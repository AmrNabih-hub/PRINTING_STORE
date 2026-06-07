export type UserRole = 'admin' | 'employee' | 'courier' | 'customer';
export type OrderStatus = 'pending' | 'processing' | 'ready_for_handover' | 'in_transit' | 'delivered' | 'cancelled';
export type MaterialType = 'ink' | 'substrate' | 'frame' | 'coating' | 'other';
export type DiscountType = 'percentage' | 'fixed_egp';

export interface AuthUser {
  id: string; // UUID
  email: string;
  passwordHash: string;
  rawUserMetaData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string; // UUID references AuthUser.id
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemConfig {
  key: string;
  value: number;
  description?: string;
  updatedAt: Date;
  updatedBy?: string; // UUID references Profile.id
}

export interface Material {
  id: string; // UUID
  name: string;
  type: MaterialType;
  unitName: string; // e.g., 'ml', 'sq_meter', 'cm'
  costPerUnit: number;
  stockLevel: number;
  updatedAt: Date;
  updatedBy?: string; // UUID references Profile.id
}

export interface EmployeePerformance {
  employeeId: string; // UUID references Profile.id
  efficiencyModifier: number;
  totalOrdersCompleted: number;
  averageCompletionTimeMinutes: number;
  updatedAt: Date;
}

export interface Order {
  id: string; // UUID
  customerId: string; // UUID references Profile.id
  employeeId?: string; // UUID references Profile.id
  courierId?: string; // UUID references Profile.id
  status: OrderStatus;
  widthCm: number;
  heightCm: number;
  fileUrl: string;
  substrateMaterialId: string; // UUID references Material.id
  frameMaterialId?: string; // UUID references Material.id
  coatingMaterialId?: string; // UUID references Material.id
  complexityScore: number;
  promoCodeId?: string; // UUID references PromoCode.id
  priceEgp: number;
  discountAppliedEgp: number;
  priceBreakdown: OrderPriceBreakdown;
  aiStatus: 'pending' | 'approved' | 'flagged_for_review' | 'rejected';
  isGalleryOptIn: boolean;
  shippingAddress: string;
  deliveryCoords?: OrderDeliveryCoords;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderPriceBreakdown {
  substrateCost: number;
  inkCost: number;
  frameCost: number;
  coatingCost: number;
  serviceFee: number;
  aiAuditFee?: number;
  baseTotal: number;
  markupTotal: number;
  promoDiscount: number;
  finalPrice: number;
}

export interface OrderDeliveryCoords {
  lat: number;
  lng: number;
  paths?: Array<{ lat: number; lng: number }>;
}

export interface OrderMaterialsUsage {
  orderId: string; // UUID references Order.id
  materialId: string; // UUID references Material.id
  estimatedQuantity: number;
  actualQuantity?: number;
}

export interface DesignAssessment {
  id: string; // UUID
  orderId?: string; // UUID references Order.id
  fileUrl: string;
  artworkClassification: string;
  estimatedInkDensityFactor: number;
  compressionArtifactsDetected: boolean;
  printReadinessScore: number;
  riskAssessment?: string;
  isPotentialPricingGame: boolean;
  rawAiPayload: Record<string, any>;
  createdAt: Date;
}

export interface PromoCode {
  id: string; // UUID
  code: string;
  type: DiscountType;
  discountValue: number;
  minOrderValueEgp: number;
  maxDiscountEgp?: number;
  startDate: Date;
  endDate: Date;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string; // UUID references Profile.id
}

export interface PromoCodeUsage {
  id: string; // UUID
  promoCodeId: string; // UUID references PromoCode.id
  customerId: string; // UUID references Profile.id
  orderId?: string; // UUID references Order.id
  usedAt: Date;
}

export interface GalleryItem {
  id: string; // UUID
  customerId: string; // UUID references Profile.id
  imageUrl: string;
  title: string;
  description?: string;
  isApproved: boolean;
  approvedBy?: string; // UUID references Profile.id
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  widthCm: number;
  heightCm: number;
  costPerSqMeterSubstrate: number;
  costPerLinearCmFrame: number;
  costPerMlInk: number;
  inkDensityMultiplier: number;
  marginMarkupMultiplier: number;
  fixedServiceFeeEgp: number;
  costPerSqMeterCoating?: number;
  aiAuditFeeEgp?: number;
}
