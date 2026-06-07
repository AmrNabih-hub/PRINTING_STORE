'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import styles from './Dropzone.module.css';
import { cn } from '@/lib/utils';
import { useTranslation } from '../../context/TranslationContext';

interface UploadResult {
  success: boolean;
  originalName: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  thumbnailUrl: string;
  aiAssessment: {
    artworkClassification: string;
    estimatedInkDensityFactor: number;
    compressionArtifactsDetected: boolean;
    printReadinessScore: number;
    riskAssessment: string;
    isPotentialPricingGame: boolean;
  };
}

interface DropzoneProps {
  onUploadSuccess: (result: UploadResult) => void;
  widthCm: number;
  heightCm: number;
}

export default function Dropzone({ onUploadSuccess, widthCm, heightCm }: DropzoneProps) {
  const { t, locale } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE_MB = 80;

  function validateAndUploadFile(file: File) {
    setErrorMsg(null);

    // 1. Client-Side Size Pre-Validation Boundaries
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      const errorText = t('upload.errorTooLarge').replace('{limit}', String(MAX_SIZE_MB));
      setErrorMsg(errorText);
      return;
    }

    // 2. Client-Side Format/MIME Verification
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff'];
    const isTiffExtension = file.name.endsWith('.tiff') || file.name.endsWith('.tif');
    if (!allowedTypes.includes(file.type) && !isTiffExtension) {
      const errorText = t('upload.errorFormat');
      setErrorMsg(errorText);
      return;
    }

    uploadFile(file);
  }

  function uploadFile(file: File) {
    setLoading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('widthCm', String(widthCm));
    formData.append('heightCm', String(heightCm));

    // Simulated progress tick (stops at 90% until fetch completes)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 100);

    fetch('/api/assets/ingest', {
      method: 'POST',
      body: formData,
    })
      .then(async (res) => {
        clearInterval(interval);
        setProgress(100);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'INGESTION_FAILED');
        }
        return res.json();
      })
      .then((data: UploadResult) => {
        onUploadSuccess(data);
      })
      .catch((err) => {
        const fallbackErr = t('upload.errorFailed');
        setErrorMsg(err.message === 'FILE_TOO_LARGE' ? t('upload.errorTooLarge').replace('{limit}', String(MAX_SIZE_MB)) : fallbackErr);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUploadFile(e.dataTransfer.files[0]);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndUploadFile(e.target.files[0]);
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={cn(styles.dropzoneContainer, isDragActive && styles.dropzoneActive)}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".png,.jpg,.jpeg,.tiff"
          onChange={handleChange}
        />

        <div className={styles.iconWrapper}>
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>

        <p className={styles.textTitle}>
          {locale === 'ar-eg' ? 'اسحب وأسقط ملف الصورة هنا' : 'Drag & drop printing file'}
        </p>
        <p className={styles.textSub}>
          {locale === 'ar-eg'
            ? `نقبل صيغ JPG، PNG، TIFF حتى ${MAX_SIZE_MB} ميجابايت`
            : `Accepts JPG, PNG, TIFF up to ${MAX_SIZE_MB}MB`}
        </p>

        {loading && (
          <div className="w-full max-w-xs mt-4">
            <div className={styles.progressContainer}>
              <div className={styles.progressBar} style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] text-text/50 mt-1">{t('common.loading')}</p>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
          {errorMsg}
        </div>
      )}
    </motion.div>
  );
}
