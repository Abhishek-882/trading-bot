import React, { useEffect, useState, useRef } from 'react';

/**
 * RollingNumber — Smooth fluid number ticker with organic physics feel.
 * Animates numerical transitions smoothly with tactile ease-out spring curves.
 */
export function RollingNumber({ value, prefix = '', suffix = '', decimals = 0, className = '' }) {
  const [displayValue, setDisplayValue] = useState(typeof value === 'number' ? value : parseFloat(value) || 0);
  const targetRef = useRef(typeof value === 'number' ? value : parseFloat(value) || 0);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const startValueRef = useRef(displayValue);

  const numTarget = typeof value === 'number' ? value : parseFloat(value) || 0;

  useEffect(() => {
    if (Math.abs(numTarget - targetRef.current) < 0.0000001) return;

    startValueRef.current = displayValue;
    targetRef.current = numTarget;
    startTimeRef.current = performance.now();
    const duration = 450; // ms

    const animate = (currentTime) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);

      // Smooth cubic ease-out curve (1 - (1 - t)^3)
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startValueRef.current + (targetRef.current - startValueRef.current) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetRef.current);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [numTarget]);

  const formatted = decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString();

  return (
    <span className={`inline-block font-mono tracking-tight transition-colors duration-200 ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

export default RollingNumber;
