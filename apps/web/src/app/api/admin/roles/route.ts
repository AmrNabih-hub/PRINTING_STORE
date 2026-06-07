import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifySessionToken, UserRole } from '@printing-store/core-logic';

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

export async function POST(request: NextRequest) {
  try {
    // 1. Zero-Trust Admin verification
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { targetUserId, newRole } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
    }

    // Validate newRole value against standard user roles
    const validRoles: UserRole[] = ['admin', 'employee', 'courier', 'customer'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 400 });
    }

    // Enforce check: an admin cannot demote themselves to prevent system locking
    if (targetUserId === session.userId && newRole !== 'admin') {
      return NextResponse.json({ error: 'SELF_DEMOTION_FORBIDDEN' }, { status: 400 });
    }

    // 3. Mutate user role
    const updateRes = await query(
      'UPDATE public.profiles SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [newRole, targetUserId]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true, targetUserId, role: newRole });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Failed to change user role:', error);
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', details: msg }, { status: 500 });
  }
}
