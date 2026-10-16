'use client';
import React, { useEffect, useRef, useState } from 'react';

interface LandingHeroProps {
  onLogin: () => void;
}

export default function LandingHero({ onLogin }: LandingHeroProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-12">
      {/* Pixel grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#7C5CFF 1px, transparent 1px), linear-gradient(90deg, #7C5CFF 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Logo + wordmark */}
      <div
        className={`flex items-center gap-3 mb-10 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        style={{ transitionDelay: '0ms' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)' }}>
          <span className="font-pixel text-white text-xs font-bold">GDU</span>
        </div>
        <span className="font-heading font-bold text-xl text-foreground tracking-tight">
          GDU <span className="text-xp-lime">XP</span>
        </span>
      </div>

      {/* Main headline */}
      <div
        className={`text-center max-w-3xl mx-auto transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        style={{ transitionDelay: '100ms' }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-xp-lime animate-pulse" />
          <span className="text-xs font-medium text-violet-300 font-sans">GameDevUtopia · Season 3 Active</span>
        </div>

        <h1 className="font-heading font-bold text-5xl sm:text-6xl lg:text-7xl text-foreground leading-[1.05] tracking-tight mb-6">
          Level up your{' '}
          <span
            className="relative inline-block"
            style={{
              background: 'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 50%, #A3E635 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            community
          </span>
        </h1>

        <p className="text-muted-foreground text-lg sm:text-xl font-sans max-w-xl mx-auto leading-relaxed">
          Earn XP for every contribution — code, art, writing, events. Track your growth, climb leagues, and build your game dev portfolio.
        </p>
      </div>

      {/* CTA */}
      <div
        className={`mt-10 flex flex-col sm:flex-row items-center gap-4 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        style={{ transitionDelay: '220ms' }}
      >
        <button
          onClick={onLogin}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-heading font-semibold text-base text-white transition-all duration-200 hover:scale-105 active:scale-95 group"
          style={{
            background: 'linear-gradient(135deg, #5865F2 0%, #7C5CFF 100%)',
            boxShadow: '0 0 32px rgba(88,101,242,0.4), 0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <DiscordIcon />
          Continue with Discord
          <span className="text-white/60 text-sm font-normal group-hover:text-white/80 transition-colors">→</span>
        </button>
        <span className="text-muted-foreground text-sm font-sans">Free · No credit card</span>
      </div>

      {/* Floating XP badges */}
      <div
        className={`mt-16 flex flex-wrap justify-center gap-3 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ transitionDelay: '340ms' }}
      >
        {[
          { label: '+150 XP', sub: 'Unity Workshop', color: 'violet' },
          { label: '+200 XP', sub: 'Concept Art', color: 'cyan' },
          { label: '+350 XP', sub: 'Code Challenge', color: 'lime' },
          { label: '+80 XP', sub: 'Discord Help', color: 'amber' },
        ].map((badge, i) => (
          <div
            key={badge.label}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border card-base"
            style={{
              animationDelay: `${i * 0.15}s`,
              borderColor: badge.color === 'violet' ? 'rgba(124,92,255,0.3)' : badge.color === 'cyan' ? 'rgba(34,211,238,0.3)' : badge.color === 'lime' ? 'rgba(163,230,53,0.3)' : 'rgba(245,158,11,0.3)',
            }}
          >
            <span
              className="font-pixel text-xs font-bold"
              style={{
                color: badge.color === 'violet' ? '#7C5CFF' : badge.color === 'cyan' ? '#22D3EE' : badge.color === 'lime' ? '#A3E635' : '#F59E0B',
              }}
            >
              {badge.label}
            </span>
            <span className="text-muted-foreground text-xs font-sans">{badge.sub}</span>
          </div>
        ))}
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="text-xs text-muted-foreground font-sans">Scroll to explore</span>
        <div className="w-px h-8 bg-gradient-to-b from-muted-foreground to-transparent" />
      </div>
    </section>
  );
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}
