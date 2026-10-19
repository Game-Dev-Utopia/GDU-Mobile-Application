'use client';
import React, { useEffect, useRef, useState } from 'react';

const STATS = [
  {
    value: 340,
    suffix: '+',
    label: 'Members',
    sublabel: 'across 2 branches',
    color: '#7C5CFF',
  },
  {
    value: 128400,
    suffix: '',
    label: 'XP Awarded',
    sublabel: 'this season',
    color: '#A3E635',
    format: 'compact',
  },
  {
    value: 2,
    suffix: '',
    label: 'Active Branches',
    sublabel: 'PICT & IIITK',
    color: '#22D3EE',
  },
];

function useCountUp(target: number, active: boolean, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return count;
}

function StatItem({ stat, active }: { stat: (typeof STATS)[0]; active: boolean }) {
  const count = useCountUp(stat.value, active);

  function format(n: number) {
    if (stat.format === 'compact') {
      if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    }
    return n.toLocaleString();
  }

  return (
    <div className="flex flex-col items-center gap-1 px-8 py-6 relative">
      <span
        className="font-pixel text-4xl sm:text-5xl font-bold tabular-nums"
        style={{ color: stat.color, textShadow: `0 0 20px ${stat.color}50` }}
      >
        {format(count)}
        {stat.suffix}
      </span>
      <span className="font-heading font-semibold text-base text-foreground">{stat.label}</span>
      <span className="text-xs text-muted-foreground font-sans">{stat.sublabel}</span>
    </div>
  );
}

export default function StatsStrip() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setActive(true);
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div
          className="card-base overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #131A33 0%, #1A1040 50%, #0F1F3A 100%)' }}
        >
          <div className="flex flex-col sm:flex-row items-center divide-y sm:divide-y-0 sm:divide-x divide-border">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex-1 w-full">
                <StatItem stat={stat} active={active} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
