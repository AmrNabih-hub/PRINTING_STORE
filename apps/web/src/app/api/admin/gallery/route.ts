import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifySessionToken } from '@printing-store/core-logic';

export const dynamic = 'force-dynamic';

async function getAdminSession(request: NextRequest) {
  const cookieToken = request.cookies.get('session_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || cookieToken;

  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    if (!payload || payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

// 1. GET - Fetch the queue of orders waiting for gallery review/approval
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Retrieve AI-approved orders requesting gallery opt-in
    // that don't already have an approved gallery item
    const auditRes = await query(
      `SELECT o.id, o.file_url, o.width_cm, o.height_cm, o.created_at, p.full_name AS artist_name, p.id AS customer_id
       FROM public.orders o
       JOIN public.profiles p ON o.customer_id = p.id
       WHERE o.is_gallery_opt_in = true 
         AND o.ai_status = 'approved'
         AND NOT EXISTS (
           SELECT 1 FROM public.gallery_items gi 
           WHERE gi.id = o.id AND gi.is_approved = true
         )
       ORDER BY o.created_at DESC`
    );

    const queue = auditRes.rows.map(row => ({
      orderId: row.id,
      fileUrl: row.file_url,
      widthCm: parseFloat(row.width_cm),
      heightCm: parseFloat(row.height_cm),
      createdAt: row.created_at,
      artistName: row.artist_name,
      customerId: row.customer_id,
    }));

    return NextResponse.json({ queue });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}

// 2. POST - Publish an order to the public gallery
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { orderId, title, description } = await request.json();

    if (!orderId || !title || !description) {
      return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
    }

    // Verify the order qualifies (must exist, AI approved, is_gallery_opt_in = true)
    const orderRes = await query(
      'SELECT customer_id, file_url FROM public.orders WHERE id = $1 AND is_gallery_opt_in = true AND ai_status = $2',
      [orderId, 'approved']
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'ORDER_NOT_ELIGIBLE' }, { status: 400 });
    }

    const { customer_id, file_url } = orderRes.rows[0];

    // Atomically insert/update the gallery items table
    await query(
      `INSERT INTO public.gallery_items (id, customer_id, image_url, title, description, is_approved, approved_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           description = EXCLUDED.description,
           is_approved = true,
           approved_by = EXCLUDED.approved_by,
           updated_at = CURRENT_TIMESTAMP`,
      [orderId, customer_id, file_url, title, description, session.userId]
    );

    return NextResponse.json({ success: true, orderId, published: true });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Failed to publish gallery item:', error);
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}
