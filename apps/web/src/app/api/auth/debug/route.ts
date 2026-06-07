import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@printing-store/core-logic';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  const cookieToken = request.cookies.get('session_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || cookieToken;

  let verifiedPayload = null;
  let verificationError = null;

  if (token) {
    try {
      verifiedPayload = await verifySessionToken(token);
    } catch (err: any) {
      verificationError = err.message;
    }
  }

  return NextResponse.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      HAS_JWT_SECRET: !!process.env.JWT_SECRET,
      JWT_SECRET_LENGTH: process.env.JWT_SECRET?.length || 0,
    },
    cookies: request.cookies.getAll().map(c => ({ name: c.name, value: c.value ? c.value.substring(0, 10) + '...' : '' })),
    tokenExists: !!token,
    verifiedPayload,
    verificationError,
  });
}
