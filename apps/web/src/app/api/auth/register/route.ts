import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@/lib/cloudflare';
import { users, profiles } from '@printing-store/core-logic/src/schema';
import { UserRegisterSchema, signSessionToken, getSessionCookieConfig } from '@printing-store/core-logic';

function hashPassword(password: string): string {
  const iterations = 100000;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return `${iterations}:${salt}:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = z.record(z.any()).parse(await request.json());
    const result = UserRegisterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', details: result.error.format() },
        { status: 400 }
      );
    }

    const { email, password, fullName } = result.data;

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);

    // Check if user already exists
    const checkUser = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).get();
    if (checkUser) {
      return NextResponse.json({ error: 'EMAIL_ALREADY_EXISTS' }, { status: 400 });
    }

    const pwHash = hashPassword(password);
    const userId = crypto.randomUUID();
    const role = 'customer' as const;

    // D1 Transactions (batch)
    await db.batch([
      db.insert(users).values({
        id: userId,
        email,
        passwordHash: pwHash,
      }),
      db.insert(profiles).values({
        id: userId,
        email,
        fullName,
        role,
      }).onConflictDoUpdate({
        target: profiles.id,
        set: { fullName, role }
      })
    ]);

    const payload = {
      userId,
      email,
      role,
    };

    const token = await signSessionToken(payload, 86400);

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        role,
      },
    }, { status: 201 });

    const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

    response.cookies.set({
      name: 'session_token',
      value: token,
      ...getSessionCookieConfig(isSecure, 86400),
    });

    return response;

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: errMsg },
      { status: 500 }
    );
  }
}
