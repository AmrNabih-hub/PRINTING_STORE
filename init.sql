-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Custom Schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;

-- Define Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'employee', 'courier', 'customer');
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'ready_for_handover', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE public.material_type AS ENUM ('ink', 'substrate', 'frame', 'coating', 'other');
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_egp');

-- 1. Auth Users Table (Simulating credentials layer locally)
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Public Profiles Table (References auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role public.user_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. System Global Settings Table (Holds markup margin, fixed fees, thresholds)
CREATE TABLE public.system_config (
    key VARCHAR(100) PRIMARY KEY,
    value NUMERIC(12, 4) NOT NULL CHECK (value >= 0),
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES public.profiles(id)
);

-- 4. Inventory / Materials Catalog Table
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    type public.material_type NOT NULL,
    unit_name VARCHAR(50) NOT NULL, -- e.g., 'ml', 'sq_meter', 'cm'
    cost_per_unit NUMERIC(12, 4) NOT NULL CHECK (cost_per_unit >= 0),
    stock_level NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (stock_level >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES public.profiles(id)
);

-- 5. Promo Codes Table (Natively enforcing usage limits, value borders, and expiration dates)
CREATE TABLE public.promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL CHECK (code ~ '^[A-Z0-9_-]+$'), -- Strict uppercase alphanumeric
    type public.discount_type NOT NULL,
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_value_egp NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (min_order_value_egp >= 0),
    max_discount_egp NUMERIC(10, 2) CHECK (max_discount_egp > 0), -- caps percentage discount
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL CHECK (end_date > start_date),
    usage_limit INTEGER CHECK (usage_limit > 0), -- total activations allowed globally
    usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES public.profiles(id),
    CONSTRAINT chk_usage_limit CHECK (usage_limit IS NULL OR usage_count <= usage_limit)
);

-- 6. Employee Performance Table
CREATE TABLE public.employee_performance (
    employee_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    efficiency_modifier NUMERIC(4, 2) NOT NULL DEFAULT 1.00 CHECK (efficiency_modifier >= 0.1),
    total_orders_completed INTEGER NOT NULL DEFAULT 0 CHECK (total_orders_completed >= 0),
    average_completion_time_minutes INTEGER NOT NULL DEFAULT 0 CHECK (average_completion_time_minutes >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Customer Orders Table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id),
    employee_id UUID REFERENCES public.profiles(id),
    courier_id UUID REFERENCES public.profiles(id),
    status public.order_status NOT NULL DEFAULT 'pending',
    
    -- Dimensions in Centimeters
    width_cm NUMERIC(6, 2) NOT NULL CHECK (width_cm > 0),
    height_cm NUMERIC(6, 2) NOT NULL CHECK (height_cm > 0),
    
    -- Artwork & Materials Configuration
    file_url TEXT NOT NULL,
    substrate_material_id UUID NOT NULL REFERENCES public.materials(id),
    frame_material_id UUID REFERENCES public.materials(id),
    
    -- Routing Metrics & Pricing Parameters
    complexity_score NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (complexity_score >= 0.5),
    promo_code_id UUID REFERENCES public.promo_codes(id),
    price_egp NUMERIC(10, 2) NOT NULL CHECK (price_egp >= 0),
    discount_applied_egp NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_applied_egp >= 0),
    price_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb, -- details: substrate, ink, frame cost, margin, fee, promo discount
    
    -- AI Quality Gate Status
    ai_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'approved', 'flagged_for_review', 'rejected')),
    is_gallery_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Shipping Details
    shipping_address TEXT NOT NULL,
    delivery_coords JSONB, -- { "lat": Float, "lng": Float, "paths": Array }
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Promo Code Usages Ledger (Audit trail to prevent customer duplicate usage of single-use codes)
CREATE TABLE public.promo_code_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Order Material Usage Ledger (Audit Trail of Material depletion)
CREATE TABLE public.order_materials_usage (
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE RESTRICT,
    estimated_quantity NUMERIC(12, 4) NOT NULL CHECK (estimated_quantity >= 0),
    actual_quantity NUMERIC(12, 4) CHECK (actual_quantity >= 0),
    PRIMARY KEY (order_id, material_id)
);

-- 10. Design Assessments Audit Log
CREATE TABLE public.design_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    artwork_classification VARCHAR(100) NOT NULL,
    estimated_ink_density_factor NUMERIC(4, 2) NOT NULL DEFAULT 1.00 CHECK (estimated_ink_density_factor >= 0.1),
    compression_artifacts_detected BOOLEAN NOT NULL DEFAULT FALSE,
    print_readiness_score INTEGER NOT NULL CHECK (print_readiness_score BETWEEN 0 AND 100),
    risk_assessment TEXT,
    is_potential_pricing_game BOOLEAN NOT NULL DEFAULT FALSE,
    raw_ai_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Curated Public Gallery Table
CREATE TABLE public.gallery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id),
    image_url TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Trigger Functions & Database Automation
-- Automate Profile Creation on signup (Secured search_path to prevent path hijacking)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'customer'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger to initialize employee performance record
CREATE OR REPLACE FUNCTION public.handle_employee_profile_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'employee' THEN
        INSERT INTO public.employee_performance (employee_id, efficiency_modifier)
        VALUES (NEW.id, 1.00)
        ON CONFLICT (employee_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_employee_role_assigned
    AFTER INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_employee_profile_update();

-- Auto-update timestamps triggers
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_orders_timestamp BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_gallery_items_timestamp BEFORE UPDATE ON public.gallery_items FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_materials_timestamp BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_system_config_timestamp BEFORE UPDATE ON public.system_config FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_promo_codes_timestamp BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Fair order assignment query (Locked selection using FOR UPDATE OF to prevent concurrency race conditions)
CREATE OR REPLACE FUNCTION public.assign_order_fairly(order_complexity NUMERIC)
RETURNS UUID AS $$
DECLARE
    assigned_emp_id UUID;
BEGIN
    -- Query the employee with the lowest Load Score: L_e = W_e + (C_o * E_e)
    SELECT p.id INTO assigned_emp_id
    FROM public.profiles p
    LEFT JOIN public.employee_performance ep ON p.id = ep.employee_id
    LEFT JOIN (
        -- Count only active/incomplete assignments
        SELECT employee_id, COUNT(*) as active_workload 
        FROM public.orders 
        WHERE status IN ('pending', 'processing')
        GROUP BY employee_id
    ) o ON p.id = o.employee_id
    WHERE p.role = 'employee'
    ORDER BY (COALESCE(o.active_workload, 0) + (order_complexity * COALESCE(ep.efficiency_modifier, 1.00))) ASC, p.id ASC
    LIMIT 1
    FOR UPDATE OF p;

    RETURN assigned_emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
