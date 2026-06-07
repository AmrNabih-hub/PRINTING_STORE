import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';
import crypto from 'crypto';

describe('PostgreSQL Schemas, Triggers, & Balancer Integrations', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      host: 'localhost',
      port: 5433,
      user: 'postgres',
      password: 'supersecretpassword',
      database: 'printing_store_test',
    });
    await client.connect();
  });

  beforeEach(async () => {
    // Clear database to isolate each test case execution
    await client.query('TRUNCATE auth.users CASCADE');
    await client.query('TRUNCATE public.materials CASCADE');
    await client.query('TRUNCATE public.system_config CASCADE');
  });

  afterAll(async () => {
    try {
      // 1. Re-seed system configuration keys
      const systemConfigs = [
        { key: 'markup_margin', value: 1.50, description: 'Default profit margin multiplier' },
        { key: 'service_fee', value: 50.00, description: 'Fixed handling and service fee in EGP' },
        { key: 'ai_audit_fee', value: 2.00, description: 'LLM image quality audit coverage fee in EGP' }
      ];

      for (const config of systemConfigs) {
        await client.query(`
          INSERT INTO public.system_config (key, value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP
        `, [config.key, config.value, config.description]);
      }

      // 2. Re-seed materials catalog
      const materials = [
        { name: 'Matte Canvas', type: 'substrate', unit_name: 'sq_meter', cost_per_unit: 120.00, stock_level: 1000 },
        { name: 'Glossy Photo Paper', type: 'substrate', unit_name: 'sq_meter', cost_per_unit: 85.00, stock_level: 2000 },
        { name: 'Vinyl Banner', type: 'substrate', unit_name: 'sq_meter', cost_per_unit: 150.00, stock_level: 1500 },
        { name: 'Pine Wood', type: 'frame', unit_name: 'cm', cost_per_unit: 8.00, stock_level: 5000 },
        { name: 'Aluminum', type: 'frame', unit_name: 'cm', cost_per_unit: 12.00, stock_level: 3000 },
        { name: 'Standard CMYK', type: 'ink', unit_name: 'ml', cost_per_unit: 5.00, stock_level: 100000 }
      ];

      for (const mat of materials) {
        await client.query(`
          INSERT INTO public.materials (name, type, unit_name, cost_per_unit, stock_level)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (name) DO UPDATE
          SET type = EXCLUDED.type,
              unit_name = EXCLUDED.unit_name,
              cost_per_unit = EXCLUDED.cost_per_unit,
              stock_level = EXCLUDED.stock_level,
              updated_at = CURRENT_TIMESTAMP
        `, [mat.name, mat.type, mat.unit_name, mat.cost_per_unit, mat.stock_level]);
      }

      // 3. Re-seed admin user to prevent deletion by tests
      const adminEmail = 'admin@example.com';
      const adminPassword = 'Password123!';
      const adminName = 'Test Admin';
      
      await client.query('DELETE FROM auth.users WHERE email = $1', [adminEmail]);
      
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(adminPassword, salt, 1000, 64, 'sha512').toString('hex');
      const pwHash = `${salt}:${hash}`;
      
      const insertRes = await client.query(
        'INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id',
        [adminEmail, pwHash, JSON.stringify({ full_name: adminName })]
      );
      const adminId = insertRes.rows[0].id;
      
      await client.query(
        "UPDATE public.profiles SET role = 'admin' WHERE id = $1",
        [adminId]
      );
    } catch (err) {
      console.error('Failed to restore database seeds in afterAll:', err);
    } finally {
      await client.end();
    }
  });

  it('verifies handle_new_user trigger inserts into public.profiles as customer', async () => {
    // 1. Insert a user into auth.users schema simulating signup
    const userEmail = 'test_customer@example.com';
    const insertRes = await client.query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) 
       VALUES ($1, 'hashed_pw', '{"full_name": "John Doe"}'::jsonb) 
       RETURNING id`,
      [userEmail]
    );
    const authId = insertRes.rows[0].id;

    // 2. Fetch the corresponding record from public.profiles
    const profileRes = await client.query(
      'SELECT * FROM public.profiles WHERE id = $1',
      [authId]
    );

    expect(profileRes.rows.length).toBe(1);
    expect(profileRes.rows[0].email).toBe(userEmail);
    expect(profileRes.rows[0].full_name).toBe('John Doe');
    expect(profileRes.rows[0].role).toBe('customer'); // Default role constraint assertion
  });

  it('verifies on_employee_role_assigned trigger initializes performance metrics', async () => {
    // 1. Insert an auth user
    const employeeEmail = 'test_employee@example.com';
    const insertRes = await client.query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) 
       VALUES ($1, 'hashed_pw', '{"full_name": "Worker Bob"}'::jsonb) 
       RETURNING id`,
      [employeeEmail]
    );
    const authId = insertRes.rows[0].id;

    // 2. Update the profile role to 'employee' (which triggers employee_performance initialization)
    await client.query(
      "UPDATE public.profiles SET role = 'employee' WHERE id = $1",
      [authId]
    );

    // 3. Verify public.employee_performance row exists
    const performanceRes = await client.query(
      'SELECT * FROM public.employee_performance WHERE employee_id = $1',
      [authId]
    );

    expect(performanceRes.rows.length).toBe(1);
    expect(Number(performanceRes.rows[0].efficiency_modifier)).toBe(1.00);
    expect(performanceRes.rows[0].total_orders_completed).toBe(0);
  });

  it('verifies assign_order_fairly algorithm correctly distributes load inside transaction borders', async () => {
    // 1. Setup two employees
    const emp1Res = await client.query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) 
       VALUES ('emp1@example.com', 'hashed_pw', '{"full_name": "Emp One"}'::jsonb) 
       RETURNING id`
    );
    const emp1Id = emp1Res.rows[0].id;
    await client.query("UPDATE public.profiles SET role = 'employee' WHERE id = $1", [emp1Id]);

    const emp2Res = await client.query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) 
       VALUES ('emp2@example.com', 'hashed_pw', '{"full_name": "Emp Two"}'::jsonb) 
       RETURNING id`
    );
    const emp2Id = emp2Res.rows[0].id;
    await client.query("UPDATE public.profiles SET role = 'employee' WHERE id = $1", [emp2Id]);

    // Set efficiency: employee 1 is standard (1.00), employee 2 is slow (1.50)
    await client.query(
      'UPDATE public.employee_performance SET efficiency_modifier = 1.00 WHERE employee_id = $1',
      [emp1Id]
    );
    await client.query(
      'UPDATE public.employee_performance SET efficiency_modifier = 1.50 WHERE employee_id = $1',
      [emp2Id]
    );

    // 2. Setup a customer and materials for order requirements
    const custRes = await client.query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) 
       VALUES ('buyer@example.com', 'hashed_pw', '{"full_name": "Buyer Jane"}'::jsonb) 
       RETURNING id`
    );
    const customerId = custRes.rows[0].id;

    const substrateRes = await client.query(
      `INSERT INTO public.materials (name, type, unit_name, cost_per_unit, stock_level) 
       VALUES ('Standard Substrate', 'substrate', 'sq_meter', 100, 10) 
       RETURNING id`
    );
    const substrateId = substrateRes.rows[0].id;

    // 3. Perform a fair assignment simulation when both employees have 0 workload
    // Executed inside an explicit Database Transaction Block (BEGIN -> COMMIT) to test row locking safety
    await client.query('BEGIN');
    
    const assignRes1 = await client.query('SELECT public.assign_order_fairly(1.00) as emp_id');
    const chosenEmpId1 = assignRes1.rows[0].emp_id;
    expect(chosenEmpId1).toBe(emp1Id);

    // Create an order assigned to the selected employee inside the transaction
    await client.query(
      `INSERT INTO public.orders (customer_id, employee_id, status, width_cm, height_cm, file_url, substrate_material_id, price_egp, shipping_address)
       VALUES ($1, $2, 'pending', 50, 50, 'https://example.com/art.jpg', $3, 200, 'Maadi, Cairo')`,
      [customerId, chosenEmpId1, substrateId]
    );

    await client.query('COMMIT');

    // 4. Run balancer query for the next order.
    // Now Employee 1 has workload W_1 = 1, Employee 2 has workload W_2 = 0.
    // If a new order with complexity 1.00 comes in:
    // L_1 = 1 + (1.0 * 1.0) = 2.0
    // L_2 = 0 + (1.0 * 1.5) = 1.5
    // emp2Id should now be chosen because L_2 (1.5) < L_1 (2.0)
    
    await client.query('BEGIN');
    
    const assignRes2 = await client.query('SELECT public.assign_order_fairly(1.00) as emp_id');
    const chosenEmpId2 = assignRes2.rows[0].emp_id;
    expect(chosenEmpId2).toBe(emp2Id);
    
    await client.query('COMMIT');
  });

  it('updates a material successfully', async () => {
    // 1. Insert admin user to satisfy updated_by foreign key
    const adminEmail = 'admin_update_test@example.com';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('Password123!', salt, 1000, 64, 'sha512').toString('hex');
    const pwHash = `${salt}:${hash}`;
    const insertAdmin = await client.query(
      'INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id',
      [adminEmail, pwHash, JSON.stringify({ full_name: 'Update Admin' })]
    );
    const adminId = insertAdmin.rows[0].id;
    await client.query("UPDATE public.profiles SET role = 'admin' WHERE id = $1", [adminId]);

    // 2. Insert a material
    const insertMat = await client.query(
      `INSERT INTO public.materials (name, type, unit_name, cost_per_unit, stock_level)
       VALUES ('Standard CMYK 2', 'ink', 'ml', 5, 100000)
       RETURNING id`
    );
    const matId = insertMat.rows[0].id;

    // 3. Update material
    const updateRes = await client.query(
      `UPDATE public.materials
       SET name = $1, type = $2, unit_name = $3, cost_per_unit = $4, stock_level = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING id`,
      ['Standard CMYK 3', 'ink', 'ml', 6, 110000, adminId, matId]
    );

    expect(updateRes.rows.length).toBe(1);
  });

  it('logs user profiles', async () => {
    const res = await client.query('SELECT id, email, role, full_name FROM public.profiles');
    console.log('--- PROFILES START ---');
    console.log(JSON.stringify(res.rows, null, 2));
    console.log('--- PROFILES END ---');
  });
});
