import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@/lib/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, count } from 'drizzle-orm';
import { orders as ordersSchema } from '@printing-store/core-logic/src/schema';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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

    // 3. Connect to D1 via Drizzle
    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);

    // 4. Query total count
    const totalCountRes = await db
      .select({ value: count() })
      .from(ordersSchema)
      .where(eq(ordersSchema.customerId, userId));
    const totalCount = totalCountRes[0]?.value || 0;

    // 5. Query orders
    const ordersData = await db
      .select({
        id: ordersSchema.id,
        status: ordersSchema.status,
        widthCm: ordersSchema.widthCm,
        heightCm: ordersSchema.heightCm,
        fileUrl: ordersSchema.fileUrl,
        priceEgp: ordersSchema.priceEgp,
        discountAppliedEgp: ordersSchema.discountAppliedEgp,
        priceBreakdown: ordersSchema.priceBreakdown,
        createdAt: ordersSchema.createdAt,
      })
      .from(ordersSchema)
      .where(eq(ordersSchema.customerId, userId))
      .orderBy(desc(ordersSchema.createdAt))
      .limit(limit)
      .offset(offset);

    const orders = ordersData.map(row => ({
      ...row,
      priceBreakdown: typeof row.priceBreakdown === 'string'
        ? JSON.parse(row.priceBreakdown)
        : row.priceBreakdown,
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
