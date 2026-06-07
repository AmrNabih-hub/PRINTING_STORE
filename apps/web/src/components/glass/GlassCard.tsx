'use client';

import React, { MouseEvent } from 'react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
import styles from './GlassCard.module.css';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function GlassCard({ children, className = '' }: GlassCardProps) {
  // Use Framer Motion values to directly update coordinate templates without React state re-renders
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  // Bind accent RGB to hardware-accelerated radial template
  const radialGradient = useMotionTemplate`radial-gradient(
    400px circle at ${mouseX}px ${mouseY}px,
    rgba(var(--accent-rgb), 0.15),
    transparent 80%
  )`;

  return (
    <div
      onMouseMove={handleMouseMove}
      className={cn(styles.liquidCardContainer, 'group', className)}
    >
      {/* Invisible dynamic radial-glow overlay element */}
      <motion.div
        className={styles.glowOverlay}
        style={{
          background: radialGradient,
        }}
      />
      {/* Relative content container */}
      <div className={styles.contentLayer}>{children}</div>
    </div>
  );
}
