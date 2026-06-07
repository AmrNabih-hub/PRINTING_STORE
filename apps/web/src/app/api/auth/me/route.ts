import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@printing-store/core-logic';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@/lib/cloudflare';
import { profiles } from '@printing-store/core-logic/src/schema';

export async function GET(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('session_token')?.value;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const payload = await verifySessionToken(token);

    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const userId = (payload as any).userId;
    const email = (payload as any).email;

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);

    // Query profile for real-time full_name, role, avatar_url and validation
    const profile = await db.select({
      fullName: profiles.fullName,
      role: profiles.role,
      avatarUrl: profiles.avatarUrl
    }).from(profiles).where(eq(profiles.id, userId)).limit(1).get();

    if (!profile) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userId,
        email: email,
        role: profile.role,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
      },
    });

  } catch (error: unknown) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
