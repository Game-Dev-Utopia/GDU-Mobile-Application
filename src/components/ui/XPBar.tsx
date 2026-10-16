'use client';
import React, { useEffect, useRef, useState } from 'react';

interface XPBarProps {
  current: number;
  max: number;
  height?: number;
  showLabel?: boolean;
  animate?: boolean;
}

export default function XPBar({
  current,
  max,
  height = 8,
  showLabel = true,
  animate = true,
}: XPBarProps) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  const [displayPct, setDisplayPct] = useState(animate ? 0 : pct);

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => setDisplayPct(pct), 150);
    return () => clearTimeout(timer);
  }, [pct, animate]);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {current.toLocaleString()} / {max.toLocaleString()} XP
          </span>
          <span className="text-[11px] font-bold text-xp-lime">{pct}%</span>
        </div>
      )}
      <div className="xp-bar-track" style={{ height: `${height}px` }}>
        <div
          className="xp-bar-fill"
          style={{ width: `${displayPct}%`, height: `${height}px` }}
        />
      </div>
    </div>
  );
}