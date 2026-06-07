import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { verifyPaymobSignature } from '@printing-store/core-logic';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Ingest Raw Body Text format to prevent Next.js JSON deserialization character corruption
    const rawBody = await request.text();
    if (!rawBody) {
      return Response.json({ error: 'EMPTY_BODY' }, { status: 400 });
    }

    // 2. Extract signature from query params or headers (Paymob uses 'hmac')
    const hmacQuery = request.nextUrl.searchParams.get('hmac') || '';
    const hmacHeader = request.headers.get('hmac') || request.headers.get('x-paymob-signature') || '';
    const signature = hmacQuery || hmacHeader;

    if (!signature) {
      return Response.json({ error: 'SIGNATURE_MISSING' }, { status: 401 });
    }

    // 3. Parse JSON safely from raw body
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    // 4. Recalculate and cryptographically verify signature
    const secret = process.env.PAYMOB_HMAC_SECRET || 'default_paymob_hmac_secret_fallback';
    const isSignatureValid = verifyPaymobSignature(payload, signature, secret);

    if (!isSignatureValid) {
      return Response.json({ error: 'UNAUTHORIZED_SIGNATURE' }, { status: 401 });
    }

    // 5. Update database state within a safe transaction block
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      // After HMAC verification, payload is trusted — cast for nested property access
      const obj = (payload.obj || payload) as Record<string, any>;
      // Get merchant order UUID mapping from payload nested fields
      const orderId = obj.order?.merchant_order_id || obj.merchant_order_id || obj.order?.id || obj.order;
      const success = String(obj.success) === 'true';

      if (!orderId) {
        await dbClient.query('ROLLBACK');
        dbClient.release();
        return Response.json({ error: 'MERCHANT_ORDER_ID_MISSING' }, { status: 400 });
      }

      // Check if order exists
      const checkRes = await dbClient.query('SELECT status FROM public.orders WHERE id = $1', [orderId]);
      if (checkRes.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        dbClient.release();
        return Response.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
      }

      const newStatus = success ? 'processing' : 'cancelled';

      // Update status
      await dbClient.query('UPDATE public.orders SET status = $1 WHERE id = $2', [newStatus, orderId]);

      await dbClient.query('COMMIT');
      dbClient.release();

      return Response.json({ success: true, orderId, status: newStatus });

    } catch (txError) {
      await dbClient.query('ROLLBACK');
      dbClient.release();
      throw txError;
    }

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook processing error:', error);
    return Response.json(
      { error: 'INTERNAL_SERVER_ERROR', message: errMsg },
      { status: 500 }
    );
  }
}
