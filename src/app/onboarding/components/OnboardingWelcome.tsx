'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onEnter: () => void;
}

export default function OnboardingWelcome({ onEnter }: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'burst' | 'card' | 'ready'>('burst');
  const [xpCount, setXpCount] = useState(0);
  const [particles, setParticles] = useState<
    {
      id: number;
      x: number;
      y: number;
      color: string;
      size: number;
      angle: number;
      speed: number;
    }[]
  >([]);

  const COLORS = ['#7C5CFF', '#22D3EE', '#A3E635', '#F59E0B', '#F43F5E', '#fff'];

  useEffect(() => {
    // Generate confetti particles
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: 40 + Math.random() * 20,
      y: 30 + Math.random() * 20,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 6,
      angle: Math.random() * 360,
      speed: 0.5 + Math.random() * 1.5,
    }));
    setParticles(newParticles);

    // Phase transitions
    const t1 = setTimeout(() => setPhase('card'), 600);
    const t2 = setTimeout(() => setPhase('ready'), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Count-up XP
  useEffect(() => {
    if (phase !== 'card') return;
    let val = 0;
    const target = 0; // starting XP
    const timer = setInterval(() => {
      val += 5;
      if (val >= target) {
        setXpCount(target);
        clearInterval(timer);
      } else setXpCount(val);
    }, 30);
    return () => clearInterval(timer);
  }, [phase]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full transition-all duration-1000"
          style={{
            background:
              phase === 'burst'
                ? 'radial-gradient(circle, rgba(124,92,255,0.3) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(163,230,53,0.15) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Confetti particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            transform: `rotate(${p.angle}deg)`,
            opacity: phase === 'burst' ? 1 : 0,
            transition: `all ${1.2 + p.speed}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
            transitionDelay: `${Math.random() * 0.3}s`,
            ...(phase !== 'burst'
              ? {
                  left: `${p.x + (Math.random() - 0.5) * 80}%`,
                  top: `${p.y + 40 + Math.random() * 60}%`,
                }
              : {}),
          }}
        />
      ))}

      {/* Welcome card */}
      <div
        className={`relative z-10 card-base p-8 sm:p-12 max-w-md w-full text-center transition-all duration-700 ${phase !== 'burst' ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
        style={{ boxShadow: '0 0 60px rgba(124,92,255,0.2), 0 0 120px rgba(163,230,53,0.1)' }}
      >
        {/* Level badge */}
        <div className="flex justify-center mb-6">
          <div
            className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(124,92,255,0.2), rgba(163,230,53,0.15))',
              border: '2px solid rgba(124,92,255,0.4)',
              boxShadow: '0 0 32px rgba(124,92,255,0.3)',
            }}
          >
            <span className="font-pixel text-xp-lime text-xs mb-1">LEVEL</span>
            <span
              className="font-pixel font-bold text-4xl"
              style={{ color: '#A3E635', textShadow: '0 0 20px rgba(163,230,53,0.6)' }}
            >
              1
            </span>
          </div>
        </div>

        <h2 className="font-heading font-bold text-3xl text-foreground mb-2">
          Welcome, {user?.name?.split(' ')[0] || 'Adventurer'}!
        </h2>
        <p className="text-muted-foreground font-sans text-base mb-2">
          You&apos;re now a{' '}
          <span className="font-pixel text-violet-400 text-sm">Pixel Recruit</span>
        </p>
        <p className="text-muted-foreground font-sans text-sm mb-8">
          Your journey starts at Level 1. Complete activities, earn XP, and rise through the ranks.
        </p>

        {/* Starting stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Starting XP', value: '0', color: '#A3E635' },
            { label: 'Level', value: '1', color: '#7C5CFF' },
            { label: 'League', value: 'Bronze', color: '#CD7F32' },
          ].map((stat) => (
            <div key={stat.label} className="bg-muted/50 rounded-xl p-3">
              <div className="font-pixel font-bold text-lg" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[10px] text-muted-foreground font-sans mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onEnter}
          className={`w-full py-4 rounded-2xl font-heading font-semibold text-base text-white transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] ${phase === 'ready' ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(135deg, #7C5CFF, #A3E635)' }}
        >
          Enter GDU XP →
        </button>
      </div>
    </div>
  );
}
