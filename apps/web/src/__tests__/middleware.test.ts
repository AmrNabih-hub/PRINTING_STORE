import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';
import { signSessionToken } from '@printing-store/core-logic';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Edge Middleware Security Guards', () => {
  beforeAll(() => {
    // Set matching secrets for test verification
    process.env.JWT_SECRET = 'default-fallback-jwt-secret-key-32-bytes';
    process.env.ALLOWED_ORIGIN = 'http://localhost:3000';
  });

  it('redirects unauthenticated user trying to access /dashboard silently to /', async () => {
    const req = new NextRequest(new Request('http://localhost:3000/dashboard'));
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('allows authenticated user with customer role to access /dashboard', async () => {
    const token = await signSessionToken({
      userId: '920b78c9-fa53-4886-90ee-c5b57d6b38c2',
      email: 'customer@test.com',
      role: 'customer',
    });

    const req = new NextRequest(new Request('http://localhost:3000/dashboard'), {
      headers: {
        cookie: `session_token=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
    // Next.js serializes request header overrides with 'x-middleware-request-' prefix on the NextResponse object
    expect(res.headers.get('x-middleware-request-x-user-id')).toBe('920b78c9-fa53-4886-90ee-c5b57d6b38c2');
    expect(res.headers.get('x-middleware-request-x-user-role')).toBe('customer');
  });

  it('redirects authenticated customer trying to access /ops/admin silently to /dashboard', async () => {
    const token = await signSessionToken({
      userId: '920b78c9-fa53-4886-90ee-c5b57d6b38c2',
      email: 'customer@test.com',
      role: 'customer',
    });

    const req = new NextRequest(new Request('http://localhost:3000/ops/admin'), {
      headers: {
        cookie: `session_token=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('allows admin role to access /ops/admin', async () => {
    const token = await signSessionToken({
      userId: 'a3928a38-c67d-411a-8cfa-5b12da61bb89',
      email: 'admin@test.com',
      role: 'admin',
    });

    const req = new NextRequest(new Request('http://localhost:3000/ops/admin'), {
      headers: {
        cookie: `session_token=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-request-x-user-role')).toBe('admin');
  });

  it('rejects cross-site POST requests under /api/* without Authorization header', async () => {
    const req = new NextRequest(new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        origin: 'http://malicious-site.com',
      },
    }));

    const res = await middleware(req);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toBe('CORS_REJECTED');
  });

  it('allows cross-site mutating requests when Authorization: Bearer is present', async () => {
    const token = await signSessionToken({
      userId: '920b78c9-fa53-4886-90ee-c5b57d6b38c2',
      email: 'customer@test.com',
      role: 'customer',
    });

    const req = new NextRequest(new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        origin: 'http://some-external-app.com',
        authorization: `Bearer ${token}`,
      },
    }));

    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-request-x-user-id')).toBe('920b78c9-fa53-4886-90ee-c5b57d6b38c2');
  });

  it('rolls session token when valid cookie is within 6 hour expiration threshold', async () => {
    // Expiry in 2 hours (within 6h threshold)
    const token = await signSessionToken({
      userId: '920b78c9-fa53-4886-90ee-c5b57d6b38c2',
      email: 'customer@test.com',
      role: 'customer',
    }, 2 * 60 * 60);

    const req = new NextRequest(new Request('http://localhost:3000/dashboard'), {
      headers: {
        cookie: `session_token=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);

    // Verify rolling response set new cookie
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('session_token=');
  });
});
