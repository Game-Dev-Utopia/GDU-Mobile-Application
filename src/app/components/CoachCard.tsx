'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getCoachRecommendations, type CoachRecommendation } from '@/lib/api';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  technical: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  social: { bg: 'bg-amber-50', text: 'text-amber-700' },
  soft: { bg: 'bg-violet-50', text: 'text-violet-700' },
  management: { bg: 'bg-rose-50', text: 'text-rose-700' },
};

export default function CoachCard() {
  const { user, isLoading } = useAuth();
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      getCoachRecommendations(user.id)
        .then((recs) => {
          setRecommendations(recs.slice(0, 2));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user, isLoading]);

  if (loading || !user || recommendations.length === 0) return null;

  const rec = recommendations[0];
  const cfg = CATEGORY_COLORS[rec.activityCategory];

  return (
    <div className="rounded-xl p-4 bg-card border border-line">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-bold text-ink text-lg">Your Coach</h3>
        <Link
          href="/coach"
          className="text-xs text-mute hover:text-foreground underline underline-offset-4"
        >
          View all
        </Link>
      </div>
      <p className="text-sm text-mute mb-3">
        Based on your standing and category gaps, here's a suggestion to keep your momentum going:
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
          <span className={`text-xs font-bold ${cfg.text}`}>
            {rec.activityCategory.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[10px] px-1 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
              {rec.activityCategory}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Difficulty {rec.activityDifficulty}/5
            </span>
          </div>
          <h4 className="font-heading font-semibold text-ink text-sm leading-tight line-clamp-2">
            {rec.activityTitle}
          </h4>
          <p className="text-[11px] text-muted-foreground line-clamp-1">{rec.fitReason}</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg p-2 bg-muted/30 border border-border">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Est. EXP</span>
          <span className="font-mono font-bold text-ink">
            +{rec.expRange.min}–{rec.expRange.max}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] mt-1">
          <span className="text-muted-foreground">Runway change</span>
          <span className="font-mono font-bold text-ink">
            {rec.runwayChange ? `${rec.runwayChange.from} → ${rec.runwayChange.to} days` : '—'}
          </span>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {}}
          className="flex-1 px-3 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          disabled={rec.capped}
        >
          Add to Plan
        </button>
        <button
          onClick={() => {}}
          className="px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-medium hover:bg-accent-soft transition-colors"
        >
          Not for Me
        </button>
      </div>
    </div>
  );
}
