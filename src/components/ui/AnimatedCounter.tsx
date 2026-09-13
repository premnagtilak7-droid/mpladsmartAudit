'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: 0 | 2;
  className?: string;
}

const formatIndian = (value: number, decimals: 0 | 2) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

export function AnimatedCounter({
  value,
  duration = 1.2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let frame = 0;
    const easeOutExpo = (progress: number) => progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / (duration * 1000));
      setDisplay(value * easeOutExpo(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, inView, value]);

  return <span ref={ref} className={className}>{prefix}{formatIndian(display, decimals)}{suffix}</span>;
}

export default AnimatedCounter;
