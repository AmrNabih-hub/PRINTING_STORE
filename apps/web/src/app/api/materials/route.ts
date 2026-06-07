import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface MaterialDBRow {
  id: string;
  name: string;
  type: 'ink' | 'substrate' | 'frame' | 'coating' | 'other';
  unit_name: string;
  cost_per_unit: string;
}

export async function GET() {
  try {
    const result = await query(`
      SELECT id, name, type, unit_name, cost_per_unit 
      FROM public.materials 
      WHERE stock_level > 0 
      ORDER BY type, name
    `);

    const rows = result.rows as MaterialDBRow[];

    const substrates = rows
      .filter(r => r.type === 'substrate')
      .map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        unitName: r.unit_name,
        costPerUnit: parseFloat(r.cost_per_unit),
      }));

    const frames = rows
      .filter(r => r.type === 'frame')
      .map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        unitName: r.unit_name,
        costPerUnit: parseFloat(r.cost_per_unit),
      }));

    const coatings = rows
      .filter(r => r.type === 'coating')
      .map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        unitName: r.unit_name,
        costPerUnit: parseFloat(r.cost_per_unit),
      }));

    const inks = rows
      .filter(r => r.type === 'ink')
      .map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        unitName: r.unit_name,
        costPerUnit: parseFloat(r.cost_per_unit),
      }));

    const configRes = await query(`
      SELECT key, value 
      FROM public.system_config
    `);

    const config: Record<string, number> = {};
    configRes.rows.forEach(row => {
      config[row.key] = parseFloat(row.value);
    });

    return NextResponse.json({
      substrates,
      frames,
      coatings,
      inks,
      config: {
        markup_margin: config['markup_margin'] ?? 1.5,
        service_fee: config['service_fee'] ?? 50.0,
        ai_audit_fee: config['ai_audit_fee'] ?? 0.0,
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json(
      { error: 'DATABASE_ERROR', details: message },
      { status: 500 }
    );
  }
}
