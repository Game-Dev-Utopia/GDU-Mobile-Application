'use client';
import React, { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    number: '01',
    verb: 'Do',
    title: 'Complete activities',
    description: 'Pick from open activities — workshops, art submissions, code challenges, events. Every contribution counts.',
    color: '#7C5CFF',
    glow: 'rgba(124,92,255,0.2)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    number: '02',
    verb: 'Get recognized',
    title: 'Earn XP & badges',
    description: 'Submit proof, get reviewed by domain heads. Approved work credits XP instantly — streaks multiply your gains.',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.2)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  {
    number: '03',
    verb: 'Level up',
    title: 'Climb the leagues',
    description: 'Rise from Bronze to Diamond. Unlock titles, dominate branch leaderboards, and build a portfolio that speaks for itself.',
    color: '#A3E635',
    glow: 'rgba(163,230,53,0.2)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest font-sans">How it works</span>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mt-3">
            Three steps to{' '}
            <span className="text-xp-lime">legendary</span>
          </h2>
        </div>

        {/* Asymmetric bento layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Step 1 — large */}
          <StepCard step={STEPS[0]} visible={visible} delay={0} className="md:col-span-3 md:row-span-1" large />
          {/* Step 2 — medium */}
          <StepCard step={STEPS[1]} visible={visible} delay={120} className="md:col-span-2" />
          {/* Step 3 — full width on md */}
          <StepCard step={STEPS[2]} visible={visible} delay={240} className="md:col-span-5 md:flex-row" horizontal />
        </div>
      </div>
    </section>
  );
}

interface StepCardProps {
  step: typeof STEPS[0];
  visible: boolean;
  delay: number;
  className?: string;
  large?: boolean;
  horizontal?: boolean;
}

function StepCard({ step, visible, delay, className = '', large, horizontal }: StepCardProps) {
  return (
    <div
      className={`card-base p-6 flex flex-col gap-4 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${horizontal ? 'md:flex-row md:items-center md:gap-8' : ''} ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        boxShadow: `0 0 40px ${step.glow}`,
      }}
    >
      {/* Number + icon */}
      <div className={`flex items-start gap-4 ${horizontal ? 'md:flex-shrink-0' : ''}`}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${step.color}18`, border: `1px solid ${step.color}40`, color: step.color }}
        >
          {step.icon}
        </div>
        <div>
          <span className="font-pixel text-xs" style={{ color: step.color }}>{step.number}</span>
          <h3 className="font-heading font-bold text-2xl text-foreground leading-tight mt-0.5">
            {step.verb}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className={horizontal ? 'flex-1' : ''}>
        <p className="font-heading font-semibold text-base text-foreground mb-2">{step.title}</p>
        <p className="text-muted-foreground text-sm font-sans leading-relaxed">{step.description}</p>
      </div>

      {/* Visual accent */}
      {large && (
        <div className="mt-auto pt-4 border-t border-border flex items-center gap-3">
          {['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'].map((tier, i) => (
            <div key={tier} className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded-full border-2"
                style={{
                  borderColor: ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF'][i],
                  background: `${['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF'][i]}20`,
                }}
              />
              <span className="text-[9px] text-muted-foreground font-sans">{tier}</span>
            </div>
          ))}
          <span className="text-xs text-muted-foreground font-sans ml-1">League tiers</span>
        </div>
      )}
    </div>
  );
}
