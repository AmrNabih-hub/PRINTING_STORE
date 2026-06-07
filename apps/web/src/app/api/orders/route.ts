import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@/lib/cloudflare';
import { verifySessionToken } from '@printing-store/core-logic';

async function getSessionFromRequest(request: NextRequest): Promise<{ userId: string; email: string; role: string } | null> {
  const userId = request.headers.get('x-user-id');
  const email = request.headers.get('x-user-email');
  const role = request.headers.get('x-user-role');

  if (userId && email && role) {
    return { userId, email, role };
  }

  // Zero-trust fallback parsing if middleware didn't run
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieToken = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('session_token='))
    ?.split('=')[1];

  const token = bearerToken || cookieToken;
  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    return payload ? { userId: payload.userId, email: payload.email, role: payload.role } : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const idempotencyKey = request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
    }

    // Verify it's a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      return NextResponse.json({ error: 'INVALID_IDEMPOTENCY_KEY_FORMAT' }, { status: 400 });
    }

    // 1. Resolve Session
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = z.record(z.any()).parse(await request.json());

    // 2. Validate essential fields (basic validation before queuing)
    if (!body.file_url || !body.width_cm || !body.height_cm || !body.substrate_material_id) {
      return NextResponse.json({ error: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
    }

    // 3. Connect to Cloudflare Bindings
    const { ORDER_QUEUE } = await getCloudflareContext();

    if (!ORDER_QUEUE) {
      console.error("ORDER_QUEUE binding is undefined. Are you running with wrangler dev?");
      return NextResponse.json({ error: 'QUEUE_UNAVAILABLE' }, { status: 503 });
    }

    // 4. Construct Order Payload for the Queue
    // In a full implementation, we'd calculate priceEgp securely here or inside the Worker
    // For this architecture step, we pass the raw data to the Queue Worker for async processing.
    const orderPayload = {
      idempotencyKey,
      customerId: session.userId,
      fileKey: body.file_url, // Maps to R2 key (or mock key)
      widthCm: body.width_cm,
      heightCm: body.height_cm,
      substrateMaterialId: body.substrate_material_id,
      shippingAddress: body.shipping_address || 'TBD',
      priceEgp: body.estimated_price || 0, // Placeholder, queue worker should ideally recalculate or we pass calculated
    };

    // 5. Publish to Cloudflare Queue
    await ORDER_QUEUE.send(orderPayload);

    // 6. Return 202 Accepted instantly
    return NextResponse.json({
      success: true,
      message: 'Order accepted for processing',
      idempotencyKey,
      status: 'pending_processing'
    }, { status: 202 });

  } catch (error) {
    console.error('Order enqueue error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
