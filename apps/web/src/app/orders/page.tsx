'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import GlassCard from '@/components/glass/GlassCard';
import OrderStatusBadge from '@/components/dashboard/OrderStatusBadge';
import styles from './Orders.module.css';
import { OrderStatus, OrderPriceBreakdown } from '@printing-store/core-logic';

interface Order {
  id: string;
  status: OrderStatus;
  widthCm: number;
  heightCm: number;
  fileUrl: string;
  priceEgp: number;
  discountAppliedEgp: number;
  priceBreakdown: OrderPriceBreakdown;
  shippingAddress: string;
  createdAt: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Authenticate user session immediately
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.authenticated) {
          router.push('/auth/login');
          return;
        }
        
        // Fetch order list if authorized
        const ordersRes = await fetch('/api/orders/history?limit=50');
        if (!ordersRes.ok) {
          throw new Error('Failed to retrieve orders history.');
        }
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred loading order list.');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  function toggleExpand(orderId: string) {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  }

  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale === 'ar-eg' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <div className={styles.loader}>
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <GlassCard className="p-6 text-center text-red-500 font-bold border-red-500/20 bg-red-500/10">
          {error}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>{t('orders.title')}</h1>
        <p className={styles.subtitle}>{t('orders.history')}</p>
      </div>

      {orders.length > 0 ? (
        <div className={styles.orderList}>
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const pb = order.priceBreakdown;
            return (
              <GlassCard
                key={order.id}
                className={styles.orderCard}
              >
                <div onClick={() => toggleExpand(order.id)} className={styles.orderHeader}>
                  <div className={styles.orderMeta}>
                    <span className={styles.orderTitle}>
                      {t('orders.orderId')}: #{order.id.slice(0, 8)}
                    </span>
                    <span className={styles.orderDate}>
                      {formatDate(order.createdAt)}
                    </span>
                  </div>

                  <div className={styles.headerRight}>
                    <span className={styles.orderPrice}>
                      {order.priceEgp.toFixed(2)} EGP
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className={styles.expandContainer}
                    >
                      <div className={styles.detailsGrid}>
                        {/* Print Parameters & Costs */}
                        <div className={styles.detailSection}>
                          <h3 className={styles.sectionTitle}>{t('checkout.priceBreakdown')}</h3>
                          <div className={styles.row}>
                            <span className={styles.rowLabel}>{t('orders.dimensions')}</span>
                            <span className={styles.rowValue}>{order.widthCm} x {order.heightCm} cm</span>
                          </div>
                          {pb && (
                            <>
                              <div className={styles.row}>
                                <span className={styles.rowLabel}>{t('checkout.subtotal')}</span>
                                <span className={styles.rowValue}>{pb.substrateCost?.toFixed(2)} EGP</span>
                              </div>
                              <div className={styles.row}>
                                <span className={styles.rowLabel}>{t('checkout.inkCost')}</span>
                                <span className={styles.rowValue}>{pb.inkCost?.toFixed(2)} EGP</span>
                              </div>
                              <div className={styles.row}>
                                <span className={styles.rowLabel}>{t('checkout.frameCost')}</span>
                                <span className={styles.rowValue}>{pb.frameCost?.toFixed(2)} EGP</span>
                              </div>
                              <div className={styles.row}>
                                <span className={styles.rowLabel}>{t('checkout.serviceFee')}</span>
                                <span className={styles.rowValue}>{pb.serviceFee?.toFixed(2)} EGP</span>
                              </div>
                              {order.discountAppliedEgp > 0 && (
                                <div className={styles.row}>
                                  <span className={styles.rowLabel}>{t('checkout.discount')}</span>
                                  <span className={styles.rowValueSuccess}>-{order.discountAppliedEgp.toFixed(2)} EGP</span>
                                </div>
                              )}
                              <div className={styles.totalRow}>
                                <span>{t('checkout.total')}</span>
                                <span className={styles.totalValue}>{order.priceEgp.toFixed(2)} EGP</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Shipping details & Preview Link */}
                        <div className={styles.detailSection}>
                          <h3 className={styles.sectionTitle}>{t('checkout.shippingLabel')}</h3>
                          <p className={styles.shippingText}>{order.shippingAddress}</p>

                          <h3 className={styles.sectionTitle + ' mt-3'}>Artwork</h3>
                          <div className={styles.previewWrapper}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={order.fileUrl}
                              alt="Artwork Thumbnail"
                              className={styles.previewThumb}
                            />
                            <a
                              href={order.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-accent hover:underline font-semibold"
                            >
                              View Original Asset ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-sm font-medium">{t('orders.emptyState')}</span>
          <Link href="/dashboard" className={styles.payButton + ' max-w-xs mt-2'}>
            {locale === 'ar-eg' ? 'ارفع صورة جديدة' : 'Upload Artwork'}
          </Link>
        </div>
      )}
    </div>
  );
}
