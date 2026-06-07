'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/context/TranslationContext';
import GlassCard from '@/components/glass/GlassCard';
import GlassSelect from '@/components/glass/GlassSelect';
import { UserRole } from '@printing-store/core-logic';
import styles from './Admin.module.css';

interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

interface Material {
  id: string;
  name: string;
  type: 'ink' | 'substrate' | 'frame' | 'coating' | 'other';
  unitName: string;
  costPerUnit: number;
  stockLevel: number;
}

interface SystemConfig {
  key: string;
  value: number;
  description?: string;
}

interface AuditItem {
  orderId: string;
  fileUrl: string;
  widthCm: number;
  heightCm: number;
  createdAt: string;
  artistName: string;
  customerId: string;
}

type TabType = 'roles' | 'materials' | 'config' | 'gallery';

export default function AdminPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabType>('roles');
  const [loading, setLoading] = useState(true);

  // Data States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [auditQueue, setAuditQueue] = useState<AuditItem[]>([]);

  // Material Form States
  const [matForm, setMatForm] = useState({
    id: '',
    name: '',
    type: 'substrate',
    unit_name: 'sq_meter',
    cost_per_unit: '',
    stock_level: '',
  });
  const [isEditingMat, setIsEditingMat] = useState(false);
  const [matSubmitLoading, setMatSubmitLoading] = useState(false);

  // Gallery Publish Modal States
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryDesc, setGalleryDesc] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Role Mutation State
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);

  // Load dashboard tab data
  const loadData = useCallback(async () => {
    try {
      if (activeTab === 'roles') {
        const res = await fetch('/api/admin/profiles');
        if (res.ok) {
          const data = await res.json();
          setProfiles(data.profiles || []);
        }
      } else if (activeTab === 'materials') {
        const res = await fetch('/api/admin/materials');
        if (res.ok) {
          const data = await res.json();
          setMaterials(data.materials || []);
        }
      } else if (activeTab === 'config') {
        const res = await fetch('/api/admin/config');
        if (res.ok) {
          const data = await res.json();
          setConfigs(data.configs || []);
        }
      } else if (activeTab === 'gallery') {
        const res = await fetch('/api/admin/gallery');
        if (res.ok) {
          const data = await res.json();
          setAuditQueue(data.queue || []);
        }
      }
    } catch (err) {
      console.error('Failed to load admin panel data:', err);
    }
  }, [activeTab]);

  useEffect(() => {
    // Authenticate session checks
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.authenticated || data.user.role !== 'admin') {
          router.push('/dashboard');
        } else {
          setLoading(false);
        }
      } catch {
        router.push('/dashboard');
      }
    }

    checkAuth();
  }, [router]);

  // Reload data when active tab changes
  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [activeTab, loading, loadData]);

  // Handle User Role Changes
  async function handleRoleChange(targetUserId: string, newRole: UserRole) {
    setUpdatingRoleUserId(targetUserId);

    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorDetail = data.error || res.statusText;
        alert(data.message || `${t('common.error')} (${errorDetail})`);
        return;
      }

      // Update locally
      setProfiles(prev =>
        prev.map(p => (p.id === targetUserId ? { ...p, role: newRole } : p))
      );
    } catch {
      alert(t('common.error'));
    } finally {
      setUpdatingRoleUserId(null);
    }
  }

  // Handle Material Form CRUD
  async function handleMaterialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matForm.name || !matForm.cost_per_unit || !matForm.stock_level) return;

    setMatSubmitLoading(true);

    const payload = {
      name: matForm.name,
      type: matForm.type,
      unit_name: matForm.unit_name,
      cost_per_unit: parseFloat(matForm.cost_per_unit),
      stock_level: parseFloat(matForm.stock_level),
    };

    try {
      let res;
      if (isEditingMat) {
        res = await fetch('/api/admin/materials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: matForm.id }),
        });
      } else {
        res = await fetch('/api/admin/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        const errorDetail = data.error || (data.details ? JSON.stringify(data.details) : res.statusText);
        alert(data.message || `${t('common.error')} (${errorDetail})`);
        return;
      }

      // Success -> reset form and reload list
      setMatForm({
        id: '',
        name: '',
        type: 'substrate',
        unit_name: 'sq_meter',
        cost_per_unit: '',
        stock_level: '',
      });
      setIsEditingMat(false);
      await loadData();
    } catch {
      alert(t('common.error'));
    } finally {
      setMatSubmitLoading(false);
    }
  }

  function handleEditMaterial(mat: Material) {
    setMatForm({
      id: mat.id,
      name: mat.name,
      type: mat.type,
      unit_name: mat.unitName,
      cost_per_unit: String(mat.costPerUnit),
      stock_level: String(mat.stockLevel),
    });
    setIsEditingMat(true);
  }

  async function handleDeleteMaterial(id: string) {
    if (!confirm(t('admin.materials.deleteConfirm'))) return;

    try {
      const res = await fetch(`/api/admin/materials?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        const errorDetail = data.error || res.statusText;
        alert(data.message || `${t('common.error')} (${errorDetail})`);
        return;
      }

      await loadData();
    } catch {
      alert(t('common.error'));
    }
  }

  // Handle System Config changes
  async function handleConfigUpdate(key: string, value: string) {
    if (!value || isNaN(parseFloat(value))) return;

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: parseFloat(value) }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorDetail = data.error || res.statusText;
        alert(data.message || `${t('common.error')} (${errorDetail})`);
        return;
      }

      setConfigs(prev =>
        prev.map(c => (c.key === key ? { ...c, value: parseFloat(value) } : c))
      );
    } catch {
      alert(t('common.error'));
    }
  }

  // Handle Gallery audit approval publication
  function openPublishModal(orderId: string) {
    setSelectedOrderId(orderId);
    setGalleryTitle('');
    setGalleryDesc('');
    setPublishModalOpen(true);
  }

  async function handlePublishGalleryItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || !galleryTitle || !galleryDesc) return;

    setPublishing(true);

    try {
      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrderId,
          title: galleryTitle,
          description: galleryDesc,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorDetail = data.error || res.statusText;
        alert(data.message || `${t('common.error')} (${errorDetail})`);
        return;
      }

      setPublishModalOpen(false);
      setSelectedOrderId(null);
      await loadData();
    } catch {
      alert(t('common.error'));
    } finally {
      setPublishing(false);
    }
  }

  function getLocalizedTabName(tab: TabType) {
    const names = {
      roles: t('admin.tabs.roles'),
      materials: t('admin.tabs.materials'),
      config: t('admin.tabs.config'),
      gallery: t('admin.tabs.gallery'),
    };
    return names[tab];
  }

  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale === 'ar-eg' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
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

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>{t('admin.title')}</h1>
        <p className="text-sm text-text/60">{t('admin.subtitle')}</p>
      </div>

      {/* Tabs Menu */}
      <div className={styles.tabBar}>
        {(['roles', 'materials', 'config', 'gallery'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTabBtn : ''}`}
          >
            {getLocalizedTabName(tab)}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      <div className={styles.tabContent}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
        {/* Tab A: Role Manager */}
        {activeTab === 'roles' && (
          <GlassCard className="p-0">
            <div className={styles.tableContainer}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>{t('admin.roles.fullName')}</th>
                    <th>{t('admin.roles.email')}</th>
                    <th>{t('admin.roles.signedUp')}</th>
                    <th>{t('admin.roles.currentRole')}</th>
                    <th>{t('admin.roles.controls')}</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td data-label={t('admin.roles.fullName')} className="font-bold">{profile.fullName}</td>
                      <td data-label={t('admin.roles.email')}>{profile.email}</td>
                      <td data-label={t('admin.roles.signedUp')}>{formatDate(profile.createdAt)}</td>
                      <td data-label={t('admin.roles.currentRole')}>
                        <span className={`
                          ${styles.badge}
                          ${profile.role === 'admin' && styles.badgeAdmin}
                          ${profile.role === 'employee' && styles.badgeEmployee}
                          ${profile.role === 'courier' && styles.badgeCourier}
                          ${profile.role === 'customer' && styles.badgeCustomer}
                        `}>
                          {t(`admin.roles.options.${profile.role}`)}
                        </span>
                      </td>
                      <td data-label={t('admin.roles.controls')}>
                        <GlassSelect
                          value={profile.role}
                          onChange={(val) => handleRoleChange(profile.id, val as UserRole)}
                          disabled={updatingRoleUserId === profile.id}
                          options={[
                            { value: 'customer', label: t('admin.roles.options.customer') },
                            { value: 'employee', label: t('admin.roles.options.employee') },
                            { value: 'courier', label: t('admin.roles.options.courier') },
                            { value: 'admin', label: t('admin.roles.options.admin') },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        {/* Tab B: Materials Inventory CRUD */}
        {activeTab === 'materials' && (
          <div className="flex flex-col gap-6">
            {/* Form */}
            <GlassCard className={styles.formCard}>
              <h2 className={styles.sectionHeader}>
                {isEditingMat ? t('admin.materials.editTitle') : t('admin.materials.newTitle')}
              </h2>
              <form onSubmit={handleMaterialSubmit} className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>{t('admin.materials.name')}</label>
                  <input
                    type="text"
                    placeholder={t('admin.materials.namePlaceholder')}
                    value={matForm.name}
                    onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                    className={styles.textInput}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>{t('admin.materials.type')}</label>
                  <GlassSelect
                    value={matForm.type}
                    onChange={(val) => setMatForm({ ...matForm, type: val })}
                    options={[
                      { value: 'substrate', label: t('checkout.substrateLabel') },
                      { value: 'frame', label: t('checkout.frameLabel') },
                      { value: 'ink', label: t('checkout.inkCost') },
                      { value: 'coating', label: locale === 'ar-eg' ? 'طبقة حماية' : 'Coating' },
                    ]}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>{t('admin.materials.unitName')}</label>
                  <input
                    type="text"
                    placeholder={t('admin.materials.unitPlaceholder')}
                    value={matForm.unit_name}
                    onChange={(e) => setMatForm({ ...matForm, unit_name: e.target.value })}
                    className={styles.textInput}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>{t('admin.materials.costPerUnit')}</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="120.00"
                    value={matForm.cost_per_unit}
                    onChange={(e) => setMatForm({ ...matForm, cost_per_unit: e.target.value })}
                    className={styles.textInput}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>{t('admin.materials.stockLevel')}</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1000"
                    value={matForm.stock_level}
                    onChange={(e) => setMatForm({ ...matForm, stock_level: e.target.value })}
                    className={styles.textInput}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className={styles.formBtn + ' flex-grow'}
                    disabled={matSubmitLoading}
                  >
                    {isEditingMat ? t('admin.materials.btnUpdate') : t('admin.materials.btnRegister')}
                  </button>
                  {isEditingMat && (
                    <button
                      type="button"
                      onClick={() => {
                        setMatForm({
                          id: '',
                          name: '',
                          type: 'substrate',
                          unit_name: 'sq_meter',
                          cost_per_unit: '',
                          stock_level: '',
                        });
                        setIsEditingMat(false);
                      }}
                      className={styles.formBtn + ' bg-white/10 text-text'}
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </form>
            </GlassCard>

            {/* List */}
            <GlassCard className="p-0">
              <div className={styles.tableContainer}>
                <table className={styles.adminTable}>
                  <thead>
                    <tr>
                      <th>{t('admin.materials.tblName')}</th>
                      <th>{t('admin.materials.tblCategory')}</th>
                      <th>{t('admin.materials.tblUnit')}</th>
                      <th>{t('admin.materials.tblCost')}</th>
                      <th>{t('admin.materials.tblStock')}</th>
                      <th>{t('admin.materials.tblControls')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((mat) => (
                      <tr key={mat.id}>
                        <td data-label={t('admin.materials.tblName')} className="font-bold">{mat.name}</td>
                        <td data-label={t('admin.materials.tblCategory')} className="capitalize text-accent/80 font-semibold">{t(`checkout.${mat.type}Label`)}</td>
                        <td data-label={t('admin.materials.tblUnit')} className="font-mono">{mat.unitName}</td>
                        <td data-label={t('admin.materials.tblCost')} className="font-mono">{mat.costPerUnit.toFixed(2)} EGP</td>
                        <td data-label={t('admin.materials.tblStock')} className="font-mono">{mat.stockLevel.toFixed(2)}</td>
                        <td data-label={t('admin.materials.tblControls')}>
                          <button
                            type="button"
                            onClick={() => handleEditMaterial(mat)}
                            className={styles.editBtn}
                          >
                            {t('admin.materials.btnEdit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMaterial(mat.id)}
                            className={styles.deleteBtn}
                          >
                            {t('admin.materials.btnDelete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Tab C: System Configuration Constants */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {configs.map((conf) => (
              <GlassCard key={conf.key} className={styles.formCard}>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider font-bold text-text/50">{t('admin.config.cardTitle')}</span>
                  <h3 className="text-base font-bold text-accent">{conf.key}</h3>
                  <p className="text-xs text-text/60 leading-normal">{conf.description || 'System setting'}</p>
                </div>
                
                <div className="flex gap-3 items-end mt-2">
                  <div className={styles.inputGroup + ' flex-grow'}>
                    <label className={styles.inputLabel}>{t('admin.config.valueLabel')}</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={conf.value}
                      onBlur={(e) => handleConfigUpdate(conf.key, e.target.value)}
                      className={styles.textInput}
                    />
                  </div>
                  <span className="text-xs text-text/40 font-mono mb-2.5">{t('admin.config.autoSaved')}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Tab D: Gallery Audit Grid */}
        {activeTab === 'gallery' && (
          <div className="flex flex-col gap-4">
            {auditQueue.length > 0 ? (
              <div className={styles.auditGrid}>
                {auditQueue.map((item) => (
                  <GlassCard key={item.orderId} className={styles.auditCard}>
                    <div className={styles.auditImgWrapper}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.fileUrl}
                        alt="Audited Artwork"
                        className={styles.auditImg}
                      />
                    </div>
                    <div className={styles.auditInfo}>
                      <span className={styles.artistName}>
                        {t('admin.gallery.artist').replace('{name}', item.artistName)}
                      </span>
                      <span className="text-text/60">
                        {t('admin.gallery.dimensions')
                          .replace('{width}', String(item.widthCm))
                          .replace('{height}', String(item.heightCm))}
                      </span>
                      <span className={styles.auditDate}>
                        {t('admin.gallery.ordered').replace('{date}', formatDate(item.createdAt))}
                      </span>
                    </div>
                    <div className={styles.btnGroup}>
                      <button
                        type="button"
                        onClick={() => openPublishModal(item.orderId)}
                        className={styles.publishBtn}
                      >
                        {t('admin.gallery.btnPublish')}
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <svg className={styles.emptyIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-semibold">{t('admin.gallery.emptyState')}</p>
                <p className="text-xs text-text/40 -mt-2">{t('admin.gallery.emptyDesc')}</p>
              </div>
            )}
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Gallery Publish title/description Modal dialog pop-up */}
      <AnimatePresence>
        {publishModalOpen && (
          <div className={styles.modalOverlay}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassCard className={styles.modalContent}>
                <h3 className={styles.modalTitle}>{t('admin.gallery.modal.title')}</h3>
                <p className="text-xs text-text/60 -mt-3">{t('admin.gallery.modal.subtitle')}</p>

                <form onSubmit={handlePublishGalleryItem} className="flex flex-col gap-4">
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>{t('admin.gallery.modal.displayTitle')}</label>
                    <input
                      type="text"
                      placeholder="Sunset Over Giza"
                      value={galleryTitle}
                      onChange={(e) => setGalleryTitle(e.target.value)}
                      className={styles.textInput}
                      required
                      disabled={publishing}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>{t('admin.gallery.modal.description')}</label>
                    <textarea
                      placeholder="Hand-stretched print capturing Giza landscapes in vibrant high contrast CMYK..."
                      value={galleryDesc}
                      onChange={(e) => setGalleryDesc(e.target.value)}
                      className={`${styles.textInput} ${styles.textarea}`}
                      required
                      disabled={publishing}
                    />
                  </div>

                  <div className="flex gap-3 mt-2">
                    <button
                      type="submit"
                      className={styles.modalBtnSuccess}
                      disabled={publishing}
                    >
                      {publishing ? t('admin.gallery.modal.publishing') : t('admin.gallery.modal.btnCurate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPublishModalOpen(false);
                        setSelectedOrderId(null);
                      }}
                      className={styles.modalCloseBtn}
                      disabled={publishing}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
