'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '../../context/TranslationContext';
import styles from './TopNav.module.css';
import { cn } from '@/lib/utils';

interface UserSession {
  id: string;
  email: string;
  role: string;
  fullName?: string;
  avatarUrl?: string;
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, changeLocale } = useTranslation();
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [user, setUser] = useState<UserSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load theme and auth session
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme as 'dark' | 'light');
    document.cookie = `theme=${savedTheme}; path=/; max-age=31536000; SameSite=Lax`;
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json() as any;
          if (data.authenticated) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        }
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    }

    checkAuth();
  }, [pathname]);

  // Close mobile menu on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setUser(null);
        router.push('/');
        router.refresh();
      }
    } catch {
      router.push('/');
    }
  };

  // Center navigation links: Home / Gallery, Dashboard, and Operational boards by role
  const navLinks = React.useMemo(() => {
    if (!user) {
      return [
        { href: '/', labelKey: 'nav.gallery' }
      ];
    }

    const links = [
      { href: '/', labelKey: 'nav.gallery' },
      { href: '/dashboard', labelKey: 'nav.dashboard' },
    ];

    if (user.role === 'admin') {
      links.push(
        { href: '/ops/fulfillment', labelKey: 'nav.fulfillment' },
        { href: '/ops/admin', labelKey: 'nav.admin' }
      );
    } else if (user.role === 'employee' || user.role === 'courier') {
      links.push({ href: '/ops/fulfillment', labelKey: 'nav.fulfillment' });
    } else {
      links.push({ href: '/orders', labelKey: 'nav.orders' });
    }

    return links;
  }, [user]);

  const logoText = locale === 'ar-eg' ? 'إمبرينتا' : 'IMPRINTA';

  return (
    <header className={styles.navHeader}>
      <div className={styles.navContainer}>
        {/* Left Section: Branding Logo */}
        <div className={styles.brandWrapper}>
          <Link href="/" className={styles.brandLink}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/imprinta_logo.png" 
              alt="Imprinta Logo" 
              className="w-7 h-7 rounded-full object-cover border border-primary/30 me-2.5 shadow-[0_0_8px_rgba(255,45,120,0.2)]" 
            />
            <span className={styles.brandText}>{logoText}</span>
          </Link>
        </div>

        {/* Center Section: Main Navigation Links (Desktop) */}
        <nav className={styles.desktopMenu}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(styles.menuLink, isActive && styles.activeLink)}
              >
                {t(link.labelKey)}
                {isActive && <span className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: System Settings & Session Actions (Desktop) */}
        <div className={styles.desktopControls}>
          <button
            onClick={toggleTheme}
            className={styles.themeBtn}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.048.052A5.002 5.002 0 0112 17a4.978 4.978 0 01-3.328-1.248l-.052-.052z" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={() => changeLocale(locale === 'en' ? 'ar-eg' : 'en')}
            className={styles.langBtn}
            title="Switch Language"
          >
            {locale === 'en' ? 'العربية' : 'EN'}
          </button>

          {authChecked && (
            <>
              <div className={styles.divider} />
              {user ? (
                <>
                  <button
                    onClick={handleLogout}
                    className={styles.logoutBtn}
                    title="Sign Out"
                  >
                    {t('nav.logout')}
                  </button>
                  
                  <div className={styles.divider} />
                  
                  {/* Account Avatar Icon at the far right */}
                  <Link
                    href="/account"
                    className={cn(styles.avatarLink, pathname === '/account' && styles.avatarActive)}
                    title={t('nav.account')}
                  >
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName || 'User Profile'}
                        className={styles.avatarImage}
                      />
                    ) : (
                      <div className={styles.avatarGradient}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className={cn(styles.loginLink, pathname === '/auth/login' && styles.activeLoginLink)}
                >
                  {t('nav.login')}
                </Link>
              )}
            </>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className={styles.mobileActions}>
          <button
            onClick={() => changeLocale(locale === 'en' ? 'ar-eg' : 'en')}
            className={styles.langBtnMobile}
            title="Switch Language"
          >
            {locale === 'en' ? 'عربى' : 'EN'}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={styles.mobileMenuToggle}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className={styles.mobileOverlay}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className={styles.mobileDrawer}
            onClick={(e) => e.stopPropagation()}
          >
            <nav className={styles.mobileMenuList}>
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(styles.mobileMenuLink, isActive && styles.mobileActiveLink)}
                  >
                    {t(link.labelKey)}
                  </Link>
                );
              })}
              
              {user && (
                <Link
                  href="/account"
                  className={cn(styles.mobileMenuLink, pathname === '/account' && styles.mobileActiveLink)}
                >
                  {t('nav.account')}
                </Link>
              )}
              
              <div className={styles.mobileMenuDivider} />
              
              <div className="flex flex-col gap-4 w-full px-2">
                <button
                  onClick={toggleTheme}
                  className={styles.mobileThemeBtn}
                >
                  {theme === 'dark' ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.048.052A5.002 5.002 0 0112 17a4.978 4.978 0 01-3.328-1.248l-.052-.052z" />
                      </svg>
                      <span>{locale === 'ar-eg' ? 'الوضع المضيء' : 'Light Mode'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      <span>{locale === 'ar-eg' ? 'الوضع الداكن' : 'Dark Mode'}</span>
                    </>
                  )}
                </button>
                
                {authChecked && (
                  <>
                    {user ? (
                      <button
                        onClick={handleLogout}
                        className={styles.mobileLogoutBtn}
                      >
                        {t('nav.logout')}
                      </button>
                    ) : (
                      <Link
                        href="/auth/login"
                        className={styles.mobileLoginBtn}
                      >
                        {t('nav.login')}
                      </Link>
                    )}
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
