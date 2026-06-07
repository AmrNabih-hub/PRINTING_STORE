'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/context/TranslationContext';
import styles from './MaterialSelector.module.css';

interface MaterialItem {
  id: string;
  name: string;
  type: 'ink' | 'substrate' | 'frame' | 'coating' | 'other';
  unitName: string;
  costPerUnit: number;
}

interface MaterialSelectorProps {
  selectedSubstrateId: string;
  onSelectSubstrate: (id: string, costPerUnit: number) => void;
  selectedFrameId: string | null;
  onSelectFrame: (id: string | null, costPerUnit: number) => void;
  selectedCoatingId: string | null;
  onSelectCoating: (id: string | null, costPerUnit: number) => void;
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

export default function MaterialSelector({
  selectedSubstrateId,
  onSelectSubstrate,
  selectedFrameId,
  onSelectFrame,
  selectedCoatingId,
  onSelectCoating,
}: MaterialSelectorProps) {
  const { t, locale } = useTranslation();
  const [substrates, setSubstrates] = useState<MaterialItem[]>([]);
  const [frames, setFrames] = useState<MaterialItem[]>([]);
  const [coatings, setCoatings] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const response = await fetch('/api/materials');
        if (!response.ok) {
          throw new Error('Failed to load materials catalog.');
        }
        const data = await response.json() as any;
        setSubstrates(data.substrates || []);
        setFrames(data.frames || []);
        setCoatings(data.coatings || []);

        // Proactively set default selections if not already configured
        if (data.substrates?.length > 0 && !selectedSubstrateId) {
          onSelectSubstrate(data.substrates[0].id, data.substrates[0].costPerUnit);
        }
      } catch (err: any) {
        setError(err.message || 'Unknown error occurred loading materials catalog');
      } finally {
        setLoading(false);
      }
    }

    fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className={styles.loader}>
        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Substrates Section */}
      <div>
        <h2 className={styles.sectionTitle}>{t('checkout.substrateLabel')}</h2>
        <div className={styles.grid}>
          {substrates.map((sub) => {
            const isSelected = selectedSubstrateId === sub.id;
            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubstrate(sub.id, sub.costPerUnit)}
                className={`${styles.card} ${isSelected ? styles.selectedCard : ''}`}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>
                    {getLocalizedMaterialName(sub.name, locale)}
                  </span>
                  <div className={styles.radioIndicator}>
                    <div className={styles.radioDot} />
                  </div>
                </div>
                <span className={styles.cardCost}>
                  {sub.costPerUnit} EGP / m²
                </span>
                <span className={styles.cardDetail}>
                  {locale === 'ar-eg' ? 'خامة طباعة عالية الجودة' : 'High quality canvas base'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Frames Section */}
      <div>
        <h2 className={styles.sectionTitle}>{t('checkout.frameLabel')}</h2>
        <div className={styles.grid}>
          {/* No Frame Option */}
          <div
            onClick={() => onSelectFrame(null, 0)}
            className={`${styles.card} ${selectedFrameId === null ? styles.selectedCard : ''}`}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardName}>{t('checkout.noFrame')}</span>
              <div className={styles.radioIndicator}>
                <div className={styles.radioDot} />
              </div>
            </div>
            <span className={styles.cardCost}>0 EGP</span>
            <span className={styles.cardDetail}>
              {locale === 'ar-eg' ? 'بدون إطار مضاف' : 'Standard frameless print'}
            </span>
          </div>

          {frames.map((fr) => {
            const isSelected = selectedFrameId === fr.id;
            return (
              <div
                key={fr.id}
                onClick={() => onSelectFrame(fr.id, fr.costPerUnit)}
                className={`${styles.card} ${isSelected ? styles.selectedCard : ''}`}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>
                    {getLocalizedMaterialName(fr.name, locale)}
                  </span>
                  <div className={styles.radioIndicator}>
                    <div className={styles.radioDot} />
                  </div>
                </div>
                <span className={styles.cardCost}>
                  {fr.costPerUnit} EGP / cm
                </span>
                <span className={styles.cardDetail}>
                  {locale === 'ar-eg' ? 'شد وتأطير خشب يدوي' : 'Hand-stretched premium border'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Coatings Section */}
      <div>
        <h2 className={styles.sectionTitle}>
          {locale === 'ar-eg' ? 'طبقة الحماية والتغطية' : 'Coating & Protection Finish'}
        </h2>
        <div className={styles.grid}>
          {/* No Coating Option */}
          <div
            onClick={() => onSelectCoating(null, 0)}
            className={`${styles.card} ${selectedCoatingId === null ? styles.selectedCard : ''}`}
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardName}>
                {locale === 'ar-eg' ? 'بدون تغطية إضافية' : 'No Coating'}
              </span>
              <div className={styles.radioIndicator}>
                <div className={styles.radioDot} />
              </div>
            </div>
            <span className={styles.cardCost}>0 EGP</span>
            <span className={styles.cardDetail}>
              {locale === 'ar-eg' ? 'طباعة قياسية بدون لمعة إضافية' : 'Standard print finish'}
            </span>
          </div>

          {coatings.map((co) => {
            const isSelected = selectedCoatingId === co.id;
            return (
              <div
                key={co.id}
                onClick={() => onSelectCoating(co.id, co.costPerUnit)}
                className={`${styles.card} ${isSelected ? styles.selectedCard : ''}`}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>
                    {getLocalizedMaterialName(co.name, locale)}
                  </span>
                  <div className={styles.radioIndicator}>
                    <div className={styles.radioDot} />
                  </div>
                </div>
                <span className={styles.cardCost}>
                  {co.costPerUnit} EGP / m²
                </span>
                <span className={styles.cardDetail}>
                  {locale === 'ar-eg' ? 'طبقة واقية مقاومة للماء والأشعة' : 'Protective coating shield'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
