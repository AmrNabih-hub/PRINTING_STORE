import { OrderPriceBreakdown, PromoCode, CartItem } from '../types/database.types';

export interface PricingInput {
  widthCm: number;
  heightCm: number;
  costPerSqMeterSubstrate: number;
  costPerLinearCmFrame: number;
  costPerMlInk: number;
  inkDensityMultiplier: number;
  marginMarkupMultiplier: number;
  fixedServiceFeeEgp: number;
  minMarginMultiplier: number; // e.g. 1.10 (demands at least 10% profit over raw base cost)
  costPerSqMeterCoating?: number;
  promoDiscountType?: 'percentage' | 'fixed_egp' | null;
  promoDiscountValue?: number | null;
  promoMaxDiscountEgp?: number | null;
  aiAuditFeeEgp?: number;
}

export interface PricingOutput {
  priceBreakdown: OrderPriceBreakdown;
  costBase: number;
  isMarginViolated: boolean;
}

/**
 * Calculates base cost for a single cart item.
 */
export function calculateItemBaseCost(item: CartItem | PricingInput): number {
  const areaSqCm = item.widthCm * item.heightCm;
  const areaSqMeter = areaSqCm / 10000;
  const perimeterCm = 2 * (item.widthCm + item.heightCm);

  // Ink assumption: 10ml average ink consumption per square meter at 100% density
  const inkConsumptionMl = 10 * areaSqMeter * item.inkDensityMultiplier;
  const inkCost = inkConsumptionMl * item.costPerMlInk;
  
  const substrateCost = areaSqMeter * item.costPerSqMeterSubstrate;
  const frameCost = perimeterCm * item.costPerLinearCmFrame;
  const coatingCost = areaSqMeter * (item.costPerSqMeterCoating || 0);
  
  return inkCost + substrateCost + frameCost + coatingCost;
}

/**
 * Calculates retail price for a single cart item before discounts.
 */
export function calculateItemRetailPrice(item: CartItem | PricingInput): number {
  const costBase = calculateItemBaseCost(item);
  return (costBase * item.marginMarkupMultiplier) + item.fixedServiceFeeEgp + (item.aiAuditFeeEgp || 0);
}

/**
 * Calculates the immutable order price breakdown and base costs, enforcing profit margin guardrails.
 */
export function calculateOrderPrice(input: PricingInput): PricingOutput {
  const costBase = calculateItemBaseCost(input);
  const priceBaseRetail = calculateItemRetailPrice(input);

  // Calculate Promo Discount
  let promoDiscount = 0;
  if (input.promoDiscountType && input.promoDiscountValue && input.promoDiscountValue > 0) {
    if (input.promoDiscountType === 'fixed_egp') {
      promoDiscount = input.promoDiscountValue;
    } else if (input.promoDiscountType === 'percentage') {
      const calculatedDiscount = priceBaseRetail * (input.promoDiscountValue / 100);
      if (input.promoMaxDiscountEgp && input.promoMaxDiscountEgp > 0) {
        promoDiscount = Math.min(calculatedDiscount, input.promoMaxDiscountEgp);
      } else {
        promoDiscount = calculatedDiscount;
      }
    }
  }

  // Final Price must not go below 0 EGP
  const finalPrice = Math.max(0, priceBaseRetail - promoDiscount);

  // Margin Guardrail Validation
  const requiredMinimumPrice = costBase * input.minMarginMultiplier;
  const isMarginViolated = finalPrice < requiredMinimumPrice;

  // Re-calculate details for breakdown
  const areaSqCm = input.widthCm * input.heightCm;
  const areaSqMeter = areaSqCm / 10000;
  const perimeterCm = 2 * (input.widthCm + input.heightCm);
  const substrateCost = areaSqMeter * input.costPerSqMeterSubstrate;
  const inkCost = (10 * areaSqMeter * input.inkDensityMultiplier) * input.costPerMlInk;
  const frameCost = perimeterCm * input.costPerLinearCmFrame;
  const coatingCost = areaSqMeter * (input.costPerSqMeterCoating || 0);

  const priceBreakdown: OrderPriceBreakdown = {
    substrateCost: Number(substrateCost.toFixed(2)),
    inkCost: Number(inkCost.toFixed(2)),
    frameCost: Number(frameCost.toFixed(2)),
    coatingCost: Number(coatingCost.toFixed(2)),
    serviceFee: Number(input.fixedServiceFeeEgp.toFixed(2)),
    aiAuditFee: input.aiAuditFeeEgp ? Number(input.aiAuditFeeEgp.toFixed(2)) : undefined,
    baseTotal: Number(costBase.toFixed(2)),
    markupTotal: Number(priceBaseRetail.toFixed(2)),
    promoDiscount: Number(promoDiscount.toFixed(2)),
    finalPrice: Number(finalPrice.toFixed(2)),
  };

  return {
    priceBreakdown,
    costBase: Number(costBase.toFixed(2)),
    isMarginViolated,
  };
}

export type PromoErrorCode =
  | 'PROMO_INACTIVE'
  | 'PROMO_NOT_STARTED'
  | 'PROMO_EXPIRED'
  | 'PROMO_LIMIT_REACHED'
  | 'PROMO_MIN_VAL_UNMET';

export interface PromoValidationResult {
  isValid: boolean;
  errorCode?: PromoErrorCode;
}

/**
 * Validates promo code parameters against a cart array to avoid process crashes.
 * Returns typed Error-Mapping codes for localization.
 */
export function validatePromoCode(
  promo: PromoCode,
  cartItems: CartItem[],
  currentDate: Date = new Date()
): PromoValidationResult {
  try {
    if (!promo.isActive) {
      return { isValid: false, errorCode: 'PROMO_INACTIVE' };
    }

    const time = currentDate.getTime();
    if (time < new Date(promo.startDate).getTime()) {
      return { isValid: false, errorCode: 'PROMO_NOT_STARTED' };
    }

    if (time > new Date(promo.endDate).getTime()) {
      return { isValid: false, errorCode: 'PROMO_EXPIRED' };
    }

    if (promo.usageLimit !== undefined && promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      return { isValid: false, errorCode: 'PROMO_LIMIT_REACHED' };
    }

    // Accumulate total base retail price for all items in the cart
    const cartTotalRetailPrice = cartItems.reduce(
      (sum, item) => sum + calculateItemRetailPrice(item),
      0
    );

    if (cartTotalRetailPrice < promo.minOrderValueEgp) {
      return { isValid: false, errorCode: 'PROMO_MIN_VAL_UNMET' };
    }

    return { isValid: true };
  } catch (err) {
    // Graceful fallback to avoid fatal server crashes
    return { isValid: false, errorCode: 'PROMO_INACTIVE' };
  }
}
