import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  status: string;
  width_cm: string;
  height_cm: string;
  file_url: string;
  price_egp: string;
  discount_applied_egp: string;
  price_breakdown: any;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Resolve Auth user from headers injected by middleware
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // 2. Parse pagination query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // 3. Query user orders
    const countRes = await query(
      'SELECT COUNT(*) FROM public.orders WHERE customer_id = $1',
      [userId]
    );
    const totalCount = parseInt(countRes.rows[0]?.count || '0', 10);

    const ordersRes = await query(
      `SELECT id, status, width_cm, height_cm, file_url, price_egp, 
              discount_applied_egp, price_breakdown, created_at
       FROM public.orders
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const orders = (ordersRes.rows as OrderRow[]).map(row => ({
      id: row.id,
      status: row.status,
      widthCm: parseFloat(row.width_cm),
      heightCm: parseFloat(row.height_cm),
      fileUrl: row.file_url,
      priceEgp: parseFloat(row.price_egp),
      discountAppliedEgp: parseFloat(row.discount_applied_egp),
      priceBreakdown: typeof row.price_breakdown === 'string' 
        ? JSON.parse(row.price_breakdown) 
        : row.price_breakdown,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Failed to retrieve order history:', error);
    return NextResponse.json(
      { error: 'DATABASE_ERROR', details: msg },
      { status: 500 }
    );
  }
}
