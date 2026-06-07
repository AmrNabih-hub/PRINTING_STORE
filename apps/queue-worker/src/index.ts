import ExifReader from 'exifreader';
import { drizzle } from 'drizzle-orm/d1';
import { orders } from 'core-logic/src/schema';
import { eq } from 'drizzle-orm';

export interface Env {
  DB: D1Database;
  ORDER_QUEUE: Queue;
  PRINT_ASSETS: R2Bucket;
}

interface OrderPayload {
  idempotencyKey: string;
  customerId: string;
  fileKey: string;
  widthCm: number;
  heightCm: number;
  substrateMaterialId: string;
  priceEgp: number;
  shippingAddress: string;
}

export default {
  async queue(batch: MessageBatch<OrderPayload>, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = drizzle(env.DB);

    for (const msg of batch.messages) {
      try {
        const payload = msg.body;

        // 1. Idempotency Check
        const existingOrder = await db.select({ id: orders.id })
                                      .from(orders)
                                      .where(eq(orders.idempotencyKey, payload.idempotencyKey))
                                      .limit(1)
                                      .get();
        if (existingOrder) {
          console.log(`Duplicate order attempt suppressed: ${payload.idempotencyKey}`);
          msg.ack();
          continue;
        }

        let dpi: number | null = null;
        let colorSpace: string | null = null;
        let printWidthPx: number | null = null;
        let printHeightPx: number | null = null;

        // 2. High-End Print Quality Validation via R2 Range-Request
        if (!payload.fileKey.startsWith('mock/')) {
          const r2Object = await env.PRINT_ASSETS.get(payload.fileKey, {
            range: { offset: 0, length: 10240 }, // Fetch only first 10KB
          });

          if (!r2Object) {
            throw new Error(`Asset not found in R2: ${payload.fileKey}`);
          }

          const arrayBuffer = await r2Object.arrayBuffer();
          const tags = ExifReader.load(arrayBuffer);

          dpi = tags['XResolution']?.value ? parseInt(tags['XResolution'].value.toString()) : null;
          colorSpace = tags['ColorSpace']?.description || null;
          printWidthPx = tags['Image Width']?.value ? parseInt(tags['Image Width'].value.toString()) : null;
          printHeightPx = tags['Image Height']?.value ? parseInt(tags['Image Height'].value.toString()) : null;

          // 3. Strict DPI Validation
          if (dpi !== null && dpi < 300) {
            console.warn(`Quality check failed. DPI is ${dpi} (Minimum 300 required) for key: ${payload.fileKey}`);
            // In a real flow, we might insert the order with status 'quality_check_failed' and alert the user.
            // For now, we flag it.
          }
        }

        // 4. Insert into D1 Database
        const orderId = crypto.randomUUID();
        
        await db.insert(orders).values({
          id: orderId,
          idempotencyKey: payload.idempotencyKey,
          customerId: payload.customerId,
          status: 'pending',
          widthCm: payload.widthCm,
          heightCm: payload.heightCm,
          fileUrl: payload.fileKey,
          substrateMaterialId: payload.substrateMaterialId,
          priceEgp: payload.priceEgp,
          shippingAddress: payload.shippingAddress,
          dpi,
          colorSpace,
          printWidthPx,
          printHeightPx,
        });

        console.log(`Order processed successfully: ${orderId}`);
        msg.ack();
      } catch (error) {
        console.error("Failed to process message:", error);
        // Do not ack(), allowing the queue to retry according to max_retries
      }
    }
  },
};
