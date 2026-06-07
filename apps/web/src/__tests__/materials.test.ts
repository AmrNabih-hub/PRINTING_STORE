import { PUT } from '../app/api/admin/materials/route';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import crypto from 'crypto';
import { signSessionToken } from '@printing-store/core-logic';

describe('Admin Materials API Route Handler Integration Test', () => {
  let client: Client;
  let adminId: string;
  let token: string;
  let matId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-bytes-long';
    client = new Client({
      host: 'localhost',
      port: 5433,
      user: 'postgres',
      password: 'supersecretpassword',
      database: 'printing_store_test',
    });
    await client.connect();

    // 1. Create a temporary admin user
    const adminEmail = 'api_admin_test@example.com';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('Password123!', salt, 1000, 64, 'sha512').toString('hex');
    const pwHash = `${salt}:${hash}`;
    
    // Cleanup any leftovers
    await client.query('DELETE FROM auth.users WHERE email = $1', [adminEmail]);
    
    const insertAdmin = await client.query(
      'INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id',
      [adminEmail, pwHash, JSON.stringify({ full_name: 'API Admin' })]
    );
    adminId = insertAdmin.rows[0].id;
    await client.query("UPDATE public.profiles SET role = 'admin' WHERE id = $1", [adminId]);

    // 2. Generate a valid admin session JWT token
    token = await signSessionToken({
      userId: adminId,
      email: adminEmail,
      role: 'admin',
    });

    // 3. Insert a temporary material
    await client.query("DELETE FROM public.materials WHERE name = 'API Material Test'");
    const insertMat = await client.query(
      `INSERT INTO public.materials (name, type, unit_name, cost_per_unit, stock_level)
       VALUES ('API Material Test', 'substrate', 'sq_meter', 100, 50)
       RETURNING id`
    );
    matId = insertMat.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    try {
      await client.query("DELETE FROM public.materials WHERE id = $1", [matId]);
      await client.query("DELETE FROM auth.users WHERE id = $1", [adminId]);
    } catch (_) {}
    await client.end();
  });

  it('successfully updates an existing material via PUT route', async () => {
    const payload = {
      id: matId,
      name: 'API Material Test Updated',
      type: 'substrate',
      unit_name: 'sq_meter',
      cost_per_unit: 120.50,
      stock_level: 60.25,
    };

    const request = new NextRequest('http://localhost:3000/api/admin/materials', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_token=${token}`,
      },
      body: JSON.stringify(payload),
    });

    const response = await PUT(request);
    const data = await response.json();
    console.log('--- PUT API RESPONSE START ---');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    console.log('--- PUT API RESPONSE END ---');

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.materialId).toBe(matId);
  });
});
