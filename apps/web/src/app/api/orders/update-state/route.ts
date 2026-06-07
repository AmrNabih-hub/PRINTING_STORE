import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySessionToken, OrderStatus } from '@printing-store/core-logic';
import type { PoolClient } from 'pg';

export const dynamic = 'force-dynamic';

async function getEmployeeSession(request: NextRequest) {
  const cookieToken = request.cookies.get('session_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || cookieToken;

  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    if (!payload || (payload.role !== 'employee' && payload.role !== 'admin')) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const session = await getEmployeeSession(request);
  if (!session) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const __body = await request.json();
    const __schema = z.object({ orderId: z.any(), status: z.any() }).nonstrict();
    const { orderId, status: newStatus  } = __schema.parse(__body);

  if (!orderId || !newStatus) {
    return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
  }

  // Enforce allowed status values for employee progression
  const allowedStatuses: OrderStatus[] = ['processing', 'ready_for_handover'];
  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json({ error: 'INVALID_STATUS_MUTATION' }, { status: 400 });
  }

  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // 1. Fetch order and lock row to prevent race conditions
    const orderRes = await dbClient.query(
      `SELECT status, width_cm, height_cm, substrate_material_id, frame_material_id, complexity_score
       FROM public.orders 
       WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      dbClient.release();
      return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
    }

    const order = orderRes.rows[0];
    const currentStatus = order.status as OrderStatus;

    // 2. State Machine Transition Checks
    if (newStatus === 'processing' && currentStatus !== 'pending') {
      await dbClient.query('ROLLBACK');
      dbClient.release();
      return NextResponse.json({
        error: 'ILLEGAL_TRANSITION',
        message: 'Order must be in PENDING status to start processing.'
      }, { status: 400 });
    }

    if (newStatus === 'ready_for_handover' && currentStatus !== 'processing') {
      await dbClient.query('ROLLBACK');
      dbClient.release();
      return NextResponse.json({
        error: 'ILLEGAL_TRANSITION',
        message: 'Order must be in PROCESSING status to be marked ready.'
      }, { status: 400 });
    }

    // 3. ERP Inventory Depletion (triggered when moving from pending -> processing)
    if (newStatus === 'processing') {
      const width = parseFloat(order.width_cm);
      const height = parseFloat(order.height_cm);
      const complexity = parseFloat(order.complexity_score);

      const areaSqM = (width * height) / 10000;
      const perimeterCm = 2 * (width + height);
      const inkConsumptionMl = 10 * areaSqM * complexity;

      // A. Decrement Substrate Stock
      await dbClient.query(
        `UPDATE public.materials
         SET stock_level = stock_level - $1
         WHERE id = $2`,
        [areaSqM, order.substrate_material_id]
      );

      // Log substrate usage
      await dbClient.query(
        `INSERT INTO public.order_materials_usage (order_id, material_id, estimated_quantity, actual_quantity)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (order_id, material_id) DO NOTHING`,
        [orderId, order.substrate_material_id, areaSqM]
      );

      // B. Decrement Frame Stock (if frame is configured)
      if (order.frame_material_id) {
        await dbClient.query(
          `UPDATE public.materials
           SET stock_level = stock_level - $1
           WHERE id = $2`,
          [perimeterCm, order.frame_material_id]
        );

        // Log frame usage
        await dbClient.query(
          `INSERT INTO public.order_materials_usage (order_id, material_id, estimated_quantity, actual_quantity)
           VALUES ($1, $2, $3, $3)
           ON CONFLICT (order_id, material_id) DO NOTHING`,
          [orderId, order.frame_material_id, perimeterCm]
        );
      }

      // C. Decrement Ink Stock
      const inkRes = await dbClient.query(
        "SELECT id FROM public.materials WHERE type = 'ink' LIMIT 1"
      );
      if (inkRes.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        dbClient.release();
        return NextResponse.json({
          error: 'INK_MATERIAL_MISSING',
          message: 'Warehouse contains no registered ink materials to decrement.'
        }, { status: 500 });
      }

      const inkId = inkRes.rows[0].id;
      await dbClient.query(
        `UPDATE public.materials
         SET stock_level = stock_level - $1
         WHERE id = $2`,
        [inkConsumptionMl, inkId]
      );

      // Log ink usage
      await dbClient.query(
        `INSERT INTO public.order_materials_usage (order_id, material_id, estimated_quantity, actual_quantity)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (order_id, material_id) DO NOTHING`,
        [orderId, inkId, inkConsumptionMl]
      );
    }

    // 4. Perform Order Status Update (inherently fires pg_notify trigger)
    await dbClient.query(
      'UPDATE public.orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, orderId]
    );

    await dbClient.query('COMMIT');
    dbClient.release();

    return NextResponse.json({ success: true, orderId, status: newStatus });

  } catch (error: unknown) {
    await dbClient.query('ROLLBACK');
    dbClient.release();

    const msg = error instanceof Error ? error.message : 'Unknown database transaction error';
    console.error('Failed to update order state:', error);

    // Differentiate check constraint violations (like stock going below 0)
    if (msg.includes('violates check constraint') || msg.includes('stock_level')) {
      return NextResponse.json({
        error: 'INSUFFICIENT_STOCK',
        message: 'Warehouse stock levels are insufficient to fulfill this configuration.'
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'DATABASE_TRANSACTION_FAILED', details: msg }, { status: 500 });
  }
}
