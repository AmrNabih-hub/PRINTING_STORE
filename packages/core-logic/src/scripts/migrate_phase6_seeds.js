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
    console.log('Running Phase 6 Database Seeding...');

    // 1. Insert/Update System Configuration Keys
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
      console.log(`System config key '${config.key}' seeded.`);
    }

    // Delete existing materials first to ensure static UUIDs are applied
    await client.query('DELETE FROM public.materials;');

    const materials = [
      { id: 'bb1e3900-a0ca-4658-b677-3762b9126498', name: 'Matte Canvas', type: 'substrate', unit_name: 'sq_meter', cost_per_unit: 120.00, stock_level: 1000 },
      { id: '21ef2743-8240-4c13-9971-6307db9e07e3', name: 'Glossy Photo Paper', type: 'substrate', unit_name: 'sq_meter', cost_per_unit: 85.00, stock_level: 2000 },
      { id: '67cca744-4f7f-4d6e-b23a-020db0a3e323', name: 'Vinyl Banner', type: 'substrate', unit_name: 'sq_meter', cost_per_unit: 150.00, stock_level: 1500 },
      { id: '9e9cba2b-bca0-4036-83ad-15a19a9ba331', name: 'Pine Wood', type: 'frame', unit_name: 'cm', cost_per_unit: 8.00, stock_level: 5000 },
      { id: '9e751c97-3321-4d4e-ada0-91fab9742d0c', name: 'Aluminum', type: 'frame', unit_name: 'cm', cost_per_unit: 12.00, stock_level: 3000 },
      { id: '65434472-91b4-454e-a797-07510bbaac40', name: 'Standard CMYK', type: 'ink', unit_name: 'ml', cost_per_unit: 5.00, stock_level: 100000 },
      { id: 'a914124b-9362-41c2-a7a0-b3977c7e1754', name: 'Standard Substrate', type: 'substrate', unit_name: 'sq_meter', cost_per_unit: 100.00, stock_level: 10 },
      { id: 'd2539655-bfa3-433b-8575-b6d4ad52179a', name: 'Glossy Finish', type: 'coating', unit_name: 'sq_meter', cost_per_unit: 15.00, stock_level: 1000 },
      { id: 'e52643a6-b51b-4d45-975a-bc865d491fba', name: 'Matte Finish', type: 'coating', unit_name: 'sq_meter', cost_per_unit: 15.00, stock_level: 1000 },
      { id: '192bb34a-9cf7-4fde-b567-cfa23419abcb', name: 'UV Protective Gloss', type: 'coating', unit_name: 'sq_meter', cost_per_unit: 25.00, stock_level: 1000 }
    ];

    for (const mat of materials) {
      await client.query(`
        INSERT INTO public.materials (id, name, type, unit_name, cost_per_unit, stock_level)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO UPDATE
        SET type = EXCLUDED.type,
            unit_name = EXCLUDED.unit_name,
            cost_per_unit = EXCLUDED.cost_per_unit,
            stock_level = EXCLUDED.stock_level,
            updated_at = CURRENT_TIMESTAMP
      `, [mat.id, mat.name, mat.type, mat.unit_name, mat.cost_per_unit, mat.stock_level]);
      console.log(`Material '${mat.name}' seeded.`);
    }

    // 3. Optional: Add a sample promo code for testing checkout discounts
    const samplePromo = {
      code: 'WELCOME2026',
      type: 'percentage',
      discount_value: 15.00, // 15% discount
      min_order_value_egp: 100.00,
      start_date: new Date(),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
      usage_limit: 100
    };

    await client.query(`
      INSERT INTO public.promo_codes (code, type, discount_value, min_order_value_egp, start_date, end_date, usage_limit)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (code) DO NOTHING
    `, [
      samplePromo.code,
      samplePromo.type,
      samplePromo.discount_value,
      samplePromo.min_order_value_egp,
      samplePromo.start_date,
      samplePromo.end_date,
      samplePromo.usage_limit
    ]);
    console.log(`Promo code '${samplePromo.code}' seeded.`);

    console.log('Phase 6 Database Seeding completed successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
