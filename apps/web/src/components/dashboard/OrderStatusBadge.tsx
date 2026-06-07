'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import { OrderStatus } from '@printing-store/core-logic';
import styles from './OrderStatusBadge.module.css';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export default function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const { t } = useTranslation();

  let statusClass = styles.pending;
  let hasPulse = true;

  switch (status) {
    case 'pending':
      statusClass = styles.pending;
      break;
    case 'processing':
      statusClass = styles.processing;
      break;
    case 'ready_for_handover':
      statusClass = styles.ready;
      break;
    case 'in_transit':
      statusClass = styles.transit;
      break;
    case 'delivered':
      statusClass = styles.delivered;
      hasPulse = false;
      break;
    case 'cancelled':
      statusClass = styles.cancelled;
      hasPulse = false;
      break;
  }

  // Localized status string lookup
  const statusLabel = t(`orders.status.${status}`);

  return (
    <motion.span
      layout
      className={`${styles.badge} ${statusClass}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      {hasPulse && <span className={styles.pulseDot} />}
      {statusLabel}
    </motion.span>
  );
}
