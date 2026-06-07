'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import GlassCard from '../../components/glass/GlassCard';
import Dropzone from '../../components/upload/Dropzone';
import OrderStatusBadge from '../../components/dashboard/OrderStatusBadge';
import { useTranslation } from '../../context/TranslationContext';
import { useOrderStream } from '@/hooks/useOrderStream';
import styles from './Dashboard.module.css';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@printing-store/core-logic';

interface MaterialItem {
  id: string;
  name: string;
  type: 'ink' | 'substrate' | 'frame' | 'coating' | 'other';
  unitName: string;
  costPerUnit: number;
}

function getLocalizedMaterialName(name: string, locale: string): string {
  const localMap: Record<string, Record<string, string>> = {
    'Matte Canvas': { 'ar-eg': 'كانفاس مطفي فاخر', 'en': 'Premium Matte Canvas' },
    'Glossy Photo Paper': { 'ar-eg': 'ورق صور لامع ممتاز', 'en': 'Glossy Photo Paper' },
    'Vinyl Banner': { 'ar-eg': 'بنر فينيل متين شاق', 'en': 'Durable Vinyl Banner' },
    'Pine Wood': { 'ar-eg': 'إطار خشب سويدي طبيعي', 'en': 'Natural Pine Wood Frame' },
    'Aluminum': { 'ar-eg': 'إطار ألومنيوم فخم', 'en': 'Polished Aluminum Frame' },
    'Glossy Finish': { 'ar-eg': 'طبقة حماية لامعة', 'en': 'Glossy Protective Coating' },
    'Matte Finish': { 'ar-eg': 'طبقة حماية مطفية', 'en': 'Matte Protective Coating' },
    'UV Protective Gloss': { 'ar-eg': 'طبقة لمعان مقاومة للأشعة', 'en': 'UV Protective Gloss' },
  };

  return localMap[name]?.[locale] || name;
}

interface StandardRatio {
  name: string;
  arName: string;
  w: number;
  h: number;
}

function getNearestStandardRatio(ratio: number): StandardRatio {
  const standards = [
    { name: '1:1 Square', arName: '1:1 مربع', w: 1, h: 1 },
    { name: '4:5', arName: '4:5', w: 4, h: 5 },
    { name: '3:4', arName: '3:4', w: 3, h: 4 },
    { name: '2:3', arName: '2:3', w: 2, h: 3 },
    { name: '16:9', arName: '16:9', w: 16, h: 9 }
  ];

  const normalizedRatio = ratio < 1 ? 1 / ratio : ratio;

  let bestMatch = standards[0];
  let minDiff = Infinity;

  for (const std of standards) {
    const stdRatio = std.w / std.h;
    const diff = Math.abs(normalizedRatio - stdRatio);
    if (diff < minDiff) {
      minDiff = diff;
      bestMatch = std;
    }
  }

  if (ratio < 1) {
    return {
      name: `${bestMatch.h}:${bestMatch.w}`,
      arName: `${bestMatch.h}:${bestMatch.w}`,
      w: bestMatch.h,
      h: bestMatch.w
    };
  }
  return bestMatch;
}

interface UploadResult {
  success: boolean;
  originalName: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  thumbnailUrl: string;
  aiAssessment: {
    artworkClassification: string;
    estimatedInkDensityFactor: number;
    compressionArtifactsDetected: boolean;
    printReadinessScore: number;
    riskAssessment: string;
    isPotentialPricingGame: boolean;
    rawAiPayload?: Record<string, any>;
  };
}

interface Order {
  id: string;
  status: OrderStatus;
  widthCm: number;
  heightCm: number;
  fileUrl: string;
  priceEgp: number;
  createdAt: string;
}

