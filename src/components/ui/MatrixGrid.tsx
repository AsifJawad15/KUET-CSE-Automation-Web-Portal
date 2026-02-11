'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * MatrixGrid — Brown/beige grid overlay that reacts to mouse hover.
 * Renders a subtle grid of dots. Dots near the cursor glow with warm beige color.
 */
const MatrixGrid: React.FC<{
  className?: string;
  dotColor?: string;
  glowColor?: string;
  dotSize?: number;
  gap?: number;
  baseOpacity?: number;
  hoverRadius?: number;
}> = ({
  className = '',
  dotColor = 'rgba(93,64,55,0.12)',
  glowColor = 'rgba(212,165,116,0.55)',
  dotSize = 2,
  gap = 32,
  baseOpacity = 0.25,
  hoverRadius = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    setDims({ w, h });
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    for (let x = gap; x < dims.w; x += gap) {
      for (let y = gap; y < dims.h; y += gap) {
        const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
        const t = Math.max(0, 1 - dist / hoverRadius);

        ctx.beginPath();
        ctx.arc(x, y, dotSize + t * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = t > 0.01 ? glowColor : dotColor;
        ctx.globalAlpha = baseOpacity + t * 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Reset scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rafRef.current = requestAnimationFrame(draw);
  }, [dims, dotColor, glowColor, dotSize, gap, baseOpacity, hoverRadius]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`absolute inset-0 pointer-events-auto z-0 ${className}`}
    />
  );
};

export default MatrixGrid;
