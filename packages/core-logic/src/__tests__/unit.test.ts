import { describe, it, expect, beforeAll } from 'vitest';
import { calculateOrderPrice, PricingInput, validatePromoCode } from '../checkout/pricing';
import { OrderCreateInputSchema, PromoCodeInputSchema } from '../validation/schemas';
import { MockAIAuditor } from '../ai/auditor';
import { PromoCode, CartItem } from '../types/database.types';
import { signSessionToken, verifySessionToken, shouldRollToken, getSessionCookieConfig, clearKeyCache } from '../auth/jwt';

describe('Pricing Cost Formula Math & Margin Safeguards', () => {
  const baseInput: PricingInput = {
    widthCm: 100,
    heightCm: 100,
    costPerSqMeterSubstrate: 100, // 100 EGP per square meter of canvas
    costPerLinearCmFrame: 1,      // 1 EGP per linear centimeter of wood frame
    costPerMlInk: 5,              // 5 EGP per ml
    inkDensityMultiplier: 1.0,    // 100% density
    marginMarkupMultiplier: 1.5,  // 50% profit markup
    fixedServiceFeeEgp: 50,       // 50 EGP flat fee
    minMarginMultiplier: 1.10,    // Requires final price >= (base cost * 1.10)
  };

  it('calculates retail price without discounts correctly', () => {
    // Area: 100 x 100 = 10000 sq cm = 1.0 sq meter
    // Substrate: 1.0 * 100 = 100 EGP
    // Ink: 10 * 1.0 * 1.0 = 10ml. 10 * 5 = 50 EGP
    // Frame: 2 * (100 + 100) = 400cm. 400 * 1 = 400 EGP
    // Cost Base: 100 + 50 + 400 = 550 EGP
    // Base Retail (no fee): 550 * 1.5 = 825 EGP
    // Retail Price: 825 + 50 = 875 EGP
    
    const result = calculateOrderPrice(baseInput);
    expect(result.costBase).toBe(550);
    expect(result.priceBreakdown.finalPrice).toBe(875);
    expect(result.isMarginViolated).toBe(false);
  });

  it('applies percentage promo codes and checks maximum caps', () => {
    const inputWithPercentCode: PricingInput = {
      ...baseInput,
      promoDiscountType: 'percentage',
      promoDiscountValue: 20, // 20% discount
      promoMaxDiscountEgp: 100, // discount capped at 100 EGP
    };

    const result = calculateOrderPrice(inputWithPercentCode);
    // Base retail: 875 EGP. 20% of 875 = 175 EGP. Capped at 100 EGP.
    // Final price: 875 - 100 = 775 EGP.
    expect(result.priceBreakdown.promoDiscount).toBe(100);
    expect(result.priceBreakdown.finalPrice).toBe(775);
  });

  it('triggers margin violation when discount sells below production cost threshold', () => {
    const inputWithExcessiveDiscount: PricingInput = {
      ...baseInput,
      promoDiscountType: 'fixed_egp',
      promoDiscountValue: 300, // 300 EGP discount
      minMarginMultiplier: 1.10, // requires final price >= 550 * 1.10 = 605 EGP
    };

    // Base retail: 875. Discount: 300. Final Price: 575 EGP.
    // Cost Base: 550. Minimum Price demanded: 605 EGP.
    // Final price (575) < 605, so isMarginViolated should be true!
    const result = calculateOrderPrice(inputWithExcessiveDiscount);
    expect(result.priceBreakdown.finalPrice).toBe(575);
    expect(result.isMarginViolated).toBe(true);
  });

  it('correctly adds AI Quality Audit fee to the final price and breakdown', () => {
    const inputWithAiFee: PricingInput = {
      ...baseInput,
      aiAuditFeeEgp: 2.00,
    };

    const result = calculateOrderPrice(inputWithAiFee);
    // Base retail (no AI fee): 875 EGP.
    // AI fee: 2 EGP.
    // Final price: 875 + 2 = 877 EGP.
    expect(result.priceBreakdown.aiAuditFee).toBe(2.00);
    expect(result.priceBreakdown.finalPrice).toBe(877.00);
    expect(result.priceBreakdown.markupTotal).toBe(877.00);
  });
});

