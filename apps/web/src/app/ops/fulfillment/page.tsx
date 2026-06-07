'use client';

import React, { useEffect, useState } from 'react';

interface Material {
  id: string;
  name: string;
  type: string;
  basePriceEgp: number;
  stockLevel: number;
  stockUnit: string;
  isAvailable: boolean;
}

export default function FulfillmentDashboard() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/materials')
      .then(r => r.json())
      .then(data => {
        if (data.materials) setMaterials(data.materials);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch materials', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] p-8 text-neutral-100 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex justify-between items-end border-b border-white/10 pb-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400">
              Fulfillment Ops
            </h1>
            <p className="text-neutral-500 text-sm">Material inventory and catalog management.</p>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-3xl bg-white/[0.02] backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.01]">
            <h2 className="text-lg font-medium text-neutral-200">Material Inventory</h2>
            <div className="flex items-center gap-3">
              <div className="text-xs font-mono text-neutral-500 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                {materials.length} total items
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs uppercase tracking-wider bg-black/20 text-neutral-500">
                <tr>
                  <th className="px-8 py-5 font-medium">Material</th>
                  <th className="px-8 py-5 font-medium">Type</th>
                  <th className="px-8 py-5 font-medium">Unit Price</th>
                  <th className="px-8 py-5 font-medium">Stock Level</th>
                  <th className="px-8 py-5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    </td>
                  </tr>
                ) : materials.map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-4 font-medium text-neutral-200">
                      {item.name}
                      <div className="text-[10px] text-neutral-600 font-mono mt-1">{item.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-white/5 text-neutral-300 border border-white/10">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-mono text-neutral-300">
                      {item.basePriceEgp?.toFixed(2)} EGP <span className="text-neutral-600 text-xs">/ {item.stockUnit}</span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${item.stockLevel > 50 ? 'bg-emerald-500' : item.stockLevel > 10 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                        <span className="text-neutral-300 font-mono">{item.stockLevel}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      {item.isAvailable ? (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                          Available
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-xs font-medium flex items-center gap-1.5">
                          Unavailable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && materials.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-neutral-500 font-medium">
                      No materials available in catalog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
