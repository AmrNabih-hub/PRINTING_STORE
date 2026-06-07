import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySessionToken } from '@printing-store/core-logic';

export const dynamic = 'force-dynamic';

interface BillingData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  city?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
}

interface PaymobRequestBody {
  orderId: string;
  paymentMethod: 'card' | 'wallet' | 'kiosk';
  billingData: BillingData;
  walletNumber?: string;
}

async function getSessionFromRequest(request: NextRequest) {
  const cookieToken = request.cookies.get('session_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || cookieToken;

  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Resolve and authenticate user session
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // 2. Parse request body
    const body = (await request.json()) as PaymobRequestBody;
    const { orderId, paymentMethod, billingData, walletNumber } = body;

    if (!orderId || !paymentMethod || !billingData) {
      return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
    }

    const allowedMethods = ['card', 'wallet', 'kiosk'];
    if (!allowedMethods.includes(paymentMethod)) {
      return NextResponse.json({ error: 'INVALID_PAYMENT_METHOD' }, { status: 400 });
    }

    // 3. Secure DB Order lookup and validation (Step B)
    const orderRes = await pool.query(
      `SELECT o.price_egp, o.status, o.customer_id, p.email, p.full_name
       FROM public.orders o
       JOIN public.profiles p ON o.customer_id = p.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // Enforce check: Order must belong to the logged-in customer (or admin)
    if (order.customer_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Enforce check: Order must be in pending status
    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'ORDER_ALREADY_PROCESSED' }, { status: 400 });
    }

    const amountCents = Math.round(parseFloat(order.price_egp as string) * 100);

    // Paymob Integration Credentials
    const apiKey = process.env.PAYMOB_API_KEY;
    const isMock = !apiKey || apiKey === 'mock' || apiKey.startsWith('default');

    const cardIntegrationId = parseInt(process.env.PAYMOB_INTEGRATION_ID_CARD || '0', 10);
    const walletIntegrationId = parseInt(process.env.PAYMOB_INTEGRATION_ID_WALLET || '0', 10);
    const kioskIntegrationId = parseInt(process.env.PAYMOB_INTEGRATION_ID_KIOSK || '0', 10);
    const iframeId = process.env.PAYMOB_IFRAME_ID || '0';

    const orderFullName = order.full_name as string;
    const firstName = billingData.firstName || orderFullName.split(' ')[0] || 'Customer';
    const lastName = billingData.lastName || orderFullName.split(' ')[1] || 'Store';
    const email = billingData.email || (order.email as string) || 'customer@example.com';
    const phoneNumber = billingData.phoneNumber || '+201000000000';
    const city = billingData.city || 'Cairo';
    const street = billingData.street || 'Maadi';
    const building = billingData.building || '1';
    const floor = billingData.floor || '1';
    const apartment = billingData.apartment || '1';

    // Compute return URL based on configured host
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost';
    const returnUrl = `${siteUrl}/dashboard`;

    if (isMock) {
      // Return simulated mock payload matching Paymob structure
      const mockPaymobOrderId = Math.floor(Math.random() * 10000000).toString();
      const mockPaymentToken = 'mock_payment_token_' + Math.random().toString(36).substring(2);

      if (paymentMethod === 'card') {
        const iframeUrl = `/checkout?mock_iframe=true&payment_token=${mockPaymentToken}&order_id=${orderId}`;
        return NextResponse.json({ success: true, paymentMethod, redirectUrl: iframeUrl, paymobOrderId: mockPaymobOrderId });
      } else if (paymentMethod === 'wallet') {
        const walletRedirectUrl = `/checkout?mock_wallet=true&order_id=${orderId}&wallet=${walletNumber || phoneNumber}`;
        return NextResponse.json({ success: true, paymentMethod, redirectUrl: walletRedirectUrl, paymobOrderId: mockPaymobOrderId });
      } else {
        return NextResponse.json({
          success: true,
          paymentMethod,
          billReference: 'MASARY-' + Math.floor(100000 + Math.random() * 900000).toString(),
          paymobOrderId: mockPaymobOrderId
        });
      }
    }

    // --- REAL PAYMOB API CALLS ---

    // Step A: Authentication Token Request
    const authRes = await fetch('https://egypt.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });

    if (!authRes.ok) {
      const errorText = await authRes.text();
      return NextResponse.json({ error: 'PAYMOB_AUTH_FAILED', details: errorText }, { status: 502 });
    }

    const authData = (await authRes.json()) as { token: string };
    const authToken = authData.token;

    // Step B: Paymob Order Registration
    const registerRes = await fetch('https://egypt.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: 'false',
        amount_cents: amountCents.toString(),
        currency: 'EGP',
        merchant_order_id: orderId,
        items: [],
      }),
    });

    if (!registerRes.ok) {
      const errorText = await registerRes.text();
      return NextResponse.json({ error: 'PAYMOB_ORDER_REGISTRATION_FAILED', details: errorText }, { status: 502 });
    }

    const paymobOrder = (await registerRes.json()) as { id: number };
    const paymobOrderId = paymobOrder.id.toString();

    // Determine target integration ID based on payment intent
    let integrationId = cardIntegrationId;
    if (paymentMethod === 'wallet') integrationId = walletIntegrationId;
    if (paymentMethod === 'kiosk') integrationId = kioskIntegrationId;

    // Step C: Payment Key Generation (Including explicit return_url)
    const keyRes = await fetch('https://egypt.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amountCents.toString(),
        expiration: 3600,
        order_id: paymobOrderId,
        billing_data: {
          apartment,
          email,
          floor,
          first_name: firstName,
          street,
          building,
          phone_number: phoneNumber,
          shipping_method: 'PKG',
          postal_code: '11511',
          city,
          country: 'EG',
          last_name: lastName,
          state: city,
        },
        currency: 'EGP',
        integration_id: integrationId,
        return_url: returnUrl,
      }),
    });

    if (!keyRes.ok) {
      const errorText = await keyRes.text();
      return NextResponse.json({ error: 'PAYMOB_PAYMENT_KEY_FAILED', details: errorText }, { status: 502 });
    }

    const keyData = (await keyRes.json()) as { token: string };
    const paymentKeyToken = keyData.token;

    // Step D: Branch on payment type to generate URLs
    if (paymentMethod === 'card') {
      const iframeUrl = `https://egypt.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKeyToken}`;
      return NextResponse.json({ success: true, paymentMethod, redirectUrl: iframeUrl, paymobOrderId });
    } else if (paymentMethod === 'wallet') {
      const walletRes = await fetch('https://egypt.paymob.com/api/acceptance/payments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: {
            identifier: walletNumber || phoneNumber,
            subtype: 'WALLET',
          },
          payment_token: paymentKeyToken,
        }),
      });

      if (!walletRes.ok) {
        const errorText = await walletRes.text();
        return NextResponse.json({ error: 'PAYMOB_WALLET_PAY_FAILED', details: errorText }, { status: 502 });
      }

      const walletData = (await walletRes.json()) as { redirect_url?: string; pending_url?: string };
      const redirectUrl = walletData.redirect_url || walletData.pending_url;
      return NextResponse.json({
        success: true,
        paymentMethod,
        redirectUrl,
        paymobOrderId
      });
    } else if (paymentMethod === 'kiosk') {
      const kioskRes = await fetch('https://egypt.paymob.com/api/acceptance/payments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: {
            identifier: 'AGGREGATOR',
            subtype: 'AMAN',
          },
          payment_token: paymentKeyToken,
        }),
      });

      if (!kioskRes.ok) {
        const errorText = await kioskRes.text();
        return NextResponse.json({ error: 'PAYMOB_KIOSK_PAY_FAILED', details: errorText }, { status: 502 });
      }

      const kioskData = (await kioskRes.json()) as { data?: { bill_reference?: string; reference_number?: string } };
      const billReference = kioskData.data?.bill_reference || kioskData.data?.reference_number;
      return NextResponse.json({
        success: true,
        paymentMethod,
        billReference,
        paymobOrderId
      });
    }

    return NextResponse.json({ error: 'UNSUPPORTED_PAYMENT_FLOW' }, { status: 400 });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown payment intent error';
    console.error('Paymob intent error:', error);
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: errMsg }, { status: 500 });
  }
}
