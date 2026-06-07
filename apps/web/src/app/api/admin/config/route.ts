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

// 1. GET - Fetch system settings config items
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const res = await query(
      'SELECT key, value, description, updated_at FROM public.system_config ORDER BY key'
    );

    const configs = res.rows.map(row => ({
      key: row.key,
      value: parseFloat(row.value),
      description: row.description,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ configs });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}

// 2. POST - Update a system configuration variable
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { key, value } = await request.json();

    if (!key || value === undefined || isNaN(parseFloat(value))) {
      return NextResponse.json({ error: 'INVALID_PARAMETERS' }, { status: 400 });
    }

    const parsedVal = parseFloat(value);
    if (parsedVal < 0) {
      return NextResponse.json({ error: 'VALUE_CANNOT_BE_NEGATIVE' }, { status: 400 });
    }

    const updateRes = await query(
      `INSERT INTO public.system_config (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
       RETURNING key`,
      [key, parsedVal, session.userId]
    );

    return NextResponse.json({ success: true, key: updateRes.rows[0].key, value: parsedVal });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Failed to update system config:', error);
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}
