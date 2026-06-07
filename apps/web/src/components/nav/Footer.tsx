'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '../../context/TranslationContext';
import styles from './Footer.module.css';

export default function Footer() {
  const { t, locale, changeLocale } = useTranslation();

  const brandText = locale === 'ar-eg' ? 'إمبرينتا' : 'IMPRINTA';
  const tagline = locale === 'ar-eg' 
    ? 'بوابتك لطباعة وتجسيد تصميماتك الفنية بأعلى جودة ودقة فنية متناهية.'
    : 'Your gateway to high-resolution print rendering and custom framing with absolute precision.';

  return (
    <footer className={styles.footerContainer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          
          {/* Brand Information */}
          <div className={styles.columnBrand}>
            <div className={styles.brandLogo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/imprinta_logo.png" 
                alt="Imprinta Logo" 
                className="w-7 h-7 rounded-full object-cover border border-primary/30 me-2.5 shadow-[0_0_8px_rgba(255,45,120,0.2)]" 
              />
              <span className={styles.brandTitle}>{brandText}</span>
            </div>
            <p className={styles.brandDesc}>{tagline}</p>
            <div className={styles.statusPanel}>
              <span className={styles.statusIndicatorConnected} />
              <span className={styles.statusText}>
                {locale === 'ar-eg' ? 'جميع الخدمات تعمل بكفاءة' : 'All services active'}
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className={styles.columnLinks}>
            <h4 className={styles.columnHeader}>
              {locale === 'ar-eg' ? 'تصفح الموقع' : 'Explore'}
            </h4>
            <ul className={styles.linkList}>
              <li>
                <Link href="/" className={styles.footerLink}>
                  {t('nav.gallery')}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className={styles.footerLink}>
                  {t('nav.dashboard')}
                </Link>
              </li>
              <li>
                <Link href="/account" className={styles.footerLink}>
                  {t('nav.account')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details / Support */}
          <div className={styles.columnLinks}>
            <h4 className={styles.columnHeader}>
              {locale === 'ar-eg' ? 'الدعم والمساعدة' : 'Support'}
            </h4>
            <ul className={styles.linkList}>
              <li className={styles.supportInfoItem}>
                {locale === 'ar-eg' ? 'القاهرة، جمهورية مصر العربية' : 'Cairo, Egypt'}
              </li>
              <li className={styles.supportInfoItem}>
                support@imprinta.com
              </li>
              <li className={styles.supportInfoItem}>
                +20 2 1234 5678
              </li>
            </ul>
          </div>

        </div>

        <div className={styles.footerBottom}>
          <span className={styles.copyrightText}>
            &copy; {new Date().getFullYear()} {brandText}. {locale === 'ar-eg' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </span>
          
          <button
            onClick={() => changeLocale(locale === 'en' ? 'ar-eg' : 'en')}
            className={styles.footerLangBtn}
            title="Switch Language"
          >
            {locale === 'en' ? 'English' : 'العربية'}
          </button>
        </div>
      </div>
    </footer>
  );
}
