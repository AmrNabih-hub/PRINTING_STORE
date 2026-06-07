'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GlassCard from '../../components/glass/GlassCard';
import { useTranslation } from '../../context/TranslationContext';
import styles from '../dashboard/Dashboard.module.css'; // Reuse dashboard layout classes
import { cn } from '@/lib/utils';

interface UserSession {
  id: string;
  email: string;
  role: string;
  fullName: string;
  avatarUrl?: string;
}

export default function AccountCenterPage() {
  const router = useRouter();
  const { t, locale, changeLocale } = useTranslation();
  
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load session and orders count
  async function loadSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.push('/auth/login');
        return;
      }
      const data = await res.json() as any;
      if (data.authenticated) {
        setUser(data.user);
        // Fetch orders count
        const historyRes = await fetch('/api/orders/history?limit=100');
        if (historyRes.ok) {
          const historyData = await historyRes.json() as any;
          setOrderCount(historyData.orders?.length || 0);
        }
      } else {
        router.push('/auth/login');
      }
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') || 'dark') as 'dark' | 'light';
    setTheme(savedTheme);
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setUploadError('');

    try {
      // Step 1: Get presigned URL and update DB pointer
      const res = await fetch('/api/auth/avatar-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        throw new Error(data.error || 'UPLOAD_FAILED');
      }

      const { uploadUrl } = data;

      // Step 2: Upload file directly to R2 using the presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to R2');
      }

      // Refresh session info to reflect the new avatar
      await loadSession();

    } catch (err: any) {
      setUploadError(
        locale === 'ar-eg' 
          ? 'فشل تحميل الصورة. يرجى اختيار ملف صورة صالح.' 
          : 'Failed to upload profile picture. Please choose a valid image file.'
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center text-xs text-text/50">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin mb-2" />
        {t('common.loading')}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Greeting Banner */}
      <GlassCard className={styles.profileBox}>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl md:text-2xl font-black text-accent">
            {locale === 'ar-eg' ? 'مركز الحساب الشخصي' : 'Account Center'}
          </h1>
          <p className="text-xs text-text/60">
            {locale === 'ar-eg' ? 'إدارة وتخصيص إعدادات حسابك ومراجعة طلباتك' : 'Manage your system configurations and security presets'}
          </p>
        </div>
      </GlassCard>

      {/* Main Account Bento layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Profile Card & Avatar Upload */}
        <GlassCard className="p-8 flex flex-col gap-8 border-white/10 dark:border-white/5 md:col-span-7">
          <h2 className="text-sm font-black tracking-wider uppercase text-text/80 border-b border-white/10 pb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {locale === 'ar-eg' ? 'البيانات الشخصية' : 'User Specifications'}
          </h2>

          <div className="flex flex-col items-center sm:flex-row gap-6">
            {/* Interactive Avatar Upload Container */}
            <div className="relative group flex flex-col items-center gap-2">
              <div 
                onClick={triggerFileInput}
                className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-white/5 shadow-lg relative cursor-pointer group-hover:border-accent transition-all duration-300 flex items-center justify-center"
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={user.avatarUrl} 
                    alt={user.fullName} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-accent to-rose-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                {/* Upload Overlay indicator on hover */}
                <div className="absolute inset-0 bg-midnight-bg/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
                disabled={uploadingAvatar}
              />
              <button 
                type="button" 
                onClick={triggerFileInput} 
                className="text-[10px] uppercase font-bold text-accent hover:opacity-85"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? '...' : (locale === 'ar-eg' ? 'تغيير الصورة' : 'Change Photo')}
              </button>
            </div>

            {/* Profile fields */}
            <div className="flex flex-col gap-4 flex-grow w-full">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-text/55">{t('auth.fullNameLabel')}</span>
                <span className="text-sm font-black text-text">{user.fullName}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-text/55">{t('auth.emailLabel')}</span>
                <span className="text-sm font-semibold text-text/80">{user.email}</span>
              </div>

              {/* Hide "customer" role from normal users */}
              {user.role !== 'customer' && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-text/55">{locale === 'ar-eg' ? 'صلاحية النظام' : 'System Role'}</span>
                  <span className="text-xs font-bold text-accent uppercase">{user.role}</span>
                </div>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-semibold">
              {uploadError}
            </div>
          )}
        </GlassCard>

        {/* Stats & Actions */}
        <div className="flex flex-col gap-6 md:col-span-5">
          {/* Order Summary Stats */}
          <GlassCard className="p-8 flex flex-col gap-4 border-white/10 dark:border-white/5 justify-between">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-text/60">
                  {locale === 'ar-eg' ? 'إجمالي الطلبات المسجلة' : 'Total Orders Placed'}
                </span>
                <span className="text-3xl font-black text-accent">{orderCount}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-accent/10 text-accent border border-accent/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
            
            <Link
              href="/dashboard"
              className="w-full text-center py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold transition-all duration-200"
            >
              {locale === 'ar-eg' ? 'عرض طلباتي بلوحة التحكم' : 'View Orders in Dashboard'}
            </Link>
          </GlassCard>

          {/* Settings panel */}
          <GlassCard className="p-8 flex flex-col gap-5 border-white/10 dark:border-white/5">
            <h2 className="text-sm font-black tracking-wider uppercase text-text/80 border-b border-white/10 pb-3">
              {locale === 'ar-eg' ? 'خيارات التخصيص' : 'System Settings'}
            </h2>

            <div className="flex flex-col gap-4">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text/70">
                  {locale === 'ar-eg' ? 'مظهر النظام' : 'Visual Mode'}
                </span>
                <button
                  onClick={toggleTheme}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold transition-all"
                >
                  {theme === 'dark' ? (locale === 'ar-eg' ? 'الوضع المضيء' : 'Light Mode') : (locale === 'ar-eg' ? 'الوضع الداكن' : 'Dark Mode')}
                </button>
              </div>

              {/* Lang switcher */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text/70">
                  {locale === 'ar-eg' ? 'اللغة الافتراضية' : 'Default Language'}
                </span>
                <button
                  onClick={() => changeLocale(locale === 'en' ? 'ar-eg' : 'en')}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold transition-all"
                >
                  {locale === 'en' ? 'العربية' : 'English'}
                </button>
              </div>
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
}
