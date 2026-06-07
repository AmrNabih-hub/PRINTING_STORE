import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface GalleryRow {
  id: string;
  image_url: string;
  title: string;
  description: string | null;
  created_at: string;
  artist_name: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50); // Cap limit at 50 to prevent RAM exhaustion
    const offset = (page - 1) * limit;

    // 1. Get total count for pagination calculations
    const countRes = await query(
      'SELECT COUNT(*) FROM public.gallery_items WHERE is_approved = true'
    );
    const totalCount = parseInt(countRes.rows[0]?.count || '0', 10);

    // 2. Fetch approved gallery items joined with artist profile names
    const itemsRes = await query(
      `SELECT gi.id, gi.image_url, gi.title, gi.description, gi.created_at, p.full_name AS artist_name
       FROM public.gallery_items gi
       JOIN public.profiles p ON gi.customer_id = p.id
       WHERE gi.is_approved = true
       ORDER BY gi.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const items = (itemsRes.rows as GalleryRow[]).map(row => ({
      id: row.id,
      imageUrl: row.image_url,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      artistName: row.artist_name,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Failed to retrieve public gallery items:', error);
    return NextResponse.json(
      { error: 'DATABASE_ERROR', details: msg },
      { status: 500 }
    );
  }
}
