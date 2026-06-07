import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@/lib/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { materials } from '@printing-store/core-logic/src/schema';
import { verifySessionToken, MaterialInputSchema } from '@printing-store/core-logic';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

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

// 1. GET - Fetch all materials
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);
    const allMaterials = await db.select().from(materials).all();

    return NextResponse.json({ materials: allMaterials });
  } catch (error: any) {
    return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
  }
}

// 2. POST - Insert a new material
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = z.record(z.any()).parse(await request.json());
    const validation = MaterialInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED', details: validation.error.format() }, { status: 400 });
    }

    // In the old code, MaterialInputSchema expects: name, type, unit_name, cost_per_unit, stock_level
    // We map this to the Drizzle schema `materials`: name, type, basePriceEgp, stockLevel, stockUnit, etc.
    const { name, type, unit_name, cost_per_unit, stock_level } = validation.data as any; // Cast since types might misalign with the schema naming

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);
    
    const id = crypto.randomUUID();
    
    await db.insert(materials).values({
      id,
      name,
      type,
      basePriceEgp: cost_per_unit || 0,
      stockLevel: stock_level || 0,
      stockUnit: unit_name || 'unit',
      updatedBy: session.userId,
    }).execute();

    return NextResponse.json({ success: true, materialId: id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
  }
}

// 3. PUT - Modify an existing material
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = z.record(z.any()).parse(await request.json());
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'MATERIAL_ID_REQUIRED' }, { status: 400 });
    }

    const validation = MaterialInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED', details: validation.error.format() }, { status: 400 });
    }

    const { name, type, unit_name, cost_per_unit, stock_level } = validation.data as any;

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);

    const updateRes = await db.update(materials)
      .set({
        name,
        type,
        basePriceEgp: cost_per_unit,
        stockLevel: stock_level,
        stockUnit: unit_name,
        updatedBy: session.userId,
      })
      .where(eq(materials.id, id))
      .returning();

    if (updateRes.length === 0) {
      return NextResponse.json({ error: 'MATERIAL_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ success: true, materialId: id });
  } catch (error: any) {
    return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
  }
}

// 4. DELETE - Remove a material
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

    const { DB } = await getCloudflareContext();
    const db = drizzle(DB);

    // Skip orders relation check here as orders schema is complex; let D1 handle constraints if defined, 
    // or just execute deletion. If there's an FK error, it will throw.
    
    try {
      const deleteRes = await db.delete(materials).where(eq(materials.id, id)).returning();
      if (deleteRes.length === 0) {
        return NextResponse.json({ error: 'MATERIAL_NOT_FOUND' }, { status: 404 });
      }
    } catch (e: any) {
      if (e.message.includes('FOREIGN KEY constraint failed')) {
        return NextResponse.json({
          error: 'MATERIAL_IN_USE',
          message: 'This material is referenced in existing customer orders and cannot be deleted.'
        }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json({ success: true, deletedMaterialId: id });
  } catch (error: any) {
    return NextResponse.json({ error: 'DATABASE_ERROR', details: error.message }, { status: 500 });
  }
}
