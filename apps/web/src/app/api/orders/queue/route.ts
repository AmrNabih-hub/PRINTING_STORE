import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { verifySessionToken } from '@printing-store/core-logic';
import type { Notification, PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolves the authenticated session from middleware-injected headers or
 * falls back to Bearer/cookie JWT verification (zero-trust boundary).
 */
async function getSessionFromRequest(
  request: NextRequest
): Promise<{ userId: string; role: string } | null> {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');

  if (userId && role) {
    return { userId, role };
  }

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('session_token='))
    ?.split('=')[1];

  const token = bearerToken || cookieToken;
  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    return payload
      ? { userId: payload.userId, role: payload.role }
      : null;
  } catch {
    return null;
  }
}

/**
 * SSE endpoint streaming real-time order status updates via PostgreSQL LISTEN/NOTIFY.
 *
 * Connection lifecycle:
 *   1. Acquires a dedicated pg client from the pool
 *   2. Executes LISTEN order_updates
 *   3. Pushes SSE frames on each pg notification
 *   4. On client disconnect (abort signal): UNLISTEN → release client
 *
 * Guard flags prevent double-release if both abort + cancel fire.
 */
export async function GET(request: NextRequest) {
  // ── Auth Gate ───────────────────────────────────────────────
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { userId } = session;
  const isAdmin = session.role === 'admin' || session.role === 'employee';

  // ── Dedicated PG client for persistent LISTEN channel ──────
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[SSE] Failed to acquire pool client:', err);
    return Response.json(
      { error: 'SERVICE_UNAVAILABLE' },
      { status: 503 }
    );
  }

  // Guard flags to prevent double-UNLISTEN and double-release
  let listenerActive = false;
  let released = false;

  /**
   * Safely returns the client to the pool exactly once.
   */
  const safeRelease = () => {
    if (!released) {
      released = true;
      client.release();
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      // ── Initial SSE handshake ────────────────────────────────
      controller.enqueue(encodeSSE({ type: 'connected', userId }));

      // ── Notification handler (per-row visibility scoping) ───
      const notificationHandler = (msg: Notification) => {
        if (!msg.payload) return;
        try {
          const data = JSON.parse(msg.payload);

          // Customers see only their own orders; admins/employees see all
          if (!isAdmin && data.customer_id !== userId) {
            return;
          }

          controller.enqueue(
            encodeSSE({
              type: 'order_update',
              orderId: data.id,
              status: data.status,
              updatedAt: data.updated_at,
            })
          );
        } catch (parseErr) {
          console.error('[SSE] Notification parse error:', parseErr);
        }
      };

      client.on('notification', notificationHandler);

      // ── Subscribe to the pg channel ─────────────────────────
      try {
        await client.query('LISTEN order_updates');
        listenerActive = true;
      } catch (listenErr) {
        console.error('[SSE] Failed to LISTEN order_updates:', listenErr);
        controller.close();
        safeRelease();
        return;
      }

      // ── 30s heartbeat keepalive (proxy/LB idle timeout) ─────
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encodeSSE({
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
            })
          );
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30_000);

      // ── Cleanup helper (idempotent via guard flags) ─────────
      const cleanup = async () => {
        clearInterval(heartbeatInterval);
        client.removeListener('notification', notificationHandler);

        if (listenerActive) {
          listenerActive = false;
          try {
            await client.query('UNLISTEN order_updates');
          } catch (unlistenErr) {
            console.error('[SSE] UNLISTEN failed:', unlistenErr);
          }
        }

        try {
          controller.close();
        } catch {
          // Stream may already be closed — swallow safely
        }

        safeRelease();
      };

      // ── Abort signal: fires when the browser disconnects ────
      request.signal.addEventListener('abort', () => {
        // Intentionally fire-and-forget; errors are logged inside cleanup()
        void cleanup();
      });
    },

    cancel() {
      // Fallback: ReadableStream cancelled directly by the runtime
      if (listenerActive) {
        listenerActive = false;
        client
          .query('UNLISTEN order_updates')
          .catch((err: unknown) =>
            console.error('[SSE] UNLISTEN in cancel():', err)
          );
      }
      safeRelease();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Encodes a JSON payload into SSE wire format:
 *   data: {"type":"...","orderId":"..."}\n\n
 */
function encodeSSE(data: Record<string, unknown>): Uint8Array {
  const text = `data: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(text);
}
