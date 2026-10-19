'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import XPBar from '@/components/ui/XPBar';
import {
  getLeagueProgress,
  getLeagueTiers,
  type LeagueTierInfo,
  type LeagueProgress,
} from '@/lib/api';

export default function LeaguesPage() {
  const { user, isLoading } = useAuth();
  const [tiers, setTiers] = useState<LeagueTierInfo[]>([]);
  const [progress, setProgress] = useState<LeagueProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isLoading && user) {
        const [t, p] = await Promise.all([getLeagueTiers(), getLeagueProgress(user.totalExp)]);
        if (!cancelled) {
          setTiers(t);
          setProgress(p);
          setLoading(false);
        }
      } else if (!isLoading && !user) {
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isLoading, user]);

  if (loading || !user || !progress) {
    return (
      <AppLayout activePath="/leagues">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const { currentTier, nextTier } = progress;

  return (
    <AppLayout activePath="/leagues">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Leagues</h1>
            <p className="text-mute">Compete in seasonal leagues based on your EXP</p>
          </div>
        </div>

        {/* Your League card */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-bold text-ink">Your League</h2>
              <p className="text-mute mb-1">
                You're in <span className="font-bold text-accent">{currentTier.displayName}</span>{' '}
                league
              </p>
              <p className="text-xs text-mute font-mono">
                {user.totalExp.toLocaleString()} total EXP
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs ${
                currentTier.isLocked ? 'bg-muted text-mute' : 'bg-accent text-white'
              }`}
            >
              {currentTier.displayName[0].toUpperCase()}
            </div>
          </div>

          <XPBar current={progress.progressPercent} max={100} showLabel animate />

          {nextTier ? (
            <p className="text-sm text-mute mt-3">
              {progress.expToNext.toLocaleString()} EXP to {nextTier.displayName}
            </p>
          ) : (
            <p className="text-sm text-mute mt-3">You've reached the highest tier!</p>
          )}
        </div>

        {/* All tiers grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => {
            const isCurrent = currentTier.name === tier.name;
            const isUnlocked = user.totalExp >= tier.minExp;
            return (
              <div
                key={tier.name}
                className={`rounded-xl p-5 border transition-all duration-300 ${
                  isCurrent
                    ? 'bg-accent-soft border-accent shadow-lg scale-105'
                    : isUnlocked
                      ? 'bg-card border-line hover:border-accent/50'
                      : 'bg-muted/50 border-line/50 text-mute/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                        isUnlocked ? 'bg-accent text-white' : 'bg-muted text-mute'
                      }`}
                    >
                      {tier.displayName[0].toUpperCase()}
                    </div>
                    <span
                      className={`font-heading font-bold ${isUnlocked ? 'text-ink' : 'text-mute'}`}
                    >
                      {tier.displayName}
                    </span>
                  </div>
                  {!isUnlocked && <span className="text-xs text-mute">Locked</span>}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-mute mb-1">
                    <span>EXP Range</span>
                    <span className="font-mono">
                      {tier.minExp.toLocaleString()} – {tier.maxExp ?? '∞'}
                    </span>
                  </div>
                  <div className="w-full bg-accent-soft/50 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isUnlocked ? 'bg-accent' : 'bg-muted'
                      } w-${isCurrent ? progress.progressPercent : isUnlocked ? 100 : 0}`}
                    />
                  </div>
                  <div className="text-xs text-mute">
                    {isCurrent
                      ? `${progress.progressPercent.toFixed(0)}% to next tier`
                      : isUnlocked
                        ? 'Completed'
                        : `${Math.max(0, tier.minExp - user.totalExp).toLocaleString()} EXP to unlock`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
