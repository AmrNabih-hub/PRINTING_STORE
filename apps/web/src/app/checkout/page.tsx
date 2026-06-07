'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import GlassCard from '@/components/glass/GlassCard';
import MaterialSelector from '@/components/checkout/MaterialSelector';
import PriceBreakdown from '@/components/checkout/PriceBreakdown';
import { calculateOrderPrice, OrderPriceBreakdown } from '@printing-store/core-logic';
import styles from './Checkout.module.css';
import { cn } from '@/lib/utils';

// Client-side UUID generator fallback
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface AppliedPromo {
  code: string;
  type: 'percentage' | 'fixed_egp';
  discountValue: number;
  minOrderValueEgp: number;
  maxDiscountEgp: number | null;
}

const PRESET_SIZES = [
  { width: 30, height: 40, nameEn: 'Gallery Small', nameAr: 'معرض صغير' },
  { width: 40, height: 60, nameEn: 'Standard Portrait', nameAr: 'لوحة قياسية' },
  { width: 50, height: 70, nameEn: 'Gallery Exhibition', nameAr: 'لوحة معارض' },
  { width: 60, height: 90, nameEn: 'Premium Masterpiece', nameAr: 'لوحة جدارية ضخمة' },
  { width: 80, height: 120, nameEn: 'Collector Giant', nameAr: 'لوحة مقتنين عملاقة' },
  { width: 100, height: 100, nameEn: 'Premium Square', nameAr: 'مربع فاخر' },
];

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, locale } = useTranslation();

  const fileUrl = searchParams.get('file_url') || '';

  // Configuration States
  const [width, setWidth] = useState<number>(30);
  const [height, setHeight] = useState<number>(40);
  const [substrateId, setSubstrateId] = useState<string>('');
  const [substrateCost, setSubstrateCost] = useState<number>(0);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [frameCost, setFrameCost] = useState<number>(0);
  const [coatingId, setCoatingId] = useState<string | null>(null);
  const [coatingCost, setCoatingCost] = useState<number>(0);
  const [galleryOptIn, setGalleryOptIn] = useState<boolean>(false);
  
  // Detailed shipping address fields
  const [city, setCity] = useState<string>('Cairo');
  const [district, setDistrict] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [buildingApt, setBuildingApt] = useState<string>('');

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet' | 'cod'>('card');

  const shippingAddress = useMemo(() => {
    const parts = [
      street.trim(),
      buildingApt.trim(),
      district.trim(),
      city.trim()
    ].filter(Boolean);
    return parts.join(', ');
  }, [city, district, street, buildingApt]);

  // Promo Code States
  const [promoCode, setPromoCode] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string>('');
  const [promoSuccess, setPromoSuccess] = useState<string>('');
  const [validatingPromo, setValidatingPromo] = useState<boolean>(false);

  // Submission States
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [showSimModal, setShowSimModal] = useState<boolean>(false);
  const [simulatingPayment, setSimulatingPayment] = useState<boolean>(false);

  // Dynamic config/materials states
  const [inkDensityMultiplier, setInkDensityMultiplier] = useState<number>(1.0);
  const [inkCost, setInkCost] = useState<number>(5.0);
  const [systemConfig, setSystemConfig] = useState<{
    markup_margin: number;
    service_fee: number;
    ai_audit_fee: number;
  }>({
    markup_margin: 1.5,
    service_fee: 50.0,
    ai_audit_fee: 0.0,
  });

  // Authenticate immediately: redirect to landing if not logged in
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.authenticated) {
          router.push('/auth/login');
        }
      } catch {
        router.push('/auth/login');
      }
    }
    checkAuth();
  }, [router]);

  // Load configs and search parameters on mount
  useEffect(() => {
    async function loadMaterialsAndParams() {
      try {
        const res = await fetch('/api/materials');
        if (res.ok) {
          const data = await res.json();
          
          // Set system configs
          const config = data.config || { markup_margin: 1.5, service_fee: 50.0, ai_audit_fee: 0.0 };
          setSystemConfig(config);
          
          if (data.inks?.length > 0) {
            setInkCost(data.inks[0].costPerUnit);
          }

          // Parse query params
          const paramWidth = searchParams.get('width');
          const paramHeight = searchParams.get('height');
          const paramSubstrateId = searchParams.get('substrate_id');
          const paramFrameId = searchParams.get('frame_id');
          const paramCoatingId = searchParams.get('coating_id');
          const paramInkDensity = searchParams.get('ink_density');

          if (paramWidth) setWidth(Number(paramWidth));
          if (paramHeight) setHeight(Number(paramHeight));
          
          if (paramInkDensity) {
            setInkDensityMultiplier(parseFloat(paramInkDensity));
          }

          if (paramSubstrateId) {
            const sub = data.substrates?.find((s: any) => s.id === paramSubstrateId);
            if (sub) {
              setSubstrateId(sub.id);
              setSubstrateCost(sub.costPerUnit);
            }
          }

          if (paramFrameId && paramFrameId !== 'null' && paramFrameId !== '') {
            const fr = data.frames?.find((f: any) => f.id === paramFrameId);
            if (fr) {
              setFrameId(fr.id);
              setFrameCost(fr.costPerUnit);
            }
          }

          if (paramCoatingId && paramCoatingId !== 'null' && paramCoatingId !== '') {
            const co = data.coatings?.find((c: any) => c.id === paramCoatingId);
            if (co) {
              setCoatingId(co.id);
              setCoatingCost(co.costPerUnit);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load materials catalog in checkout page:', err);
      }
    }

    loadMaterialsAndParams();
  }, [searchParams]);

  // Compute live price breakdown client-side dynamically
  const pricingResult = useMemo(() => {
    const input = {
      widthCm: width,
      heightCm: height,
      costPerSqMeterSubstrate: substrateCost,
      costPerLinearCmFrame: frameCost,
      costPerSqMeterCoating: coatingCost,
      costPerMlInk: inkCost,
      inkDensityMultiplier: inkDensityMultiplier,
      marginMarkupMultiplier: systemConfig.markup_margin,
      fixedServiceFeeEgp: systemConfig.service_fee,
      minMarginMultiplier: 1.10,
      promoDiscountType: appliedPromo?.type || null,
      promoDiscountValue: appliedPromo ? Number(appliedPromo.discountValue) : null,
      promoMaxDiscountEgp: appliedPromo?.maxDiscountEgp ? Number(appliedPromo.maxDiscountEgp) : null,
      aiAuditFeeEgp: systemConfig.ai_audit_fee,
    };

    return calculateOrderPrice(input);
  }, [width, height, substrateCost, frameCost, coatingCost, inkCost, inkDensityMultiplier, systemConfig, appliedPromo]);

  // Handle promo code application
  async function handleApplyPromo() {
    if (!promoCode) return;
    setValidatingPromo(true);
    setPromoError('');
    setPromoSuccess('');

    try {
      const codeParam = encodeURIComponent(promoCode);
      const res = await fetch(
        `/api/promo/validate?code=${codeParam}&width_cm=${width}&height_cm=${height}&substrate_cost=${substrateCost}&frame_cost=${frameCost}&coating_cost=${coatingCost}&ink_density=${inkDensityMultiplier}&ai_audit_fee=${systemConfig.ai_audit_fee}`
      );
      const data = await res.json();

      if (!res.ok || !data.isValid) {
        setPromoError(t('checkout.invalidPromo'));
        setAppliedPromo(null);
      } else {
        setAppliedPromo(data.promo);
        setPromoSuccess(t('checkout.promoSuccess'));
      }
    } catch {
      setPromoError(t('checkout.invalidPromo'));
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  }

  // Handle Order Submission
  async function handlePlaceOrder() {
    if (!fileUrl) return;
    if (!substrateId) return;
    if (!shippingAddress || shippingAddress.trim().length < 5) {
      alert(locale === 'ar-eg' ? 'يرجى إدخال تفاصيل العنوان بالكامل أولاً' : 'Please input full address details first');
      return;
    }

    setPlacingOrder(true);
    const key = generateUUID();

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': key,
        },
        body: JSON.stringify({
          width_cm: width,
          height_cm: height,
          file_url: fileUrl,
          substrate_material_id: substrateId,
          frame_material_id: frameId,
          coating_material_id: coatingId,
          is_gallery_opt_in: galleryOptIn,
          shipping_address: shippingAddress,
          promo_code: appliedPromo?.code || null,
          payment_method: paymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || t('common.error'));
        setPlacingOrder(false);
        return;
      }

      if (paymentMethod === 'cod') {
        alert(locale === 'ar-eg' ? 'تم تأكيد طلبك بنجاح! سيتم الدفع عند الاستلام.' : 'Order placed successfully! Cash on delivery confirmed.');
        router.push('/dashboard');
        router.refresh();
      } else {
        // Order created successfully -> show payment simulation modal
        setOrderId(data.orderId);
        setShowSimModal(true);
      }
    } catch (err) {
      alert(t('common.error'));
      setPlacingOrder(false);
    }
  }

  // Trigger simulated payment webhooks
  async function handleSimulatePayment(success: boolean) {
    if (!orderId) return;
    setSimulatingPayment(true);

    try {
      const amountCents = Math.round(pricingResult.priceBreakdown.finalPrice * 100);
      const res = await fetch('/api/webhooks/mock-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          success,
          amountCents,
        }),
      });

      if (!res.ok) {
        throw new Error('Simulation failed');
      }

      // Wait a moment for database status updates and notifications to stream, then redirect
      setTimeout(() => {
        setShowSimModal(false);
        setSimulatingPayment(false);
        router.push('/dashboard');
        router.refresh();
      }, 1000);

    } catch (err) {
      alert('Simulation webhook dispatch failed');
      setSimulatingPayment(false);
    }
  }

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
        <GlassCard className="p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-500 mb-2">No Artwork Uploaded</h2>
          <p className="text-sm text-text/60 mb-6">
            You must upload an artwork layout file before proceeding to the checkout configuration.
          </p>
          <Link href="/dashboard" className={styles.payButton}>
            Go to Uploader
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>{t('checkout.title')}</h1>
        <p className={styles.subtitle}>Configure materials, frame options, and print sizing</p>
      </div>

      <div className={styles.twoColumnLayout}>
        {/* Left Column: Configurations */}
        <div className={styles.leftColumn}>
          {/* Section A: Artwork Preview */}
          <GlassCard className={styles.previewCard}>
            <div className={styles.previewImageContainer}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt="Artwork upload preview"
                className={styles.previewImage}
              />
            </div>
            <div className={styles.previewDetails}>
              <span className={styles.previewTitle}>Uploaded Asset</span>
              <span className={styles.previewBadge}>
                {width} x {height} cm
              </span>
              <span className="text-xs text-text/50 truncate max-w-xs sm:max-w-md">
                {fileUrl}
              </span>
            </div>
          </GlassCard>

          {/* Section B: Sizing Configuration */}
          <GlassCard className={styles.card}>
            <h2 className="text-lg font-bold text-text">
              {locale === 'ar-eg' ? 'مقاسات وتخطيط الطباعة' : 'Sizing & Layout'}
            </h2>
            
            {/* Preset Sizes Chart / Grid */}
            <div className="flex flex-col gap-2">
              <label className={styles.inputLabel}>
                {locale === 'ar-eg' ? 'اختر مقاس معياري' : 'Select Standard Size Preset'}
              </label>
              <div className={styles.presetGrid}>
                {PRESET_SIZES.map((preset) => {
                  const isActive = width === preset.width && height === preset.height;
                  return (
                    <div
                      key={`${preset.width}x${preset.height}`}
                      onClick={() => {
                        setWidth(preset.width);
                        setHeight(preset.height);
                      }}
                      className={cn(
                        styles.presetCard,
                        isActive && styles.activePresetCard
                      )}
                    >
                      <span className={styles.presetLabel}>
                        {locale === 'ar-eg' ? preset.nameAr : preset.nameEn}
                      </span>
                      <span className={styles.presetDimensions}>
                        {preset.width} × {preset.height} {locale === 'ar-eg' ? 'سم' : 'cm'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-[1px] bg-white/10 my-1" />

            <div className="flex flex-col gap-2">
              <label className={styles.inputLabel}>
                {locale === 'ar-eg' ? 'أو أدخل مقاس مخصص (سم)' : 'Or Enter Custom Dimensions (cm)'}
              </label>
              <div className={styles.dimensionsGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>{t('checkout.widthLabel')}</label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={width}
                    onChange={(e) => setWidth(Math.max(5, Math.min(500, parseInt(e.target.value) || 0)))}
                    className={styles.textInput}
                    disabled={placingOrder}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>{t('checkout.heightLabel')}</label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={height}
                    onChange={(e) => setHeight(Math.max(5, Math.min(500, parseInt(e.target.value) || 0)))}
                    className={styles.textInput}
                    disabled={placingOrder}
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Substrates & Frames Selection */}
          <GlassCard className={styles.card}>
            <MaterialSelector
              selectedSubstrateId={substrateId}
              onSelectSubstrate={(id, cost) => {
                setSubstrateId(id);
                setSubstrateCost(cost);
              }}
              selectedFrameId={frameId}
              onSelectFrame={(id, cost) => {
                setFrameId(id);
                setFrameCost(cost);
              }}
              selectedCoatingId={coatingId}
              onSelectCoating={(id, cost) => {
                setCoatingId(id);
                setCoatingCost(cost);
              }}
            />
          </GlassCard>

          {/* Shipping Details */}
          <GlassCard className={styles.card}>
            <h2 className="text-lg font-bold text-text">
              {locale === 'ar-eg' ? 'تفاصيل العنوان وشحن الطلب' : 'Shipping & Delivery Address'}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className={styles.inputLabel}>
                  {locale === 'ar-eg' ? 'المدينة' : 'City / Governorate'}
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={styles.selectInput}
                  disabled={placingOrder}
                >
                  <option value="Cairo">{locale === 'ar-eg' ? 'القاهرة' : 'Cairo'}</option>
                  <option value="Giza">{locale === 'ar-eg' ? 'الجيزة' : 'Giza'}</option>
                  <option value="Alexandria">{locale === 'ar-eg' ? 'الإسكندرية' : 'Alexandria'}</option>
                  <option value="Qalyubia">{locale === 'ar-eg' ? 'القليوبية' : 'Qalyubia'}</option>
                  <option value="Sharqia">{locale === 'ar-eg' ? 'الشرقية' : 'Sharqia'}</option>
                  <option value="Gharbia">{locale === 'ar-eg' ? 'الغربية' : 'Gharbia'}</option>
                  <option value="Dakahlia">{locale === 'ar-eg' ? 'الدقهلية' : 'Dakahlia'}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={styles.inputLabel}>
                  {locale === 'ar-eg' ? 'المنطقة / الحي' : 'District / Area'}
                </label>
                <input
                  type="text"
                  placeholder={locale === 'ar-eg' ? 'مثال: مصر الجديدة، المعادي' : 'e.g. Heliopolis, Maadi'}
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className={styles.textInput}
                  disabled={placingOrder}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className={styles.inputLabel}>
                  {locale === 'ar-eg' ? 'اسم الشارع ورقم المبنى' : 'Street Address & Building No.'}
                </label>
                <input
                  type="text"
                  placeholder={locale === 'ar-eg' ? 'مثال: 12 شارع الحرية' : 'e.g. 12 El Horreya St.'}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className={styles.textInput}
                  disabled={placingOrder}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className={styles.inputLabel}>
                  {locale === 'ar-eg' ? 'الدور / الشقة / تفاصيل إضافية (اختياري)' : 'Floor / Apt / Additional Notes (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={locale === 'ar-eg' ? 'مثال: الدور الثالث، شقة 5' : 'e.g. 3rd Floor, Apt 5'}
                  value={buildingApt}
                  onChange={(e) => setBuildingApt(e.target.value)}
                  className={styles.textInput}
                  disabled={placingOrder}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-text/80 select-none cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={galleryOptIn}
                onChange={(e) => setGalleryOptIn(e.target.checked)}
                className="rounded border-white/10 bg-white/5 accent-accent"
                disabled={placingOrder}
              />
              <span>{t('checkout.galleryOptIn')}</span>
            </label>
          </GlassCard>

          {/* Payment Method Selection */}
          <GlassCard className={styles.card}>
            <h2 className="text-lg font-bold text-text">
              {locale === 'ar-eg' ? 'طريقة الدفع' : 'Payment Method'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              {/* Option 1: Card */}
              <div
                onClick={() => setPaymentMethod('card')}
                className={cn(
                  styles.presetCard,
                  paymentMethod === 'card' && styles.activePresetCard
                )}
              >
                <span className={styles.presetLabel}>
                  {locale === 'ar-eg' ? 'بطاقة بنكية' : 'Credit Card'}
                </span>
                <span className="text-[10px] opacity-60">Visa / Mastercard</span>
              </div>

              {/* Option 2: Mobile Wallet */}
              <div
                onClick={() => setPaymentMethod('wallet')}
                className={cn(
                  styles.presetCard,
                  paymentMethod === 'wallet' && styles.activePresetCard
                )}
              >
                <span className={styles.presetLabel}>
                  {locale === 'ar-eg' ? 'محفظة إلكترونية' : 'Mobile Wallet'}
                </span>
                <span className="text-[10px] opacity-60">InstaPay / Cash wallets</span>
              </div>

              {/* Option 3: Cash on Delivery */}
              <div
                onClick={() => setPaymentMethod('cod')}
                className={cn(
                  styles.presetCard,
                  paymentMethod === 'cod' && styles.activePresetCard
                )}
              >
                <span className={styles.presetLabel}>
                  {locale === 'ar-eg' ? 'الدفع عند الاستلام' : 'Cash on Delivery'}
                </span>
                <span className="text-[10px] opacity-60">{locale === 'ar-eg' ? 'الدفع كاش للمندوب' : 'Pay cash to courier'}</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Checkout Summary & Pricing */}
        <div className={styles.rightColumn}>
          {/* Promo code input */}
          <GlassCard className={styles.card}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>{t('checkout.promoLabel')}</label>
              <div className={styles.promoWrapper}>
                <input
                  type="text"
                  placeholder="WELCOME2026"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className={`${styles.textInput} ${styles.promoInput}`}
                  disabled={placingOrder || validatingPromo}
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className={styles.promoBtn}
                  disabled={placingOrder || validatingPromo || !promoCode}
                >
                  {validatingPromo ? '...' : t('checkout.applyPromo')}
                </button>
              </div>
              {promoError && <span className={styles.promoError}>{promoError}</span>}
              {promoSuccess && <span className={styles.promoSuccess}>{promoSuccess}</span>}
            </div>
          </GlassCard>

          {/* Live Pricing Summary breakdown */}
          <GlassCard className="overflow-hidden">
            <PriceBreakdown
              breakdown={pricingResult.priceBreakdown}
              isMarginViolated={pricingResult.isMarginViolated}
            />

            <div className="p-6 pt-0">
              <button
                type="button"
                onClick={handlePlaceOrder}
                className={styles.payButton}
                disabled={
                  placingOrder ||
                  !substrateId ||
                  pricingResult.isMarginViolated ||
                  shippingAddress.trim().length < 5
                }
              >
                {placingOrder ? t('checkout.processingOrder') : t('checkout.payButton')}
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Paymob Mocking simulation Modal overlay */}
      <AnimatePresence>
        {showSimModal && (
          <div className={styles.modalOverlay}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassCard className={styles.modalContent}>
                <h3 className={styles.modalTitle}>{t('checkout.simModalTitle')}</h3>
                <p className={styles.modalDesc}>{t('checkout.simModalDesc')}</p>

                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => handleSimulatePayment(true)}
                    className={styles.modalBtnSuccess}
                    disabled={simulatingPayment}
                  >
                    {simulatingPayment ? '...' : t('checkout.simSuccess')}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSimulatePayment(false)}
                    className={styles.modalBtnFail}
                    disabled={simulatingPayment}
                  >
                    {simulatingPayment ? '...' : t('checkout.simFail')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSimModal(false)}
                    className={styles.modalCloseBtn}
                    disabled={simulatingPayment}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
