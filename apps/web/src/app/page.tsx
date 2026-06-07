'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/glass/GlassCard';
import { useTranslation } from '../context/TranslationContext';
import { calculateOrderPrice } from '@printing-store/core-logic';

interface MaterialItem {
  id: string;
  name: string;
  type: 'substrate' | 'frame' | 'ink';
  unitName: string;
  costPerUnit: number;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
  title: string;
  description: string | null;
  artistName: string;
  createdAt: string;
}

function getLocalizedMaterialName(name: string, locale: string): string {
  const localMap: Record<string, Record<string, string>> = {
    'Matte Canvas': { 'ar-eg': 'كانفاس مطفي فاخر', 'en': 'Premium Matte Canvas' },
    'Glossy Photo Paper': { 'ar-eg': 'ورق صور لامع ممتاز', 'en': 'Glossy Photo Paper' },
    'Vinyl Banner': { 'ar-eg': 'بنر فينيل متين شاق', 'en': 'Durable Vinyl Banner' },
    'Pine Wood': { 'ar-eg': 'إطار خشب سويدي طبيعي', 'en': 'Natural Pine Wood Frame' },
    'Aluminum': { 'ar-eg': 'إطار ألومنيوم فخم', 'en': 'Polished Aluminum Frame' },
  };

  return localMap[name]?.[locale] || name;
}

