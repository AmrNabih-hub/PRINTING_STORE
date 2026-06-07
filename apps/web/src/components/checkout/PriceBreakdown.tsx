'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import { OrderPriceBreakdown } from '@printing-store/core-logic';
import styles from './PriceBreakdown.module.css';

interface PriceBreakdownProps {
  breakdown: OrderPriceBreakdown;
  isMarginViolated: boolean;
}

export default function PriceBreakdown({ breakdown, isMarginViolated }: PriceBreakdownProps) {
  const { t, locale } = useTranslation();

  const priceItems = [
    { label: t('checkout.subtotal'), value: breakdown.substrateCost },
    { label: t('checkout.inkCost'), value: breakdown.inkCost },
    { label: t('checkout.frameCost'), value: breakdown.frameCost },
    { label: locale === 'ar-eg' ? 'تكلفة التغطية والحماية' : 'Coating Cost', value: breakdown.coatingCost || 0 },
    { label: t('checkout.serviceFee'), value: breakdown.serviceFee },
  ];

  if (breakdown.aiAuditFee && breakdown.aiAuditFee > 0) {
    priceItems.push({
      label: locale === 'ar-eg' ? 'رسوم تدقيق الذكاء الاصطناعي' : 'AI Quality Audit',
      value: breakdown.aiAuditFee,
    });
  }

  return (
    <div className={styles.breakdownCard}>
      <h2 className={styles.title}>{t('checkout.priceBreakdown')}</h2>

      <div className={styles.priceList}>
        {/* Render base cost rows */}
        {priceItems.map((item, idx) => (
          <div key={idx} className={styles.priceRow}>
            <span className={styles.priceLabel}>{item.label}</span>
            <span className={styles.priceValue}>{item.value.toFixed(2)} EGP</span>
          </div>
        ))}

        <div className={styles.divider} />

        {/* Show Sub-total retail markup */}
        <div className={styles.subTotalRow}>
          <span>{t('checkout.markupTotal')}</span>
          <span className="font-mono">{breakdown.markupTotal.toFixed(2)} EGP</span>
        </div>

        {/* Show discount row if applied */}
        {breakdown.promoDiscount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={styles.discountRow}
          >
            <span>{t('checkout.discount')}</span>
            <span className="font-mono">-{breakdown.promoDiscount.toFixed(2)} EGP</span>
          </motion.div>
        )}

        {/* Show warning banner if minimum profit margin check fails */}
        <AnimatePresence>
          {isMarginViolated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.warningBanner}
              role="alert"
            >
              <span className={styles.warningTitle}>Margin Error</span>
              <span>{t('checkout.marginWarning')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final Price */}
        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>{t('checkout.total')}</span>
          <span className={styles.totalValue}>
            {breakdown.finalPrice.toFixed(2)} EGP
          </span>
        </div>
      </div>
    </div>
  );
}
