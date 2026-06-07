import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validatePromoCode, PromoCode, CartItem } from '@printing-store/core-logic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.toUpperCase();
    const widthCm = parseFloat(searchParams.get('width_cm') || '0');
    const heightCm = parseFloat(searchParams.get('height_cm') || '0');
    const substrateCost = parseFloat(searchParams.get('substrate_cost') || '0');
    const frameCost = parseFloat(searchParams.get('frame_cost') || '0');
    const coatingCost = parseFloat(searchParams.get('coating_cost') || '0');

    const inkDensity = parseFloat(searchParams.get('ink_density') || '1.0');
    const aiAuditFee = parseFloat(searchParams.get('ai_audit_fee') || '0.0');

    if (!code) {
      return NextResponse.json({ error: 'CODE_REQUIRED' }, { status: 400 });
    }

    // Lookup promo code
    const result = await query(
      'SELECT id, code, type, discount_value, min_order_value_egp, max_discount_egp, start_date, end_date, usage_limit, usage_count, is_active FROM public.promo_codes WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ isValid: false, error: 'PROMO_INACTIVE' });
    }

    const dbPromo = result.rows[0];
    const promo: PromoCode = {
      id: dbPromo.id,
      code: dbPromo.code,
      type: dbPromo.type,
      discountValue: Number(dbPromo.discount_value),
      minOrderValueEgp: Number(dbPromo.min_order_value_egp),
      maxDiscountEgp: dbPromo.max_discount_egp ? Number(dbPromo.max_discount_egp) : undefined,
      startDate: new Date(dbPromo.start_date),
      endDate: new Date(dbPromo.end_date),
      usageLimit: dbPromo.usage_limit ? Number(dbPromo.usage_limit) : undefined,
      usageCount: Number(dbPromo.usage_count),
      isActive: dbPromo.is_active,
      createdAt: new Date(), // Stub timestamps as they don't affect validation logic
      updatedAt: new Date(),
    };

    // Construct mock cart item to run Zod/logical validation logic
    const cartItem: CartItem = {
      widthCm: widthCm || 30,
      heightCm: heightCm || 40,
      costPerSqMeterSubstrate: substrateCost || 120.0,
      costPerLinearCmFrame: frameCost || 0.0,
      costPerSqMeterCoating: coatingCost || 0.0,
      costPerMlInk: 5.0, // standard ink pricing
      inkDensityMultiplier: inkDensity,
      marginMarkupMultiplier: 1.5, // standard margin markup
      fixedServiceFeeEgp: 50.0, // standard service fee
      aiAuditFeeEgp: aiAuditFee,
    };

    const validation = validatePromoCode(promo, [cartItem], new Date());

    if (!validation.isValid) {
      return NextResponse.json({ isValid: false, error: validation.errorCode });
    }

    return NextResponse.json({
      isValid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        type: promo.type,
        discountValue: promo.discountValue,
        minOrderValueEgp: promo.minOrderValueEgp,
        maxDiscountEgp: promo.maxDiscountEgp || null,
      }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown validation error';
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', details: msg },
      { status: 500 }
    );
  }
}
