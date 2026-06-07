const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'supersecretpassword',
  database: process.env.DB_DATABASE || 'printing_store',
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Running Phase 5 Database Migrations...');
    
    // 1. Create stateless idempotency table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.idempotency_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('processing', 'completed')),
        response JSONB,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table public.idempotency_keys verified/created.');

    // 2. Create notify trigger function for order updates
    await client.query(`
      CREATE OR REPLACE FUNCTION public.notify_order_update()
      RETURNS TRIGGER AS $$
      BEGIN
          PERFORM pg_notify(
              'order_updates',
              json_build_object(
                  'id', NEW.id,
                  'status', NEW.status,
                  'customer_id', NEW.customer_id,
                  'updated_at', NEW.updated_at
              )::text
          );
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('Trigger function notify_order_update created.');

    // 3. Bind trigger to orders status modifications
    await client.query(`
      DROP TRIGGER IF EXISTS on_order_status_updated ON public.orders;
      CREATE TRIGGER on_order_status_updated
          AFTER UPDATE OF status ON public.orders
          FOR EACH ROW
          EXECUTE FUNCTION public.notify_order_update();
    `);
    console.log('Database trigger on_order_status_updated registered.');
    console.log('Migrations completed successfully.');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
