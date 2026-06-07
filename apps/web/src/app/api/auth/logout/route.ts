import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieConfig } from '@printing-store/core-logic';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Session destroyed successfully',
  });

  const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

  // Clear cookie directly on the response object using shared helper
  response.cookies.set({
    name: 'session_token',
    value: '',
    ...getSessionCookieConfig(isSecure, 0), // maxAge 0 clears the cookie immediately
  });

  return response;
}
