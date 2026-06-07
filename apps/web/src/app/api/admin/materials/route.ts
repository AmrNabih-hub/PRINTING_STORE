import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifySessionToken, MaterialInputSchema } from '@printing-store/core-logic';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

async function getAdminSession(request: NextRequest) {
  const cookieToken = request.cookies.get('session_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || cookieToken;

  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    if (!payload || payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

// 1. GET - Fetch all catalog items with stock details
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const res = await query(
      'SELECT id, name, type, unit_name, cost_per_unit, stock_level, updated_at FROM public.materials ORDER BY type, name'
    );

    const materials = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      unitName: row.unit_name,
      costPerUnit: parseFloat(row.cost_per_unit),
      stockLevel: parseFloat(row.stock_level),
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ materials });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}

// 2. POST - Insert a new material catalog item
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const validation = MaterialInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED', details: validation.error.format() }, { status: 400 });
    }

    const { name, type, unit_name, cost_per_unit, stock_level } = validation.data;

    const insertRes = await query(
      `INSERT INTO public.materials (name, type, unit_name, cost_per_unit, stock_level, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, type, unit_name, cost_per_unit, stock_level, session.userId]
    );

    return NextResponse.json({ success: true, materialId: insertRes.rows[0].id }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}

// 3. PUT - Modify an existing material catalog item
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'MATERIAL_ID_REQUIRED' }, { status: 400 });
    }

    const validation = MaterialInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED', details: validation.error.format() }, { status: 400 });
    }

    const { name, type, unit_name, cost_per_unit, stock_level } = validation.data;

    const updateRes = await query(
      `UPDATE public.materials
       SET name = $1, type = $2, unit_name = $3, cost_per_unit = $4, stock_level = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING id`,
      [name, type, unit_name, cost_per_unit, stock_level, session.userId, id]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'MATERIAL_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true, materialId: id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}

// 4. DELETE - Remove a material from inventory
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'MATERIAL_ID_REQUIRED' }, { status: 400 });
    }

    // Check if referenced by active orders to prevent database constraint failures
    const refRes = await query(
      'SELECT id FROM public.orders WHERE substrate_material_id = $1 OR frame_material_id = $1 LIMIT 1',
      [id]
    );

    if (refRes.rows.length > 0) {
      return NextResponse.json({
        error: 'MATERIAL_IN_USE',
        message: 'This material is referenced in existing customer orders and cannot be deleted.'
      }, { status: 400 });
    }

    const deleteRes = await query('DELETE FROM public.materials WHERE id = $1 RETURNING id', [id]);
    
    if (deleteRes.rows.length === 0) {
      return NextResponse.json({ error: 'MATERIAL_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedMaterialId: id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json({ error: 'DATABASE_ERROR', details: msg }, { status: 500 });
  }
}
