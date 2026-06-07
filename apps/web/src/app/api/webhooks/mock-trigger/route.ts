import { NextRequest, NextResponse } from 'next/server';
import { calculatePaymobHMAC } from '@printing-store/core-logic';

export async function POST(request: NextRequest) {
  try {
    const { orderId, success, amountCents } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'ORDER_ID_REQUIRED' }, { status: 400 });
    }

    // 1. Construct the mock Paymob payload with correct structure
    const payload = {
      obj: {
        amount_cents: amountCents || 15000,
        created_at: new Date().toISOString(),
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        id: Math.floor(Math.random() * 1000000) + 100000,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: true,
        is_voided: false,
        order: {
          id: Math.floor(Math.random() * 1000000) + 100000,
          merchant_order_id: orderId,
        },
        owner: 7777,
        pending: false,
        source_data: {
          pan: '411111xxxxxx1111',
          sub_type: 'visa',
          type: 'card',
        },
        success: !!success,
      },
    };

    // 2. Generate cryptographically valid HMAC signature using secret
    const secret = process.env.PAYMOB_HMAC_SECRET || 'default_paymob_hmac_secret_fallback';
    const signature = calculatePaymobHMAC(payload, secret);

    // 3. Dispatch POST request to local webhook receiver gateway
    const gatewayUrl = new URL('/api/webhooks/gateway', request.url).toString();
    
    const gatewayResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'hmac': signature,
      },
      body: JSON.stringify(payload),
    });

    const result = await gatewayResponse.json();

    if (!gatewayResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'GATEWAY_DISPATCH_FAILED',
        details: result,
      }, { status: gatewayResponse.status });
    }

    return NextResponse.json({
      success: true,
      signatureVerified: true,
      gatewayResult: result,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown mock trigger error';
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', details: msg }, { status: 500 });
  }
}
