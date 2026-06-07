const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'supersecretpassword',
  database: process.env.DB_DATABASE || 'printing_store',
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const client = await pool.connect();
  try {
    const email = 'admin@example.com';
    const password = 'Password123!';
    const fullName = 'Test Admin';

    // 1. Delete if exists
    await client.query('DELETE FROM auth.users WHERE email = $1', [email]);
    console.log('Cleared existing admin user if any.');

    // 2. Hash & Insert into auth.users
    const pwHash = hashPassword(password);
    const metaData = JSON.stringify({ full_name: fullName });
    const insertRes = await client.query(
      'INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id',
      [email, pwHash, metaData]
    );
    const userId = insertRes.rows[0].id;
    console.log(`Registered user in auth.users with ID: ${userId}`);

    // 3. Promote role to admin in public.profiles
    await client.query(
      "UPDATE public.profiles SET role = 'admin' WHERE id = $1",
      [userId]
    );
    console.log('User promoted to role: admin.');

  } catch (err) {
    console.error('Failed to create admin user:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