export default function Home() {
  const { t, locale } = useTranslation();
  const [user, setUser] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Gallery items states
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryPage, setGalleryPage] = useState(1);
  const [totalGalleryPages, setTotalGalleryPages] = useState(1);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [galleryError, setGalleryError] = useState('');

  // Cost calculator state
  const [widthCm, setWidthCm] = useState(50);
  const [heightCm, setHeightCm] = useState(50);
  const [materials, setMaterials] = useState<{ substrates: MaterialItem[]; frames: MaterialItem[] }>({
    substrates: [],
    frames: [],
  });
  const [selectedSubstrate, setSelectedSubstrate] = useState<MaterialItem | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<MaterialItem | null>(null);
  const [loadingMaterials, setLoadingMaterials] = useState(true);

  const galleryLimit = 6; // Compact grid for landing page
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Card Tilt Effect
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseLeave = () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [galleryItems]);

  // Check user authentication
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json() as any;
          if (data.authenticated) {
            setUser(data.user);
          }
        }
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  // Fetch gallery items
  const fetchGallery = useCallback(async () => {
    setLoadingGallery(true);
    setGalleryError('');
    try {
      const res = await fetch(`/api/gallery?page=${galleryPage}&limit=${galleryLimit}`);
      if (!res.ok) {
        throw new Error(locale === 'ar-eg' ? 'فشل استرداد المعروضات الفنية الحالية.' : 'Failed to retrieve curated gallery items.');
      }
      const data = await res.json() as any;
      setGalleryItems(data.items || []);
      setTotalGalleryPages(data.pagination.totalPages || 1);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error loading gallery.';
      setGalleryError(errMsg);
    } finally {
      setLoadingGallery(false);
    }
  }, [galleryPage, locale]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  // Fetch materials for cost calculator
  useEffect(() => {
    async function fetchMaterials() {
      try {
        const res = await fetch('/api/materials');
        if (res.ok) {
          const data = await res.json() as any;
          setMaterials({
            substrates: data.substrates || [],
            frames: data.frames || [],
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
    fetchMaterials();
  }, []);

  // Compute live price breakdown using core pricing engine
  const pricingResult = useMemo(() => {
    if (!selectedSubstrate) return null;
    const input = {
      widthCm,
      heightCm,
      costPerSqMeterSubstrate: selectedSubstrate.costPerUnit,
      costPerLinearCmFrame: selectedFrame ? selectedFrame.costPerUnit : 0,
      costPerMlInk: 5.0,
      inkDensityMultiplier: 1.0,
      marginMarkupMultiplier: 1.5,
      fixedServiceFeeEgp: 50.0,
      minMarginMultiplier: 1.10,
      promoDiscountType: null,
      promoDiscountValue: null,
      promoMaxDiscountEgp: null,
    };
    return calculateOrderPrice(input);
  }, [widthCm, heightCm, selectedSubstrate, selectedFrame]);

  // Fallback featured piece if gallery is empty
  const featuredPiece = useMemo(() => {
    if (galleryItems.length > 0) {
      return galleryItems[0];
    }
    return {
      id: 'default-featured',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnE28CFSybgA5u4IuCxjffMppN_yi_2jJvZLNNhH7l5dAK3vLZUIQtnWVwG1ENUXKA-iCi9Bh6dKiejwXmNkqkEbv7SL4oUFHxH1vWl-EXDv8IH5u_6hswvx4TTm4cVBf8I5O-415Dy6HCI-VZBAIV7n-gy18vasd4Nc2Op7rFMBYpLCbpRbrD-rcCZbGAblErYi1TONo3bKcQKZS7KFU-bvww-_uyZ1es-1URc6074izZJsW-qZJD8p7nb8xzLwiSyfZx2ct2V3B_',
      title: locale === 'ar-eg' ? 'التدفق الأثيري' : 'Ethereal Flux',
      artistName: locale === 'ar-eg' ? 'ستوديو لومين' : 'Studio Lumen',
      description: null,
      createdAt: ''
    };
  }, [galleryItems, locale]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 90, damping: 15 } },
  };

  return (
    <div className="flex flex-col gap-24 py-8">
      {/* 1. Hero Section */}
      <section className="relative flex flex-col md:flex-row items-center justify-between gap-12 md:gap-16 max-w-7xl mx-auto w-full px-4 md:px-8 pt-6">
        {/* Ambient Spotlights */}
        <div className="absolute top-1/4 left-1/4 w-[35vw] h-[35vw] bg-primary/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vw] bg-secondary/80 rounded-full blur-[120px] pointer-events-none mix-blend-screen opacity-10 z-0"></div>

        {/* Text Content */}
        <div className="flex-1 text-center md:text-left z-10 flex flex-col gap-6">
          <div className="flex items-center justify-center md:justify-start gap-2 w-fit mx-auto md:mx-0 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black tracking-widest text-primary uppercase">
            <span>{locale === 'ar-eg' ? 'المعرض الفني المنسق' : 'Curated Art Gallery'}</span>
          </div>

          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-text">
            {locale === 'ar-eg' ? (
              <>
                روائع فنية مطبوعة بـ <br />
                <span className="text-primary neon-text-primary filter drop-shadow-[0_0_12px_rgba(255,45,120,0.5)]">
                  دقة متناهية
                </span>
              </>
            ) : (
              <>
                Printed Masterpieces with <br />
                <span className="text-primary neon-text-primary filter drop-shadow-[0_0_12px_rgba(255,45,120,0.5)]">
                  Absolute Precision
                </span>
              </>
            )}
          </h1>

          <p className="font-sans text-sm md:text-base text-text/70 leading-relaxed max-w-xl mx-auto md:mx-0">
            {locale === 'ar-eg'
              ? 'تصفح الأعمال الفنية المميزة والمنفذة بأعلى معايير الدقة والشد اليدوي. ارفع تصميمك الخاص لتنفيذه فوراً.'
              : 'Explore stunning curated creations printed with luxury materials and hand-stretched framing. Configure your custom specifications below.'}
          </p>

          <div className="flex flex-col sm:flex-row justify-center md:justify-start items-center gap-4 mt-4">
            {authChecked && user ? (
              <Link
                href="/dashboard"
                className="btn-glow-shimmer w-full sm:w-auto px-8 py-3.5 rounded-full font-heading font-extrabold bg-primary text-white hover:brightness-110 hover:shadow-[0_0_20px_rgba(255,45,120,0.5)] active:scale-[0.98] transition-all duration-300 text-xs uppercase tracking-widest text-center"
              >
                {locale === 'ar-eg' ? 'لوحة التحكم والرفع' : 'Go to Dashboard'}
              </Link>
            ) : (
              <Link
                href="/auth/register"
                className="btn-glow-shimmer w-full sm:w-auto px-8 py-3.5 rounded-full font-heading font-extrabold bg-primary text-white hover:brightness-110 hover:shadow-[0_0_20px_rgba(255,45,120,0.5)] active:scale-[0.98] transition-all duration-300 text-xs uppercase tracking-widest text-center"
              >
                {locale === 'ar-eg' ? 'إنشاء حساب للطلب' : 'Join to Order'}
              </Link>
            )}
            <a
              href="#simulator"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full font-heading font-extrabold bg-white/5 border border-white/10 text-text/90 hover:bg-white/10 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(255,45,120,0.2)] active:scale-[0.98] transition-all duration-300 text-xs uppercase tracking-widest text-center"
            >
              {locale === 'ar-eg' ? 'حاسبة التكلفة' : 'Cost Simulator'}
            </a>
          </div>
        </div>

        {/* 3D Glass Artwork Frame */}
        <div className="flex-1 w-full max-w-sm mx-auto relative perspective-[1000px] z-10">
          <div 
            ref={cardRef}
            className="relative w-full aspect-[4/5] rounded-xl bg-surface-container/80 backdrop-blur-2xl border border-outline-variant/50 p-3.5 shadow-2xl transition-transform duration-100 ease-out group overflow-hidden"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Gloss reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-white/10 to-transparent pointer-events-none rounded-xl z-20"></div>

            <div className="relative w-full h-full rounded-lg overflow-hidden z-10" style={{ transform: 'translateZ(30px)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredPiece.imageUrl}
                alt={featuredPiece.title}
                className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Refraction Glass Panel Info */}
              <div className="absolute bottom-3 left-3 right-3 bg-surface-container/90 backdrop-blur-md border border-primary/30 rounded-lg p-4 transform translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl z-20">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="font-heading text-base font-bold text-text mb-0.5">{featuredPiece.title}</h3>
                    <p className="font-sans text-xs text-text/60">By {featuredPiece.artistName}</p>
                  </div>
                  <div className="bg-primary/20 px-2.5 py-0.5 rounded-full border border-primary/40">
                    <span className="font-label text-[10px] font-bold text-primary neon-text-primary">Featured</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Curated Art Gallery Grid */}
      <section className="flex flex-col gap-10 max-w-7xl mx-auto w-full px-4 md:px-8 border-t border-outline-variant/30 pt-20">
        <div className="flex flex-col gap-2 text-center md:text-left md:flex-row md:items-end justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
              {locale === 'ar-eg' ? 'المعرض الفني الحالي' : 'Curated Showcase'}
            </h2>
            <p className="font-sans text-xs text-text/50">
              {locale === 'ar-eg' ? 'مجموعة من الأعمال الفنية المنسقة بدقة والمطبوعة في مجتمعنا' : 'A selection of high-fidelity community prints and premium canvas works.'}
            </p>
          </div>
          <Link
            href="/gallery"
            className="font-label text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider mt-4 md:mt-0 inline-flex items-center gap-1.5 justify-center"
          >
            {locale === 'ar-eg' ? 'عرض المعرض الكامل ←' : 'Browse Full Gallery →'}
          </Link>
        </div>

        {galleryError ? (
          <div className="p-6 text-center text-red-500 font-bold border border-red-500/20 bg-red-500/10 rounded-lg max-w-md mx-auto">
            {galleryError}
          </div>
        ) : loadingGallery && galleryItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-xs text-text/50">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mb-2" />
            {t('common.loading')}
          </div>
        ) : galleryItems.length > 0 ? (
          <>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {galleryItems.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={itemVariants}
                    layout
                    className="terra-card group rounded-xl overflow-hidden border border-outline-variant/30 cursor-pointer flex flex-col h-full"
                  >
                    <Link href={`/gallery`}>
                      <div className="relative w-full aspect-[4/3] bg-white/5 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>
                      <div className="p-5 flex flex-col gap-3 border-t border-outline-variant/30 bg-surface-container/40">
                        <h3 className="font-heading text-sm font-extrabold text-text uppercase tracking-wide group-hover:text-primary transition-colors">{item.title}</h3>
                        {item.description && (
                          <p className="font-sans text-xs text-text/60 leading-relaxed truncate" title={item.description}>
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1 border-t border-outline-variant/20 pt-2.5">
                          <span className="font-label text-[9px] uppercase font-bold text-text/40 tracking-wider">
                            {locale === 'ar-eg' ? 'المصمم' : 'Artist'}
                          </span>
                          <span className="font-heading text-xs font-bold text-secondary">{item.artistName}</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Gallery Pagination */}
            {totalGalleryPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6 py-4 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setGalleryPage((p) => Math.max(1, p - 1))}
                  disabled={galleryPage === 1 || loadingGallery}
                  className="px-4 py-2 rounded-full font-label text-xs font-bold bg-white/5 border border-white/10 text-text hover:bg-white/10 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 uppercase tracking-wider"
                >
                  {locale === 'ar-eg' ? 'السابق' : 'Prev'}
                </button>
                <span className="font-label text-xs font-bold text-text/60">
                  {locale === 'ar-eg' ? `صفحة ${galleryPage} من ${totalGalleryPages}` : `Page ${galleryPage} of ${totalGalleryPages}`}
                </span>
                <button
                  type="button"
                  onClick={() => setGalleryPage((p) => Math.min(totalGalleryPages, p + 1))}
                  disabled={galleryPage === totalGalleryPages || loadingGallery}
                  className="px-4 py-2 rounded-full font-label text-xs font-bold bg-white/5 border border-white/10 text-text hover:bg-white/10 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 uppercase tracking-wider"
                >
                  {locale === 'ar-eg' ? 'التالي' : 'Next'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center text-text/50 gap-3 border border-outline-variant/30 bg-surface-container/30 rounded-xl">
            <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="font-sans text-sm font-semibold">
              {locale === 'ar-eg' ? 'المعرض فارغ حالياً' : 'Curated Showcase Empty'}
            </p>
          </div>
        )}
      </section>

      {/* 3. Interactive Pricing Simulator */}
      <section id="simulator" className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-7xl mx-auto w-full px-4 md:px-8 border-t border-outline-variant/30 pt-20">
        {/* Simulator Info */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="flex items-center gap-2 w-fit px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[9px] font-black uppercase text-secondary tracking-widest">
            <span>{locale === 'ar-eg' ? 'محاكاة الأسعار الفورية' : 'Instant Simulator'}</span>
          </div>
          <h2 className="font-heading text-3xl md:text-4xl font-extrabold tracking-tight leading-tight uppercase">
            {locale === 'ar-eg' ? 'حاسبة تكلفة المواد الفورية' : 'Dynamic Cost Simulator'}
          </h2>
          <p className="font-sans text-sm text-text/70 leading-relaxed">
            {locale === 'ar-eg'
              ? 'تتيح لك الحاسبة التفاعلية معرفة تفاصيل تكلفة الإنتاج، الخامات، والإطار بشكل فوري قبل إيداع العمل أو التسجيل. اضبط المقاسات المفضلة والتقنية المناسبة وشاهد الحساب المالي الدقيق مباشرة.'
              : 'Estimate production costs instantly. Move the dimension sliders and choose raw substrates or hand-made frames to observe real-time dynamic pricing breakdown computed with database metrics.'}
          </p>
        </div>

        {/* Simulator Widget */}
        <div className="lg:col-span-7">
          <GlassCard className="p-6 md:p-8 flex flex-col gap-6 border-outline-variant/40 rounded-xl relative overflow-hidden bg-surface-container/60 backdrop-blur-2xl">
            {loadingMaterials ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-text/50">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin mb-2" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Slider width */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between font-label text-xs font-semibold text-text/60 uppercase">
                      <span>{locale === 'ar-eg' ? 'العرض (سم)' : 'Width (cm)'}</span>
                      <span className="text-primary font-bold">{widthCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      value={widthCm}
                      onChange={(e) => setWidthCm(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                  </div>

                  {/* Slider height */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between font-label text-xs font-semibold text-text/60 uppercase">
                      <span>{locale === 'ar-eg' ? 'الارتفاع (سم)' : 'Height (cm)'}</span>
                      <span className="text-primary font-bold">{heightCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Substrate choosing */}
                <div className="flex flex-col gap-2.5">
                  <span className="font-heading text-xs font-bold text-text/80 uppercase tracking-wider">{t('checkout.substrateLabel')}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {materials.substrates.map((sub) => {
                      const isSel = selectedSubstrate?.id === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSelectedSubstrate(sub)}
                          className={`px-3 py-2.5 rounded-lg font-label text-xs font-bold text-center border transition-all duration-300 cursor-pointer ${
                            isSel
                              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(255,45,120,0.3)]'
                              : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-primary/30'
                          }`}
                        >
                          {getLocalizedMaterialName(sub.name, locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Frame choosing */}
                <div className="flex flex-col gap-2.5">
                  <span className="font-heading text-xs font-bold text-text/80 uppercase tracking-wider">{t('checkout.frameLabel')}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedFrame(null)}
                      className={`px-3 py-2.5 rounded-lg font-label text-xs font-bold text-center border transition-all duration-300 cursor-pointer ${
                        selectedFrame === null
                          ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(255,45,120,0.3)]'
                          : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-primary/30'
                      }`}
                    >
                      {t('checkout.noFrame')}
                    </button>
                    {materials.frames.map((fr) => {
                      const isSel = selectedFrame?.id === fr.id;
                      return (
                        <button
                          key={fr.id}
                          type="button"
                          onClick={() => setSelectedFrame(fr)}
                          className={`px-3 py-2.5 rounded-lg font-label text-xs font-bold text-center border transition-all duration-300 cursor-pointer ${
                            isSel
                              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(255,45,120,0.3)]'
                              : 'bg-white/5 border-white/10 text-text/75 hover:bg-white/10 hover:border-primary/30'
                          }`}
                        >
                          {getLocalizedMaterialName(fr.name, locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated Price Display Panel */}
                {pricingResult && (
                  <div className="mt-2 flex flex-col gap-3 p-5 rounded-lg bg-surface-container border border-outline-variant/30 shadow-md">
                    <div className="flex justify-between items-center font-sans text-xs text-text/60">
                      <span>{t('checkout.subtotal')}</span>
                      <span className="font-label">{pricingResult.priceBreakdown.substrateCost.toFixed(2)} EGP</span>
                    </div>
                    <div className="flex justify-between items-center font-sans text-xs text-text/60">
                      <span>{t('checkout.inkCost')}</span>
                      <span className="font-label">{pricingResult.priceBreakdown.inkCost.toFixed(2)} EGP</span>
                    </div>
                    {pricingResult.priceBreakdown.frameCost > 0 && (
                      <div className="flex justify-between items-center font-sans text-xs text-text/60">
                        <span>{t('checkout.frameCost')}</span>
                        <span className="font-label">{pricingResult.priceBreakdown.frameCost.toFixed(2)} EGP</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center font-sans text-xs text-text/60">
                      <span>{t('checkout.serviceFee')}</span>
                      <span className="font-label">{pricingResult.priceBreakdown.serviceFee.toFixed(2)} EGP</span>
                    </div>
                    <div className="h-[1px] bg-white/10 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="font-heading text-sm font-extrabold uppercase tracking-wide">{t('checkout.total')}</span>
                      <span className="font-heading text-lg font-extrabold text-primary neon-text-primary">
                        {pricingResult.priceBreakdown.finalPrice.toFixed(2)} EGP
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      </section>

      {/* 4. Elegant Bottom CTA Segment */}
      <section className="flex justify-center max-w-7xl mx-auto w-full px-4 md:px-8 border-t border-outline-variant/30 pt-20">
        <GlassCard className="relative overflow-hidden w-full max-w-4xl p-8 md:p-12 text-center flex flex-col items-center gap-6 border-outline-variant/40 rounded-xl bg-gradient-to-tr from-primary/5 to-transparent backdrop-blur-2xl">
          <div className="absolute top-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl pointer-events-none"></div>

          <h2 className="font-heading text-xl md:text-3xl font-extrabold uppercase tracking-tight">
            {locale === 'ar-eg' ? 'هل أنت مستعد لطلب طباعة صورتك؟' : 'Ready to Print Your Design?'}
          </h2>
          
          <p className="font-sans text-xs md:text-sm text-text/75 max-w-lg leading-relaxed">
            {locale === 'ar-eg'
              ? 'سجل حساباً مجانياً الآن، وارفع ملفاتك مباشرة عبر لوحة التحكم لتحصل على مراجعة تلقائية فورية لجودة الطباعة وتكلفتها.'
              : 'Create a free account and upload your files directly from your dashboard to receive instant pre-press resolution auditing.'}
          </p>

          <div className="flex justify-center items-center gap-4 mt-2">
            {authChecked && user ? (
              <Link
                href="/dashboard"
                className="btn-glow-shimmer px-8 py-3.5 rounded-full font-heading font-extrabold bg-primary text-white hover:brightness-110 hover:shadow-[0_0_20px_rgba(255,45,120,0.5)] active:scale-[0.98] transition-all duration-300 text-xs tracking-wider uppercase text-center"
              >
                {locale === 'ar-eg' ? 'ابدأ بالطباعة الآن' : 'Start Designing'}
              </Link>
            ) : (
              <Link
                href="/auth/register"
                className="btn-glow-shimmer px-8 py-3.5 rounded-full font-heading font-extrabold bg-primary text-white hover:brightness-110 hover:shadow-[0_0_20px_rgba(255,45,120,0.5)] active:scale-[0.98] transition-all duration-300 text-xs tracking-wider uppercase text-center"
              >
                {locale === 'ar-eg' ? 'سجل حساب جديد' : 'Sign Up Now'}
              </Link>
            )}
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
