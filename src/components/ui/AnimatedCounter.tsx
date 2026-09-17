'use client';

import { useEffect, useState, type CSSProperties } from 'react';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: 0 | 2;
  className?: string;
  style?: CSSProperties;
}

export default function AnimatedCounter({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  style,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let frame = 0;
    const endValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(easeOut * endValue);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const formatted = count.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <span className={className} style={style}>{prefix}{formatted}{suffix}</span>;
}
