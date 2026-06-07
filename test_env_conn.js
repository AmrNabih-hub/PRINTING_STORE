const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('.env file not found');
    return;
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  console.log('ENV values:');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_DATABASE:', process.env.DB_DATABASE);

  // Connect using localhost:5433
  const port = 5433;
  const host = 'localhost';

  const client = new Client({
    host: host,
    port: port,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'supersecretpassword',
    database: process.env.DB_DATABASE || 'printing_store',
  });

  try {
    console.log(`Connecting to ${host}:${port}...`);
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT email, role FROM public.profiles;');
    console.log('Profiles in this database:', res.rows);
    const matRes = await client.query('SELECT id, name, type, cost_per_unit, stock_level FROM public.materials;');
    console.log('Materials in this database:', matRes.rows);
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await client.end();
  }
}

main();
