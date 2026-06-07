import crypto from 'crypto';

/**
 * Paymob webhook transaction payload shape.
 * Only the fields required for HMAC computation are typed;
 * the full payload is intentionally loose since gateway versions vary.
 */
export interface PaymobTransactionPayload {
  obj?: PaymobTransactionFields;
  [key: string]: unknown;
}

interface PaymobTransactionFields {
  amount_cents?: string | number;
  created_at?: string;
  currency?: string;
  error_occured?: string | boolean;
  error_occurred?: string | boolean;
  has_parent_transaction?: string | boolean;
  id?: string | number;
  integration_id?: string | number;
  is_3d_secure?: string | boolean;
  is_auth?: string | boolean;
  is_capture?: string | boolean;
  is_voided?: string | boolean;
  order?: { id?: string | number; merchant_order_id?: string } | string | number;
  owner?: string | number;
  pending?: string | boolean;
  source_data?: {
    pan?: string;
    sub_type?: string;
    type?: string;
  };
  success?: string | boolean;
  [key: string]: unknown;
}

/**
 * Calculates the Paymob HMAC-SHA512 signature using the exact lexicographical
 * concatenation order mandated by the gateway documentation.
 *
 * IMPORTANT: Paymob computes signatures against this precise concatenation —
 * NOT the raw JSON body string. Any field reordering or missing field will
 * produce a signature mismatch.
 */
export function calculatePaymobHMAC(
  payload: PaymobTransactionPayload,
  secret: string
): string {
  // Paymob webhooks send transaction variables nested in 'obj' or directly in root
  const obj = (payload.obj || payload) as PaymobTransactionFields;

  const amount_cents = String(obj.amount_cents ?? '');
  const created_at = String(obj.created_at ?? '');
  const currency = String(obj.currency ?? '');
  const error_occured = String(obj.error_occured ?? obj.error_occurred ?? 'false');
  const has_parent_transaction = String(obj.has_parent_transaction ?? 'false');
  const id = String(obj.id ?? '');
  const integration_id = String(obj.integration_id ?? '');
  const is_3d_secure = String(obj.is_3d_secure ?? 'false');
  const is_auth = String(obj.is_auth ?? 'false');
  const is_capture = String(obj.is_capture ?? 'false');
  const is_voided = String(obj.is_voided ?? 'false');

  // Nested order reference — handle both object and primitive forms
  const orderValue = obj.order;
  const orderId =
    typeof orderValue === 'object' && orderValue !== null
      ? String((orderValue as Record<string, unknown>).id ?? '')
      : String(orderValue ?? '');
  const owner = String(obj.owner ?? '');
  const pending = String(obj.pending ?? 'false');

  // Nested source data reference
  const source_pan = String(obj.source_data?.pan ?? '');
  const source_sub_type = String(obj.source_data?.sub_type ?? '');
  const source_type = String(obj.source_data?.type ?? '');

  const success = String(obj.success ?? 'false');

  // Concatenate parameters exactly in Paymob's designated lexical sequence
  const concatenated =
    amount_cents +
    created_at +
    currency +
    error_occured +
    has_parent_transaction +
    id +
    integration_id +
    is_3d_secure +
    is_auth +
    is_capture +
    is_voided +
    orderId +
    owner +
    pending +
    source_pan +
    source_sub_type +
    source_type +
    success;

  return crypto
    .createHmac('sha512', secret)
    .update(concatenated)
    .digest('hex');
}

/**
 * Performs timing-safe validation of the computed payload signature
 * against the transaction's HMAC signature.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing side-channel attacks.
 */
export function verifyPaymobSignature(
  payload: PaymobTransactionPayload,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) {
    return false;
  }
  const computed = calculatePaymobHMAC(payload, secret);
  if (computed.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'utf-8'),
    Buffer.from(signature, 'utf-8')
  );
}
