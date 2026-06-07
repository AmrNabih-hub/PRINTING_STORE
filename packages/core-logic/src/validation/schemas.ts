import { z } from 'zod';

// Helper Regex
const PROMO_CODE_REGEX = /^[A-Z0-9_-]+$/;

// User Identity Validation
export const UserRegisterSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
});

export const UserLoginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

// Order Delivery Coordinates
export const OrderDeliveryCoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  paths: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })).optional(),
});

// Order Creation Inputs
export const OrderCreateInputSchema = z.object({
  width_cm: z.number().positive('Width must be greater than zero').max(500, 'Width exceeds maximum print capabilities (500cm)'),
  height_cm: z.number().positive('Height must be greater than zero').max(500, 'Height exceeds maximum print capabilities (500cm)'),
  file_url: z.string().url('File URL must be a valid absolute HTTP/S web link'),
  substrate_material_id: z.string().uuid('Substrate material selection is invalid'),
  frame_material_id: z.string().uuid('Frame material selection is invalid').optional().nullable(),
  coating_material_id: z.string().uuid('Coating material selection is invalid').optional().nullable(),
  is_gallery_opt_in: z.boolean().default(false),
  shipping_address: z.string().min(5, 'Shipping address details are too short'),
  delivery_coords: OrderDeliveryCoordsSchema.optional().nullable(),
  promo_code: z.string().toUpperCase().regex(PROMO_CODE_REGEX, 'Promo code format is invalid').optional().nullable(),
  payment_method: z.enum(['card', 'wallet', 'cod']).optional().default('card'),
});

// Material Management Inputs (Inventory Admin)
export const MaterialInputSchema = z.object({
  name: z.string().min(2, 'Material name must contain at least 2 characters'),
  type: z.enum(['ink', 'substrate', 'frame', 'coating', 'other']),
  unit_name: z.string().min(1, 'Unit identifier is required'),
  cost_per_unit: z.number().nonnegative('Cost per unit cannot be negative'),
  stock_level: z.number().nonnegative('Stock level cannot be negative').default(0),
});

// Promo Code Management (Marketing Admin)
export const PromoCodeInputSchema = z.object({
  code: z.string().toUpperCase().regex(PROMO_CODE_REGEX, 'Promo code must be uppercase alphanumeric (e.g. SAVE20)'),
  type: z.enum(['percentage', 'fixed_egp']),
  discount_value: z.number().positive('Discount value must be greater than zero'),
  min_order_value_egp: z.number().nonnegative('Minimum order value cannot be negative').default(0),
  max_discount_egp: z.number().positive('Maximum discount limit must be positive').optional().nullable(),
  start_date: z.string().datetime('Start date must be a valid ISO DateTime string'),
  end_date: z.string().datetime('End date must be a valid ISO DateTime string'),
  usage_limit: z.number().int().positive('Usage limit must be a positive integer').optional().nullable(),
  is_active: z.boolean().default(true),
}).refine((data) => new Date(data.end_date) > new Date(data.start_date), {
  message: 'End date must be chronologically after the start date',
  path: ['end_date'],
});
