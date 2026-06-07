import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifySessionToken } from '@printing-store/core-logic';

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

export async function GET(request: NextRequest) {
  try {
    // 1. Zero-Trust verification
    const session = await getEmployeeSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // 2. Fetch assigned incomplete orders
    const res = await query(
      `SELECT o.id, o.status, o.width_cm, o.height_cm, o.file_url, o.price_egp, o.created_at, p.full_name AS customer_name
       FROM public.orders o
       JOIN public.profiles p ON o.customer_id = p.id
       WHERE o.employee_id = $1 AND o.status IN ('pending', 'processing', 'ready_for_handover')
       ORDER BY o.created_at ASC`,
      [session.userId]
    );

    const orders = res.rows.map(row => ({
      id: row.id,
      status: row.status,
      widthCm: parseFloat(row.width_cm),
      heightCm: parseFloat(row.height_cm),
      fileUrl: row.file_url,
      priceEgp: parseFloat(row.price_egp),
      createdAt: row.created_at,
      customerName: row.customer_name,
    }));

    return NextResponse.json({ orders });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Failed to fetch assigned orders:', error);
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}
