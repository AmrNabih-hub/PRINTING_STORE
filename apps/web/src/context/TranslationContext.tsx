'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import enMessages from '../messages/en.json';
import arEgMessages from '../messages/ar-eg.json';

export type Locale = 'en' | 'ar-eg';

const messagesMap = {
  'en': enMessages,
  'ar-eg': arEgMessages,
};

interface TranslationContextType {
  locale: Locale;
  t: (key: string) => string;
  changeLocale: (newLocale: Locale) => void;
  dir: 'ltr' | 'rtl';
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({
  children,
  initialLocale = 'en'
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const dir = locale === 'ar-eg' ? 'rtl' : 'ltr';

  useEffect(() => {
    // Sync with HTML element metadata
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
    
    // Store in cookie so Edge middleware and Server components read it statically
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Strict`;
  }, [locale, dir]);

  const t = (key: string): string => {
    const messages = messagesMap[locale];
    return key.split('.').reduce((acc: any, part) => acc && acc[part], messages) || key;
  };

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    // Persist to cookie immediately
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Strict`;
  };

  return (
    <TranslationContext.Provider value={{ locale, t, changeLocale, dir }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