describe('Zod Validation Boundaries', () => {
  it('validates a correct order creation payload', () => {
    const payload = {
      width_cm: 60,
      height_cm: 40,
      file_url: 'https://example.com/art.jpg',
      substrate_material_id: '4399e52d-9477-47ab-a1ce-98cc78fb6d76',
      frame_material_id: '1e19d7d2-1c6e-44cb-bc4f-4d9291b8fa10',
      is_gallery_opt_in: true,
      shipping_address: 'El Maadi, Cairo, Egypt',
    };
    
    const parsed = OrderCreateInputSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects order with negative dimensions', () => {
    const payload = {
      width_cm: -10,
      height_cm: 40,
      file_url: 'https://example.com/art.jpg',
      substrate_material_id: '4399e52d-9477-47ab-a1ce-98cc78fb6d76',
      shipping_address: 'El Maadi, Cairo, Egypt',
    };
    
    const parsed = OrderCreateInputSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('rejects promo code creation with invalid date ranges', () => {
    const invalidPromo = {
      code: 'SAVE10',
      type: 'fixed_egp',
      discount_value: 10,
      start_date: '2026-06-03T12:00:00Z',
      end_date: '2026-06-02T12:00:00Z', // chronologically before start date
    };

    const parsed = PromoCodeInputSchema.safeParse(invalidPromo);
    expect(parsed.success).toBe(false);
  });
});

describe('Mock AI Auditor', () => {
  const auditor = new MockAIAuditor();

  it('flags pricing game attempts on solid black thumbnails', async () => {
    const res = await auditor.auditImage('data:image/jpeg;base64,game_solid_black_attempt', 50, 50);
    expect(res.isPotentialPricingGame).toBe(true);
    expect(res.estimatedInkDensityFactor).toBeGreaterThan(1.5);
  });

  it('flags blur warnings on low resolution base64 tags', async () => {
    const res = await auditor.auditImage('data:image/jpeg;base64,blurry_photo_details', 50, 50);
    expect(res.compressionArtifactsDetected).toBe(true);
    expect(res.printReadinessScore).toBeLessThan(50);
  });
});

describe('Promo Code Expiration and Cart Validation Rules', () => {
  const dummyPromo: PromoCode = {
    id: 'f87a32bd-10f8-45e3-85f2-959c118bfa98',
    code: 'WINTER30',
    type: 'percentage',
    discountValue: 30,
    minOrderValueEgp: 500,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
    usageLimit: 100,
    usageCount: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const activeCart: CartItem[] = [{
    widthCm: 100,
    heightCm: 100,
    costPerSqMeterSubstrate: 100,
    costPerLinearCmFrame: 1,
    costPerMlInk: 5,
    inkDensityMultiplier: 1.0,
    marginMarkupMultiplier: 1.5,
    fixedServiceFeeEgp: 50,
  }]; // retail price is 875 EGP (exceeds 500 EGP min)

  it('validates a correct active promo code successfully', () => {
    const res = validatePromoCode(dummyPromo, activeCart, new Date('2026-06-03T12:00:00Z'));
    expect(res.isValid).toBe(true);
    expect(res.errorCode).toBeUndefined();
  });

  it('rejects coupon when current date is before start date', () => {
    const res = validatePromoCode(dummyPromo, activeCart, new Date('2025-12-31T12:00:00Z'));
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('PROMO_NOT_STARTED');
  });

  it('rejects coupon when current date is after end date', () => {
    const res = validatePromoCode(dummyPromo, activeCart, new Date('2027-01-01T12:00:00Z'));
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('PROMO_EXPIRED');
  });

  it('rejects coupon when usage count meets limit', () => {
    const exhaustedPromo = { ...dummyPromo, usageCount: 100, usageLimit: 100 };
    const res = validatePromoCode(exhaustedPromo, activeCart, new Date('2026-06-03T12:00:00Z'));
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('PROMO_LIMIT_REACHED');
  });

  it('rejects coupon when order value is below minimum requirement', () => {
    const smallCart: CartItem[] = [{
      ...activeCart[0],
      widthCm: 20,
      heightCm: 20, // base cost is small, retail is around 70 EGP (below 500 EGP min)
    }];
    const res = validatePromoCode(dummyPromo, smallCart, new Date('2026-06-03T12:00:00Z'));
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('PROMO_MIN_VAL_UNMET');
  });

  it('rejects coupon when deactivated by admin', () => {
    const deactivatedPromo = { ...dummyPromo, isActive: false };
    const res = validatePromoCode(deactivatedPromo, activeCart, new Date('2026-06-03T12:00:00Z'));
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe('PROMO_INACTIVE');
  });
});

describe('JWT Cryptographic Session Token Handlers', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-bytes-long';
  });

  const payload = {
    userId: '920b78c9-fa53-4886-90ee-c5b57d6b38c2',
    email: 'employee@printstore.com',
    role: 'employee' as const,
  };

  it('signs and verifies a valid JWE session token', async () => {
    const token = await signSessionToken(payload, 86400); // 24 hours
    expect(token).toBeTypeOf('string');
    expect(token.length).toBeGreaterThan(0);
    // JWE compact representation has 5 parts separated by dots
    expect(token.split('.').length).toBe(5);

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.userId).toBe(payload.userId);
    expect(verified!.email).toBe(payload.email);
    expect(verified!.role).toBe(payload.role);
    expect(verified!.exp).toBeTypeOf('number');
  });

  it('returns null for an invalid or tempered token', async () => {
    const verified = await verifySessionToken('invalid-token-value-here');
    expect(verified).toBeNull();
  });

  it('throws an error if JWT_SECRET is unset', async () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    clearKeyCache();
    await expect(signSessionToken(payload)).rejects.toThrow('JWT_SECRET environment variable is not set');
    process.env.JWT_SECRET = originalSecret;
    clearKeyCache();
  });

  it('generates correct session cookie configuration based on security flag', () => {
    const secureConfig = getSessionCookieConfig(true, 3600);
    expect(secureConfig.httpOnly).toBe(true);
    expect(secureConfig.secure).toBe(true);
    expect(secureConfig.sameSite).toBe('lax');
    expect(secureConfig.maxAge).toBe(3600);

    const insecureConfig = getSessionCookieConfig(false, 3600);
    expect(insecureConfig.secure).toBe(false);
  });

  it('correctly determines if a token is within the rolling threshold', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    
    // 2 hours remaining (within 6h threshold) => should roll
    const closeToExpiry = nowSec + 2 * 60 * 60;
    expect(shouldRollToken(closeToExpiry, 6)).toBe(true);

    // 10 hours remaining (outside 6h threshold) => should not roll
    const farFromExpiry = nowSec + 10 * 60 * 60;
    expect(shouldRollToken(farFromExpiry, 6)).toBe(false);

    // Already expired => should not roll (should be treated as expired/invalid)
    const expired = nowSec - 100;
    expect(shouldRollToken(expired, 6)).toBe(false);
  });
});

