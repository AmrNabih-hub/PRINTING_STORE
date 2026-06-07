import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@/lib/cloudflare';
import { users, profiles } from 'core-logic/src/schema';
import { UserLoginSchema, signSessionToken, getSessionCookieConfig } from '@printing-store/core-logic';

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length === 3) {
    const [iterationsStr, salt, hash] = parts;
    const iterations = parseInt(iterationsStr, 10);
    if (isNaN(iterations)) return false;
    const checkHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    return hash === checkHash;
  } else if (parts.length === 2) {
    const [salt, hash] = parts;
    const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === checkHash;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = UserLoginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', details: result.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);

    // Fetch auth user record
    const user = await db.select({
      id: users.id,
      passwordHash: users.passwordHash,
      email: users.email
    }).from(users).where(eq(users.email, email)).limit(1).get();

    if (!user) {
      return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    // Verify Password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    // Fetch corresponding profile for role assignment
    const profile = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id)).limit(1).get();

    if (!profile) {
      return NextResponse.json({ error: 'PROFILE_NOT_INITIALIZED' }, { status: 500 });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: profile.role,
    };

    const token = await signSessionToken(payload, 86400);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: profile.role,
      },
    });

    const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

    response.cookies.set({
      name: 'session_token',
      value: token,
      ...getSessionCookieConfig(isSecure, 86400),
    });

    return response;

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: errMsg },
      { status: 500 }
    );
  }
}
