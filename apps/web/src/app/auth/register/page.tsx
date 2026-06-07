'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import GlassCard from '@/components/glass/GlassCard';
import { UserRegisterSchema } from '@printing-store/core-logic';
import styles from './Register.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    fullName?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [generalError, setGeneralError] = useState('');

  // Password strength state
  const [strength, setStrength] = useState({ score: 0, text: '', colorClass: '' });

  useEffect(() => {
    if (!password) {
      setStrength({ score: 0, text: '', colorClass: '' });
      return;
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    let text = '';
    let colorClass = '';

    if (score <= 2) {
      text = 'Weak';
      colorClass = 'bg-red-500 w-1/3';
    } else if (score <= 4) {
      text = 'Medium';
      colorClass = 'bg-amber-500 w-2/3';
    } else {
      text = 'Strong';
      colorClass = 'bg-emerald-500 w-full';
    }

    setStrength({ score, text, colorClass });
  }, [password]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setValidationErrors({});
    setGeneralError('');

    // 1. Password confirmation check
    if (password !== confirmPassword) {
      setValidationErrors({
        confirmPassword: t('auth.passwordsDoNotMatch'),
      });
      setLoading(false);
      return;
    }

    // 2. Client-side Zod validation
    const check = UserRegisterSchema.safeParse({ email, password, fullName });
    if (!check.success) {
      const formatted = check.error.format();
      setValidationErrors({
        email: formatted.email?._errors[0],
        fullName: formatted.fullName?._errors[0],
        password: formatted.password?._errors[0],
      });
      setLoading(false);
      return;
    }

    try {
      // 3. Post to register API route
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });

      if (!response.ok) {
        const errData = await response.json() as any;
        if (errData.error === 'EMAIL_ALREADY_EXISTS') {
          setGeneralError(t('auth.emailExists'));
        } else {
          setGeneralError(errData.message || t('common.error'));
        }
        setLoading(false);
        return;
      }

      // Successful registration -> auto-redirect
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setGeneralError(t('common.error'));
      setLoading(false);
    }
  }

  // Animation constants for staggered inputs
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } },
  };

  return (
    <div className={styles.pageContainer}>
      <motion.div
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="w-full max-w-md"
      >
        <GlassCard className={styles.authCard}>
          <motion.div variants={itemVariants}>
            <h1 className={styles.title}>{t('auth.registerTitle')}</h1>
            <p className={styles.subtitle}>{t('common.welcome')}</p>
          </motion.div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {generalError && (
              <motion.div variants={itemVariants} className={styles.generalError} role="alert">
                {generalError}
              </motion.div>
            )}

            <motion.div variants={itemVariants} className={styles.inputGroup}>
              <label htmlFor="fullName" className={styles.inputLabel}>
                {t('auth.fullNameLabel')}
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Sherif El-Basha"
                className={styles.textInput}
                disabled={loading}
                required
              />
              {validationErrors.fullName && (
                <span className={styles.errorText}>{validationErrors.fullName}</span>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className={styles.inputGroup}>
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
            </motion.div>

            <motion.div variants={itemVariants} className={styles.inputGroup}>
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
              {password && (
                <div className={styles.strengthWrapper}>
                  <div className={styles.strengthBarContainer}>
                    <div className={`${styles.strengthBar} ${strength.colorClass}`} />
                  </div>
                  <span className={styles.strengthLabel}>
                    Strength: {strength.text}
                  </span>
                </div>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className={styles.inputGroup}>
              <label htmlFor="confirmPassword" className={styles.inputLabel}>
                {t('auth.confirmPasswordLabel')}
              </label>
              <div className="relative w-full">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${styles.textInput} pr-10`}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text/75 transition-colors cursor-pointer focus:outline-none flex items-center justify-center p-1"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
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
              {validationErrors.confirmPassword && (
                <span className={styles.errorText}>{validationErrors.confirmPassword}</span>
              )}
            </motion.div>

            <motion.button
              variants={itemVariants}
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('auth.registerButton')}
            </motion.button>
          </form>

          <motion.p variants={itemVariants} className={styles.footerText}>
            {t('auth.hasAccount')}
            <a href="/auth/login" className={styles.link}>
              {t('auth.loginButton')}
            </a>
          </motion.p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
