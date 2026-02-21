// ==========================================
// Animated Counter
// Single Responsibility: Animates a number from 0 → target on scroll
// ==========================================

'use client';

import { useInView } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  /** Value string like "250+" or "50". Numeric portion will be animated. */
  value: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const numMatch = value.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1]) : 0;
  const suffix = value.replace(/\d+/, '');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView || !num) return;
    let curr = 0;
    const step = Math.max(1, Math.floor(num / 60));
    const timer = setInterval(() => {
      curr += step;
      if (curr >= num) {
        setCount(num);
        clearInterval(timer);
      } else {
        setCount(curr);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [inView, num]);

  return <span ref={ref}>{inView ? `${count}${suffix}` : value}</span>;
};

export default AnimatedCounter;
