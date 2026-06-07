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

export async function GET(request: NextRequest) {
  try {
    // Zero-Trust Admin verification
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const profilesRes = await query(
      'SELECT id, email, full_name, role, created_at FROM public.profiles ORDER BY role, full_name'
    );

    const profiles = profilesRes.rows.map(row => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ profiles });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}
