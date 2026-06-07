'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from 'framer-motion';
import styles from './GlassSelect.module.css';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/context/TranslationContext';

export interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  options: GlassSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function GlassSelect({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Select...',
}: GlassSelectProps) {
  const { locale } = useTranslation();
  const isRtl = locale === 'ar-eg';
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Mouse-tracking radial glow (matching GlassCard)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  }

  const radialGradient = useMotionTemplate`radial-gradient(
    300px circle at ${mouseX}px ${mouseY}px,
    rgba(var(--accent-rgb), 0.12),
    transparent 80%
  )`;

  // Click-away close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  }

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      className={cn(styles.selectWrapper, isOpen && styles.selectWrapperOpen, className)}
    >
      {/* Radial glow overlay */}
      <motion.div
        className={styles.glowOverlay}
        style={{ background: radialGradient }}
      />

      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          styles.trigger,
          isOpen && styles.triggerOpen,
          disabled && styles.triggerDisabled
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.triggerLabel}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {/* Chevron */}
        <svg
          className={cn(styles.chevron, isOpen && styles.chevronOpen)}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              styles.dropdownPanel,
              isRtl ? styles.dropdownPanelRtl : styles.dropdownPanelLtr
            )}
            role="listbox"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    styles.option,
                    isSelected && styles.optionSelected
                  )}
                >
                  <span className={styles.optionDot} />
                  <span>{option.label}</span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
