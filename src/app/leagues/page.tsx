'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import XPBar from '@/components/ui/XPBar';

const LEAGUE_TIERS = [
  { name: 'Obsidian', min: 0, max: 999, color: '#64748B' },
  { name: 'Bronze', min: 1000, max: 2499, color: '#CD7F32' },
  { name: 'Silver', min: 2500, max: 4999, color: '#C0C0C0' },
  { name: 'Gold', min: 5000, max: 7499, color: '#FFD700' },
  { name: 'Platinum', min: 7500, max: 9999, color: '#E5E4E2' },
  { name: 'Diamond', min: 10000, max: Infinity, color: '#B9F2FF' },
];

export default function LeaguesPage() {
  const { user, isLoading } = useAuth();
  const [currentTier, setCurrentTier] = useState<{ name: string; min: number; max: number; color: string } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading && user) {
      const tier = LEAGUE_TIERS.find((t) => user.totalExp >= t.min && user.totalExp <= t.max);
      setCurrentTier(tier ?? null);
      if (tier) {
        const range = tier.max - tier.min;
        const progressInRange = user.totalExp - tier.min;
        setProgress(range === Infinity ? 100 : Math.min(100, (progressInRange / range) * 100));
      }
    }
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/leagues">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const loading = isLoading || !currentTier;

  return (
    <AppLayout activePath="/leagues">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Leagues</h1>
            <p className="text-mute">Compete in seasonal leagues based on your EXP</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {LEAGUE_TIERS.map((tier) => {
            const isCurrent = currentTier?.name === tier.name;
            const isUnlocked = user.totalExp >= tier.min;
            return (
              <div
                key={tier.name}
                className={`rounded-xl p-6 border transition-all duration-300 ${
                  isCurrent
                    ? 'bg-accent-soft border-accent shadow-lg scale-105'
                    : isUnlocked
                      ? 'bg-card border-line hover:border-accent/50'
                      : 'bg-muted/50 border-line/50 text-mute/50'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                        isUnlocked ? 'bg-accent text-white' : 'bg-muted text-mute'
                      }`}
                    >
                      {tier.name[0]}
                    </div>
                    <span className={`font-heading font-bold ${isUnlocked ? 'text-ink' : 'text-mute'}`}>
                      {tier.name}
                    </span>
                  </div>
                  {!isUnlocked && (
                    <span className="text-xs text-mute">Locked</span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-mute mb-1">
                    <span>EXP Range</span>
                    <span className="font-mono">
                      {tier.min === Infinity ? '∞' : tier.min.toLocaleString()} – {tier.max === Infinity ? '∞' : tier.max.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-accent-soft/50 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isUnlocked ? 'bg-accent' : 'bg-muted'
                      } w-${isCurrent ? progress : isUnlocked ? 100 : 0}`}
                    />
                  </div>
                  <div className="text-xs text-mute">
                    {isCurrent
                      ? `${progress.toFixed(0)}% to next tier`
                      : isUnlocked
                        ? 'Completed'
                        : `${Math.max(0, tier.min - user.totalExp).toLocaleString()} EXP to unlock`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {currentTier && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <h2 className="font-heading font-bold text-ink mb-2">Your League</h2>
            <p className="text-mute mb-4">
              You're currently in <span className="font-bold text-accent">{currentTier.name}</span> league with{' '}
              <span className="font-mono font-bold text-ink">{user.totalExp.toLocaleString()} EXP</span>.
            </p>
            <XPBar current={progress} max={100} showLabel animate />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
