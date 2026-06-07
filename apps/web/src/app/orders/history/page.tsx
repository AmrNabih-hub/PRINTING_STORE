'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OrderRow {
  id: string;
  status: string;
  widthCm: number;
  heightCm: number;
  fileUrl: string;
  priceEgp: number;
  discountAppliedEgp: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  processing: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  quality_check: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  ready: 'bg-green-500/20 text-green-500 border-green-500/30',
  in_transit: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  quality_check: 'Quality Check',
  ready: 'Ready',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderHistoryHub() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders/history?limit=50');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // HTTP Polling for decoupled real-time updates (every 5 seconds)
    const intervalId = setInterval(fetchOrders, 5000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="min-h-[80vh] flex flex-col gap-8 p-4 md:p-8 relative">
      {/* Background Glows for Premium Aesthetics */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-2"
      >
        <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/50 tracking-tight">
          Order Tracking Hub
        </h1>
        <p className="text-sm md:text-base text-white/50 font-medium">
          Monitor your premium canvas prints in real-time.
        </p>
      </motion.div>

      {/* Main Content Area */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="flex-1 w-full"
      >
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-sm font-semibold tracking-widest uppercase text-white/40">Synchronizing...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
              <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">No Orders Found</h3>
            <p className="text-sm text-white/50 max-w-sm">You haven't placed any orders yet. Once you order a canvas, you can track its live progress here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {orders.map((order, i) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative flex flex-col p-6 rounded-3xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-white/20 backdrop-blur-xl transition-all duration-300 shadow-2xl shadow-black/50 overflow-hidden"
                >
                  {/* Glass Shimmer Effect on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                  
                  {/* Top Row: Order ID & Status */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Order ID</span>
                      <span className="text-sm font-mono text-white/80">{order.id.split('-')[0].toUpperCase()}</span>
                    </div>
                    
                    <div className={`px-3 py-1.5 rounded-full border text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 ${statusColors[order.status] || statusColors.pending}`}>
                      <span className="relative flex h-2 w-2">
                        {order.status !== 'delivered' && order.status !== 'cancelled' && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
                        )}
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                      </span>
                      {statusLabels[order.status] || order.status}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6 flex-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Dimensions</span>
                      <span className="text-sm font-semibold text-white/90">{order.widthCm} x {order.heightCm} cm</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Date Placed</span>
                      <span className="text-sm font-semibold text-white/90">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Footer Row: Price */}
                  <div className="pt-4 mt-auto border-t border-white/10 flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Total Price</span>
                    <span className="text-xl font-black text-accent">{order.priceEgp.toFixed(2)} <span className="text-xs text-white/50">EGP</span></span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
