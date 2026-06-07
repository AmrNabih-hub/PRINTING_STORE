'use client';

import React, { useEffect, useState } from 'react';

interface Profile {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/profiles')
      .then(r => r.json())
      .then(data => {
        if (data.profiles) setProfiles(data.profiles);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch profiles', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] p-8 text-neutral-100 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="flex justify-between items-end border-b border-white/10 pb-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400">
              Admin Ops
            </h1>
            <p className="text-neutral-500 text-sm">System oversight and profile governance.</p>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-3xl bg-white/[0.02] backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.01]">
            <h2 className="text-lg font-medium text-neutral-200">Active Profiles</h2>
            <div className="text-xs font-mono text-neutral-500 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
              {profiles.length} total records
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs uppercase tracking-wider bg-black/20 text-neutral-500">
                <tr>
                  <th className="px-8 py-5 font-medium">Identifier</th>
                  <th className="px-8 py-5 font-medium">Email Address</th>
                  <th className="px-8 py-5 font-medium">Role</th>
                  <th className="px-8 py-5 font-medium">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    </td>
                  </tr>
                ) : profiles.map(profile => (
                  <tr key={profile.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-4 font-mono text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">
                      {profile.id.slice(0, 8)}...
                    </td>
                    <td className="px-8 py-4 font-medium text-neutral-200">
                      {profile.email}
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                        profile.role === 'admin' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        profile.role === 'employee' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
                      }`}>
                        {profile.role}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-neutral-500">
                      {new Date(profile.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
                {!loading && profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-neutral-500 font-medium">
                      No profiles found in the registry.
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
