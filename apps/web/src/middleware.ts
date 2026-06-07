import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, signSessionToken, shouldRollToken, getSessionCookieConfig } from '@printing-store/core-logic';

const PROTECTED_PATH_PREFIXES = [
  { prefix: '/ops/admin', roles: ['admin'] },
  { prefix: '/ops/fulfillment', roles: ['employee', 'admin'] },
  { prefix: '/ops/courier', roles: ['courier', 'admin'] },
  { prefix: '/dashboard', roles: ['admin', 'employee', 'courier', 'customer'] },
  { prefix: '/upload', roles: ['admin', 'employee', 'courier', 'customer'] },
  { prefix: '/gallery', roles: ['admin', 'employee', 'courier', 'customer'] },
  { prefix: '/checkout', roles: ['admin', 'employee', 'courier', 'customer'] },
  { prefix: '/orders', roles: ['admin', 'employee', 'courier', 'customer'] },
  { prefix: '/api/admin', roles: ['admin'] },
  { prefix: '/api/orders/assigned', roles: ['employee', 'admin'] },
  { prefix: '/api/orders/update-state', roles: ['employee', 'admin'] },
];

function verifyCors(request: NextRequest): boolean {
  const method = request.method;
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  if (!isMutating) return true;

  // Exempt Bearer authentication from CORS verification
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return true;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host') || '';
  const allowedOrigin = process.env.ALLOWED_ORIGIN;

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host || (allowedOrigin && origin === allowedOrigin)) {
        return true;
      }
    } catch {
      return false;
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host || (allowedOrigin && referer.startsWith(allowedOrigin))) {
        return true;
      }
    } catch {
      return false;
    }
  } else {
    // Both Origin and Referer are missing on cookie-auth mutating API request -> Suspicious
    return false;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. CORS check for API requests
  if (pathname.startsWith('/api/') && !verifyCors(request)) {
    return NextResponse.json({ error: 'CORS_REJECTED' }, { status: 403 });
  }

  // 2. Auth Resolution: Priority Bearer header, fallback Cookie
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = request.cookies.get('session_token')?.value;
  const token = bearerToken || cookieToken;

  let payload = null;
  if (token) {
    payload = await verifySessionToken(token);
  }

  // 3. Match Protected Paths
  const matchedRule = PROTECTED_PATH_PREFIXES.find(rule => pathname.startsWith(rule.prefix));

  // Determine if authentication is needed (explicit rule or /api/orders check)
  const isAuthRequired = matchedRule || pathname.startsWith('/api/orders');

  if (isAuthRequired) {
    if (pathname.startsWith('/api/')) {
      // API Route Protection
      if (!payload) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
      if (matchedRule && !matchedRule.roles.includes(payload.role)) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
    } else {
      // Pages / Visual Layer Route Protection with Silent Redirection Fallbacks
      if (!payload) {
        // Unauthenticated -> Redirect silently to landing page
        return NextResponse.redirect(new URL('/', request.url));
      }
      if (matchedRule && !matchedRule.roles.includes(payload.role)) {
        // Authenticated but role unauthorized -> Redirect silently to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // 4. Passive Token Rolling
  let rolledToken = null;
  if (payload && payload.exp && shouldRollToken(payload.exp, 6)) {
    const cleanPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    rolledToken = await signSessionToken(cleanPayload, 86400); // refresh to 24h
  }

  // 5. Pass down parsed user context in request headers for downstream handlers
  const requestHeaders = new Headers(request.headers);
  if (payload) {
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-email', payload.email);
  }
  if (rolledToken) {
    requestHeaders.set('x-refreshed-token', rolledToken);
  }

  // 6. Create response and inject rolled tokens
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (rolledToken) {
    if (bearerToken) {
      // Detached Client: Send in response header
      response.headers.set('X-Refreshed-Token', rolledToken);
    } else {
      // Browser Client: Set refreshed cookie dynamically
      const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
      response.cookies.set({
        name: 'session_token',
        value: rolledToken,
        ...getSessionCookieConfig(isSecure, 86400),
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/upload/:path*',
    '/gallery/:path*',
    '/checkout/:path*',
    '/orders/:path*',
    '/ops/:path*',
    '/api/:path*',
  ],
};
