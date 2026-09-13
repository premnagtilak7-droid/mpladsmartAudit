'use client';

import { motion, type MotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface ScrollRevealProps extends Pick<MotionProps, 'className' | 'style'> {
  children: ReactNode;
  delay?: number;
}

export function ScrollReveal({ children, delay = 0, className, style }: ScrollRevealProps) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 35, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

export default ScrollReveal;
