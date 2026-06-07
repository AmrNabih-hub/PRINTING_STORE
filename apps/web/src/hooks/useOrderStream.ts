'use client';

import { useState, useEffect, useRef } from 'react';
import { OrderStatus } from '@printing-store/core-logic';

export interface OrderUpdateEvent {
  type: 'order_update';
  orderId: string;
  status: OrderStatus;
  updatedAt: string;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export function useOrderStream() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [latestUpdate, setLatestUpdate] = useState<OrderUpdateEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to local SSE stream (same-origin automatically shares session cookies)
    const es = new EventSource('/api/orders/queue');
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus('connected');
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          setConnectionStatus('connected');
        } else if (data.type === 'order_update') {
          setLatestUpdate({
            type: 'order_update',
            orderId: data.orderId,
            status: data.status,
            updatedAt: data.updatedAt,
          });
        }
      } catch (err) {
        console.error('[SSE Client] Error parsing incoming event stream frame:', err);
      }
    };

    es.onerror = (err) => {
      console.warn('[SSE Client] Connection error, auto-reconnecting...', err);
      setConnectionStatus('connecting');
      if (es.readyState === EventSource.CLOSED) {
        setConnectionStatus('disconnected');
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setConnectionStatus('disconnected');
    };
  }, []);

  return { connectionStatus, latestUpdate };
}
