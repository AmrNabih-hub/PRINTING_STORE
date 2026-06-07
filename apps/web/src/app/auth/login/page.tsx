'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import GlassCard from '@/components/glass/GlassCard';
import { UserLoginSchema } from '@printing-store/core-logic';
import styles from './Login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setValidationErrors({});
    setGeneralError('');

    // 1. Client-side Zod validation
    const check = UserLoginSchema.safeParse({ email, password });
    if (!check.success) {
      const formatted = check.error.format();
      setValidationErrors({
        email: formatted.email?._errors[0],
        password: formatted.password?._errors[0],
      });
      setLoading(false);
      return;
    }

    try {
      // 2. Post credentials to standard auth route
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        if (errData.error === 'INVALID_CREDENTIALS') {
          setGeneralError(t('auth.invalidCredentials'));
        } else {
          setGeneralError(errData.message || t('common.error'));
        }
        setLoading(false);
        return;
      }

      // Successful login -> trigger redirection
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setGeneralError(t('common.error'));
      setLoading(false);
    }
  }

  return (
    <div className={styles.pageContainer}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <GlassCard className={styles.authCard}>
          <div>
            <h1 className={styles.title}>{t('auth.loginTitle')}</h1>
            <p className={styles.subtitle}>{t('common.welcome')}</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {generalError && (
              <div className={styles.generalError} role="alert">
                {generalError}
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.inputLabel}>
                {t('auth.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={styles.textInput}
                disabled={loading}
                required
              />
              {validationErrors.email && (
                <span className={styles.errorText}>{validationErrors.email}</span>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.inputLabel}>
                {t('auth.passwordLabel')}
              </label>
              <div className="relative w-full">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${styles.textInput} pr-10`}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text/75 transition-colors cursor-pointer focus:outline-none flex items-center justify-center p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7z" />
                    </svg>
                  )}
                </button>
              </div>
              {validationErrors.password && (
                <span className={styles.errorText}>{validationErrors.password}</span>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('auth.loginButton')}
            </button>
          </form>

          <p className={styles.footerText}>
            {t('auth.noAccount')}
            <a href="/auth/register" className={styles.link}>
              {t('auth.registerButton')}
            </a>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