export default function Dashboard() {
  const { t, locale } = useTranslation();
  
  // Custom print sizing parameters (defaults to 50cm x 50cm)
  const [widthCm, setWidthCm] = useState(50);
  const [heightCm, setHeightCm] = useState(50);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Materials & configuration states
  const [materials, setMaterials] = useState<{
    substrates: MaterialItem[];
    frames: MaterialItem[];
    coatings: MaterialItem[];
    inks: MaterialItem[];
  }>({
    substrates: [],
    frames: [],
    coatings: [],
    inks: [],
  });
  const [selectedSubstrate, setSelectedSubstrate] = useState<MaterialItem | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<MaterialItem | null>(null);
  const [selectedCoating, setSelectedCoating] = useState<MaterialItem | null>(null);
  const [systemConfig, setSystemConfig] = useState<{
    markup_margin: number;
    service_fee: number;
    ai_audit_fee: number;
  }>({
    markup_margin: 1.5,
    service_fee: 50.0,
    ai_audit_fee: 0.0,
  });
  const [loadingMaterials, setLoadingMaterials] = useState(true);

  // User session details
  const [user, setUser] = useState<any | null>(null);

  // Real-time order lists
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Subscribe to live Server-Sent-Events updates
  const { connectionStatus, latestUpdate } = useOrderStream();

  // Load recent orders and user info on mount
  async function loadOrders() {
    try {
      const res = await fetch('/api/orders/history?limit=5');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Failed to check authentication details:', err);
      }
    }

    async function loadMaterials() {
      try {
        const res = await fetch('/api/materials');
        if (res.ok) {
          const data = await res.json();
          setMaterials({
            substrates: data.substrates || [],
            frames: data.frames || [],
            coatings: data.coatings || [],
            inks: data.inks || [],
          });
          setSystemConfig(data.config || {
            markup_margin: 1.5,
            service_fee: 50.0,
            ai_audit_fee: 0.0,
          });
          if (data.substrates?.length > 0) {
            setSelectedSubstrate(data.substrates[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load materials catalog:', err);
      } finally {
        setLoadingMaterials(false);
      }
    }

    checkAuth();
    loadOrders();
    loadMaterials();
  }, []);

  // Update orders array in real-time when notifications arrive
  useEffect(() => {
    if (latestUpdate) {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === latestUpdate.orderId);
        if (idx !== -1) {
          // Update order status in-place
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: latestUpdate.status };
          return updated;
        } else {
          // If the order is new (not in recent list), fetch recent history to capture it
          loadOrders();
          return prev;
        }
      });
    }
  }, [latestUpdate]);

  // Client-side visual costing calculations matching server formulas
  const pricingResult = useMemo(() => {
    if (!selectedSubstrate) return null;

    const substrateCostPerUnit = selectedSubstrate.costPerUnit;
    const frameCostPerUnit = selectedFrame ? selectedFrame.costPerUnit : 0;
    const coatingCostPerUnit = selectedCoating ? selectedCoating.costPerUnit : 0;
    const inkCostPerUnit = materials.inks.length > 0 ? materials.inks[0].costPerUnit : 5.0;

    const densityMultiplier = uploadResult ? uploadResult.aiAssessment.estimatedInkDensityFactor : 1.0;
    const aiFee = uploadResult ? systemConfig.ai_audit_fee : 0.0;

    const areaSqM = (widthCm * heightCm) / 10000;
    const perimeterCm = 2 * (widthCm + heightCm);

    // Calculate base cost
    const subCost = areaSqM * substrateCostPerUnit;
    const frCost = perimeterCm * frameCostPerUnit;
    const coatCost = areaSqM * coatingCostPerUnit;
    const inkConsumption = areaSqM * 10 * densityMultiplier;
    const inkCost = inkConsumption * inkCostPerUnit;

    const baseCost = subCost + frCost + coatCost + inkCost;
    const retailPrice = (baseCost * systemConfig.markup_margin) + systemConfig.service_fee + aiFee;

    return {
      substrateCost: subCost * systemConfig.markup_margin,
      frameCost: frCost * systemConfig.markup_margin,
      coatingCost: coatCost * systemConfig.markup_margin,
      inkCost: inkCost * systemConfig.markup_margin,
      serviceFee: systemConfig.service_fee,
      aiAuditFee: aiFee,
      baseCost: baseCost,
      total: retailPrice,
    };
  }, [widthCm, heightCm, selectedSubstrate, selectedFrame, selectedCoating, materials.inks, uploadResult, systemConfig]);

  const dynamicAssessment = useMemo(() => {
    if (!uploadResult) return null;

    const widthPx = uploadResult.widthPx;
    const heightPx = uploadResult.heightPx;

    if (!widthPx || !heightPx) return null;

    const imageRatio = widthPx / heightPx;
    const printRatio = widthCm / heightCm;

    // 3% tolerance for aspect ratio matching
    const ratioDifference = Math.abs(imageRatio - printRatio) / imageRatio;
    const isRatioMatched = ratioDifference <= 0.03;

    const ppcWidth = widthPx / widthCm;
    const ppcHeight = heightPx / heightCm;
    const minPpc = Math.min(ppcWidth, ppcHeight);
    const dpi = Math.round(minPpc * 2.54);

    const readinessScore = Math.max(35, Math.min(100, Math.round(minPpc * 1.5 + 40)));
    const compressionArtifacts = minPpc < 28;

    const nearestStandardRatio = getNearestStandardRatio(imageRatio);

    // Calculate 3 recommended print sizes preserving the exact aspect ratio
    const recommendations = [];
    const targetMaxDims = [45, 90, 135]; // Small, Medium, Large targets

    for (const maxDim of targetMaxDims) {
      let w = 50;
      let h = 50;
      if (imageRatio >= 1) {
        w = maxDim;
        h = Math.round(maxDim / imageRatio);
      } else {
        h = maxDim;
        w = Math.round(maxDim * imageRatio);
      }
      recommendations.push({ width: w, height: h });
    }

    return {
      dpi,
      printReadinessScore: readinessScore,
      compressionArtifactsDetected: compressionArtifacts,
      isRatioMatched,
      nearestStandardRatio,
      recommendations,
    };
  }, [uploadResult, widthCm, heightCm]);

  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale === 'ar-eg' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header Profile Panel */}
      <GlassCard className={styles.profileBox}>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl md:text-2xl font-black text-accent">
            {locale === 'ar-eg' ? `مرحباً بك، ${user?.fullName || ''}` : `Welcome back, ${user?.fullName || ''}`}
          </h1>
          <p className="text-xs text-text/60">
            {user?.email || ''}
          </p>
        </div>
        {user?.role && user.role !== 'customer' && (
          <div className="flex items-center gap-2">
            {user.role === 'admin' && (
              <Link 
                href="/ops/admin" 
                className="text-[10px] tracking-wider uppercase font-black text-accent bg-accent/10 border border-accent/20 hover:bg-accent/20 px-3 py-1.5 rounded-lg transition-all duration-300 shadow-[0_0_8px_rgba(255,20,147,0.15)] hover:shadow-[0_0_12px_rgba(255,20,147,0.3)]"
              >
                {locale === 'ar-eg' ? 'إدارة النظام' : 'Admin Control'}
              </Link>
            )}
            {(user.role === 'admin' || user.role === 'employee' || user.role === 'courier') && (
              <Link 
                href="/ops/fulfillment" 
                className="text-[10px] tracking-wider uppercase font-black text-text/80 bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all duration-300"
              >
                {locale === 'ar-eg' ? 'لوحة التشغيل والطباعة' : 'Fulfillment Board'}
              </Link>
            )}
            <div className="text-[10px] tracking-wider uppercase font-black text-text/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              {locale === 'ar-eg' ? `الصلاحية: ${user.role}` : `Role: ${user.role}`}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Main Bento Grid layout */}
      <div className={styles.dashboardGrid}>
        
        {/* Cost Estimator Bento widget */}
        <GlassCard className={cn(styles.bentoItem, styles.calculatorBox)}>
          <h2 className="text-xs font-black tracking-wider uppercase text-text/80 border-b border-white/10 pb-2">
            {locale === 'ar-eg' ? 'حاسبة التكلفة الفورية' : 'Instant Cost Simulator'}
          </h2>

          <div className="flex flex-col gap-4 my-2">
            {/* Width Range Slider */}
            <div className={styles.sliderRow}>
              <div className={styles.sliderLabel}>
                <span>{locale === 'ar-eg' ? 'العرض (سم)' : 'Width (cm)'}</span>
                <span className="font-bold text-accent">{widthCm} cm</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                value={widthCm}
                onChange={(e) => setWidthCm(Number(e.target.value))}
                className={styles.rangeInput}
              />
            </div>

            {/* Height Range Slider */}
            <div className={styles.sliderRow}>
              <div className={styles.sliderLabel}>
                <span>{locale === 'ar-eg' ? 'الارتفاع (سم)' : 'Height (cm)'}</span>
                <span className="font-bold text-accent">{heightCm} cm</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className={styles.rangeInput}
              />
            </div>

            {loadingMaterials ? (
              <div className="text-center py-4 text-xs text-text/50">
                <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-2" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Substrate Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text/50">
                    {locale === 'ar-eg' ? 'الخامة الأساسية للطباعة' : 'Substrate Base'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {materials.substrates.map((sub) => {
                      const isSel = selectedSubstrate?.id === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSelectedSubstrate(sub)}
                          className={`px-3 py-2.5 rounded-xl font-bold text-center text-xs border transition-all duration-300 cursor-pointer ${
                            isSel
                              ? 'bg-accent text-neutral-950 border-accent shadow-[0_0_12px_rgba(255,20,147,0.35)]'
                              : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-accent/30'
                          }`}
                        >
                          {getLocalizedMaterialName(sub.name, locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Frame Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text/50">
                    {locale === 'ar-eg' ? 'إطار شد خشبي أو معدني' : 'Optional Framing'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFrame(null)}
                      className={`px-3 py-2.5 rounded-xl font-bold text-center text-xs border transition-all duration-300 cursor-pointer ${
                        selectedFrame === null
                          ? 'bg-accent text-neutral-950 border-accent shadow-[0_0_12px_rgba(255,20,147,0.35)]'
                          : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-accent/30'
                      }`}
                    >
                      {locale === 'ar-eg' ? 'بدون إطار' : 'No Frame'}
                    </button>
                    {materials.frames.map((fr) => {
                      const isSel = selectedFrame?.id === fr.id;
                      return (
                        <button
                          key={fr.id}
                          type="button"
                          onClick={() => setSelectedFrame(fr)}
                          className={`px-3 py-2.5 rounded-xl font-bold text-center text-xs border transition-all duration-300 cursor-pointer ${
                            isSel
                              ? 'bg-accent text-neutral-950 border-accent shadow-[0_0_12px_rgba(255,20,147,0.35)]'
                              : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-accent/30'
                          }`}
                        >
                          {getLocalizedMaterialName(fr.name, locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Coating Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-text/50">
                    {locale === 'ar-eg' ? 'طبقة حماية إضافية' : 'Protective Coating'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCoating(null)}
                      className={`px-3 py-2.5 rounded-xl font-bold text-center text-xs border transition-all duration-300 cursor-pointer ${
                        selectedCoating === null
                          ? 'bg-accent text-neutral-950 border-accent shadow-[0_0_12px_rgba(255,20,147,0.35)]'
                          : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-accent/30'
                      }`}
                    >
                      {locale === 'ar-eg' ? 'بدون تغطية' : 'No Coating'}
                    </button>
                    {materials.coatings.map((co) => {
                      const isSel = selectedCoating?.id === co.id;
                      return (
                        <button
                          key={co.id}
                          type="button"
                          onClick={() => setSelectedCoating(co)}
                          className={`px-3 py-2.5 rounded-xl font-bold text-center text-xs border transition-all duration-300 cursor-pointer ${
                            isSel
                              ? 'bg-accent text-neutral-950 border-accent shadow-[0_0_12px_rgba(255,20,147,0.35)]'
                              : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-accent/30'
                          }`}
                        >
                          {getLocalizedMaterialName(co.name, locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {pricingResult && (
            <div className="flex flex-col gap-1 bg-white/5 p-4 rounded-xl border border-white/5 mt-auto text-xs">
              <div className={styles.infoItem}>
                <span>{locale === 'ar-eg' ? 'تكلفة الخامة' : 'Substrate Cost'}</span>
                <span className="text-text/75">{pricingResult.substrateCost.toFixed(2)} EGP</span>
              </div>
              <div className={styles.infoItem}>
                <span>{locale === 'ar-eg' ? 'تكلفة الحبر' : 'Ink Cost'}</span>
                <span className="text-text/75">
                  {pricingResult.inkCost.toFixed(2)} EGP
                  {uploadResult && <span className="text-[9px] text-accent font-bold ml-1">({uploadResult.aiAssessment.estimatedInkDensityFactor}x)</span>}
                </span>
              </div>
              {pricingResult.frameCost > 0 && (
                <div className={styles.infoItem}>
                  <span>{locale === 'ar-eg' ? 'تكلفة الإطار' : 'Frame Cost'}</span>
                  <span className="text-text/75">{pricingResult.frameCost.toFixed(2)} EGP</span>
                </div>
              )}
              {pricingResult.coatingCost > 0 && (
                <div className={styles.infoItem}>
                  <span>{locale === 'ar-eg' ? 'طبقة الحماية' : 'Coating Cost'}</span>
                  <span className="text-text/75">{pricingResult.coatingCost.toFixed(2)} EGP</span>
                </div>
              )}
              <div className={styles.infoItem}>
                <span>{locale === 'ar-eg' ? 'رسوم التجهيز' : 'Service Fee'}</span>
                <span className="text-text/75">{pricingResult.serviceFee.toFixed(2)} EGP</span>
              </div>
              {pricingResult.aiAuditFee > 0 && (
                <div className={styles.infoItem}>
                  <span>{locale === 'ar-eg' ? 'رسوم تدقيق الذكاء الاصطناعي' : 'AI Quality Audit'}</span>
                  <span className="text-text/75">{pricingResult.aiAuditFee.toFixed(2)} EGP</span>
                </div>
              )}
              <div className={styles.infoItem}>
                <span className="font-bold">{locale === 'ar-eg' ? 'الإجمالي التقديري' : 'Estimated Total'}</span>
                <span className={styles.infoValue}>{pricingResult.total.toFixed(2)} EGP</span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Upload Bento Box widget */}
        <GlassCard className={cn(styles.bentoItem, styles.uploadBox)}>
          <h2 className="text-xs font-black tracking-wider uppercase text-text/80 border-b border-white/10 pb-2">
            {locale === 'ar-eg' ? 'تحميل الصورة وتدقيق الجودة' : 'Design Upload & Quality Audit'}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-2">
            <div className="flex flex-col justify-center">
              <Dropzone
                onUploadSuccess={(res) => setUploadResult(res)}
                widthCm={widthCm}
                heightCm={heightCm}
              />
            </div>

            {/* Ingestion results and vision pre-press details panel */}
            <div className="flex flex-col justify-between border border-white/5 bg-white/5 p-5 rounded-2xl min-h-[220px]">
              {uploadResult ? (
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-center gap-3">
                    <Image
                      src={uploadResult.thumbnailUrl}
                      alt="Thumbnail Preview"
                      width={48}
                      height={48}
                      className="w-12 h-12 object-cover rounded-lg border border-white/10"
                    />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold truncate text-text">{uploadResult.originalName}</span>
                      <span className="text-[10px] text-text/50">{uploadResult.widthPx} x {uploadResult.heightPx} px</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-auto">
                    <div className={styles.infoItem}>
                      <span>{locale === 'ar-eg' ? 'تقييم الجودة' : 'Print Readiness'}</span>
                      <span className={cn(
                        "font-bold",
                        dynamicAssessment && dynamicAssessment.printReadinessScore >= 80 ? "text-green-500" : "text-yellow-500"
                      )}>
                        {dynamicAssessment ? dynamicAssessment.printReadinessScore : uploadResult.aiAssessment.printReadinessScore}%
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span>{locale === 'ar-eg' ? 'دقة الطباعة' : 'Resolution (DPI)'}</span>
                      <span className="text-text/75 font-semibold">
                        {dynamicAssessment ? `${dynamicAssessment.dpi} DPI` : '---'}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span>{locale === 'ar-eg' ? 'كثافة الحبر' : 'Ink Density'}</span>
                      <span className="text-text/75">{uploadResult.aiAssessment.estimatedInkDensityFactor}x</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span>{locale === 'ar-eg' ? 'تلاعب بالأسعار' : 'Pricing Game Checks'}</span>
                      <span className={cn(
                        "font-bold",
                        uploadResult.aiAssessment.isPotentialPricingGame ? "text-red-500" : "text-green-500"
                      )}>
                        {uploadResult.aiAssessment.isPotentialPricingGame ? (locale === 'ar-eg' ? 'مرفوض' : 'Flagged') : (locale === 'ar-eg' ? 'سليم' : 'Clean')}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span>{locale === 'ar-eg' ? 'محرك الفحص' : 'Audit Engine'}</span>
                      <span className={cn(
                        "font-bold text-[10px] uppercase px-2 py-0.5 rounded border",
                        uploadResult.aiAssessment.rawAiPayload?.mock 
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" 
                          : "bg-green-500/10 text-green-400 border-green-500/20"
                      )}>
                        {uploadResult.aiAssessment.rawAiPayload?.mock 
                          ? (locale === 'ar-eg' ? 'محاكاة الجودة' : 'Pre-Press Sim (Mock)') 
                          : (locale === 'ar-eg' ? 'ذكاء اصطناعي (Gemini)' : 'Live AI (Gemini 1.5)')}
                      </span>
                    </div>
                  </div>

                  {/* Proceed to Checkout Route Button */}
                  <Link
                    href={`/checkout?file_url=${encodeURIComponent(uploadResult.thumbnailUrl)}&width=${widthCm}&height=${heightCm}&substrate_id=${selectedSubstrate?.id || ''}&frame_id=${selectedFrame?.id || ''}&coating_id=${selectedCoating?.id || ''}&ink_density=${uploadResult.aiAssessment.estimatedInkDensityFactor}`}
                    className={styles.checkoutBtn}
                  >
                    {locale === 'ar-eg' ? 'تابع لإتمام الطلب والدفع' : 'Proceed to Checkout'}
                  </Link>

                  {/* Pre-Press Dynamic Quality & Aspect Ratio Warnings Notification Panel */}
                  <div className="mt-4 flex flex-col gap-2.5">
                    {/* 1. Resolution / Quality Warning (Dynamic) */}
                    {dynamicAssessment && dynamicAssessment.printReadinessScore < 80 && (
                      <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-400 flex flex-col gap-1">
                        <span className="font-bold flex items-center gap-1">
                          ⚠️ {t('warnings.qualityTitle')}
                        </span>
                        <span className="text-text/80 leading-normal">
                          {uploadResult.aiAssessment.artworkClassification === 'error_fallback'
                            ? t('warnings.aiAuditFailed')
                            : t('warnings.dynamicQuality')
                                .replace('{dpi}', String(dynamicAssessment.dpi))
                                .replace('{width}', String(widthCm))
                                .replace('{height}', String(heightCm))}
                        </span>
                      </div>
                    )}

                    {/* 2. Compression Artifacts Warning (Dynamic) */}
                    {dynamicAssessment && dynamicAssessment.compressionArtifactsDetected && (
                      <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-400 flex flex-col gap-1">
                        <span className="font-bold flex items-center gap-1">
                          ⚠️ {t('warnings.compressionTitle')}
                        </span>
                        <span className="text-text/80 leading-normal">
                          {t('warnings.compressionDesc')}
                        </span>
                      </div>
                    )}

                    {/* 3. Pricing Game Audit (Pass-through from upload AI) */}
                    {uploadResult.aiAssessment.isPotentialPricingGame && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 flex flex-col gap-1">
                        <span className="font-bold flex items-center gap-1">
                          🚨 {t('warnings.pricingTitle')}
                        </span>
                        <span className="text-text/80 leading-normal">
                          {t('warnings.pricingDesc')}
                        </span>
                      </div>
                    )}

                    {/* 4. Dynamic Aspect Ratio Matching Panel */}
                    {dynamicAssessment && (
                      <div className={cn(
                        "p-3 rounded-xl text-[11px] flex flex-col gap-1.5 border",
                        dynamicAssessment.isRatioMatched 
                          ? "bg-green-500/10 border-green-500/20 text-green-400" 
                          : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                      )}>
                        <span className="font-bold flex items-center gap-1">
                          {dynamicAssessment.isRatioMatched 
                            ? `✓ ${t('warnings.ratioMatchTitle')}` 
                            : `⚠️ ${t('warnings.ratioMismatchTitle')}`}
                        </span>
                        <span className="text-text/80 leading-normal">
                          {dynamicAssessment.isRatioMatched 
                            ? t('warnings.ratioMatchDesc') 
                            : t('warnings.ratioMismatchDesc')
                                .replace('{designRatio}', locale === 'ar-eg' ? dynamicAssessment.nearestStandardRatio.arName : dynamicAssessment.nearestStandardRatio.name)
                                .replace('{printWidth}', String(widthCm))
                                .replace('{printHeight}', String(heightCm))}
                        </span>
                      </div>
                    )}

                    {/* 5. Recommended Size Snippets */}
                    {dynamicAssessment && (
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-[11px]">
                        <span className="font-bold text-text/90">
                          {t('warnings.recommendSizeTitle')}
                        </span>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {dynamicAssessment.recommendations.map((rec, i) => {
                            const isRecommendedMatched = widthCm === rec.width && heightCm === rec.height;
                            const sizeLabel = i === 0 
                              ? (locale === 'ar-eg' ? 'صغير' : 'Small') 
                              : i === 1 
                                ? (locale === 'ar-eg' ? 'متوسط' : 'Medium') 
                                : (locale === 'ar-eg' ? 'كبير' : 'Large');
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setWidthCm(rec.width);
                                  setHeightCm(rec.height);
                                }}
                                className={cn(
                                  "px-2 py-1.5 rounded-lg border font-bold text-center text-[10px] cursor-pointer transition-all duration-200",
                                  isRecommendedMatched
                                    ? "bg-accent text-neutral-950 border-accent shadow-[0_0_8px_rgba(255,20,147,0.3)]"
                                    : "bg-white/5 border-white/10 text-text/80 hover:bg-white/10 hover:border-accent/30"
                                )}
                              >
                                <div className="text-[8px] opacity-75 uppercase font-medium">{sizeLabel}</div>
                                <div>{rec.width}x{rec.height} cm</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <svg className="w-8 h-8 text-text/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-text/45 px-4 leading-relaxed">
                    {locale === 'ar-eg' ? 'قم برفع ملف تصميم لرؤية تقرير تدقيق الجودة والتكلفة فوراً' : 'Upload a design file to view quality audit and cost breakdown instantly'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Live Order tracking queue Bento widget (hooked up to SSE) */}
        <GlassCard className={cn(styles.bentoItem, styles.queueBox)}>
          <div className={styles.headerWithSSE}>
            <h2 className="text-xs font-black tracking-wider uppercase text-text/80">
              {t('orders.activeOrders')}
            </h2>
            
            {/* Live SSE Status Dot Badge */}
            <div className={styles.sseStatusWrapper}>
              <span className={cn(
                styles.sseIndicator,
                connectionStatus === 'connected' && styles.sseIndicatorConnected,
                connectionStatus === 'connecting' && styles.sseIndicatorConnecting,
                connectionStatus === 'disconnected' && styles.sseIndicatorDisconnected
              )} />
              <span>
                {connectionStatus === 'connected' ? t('orders.sseStatus.connected') : t('orders.sseStatus.connecting')}
              </span>
            </div>
          </div>

          <div className={styles.orderList}>
            {ordersLoading ? (
              <div className="text-center py-6 text-xs text-text/50">{t('common.loading')}</div>
            ) : orders.length > 0 ? (
              orders.map((o) => (
                <div key={o.id} className={styles.orderRow}>
                  <div className={styles.orderMeta}>
                    <span className={styles.orderTitle}>
                      {t('orders.orderId')}: #{o.id.slice(0, 8)} • {o.widthCm}x{o.heightCm} cm
                    </span>
                    <span className={styles.orderSub}>
                      {t('orders.date')}: {formatDate(o.createdAt)} • {o.priceEgp.toFixed(2)} EGP
                    </span>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <svg className="w-8 h-8 opacity-25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-xs">{t('orders.emptyState')}</span>
              </div>
            )}
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
