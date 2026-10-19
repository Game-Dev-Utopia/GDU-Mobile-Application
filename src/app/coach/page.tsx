'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getCoachRecommendations,
  getWeeklyPlan,
  addToPlan,
  removeFromPlan,
  markNotForMe,
  type CoachRecommendation,
  type WeeklyPlan,
  type PlanItem,
} from '@/lib/api';

const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  technical: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  social: { bg: 'bg-amber-50', text: 'text-amber-700' },
  soft: { bg: 'bg-violet-50', text: 'text-violet-700' },
  management: { bg: 'bg-rose-50', text: 'text-rose-700' },
};

export default function CoachPage() {
  const { user, isLoading } = useAuth();
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planExp, setPlanExp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [notForMe, setNotForMe] = useState<Set<string>>(new Set());
  const [planDaySelector, setPlanDaySelector] = useState<{
    activityId: string;
    open: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [recs, plan] = await Promise.all([
        getCoachRecommendations(user.id),
        getWeeklyPlan(user.id),
      ]);
      setRecommendations(recs);
      if (plan) {
        setPlanItems(plan.items);
        setPlanExp(plan.totalExp);
      }
    } catch (err) {
      console.error('Failed to load coach data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const isPlanItem = (activityId: string) => planItems.some((p) => p.activityId === activityId);

  const planItemFor = (activityId: string) => planItems.find((p) => p.activityId === activityId);

  const dayItems = (day: number) => planItems.filter((p) => p.dayOfWeek === day);

  async function handleAddToPlan(rec: CoachRecommendation) {
    if (isPlanItem(rec.activityId)) return;
    setPlanDaySelector({ activityId: rec.activityId, open: true });
  }

  async function handleConfirmPlan(activityId: string, dayOfWeek: number) {
    setSubmitting((prev) => new Set([...prev, activityId]));
    try {
      await addToPlan(user!.id, activityId, dayOfWeek);
      const updated = await getWeeklyPlan(user!.id);
      if (updated) {
        setPlanItems(updated.items);
        setPlanExp(updated.totalExp);
      }
      setPlanDaySelector(null);
    } catch (err: any) {
      alert(err.message || 'Failed to add to plan.');
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  }

  async function handleRemoveFromPlan(activityId: string) {
    const item = planItemFor(activityId);
    if (!item) return;
    setSubmitting((prev) => new Set([...prev, activityId]));
    try {
      await removeFromPlan(item.id);
      const updated = await getWeeklyPlan(user!.id);
      if (updated) {
        setPlanItems(updated.items);
        setPlanExp(updated.totalExp);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to remove from plan.');
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  }

  async function handleNotForMe(activityId: string) {
    setNotForMe((prev) => new Set([...prev, activityId]));
    try {
      await markNotForMe(activityId);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to mark as not for me.');
    } finally {
      setNotForMe((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  }

  const canViewRecommendations = user
    ? can(user.roles as any, 'claim.submit_self', 'self', user.scopes as any)
    : false;

  if (loading || !user) {
    return (
      <AppLayout activePath="/coach">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const dayClass = (day: number) => {
    const items = dayItems(day);
    if (items.length > 0) return 'bg-accent-soft/30 border-accent/30';
    return 'bg-muted/30 border-border';
  };

  return (
    <AppLayout activePath="/coach">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Your Coach</h1>
            <p className="text-mute">
              Personalised activity suggestions to keep your momentum going — at your pace, never
              pressured.
            </p>
          </div>
        </div>

        {/* Weekly plan strip */}
        <div className="rounded-xl p-4 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-bold text-ink text-lg mb-1">Your Weekly Plan</h2>
              <p className="text-xs text-mute">
                {planItems.length} activity{planItems.length === 1 ? '' : 's'} planned •{' '}
                <span className="font-mono font-bold text-ink">+{planExp} EST. EXP</span> this week
              </p>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const items = dayItems(day);
              return (
                <div key={day} className={`rounded-lg p-2 border ${dayClass(day)}`}>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <span className="text-[10px] font-bold text-mute uppercase">
                      {DAY_LABELS[day]}
                    </span>
                  </div>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-xs text-accent-foreground"
                      >
                        <span className="truncate w-16" title={item.activityTitle}>
                          {item.activityTitle}
                        </span>
                        <button
                          onClick={() => handleRemoveFromPlan(item.activityId)}
                          className="text-accent-foreground/70 hover:text-accent-foreground/90"
                          title="Remove from plan"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="h-6 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">—</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="font-heading font-bold text-ink mb-2">No recommendations right now</h3>
            <p className="text-mute mb-4">
              You may have already planned activities for the week, or there aren't any uncapped
              activities that fit your current standing.
            </p>
            <div className="flex justify-center">
              <button
                onClick={load}
                className="px-4 py-2 rounded-lg bg-card border border-line text-ink hover:bg-accent-soft transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-heading font-bold text-ink mb-4">Recommended for you</h2>
            <p className="text-mute text-sm mb-4">
              These activities are picked based on your current standing, category gaps, and season
              caps. All numbers are estimates — your actual results may vary.
            </p>

            <div className="grid gap-4">
              {recommendations.map((rec) => {
                const planned = isPlanItem(rec.activityId);
                const plannedItem = planItemFor(rec.activityId);
                const runwayStr = rec.runwayChange
                  ? `${rec.runwayChange.from} → ${rec.runwayChange.to} days`
                  : '—';
                const cfg = CATEGORY_COLORS[rec.activityCategory];

                return (
                  <div
                    key={rec.id}
                    className="rounded-xl p-4 border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.text} ${cfg.bg}`}
                        >
                          {rec.activityCategory}
                        </span>
                        <span className="text-xs text-mute font-mono">
                          Difficulty {rec.activityDifficulty}/5
                        </span>
                        {rec.capped && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                            Capped this season
                          </span>
                        )}
                      </div>
                      {planned && (
                        <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold">
                          Planned {DAY_LABELS[plannedItem!.dayOfWeek]}
                        </span>
                      )}
                    </div>

                    <h3 className="font-heading font-bold text-ink text-lg mb-1">
                      {rec.activityTitle}
                    </h3>
                    <p className="text-sm text-mute mb-3">{rec.fitReason}</p>

                    {/* Impact Preview */}
                    <div className="rounded-lg p-3 bg-muted/30 border border-border mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          className="w-4 h-4 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-xs font-medium text-mute uppercase tracking-wider">
                          Impact Preview (Estimate)
                        </span>
                      </div>
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">EXP Range</span>
                          <div className="font-mono font-bold text-ink">
                            +{rec.expRange.min}–{rec.expRange.max}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Runway</span>
                          <div className="font-mono font-bold text-ink">{runwayStr}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">League Places</span>
                          <div
                            className={`font-mono font-bold ${rec.leaguePlacesGained! > 0 ? 'text-accent' : 'text-muted-foreground'}`}
                          >
                            {rec.leaguePlacesGained ?? 0}
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        These are estimates based on your current standing and activity history.
                        Actual XP and runway may vary.
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!planned && (
                        <button
                          onClick={() => handleAddToPlan(rec)}
                          disabled={rec.capped || submitting.has(rec.activityId)}
                          className="flex-1 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                        >
                          {submitting.has(rec.activityId) ? (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4 animate-spin"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15 35a2 2 0 01-2 2H2a2 2 0 01-2-2V4a2 2 0 012-2h16a2 2 0 012 2z"
                                />
                              </svg>
                              Adding…
                            </span>
                          ) : (
                            'Add to Plan'
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleNotForMe(rec.activityId)}
                        disabled={notForMe.has(rec.activityId)}
                        className="px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm font-medium hover:bg-accent-soft disabled:opacity-50 transition-colors"
                      >
                        {notForMe.has(rec.activityId) ? 'Marked' : 'Not for Me'}
                      </button>
                    </div>

                    {planDaySelector?.activityId === rec.activityId && planDaySelector.open && (
                      <div className="mt-3 rounded-lg p-3 bg-card border border-line">
                        <p className="text-xs font-medium text-mute mb-2">Which day?</p>
                        <div className="grid grid-cols-7 gap-1">
                          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                            const items = dayItems(day);
                            const isFull = items.length > 0;
                            const btnClass = isFull
                              ? 'bg-muted/30 text-muted-foreground border border-border'
                              : 'bg-card text-ink border border-accent hover:bg-accent-soft/50';
                            return (
                              <button
                                key={day}
                                onClick={() => handleConfirmPlan(rec.activityId, day)}
                                className={`px-2 py-1.5 rounded text-xs font-medium ${btnClass}`}
                              >
                                {DAY_LABELS[day]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
