/**
 * Stateless Database-backed Idempotency Lock implementation.
 * Ensures double-charging and order duplication are trapped at the database level.
 *
 * Uses atomic INSERT ... ON CONFLICT to guarantee exactly-once semantics
 * even across stateless serverless containers behind a load balancer.
 */
import type { PoolClient } from 'pg';

export interface IdempotencyLockResult {
  status: 'acquired' | 'processing' | 'completed';
  response?: Record<string, unknown>;
}

/**
 * Attempts to acquire an atomic idempotency lock inside the active database client transaction.
 * Automatically handles purging expired keys before insertion.
 *
 * @returns `acquired` — fresh lock obtained; proceed with order creation.
 * @returns `processing` — another in-flight request holds the lock (409 Conflict).
 * @returns `completed` — original response is available for replay (201 replay).
 */
export async function acquireIdempotencyLock(
  client: PoolClient,
  key: string,
  ttlMinutes: number = 5
): Promise<IdempotencyLockResult> {
  // Clean up any expired keys first (garbage collection)
  await client.query("DELETE FROM public.idempotency_keys WHERE expires_at < NOW()");

  // Try to insert the idempotency key with status 'processing'
  const insertQuery = `
    INSERT INTO public.idempotency_keys (key, status, expires_at)
    VALUES ($1, 'processing', NOW() + CAST($2 || ' minutes' AS INTERVAL))
    ON CONFLICT (key) DO NOTHING
    RETURNING status, response
  `;

  const insertRes = await client.query(insertQuery, [key, ttlMinutes]);

  if (insertRes.rows.length > 0) {
    return { status: 'acquired' };
  }

  // Key already exists (conflict occurred), query the current status
  const selectQuery = `
    SELECT status, response 
    FROM public.idempotency_keys 
    WHERE key = $1
  `;
  const selectRes = await client.query(selectQuery, [key]);

  if (selectRes.rows.length === 0) {
    // If the key was deleted/expired concurrently, recursively try to acquire again
    return acquireIdempotencyLock(client, key, ttlMinutes);
  }

  const row = selectRes.rows[0];
  return {
    status: row.status as 'processing' | 'completed',
    response: row.response,
  };
}

/**
 * Commits the cached response and sets the key's status to 'completed'.
 * Must be called inside the same transaction as the order insertion.
 */
export async function commitIdempotency(
  client: PoolClient,
  key: string,
  responsePayload: Record<string, unknown>
): Promise<void> {
  const updateQuery = `
    UPDATE public.idempotency_keys
    SET status = 'completed', response = $2
    WHERE key = $1
  `;
  await client.query(updateQuery, [key, JSON.stringify(responsePayload)]);
}

/**
 * Wipes/deletes the idempotency key if the operation failed, permitting subsequent retries.
 * Should be called in error/rollback paths.
 */
export async function rollbackIdempotency(
  client: PoolClient,
  key: string
): Promise<void> {
  const deleteQuery = `
    DELETE FROM public.idempotency_keys
    WHERE key = $1
  `;
  await client.query(deleteQuery, [key]);
}
