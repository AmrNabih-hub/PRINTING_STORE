'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import GlassCard from '@/components/glass/GlassCard';
import OrderStatusBadge from '@/components/dashboard/OrderStatusBadge';
import { OrderStatus } from '@printing-store/core-logic';
import styles from './Fulfillment.module.css';

interface AssignedOrder {
  id: string;
  status: OrderStatus;
  widthCm: number;
  heightCm: number;
  fileUrl: string;
  priceEgp: number;
  createdAt: string;
  customerName: string;
}

export default function FulfillmentPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingOrderId, setMutatingOrderId] = useState<string | null>(null);
  const [stockError, setStockError] = useState<{ id: string; message: string } | null>(null);

  const loadAssignedOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/assigned');
      if (!res.ok) {
        if (res.status === 403) {
          // Silent redirection to standard dashboard if user is not employee/admin
          router.push('/dashboard');
          return;
        }
        throw new Error(t('fulfillment.fetchError'));
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t('fulfillment.unexpectedError');
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Authenticate user session immediately
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.authenticated || (data.user.role !== 'employee' && data.user.role !== 'admin')) {
          router.push('/dashboard');
        } else {
          loadAssignedOrders();
        }
      } catch {
        router.push('/dashboard');
      }
    }

    checkAuth();
  }, [router, loadAssignedOrders]);

  async function handleUpdateStatus(orderId: string, newStatus: 'processing' | 'ready_for_handover') {
    setMutatingOrderId(orderId);
    setStockError(null);

    try {
      const res = await fetch('/api/orders/update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_STOCK') {
          setStockError({ id: orderId, message: data.message });
        } else {
          alert(data.message || t('common.error'));
        }
        return;
      }

      // Successful update -> reload orders queue
      await loadAssignedOrders();
    } catch {
      alert(t('common.error'));
    } finally {
      setMutatingOrderId(null);
    }
  }

  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale === 'ar-eg' ? 'ar-EG' : 'en-US', {
        month: 'short',
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
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('fulfillment.title')}</h1>
          <p className={styles.subtitle}>{t('fulfillment.subtitle')}</p>
        </div>
        <span className={styles.employeeBadge}>{t('fulfillment.operator')}</span>
      </div>

      {orders.length > 0 ? (
        <div className={styles.taskList}>
          <AnimatePresence mode="popLayout">
            {orders.map((order) => {
              const isMutating = mutatingOrderId === order.id;
              const hasStockErr = stockError?.id === order.id;

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: 'spring', stiffness: 100 }}
                >
                  <GlassCard className={styles.taskCard}>
                    <div className={styles.taskInfo}>
                      <div className={styles.previewImageContainer}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={order.fileUrl}
                          alt="Artwork Preview"
                          className={styles.previewImage}
                        />
                      </div>
                      <div className={styles.metaSection}>
                        <span className={styles.orderNumber}>
                          {t('fulfillment.orderId').replace('{id}', order.id.slice(0, 8))}
                        </span>
                        <span className={styles.customerName}>
                          {t('fulfillment.customer').replace('{name}', order.customerName)}
                        </span>
                        <span className={styles.detailsBadge}>
                          {t('fulfillment.sizing')
                            .replace('{width}', String(order.widthCm))
                            .replace('{height}', String(order.heightCm))}
                        </span>
                        <span className={styles.dateText}>
                          {t('fulfillment.received').replace('{date}', formatDate(order.createdAt))}
                        </span>
                      </div>
                    </div>

                    <div className={styles.actionSection}>
                      <div className={styles.statusIndicator}>
                        <OrderStatusBadge status={order.status} />
                      </div>

                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'processing')}
                          disabled={isMutating}
                          className={`${styles.primaryBtn} ${styles.startBtn}`}
                        >
                          {isMutating ? t('fulfillment.starting') : t('fulfillment.startBtn')}
                        </button>
                      )}

                      {order.status === 'processing' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, 'ready_for_handover')}
                          disabled={isMutating}
                          className={`${styles.primaryBtn} ${styles.readyBtn}`}
                        >
                          {isMutating ? t('fulfillment.completing') : t('fulfillment.readyBtn')}
                        </button>
                      )}
                    </div>
                  </GlassCard>

                  {/* Stock Constraint Alert */}
                  {hasStockErr && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-semibold max-w-lg"
                    >
                      ⚠️ {stockError.message}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-semibold">{t('fulfillment.emptyState')}</p>
          <p className="text-xs text-text/40 -mt-2">{t('fulfillment.emptyDesc')}</p>
        </div>
      )}
    </div>
  );
}
