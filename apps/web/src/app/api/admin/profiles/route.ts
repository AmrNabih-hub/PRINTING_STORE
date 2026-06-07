import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@/lib/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { profiles } from '@printing-store/core-logic/src/schema';
import { verifySessionToken } from '@printing-store/core-logic';

export const runtime = 'edge';

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
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);
    const allProfiles = await db.select().from(profiles).all();

    return NextResponse.json({ profiles: allProfiles });
  } catch (error: any) {
    return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
  }
}
