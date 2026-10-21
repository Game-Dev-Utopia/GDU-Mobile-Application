'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getFeedback360Cycles,
  getFeedback360Summary,
  submitFeedback360Response,
  closeFeedback360Cycle,
  getPositionHolders,
  type Feedback360Cycle,
  type Feedback360Summary,
} from '@/lib/api';

const RATING_LABELS: Record<string, string> = {
  communication: 'Communication',
  reliability: 'Reliability',
  fairness: 'Fairness',
  leadership: 'Leadership',
};

type RatingKey = 'communication' | 'reliability' | 'fairness' | 'leadership';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Feedback360Page() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Feedback360Cycle[]>([]);
  const [summaries, setSummaries] = useState<Feedback360Summary[]>([]);
  const [positionHolders, setPositionHolders] = useState<
    { id: string; displayName: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [cycleSubmitting, setCycleSubmitting] = useState<Set<string>>(new Set());
  const [ratingForm, setRatingForm] = useState<
    Record<
      string,
      {
        communication: number;
        reliability: number;
        fairness: number;
        leadership: number;
        comment: string;
      }
    >
  >({});
  const [newCycleLabel, setNewCycleLabel] = useState('');
  const [newCycleStart, setNewCycleStart] = useState('');
  const [newCycleEnd, setNewCycleEnd] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const c = await getFeedback360Cycles();
      const openCycle = c.find((cy) => cy.status === 'open');
      const firstCycleId = openCycle ? openCycle.id : (c[0]?.id ?? '');
      const [s, p] = await Promise.all([
        firstCycleId
          ? getFeedback360Summary(firstCycleId)
          : Promise.resolve([] as Feedback360Summary[]),
        getPositionHolders(),
      ]);
      setCycles(c);
      setPositionHolders(p);
      if (firstCycleId) {
        setSelectedCycleId(firstCycleId);
        setSummaries(s);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedCycleId) {
      getFeedback360Summary(selectedCycleId).then((s) => setSummaries(s));
    }
  }, [selectedCycleId]);

  const isBoardOrAdmin = user ? user.role === 'board_member' || user.role === 'admin' : false;
  const isPositionHolder = user
    ? user.role === 'board_member' ||
      user.role === 'council_member' ||
      user.role === 'domain_head' ||
      user.role === 'faculty' ||
      user.role === 'admin'
    : false;

  const activeCycle = useMemo(() => cycles.find((c) => c.status === 'open'), [cycles]);
  const cycleSummaries = useMemo(
    () => summaries.filter((s) => s.cycleId === selectedCycleId),
    [summaries, selectedCycleId]
  );

  const canSubmitRating = isPositionHolder && !!activeCycle && activeCycle.status === 'open';

  if (loading || !user) {
    return (
      <AppLayout activePath="/feedback-360">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/feedback-360">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">360 Feedback</h1>
            <p className="text-mute">
              Quarterly anonymous feedback for position holders. Ratings for communication,
              reliability, fairness, and leadership — plus optional comment.
            </p>
          </div>
          {isBoardOrAdmin && (
            <button
              onClick={() => {}}
              className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Create Cycle
            </button>
          )}
        </div>

        {/* Important note */}
        <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-amber-600 mt-0.5">ℹ️</span>
            <div>
              <h3 className="font-bold text-amber-800 text-sm">How 360 Feedback Is Used</h3>
              <p className="text-amber-700 text-xs">
                Feedback informs position-holder reviews but{' '}
                <span className="font-bold">can never trigger a penalty alone.</span>
                Results are aggregated and only visible when at least 3 respondents have submitted.
              </p>
            </div>
          </div>
        </div>

        {/* Cycles */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-ink text-lg">Feedback Cycles</h2>
            <span
              className={`text-xs font-bold ${activeCycle ? 'text-green-700 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted/50 border border-border'} px-2 py-0.5 rounded`}
            >
              {activeCycle ? `Open: ${activeCycle.quarterLabel}` : 'No open cycle'}
            </span>
          </div>
          <div className="space-y-3">
            {cycles.length === 0 && (
              <p className="text-mute text-center py-8">No feedback cycles yet.</p>
            )}
            {cycles.map((cycle) => {
              const isOpen = cycle.status === 'open';
              return (
                <div
                  key={cycle.id}
                  className="p-3 rounded-lg border border-line hover:bg-accent-soft/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{cycle.quarterLabel}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isOpen ? 'text-green-700 bg-green-50 border-green-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}
                      >
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <span className="text-[10px] text-mute font-mono">
                      {formatDate(cycle.quarterStart)} – {formatDate(cycle.quarterEnd)}
                    </span>
                  </div>
                  {isBoardOrAdmin && (
                    <button
                      onClick={() => {
                        setCycleSubmitting((prev) => new Set([...prev, cycle.id]));
                        closeFeedback360Cycle(cycle.id)
                          .then(() => {
                            setCycleSubmitting((prev) => {
                              const next = new Set(prev);
                              next.delete(cycle.id);
                              return next;
                            });
                            setCycles(
                              cycles.map((c) =>
                                c.id === cycle.id ? { ...c, status: 'closed' } : c
                              )
                            );
                          })
                          .catch((err: any) => alert(err.message || 'Failed to close cycle.'));
                      }}
                      disabled={cycleSubmitting.has(cycle.id) || !isOpen}
                      className="px-3 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-medium disabled:opacity-50 hover:bg-rose-100 transition-colors"
                    >
                      Close Cycle
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {isBoardOrAdmin && cycles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <h3 className="text-xs font-medium text-mute uppercase mb-2">Create New Cycle</h3>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <input
                  type="text"
                  value={newCycleLabel}
                  onChange={(e) => setNewCycleLabel(e.target.value)}
                  placeholder="e.g. Q1 2027"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="date"
                  value={newCycleStart}
                  onChange={(e) => setNewCycleStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="date"
                  value={newCycleEnd}
                  onChange={(e) => setNewCycleEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                />
                <button
                  onClick={async () => {
                    if (!newCycleLabel || !newCycleStart || !newCycleEnd) return;
                    // Cycle creation would be wired via RPC; placeholder for now
                    alert('Cycle creation would be wired via database function.');
                  }}
                  className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rating Form (position holders, open cycle) */}
        {canSubmitRating && activeCycle && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">Rate a Position Holder</h2>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                Anonymous
              </span>
            </div>
            <p className="text-mute text-sm mb-4">
              Select a position holder to rate. Your identity is not stored with the response.
            </p>
            <div className="space-y-4">
              {positionHolders.map((ph) => {
                if (ph.id === user.id) return null;
                const form = ratingForm[ph.id] || {
                  communication: 3,
                  reliability: 3,
                  fairness: 3,
                  leadership: 3,
                  comment: '',
                };
                return (
                  <div key={ph.id} className="p-4 rounded-lg border border-line bg-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-ink">{ph.displayName}</h4>
                        <p className="text-[10px] text-mute capitalize">{ph.role}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(RATING_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-xs text-mute">{label}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((val) => {
                              const isSelected = form[key as RatingKey] === val;
                              return (
                                <button
                                  key={val}
                                  onClick={() => {
                                    setRatingForm((prev) => {
                                      const current = prev[ph.id] ?? {
                                        communication: 3,
                                        reliability: 3,
                                        fairness: 3,
                                        leadership: 3,
                                        comment: '',
                                      };
                                      return {
                                        ...prev,
                                        [ph.id]: { ...current, [key as RatingKey]: val },
                                      };
                                    });
                                  }}
                                  className={`w-6 h-6 rounded border transition-colors ${isSelected ? 'bg-accent text-white border-accent' : 'bg-card border-line hover:border-accent/50'}`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div>
                        <label className="text-[10px] font-medium text-mute uppercase block mb-1">
                          Optional Comment
                        </label>
                        <textarea
                          rows={2}
                          value={form.comment}
                          onChange={(e) =>
                            setRatingForm((prev) => ({
                              ...prev,
                              [ph.id]: { ...prev[ph.id], comment: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                          placeholder="Optional comment…"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          setSubmitting((prev) => new Set([...prev, ph.id]));
                          try {
                            await submitFeedback360Response({
                              cycleId: activeCycle.id,
                              targetId: ph.id,
                              communication: form.communication,
                              reliability: form.reliability,
                              fairness: form.fairness,
                              leadership: form.leadership,
                              comment: form.comment,
                            });
                            setRatingForm((prev) => {
                              const next = { ...prev };
                              delete next[ph.id];
                              return next;
                            });
                          } catch (err: any) {
                            alert(err.message || 'Failed to submit rating.');
                          } finally {
                            setSubmitting((prev) => {
                              const next = new Set(prev);
                              next.delete(ph.id);
                              return next;
                            });
                          }
                        }}
                        disabled={submitting.has(ph.id)}
                        className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
                      >
                        {submitting.has(ph.id) ? 'Submitting…' : 'Submit Rating'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {positionHolders.filter((ph) => ph.id !== user.id).length === 0 && (
                <p className="text-mute text-center py-8">No other position holders to rate.</p>
              )}
            </div>
          </div>
        )}

        {/* Results (all users, only when >= 3 respondents) */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-ink text-lg">Results</h2>
            <span
              className={`text-xs font-bold ${cycleSummaries.length > 0 ? 'text-green-700 bg-green-50 border-green-200' : 'text-amber-700 bg-amber-50 border-amber-200'} px-2 py-0.5 rounded`}
            >
              {cycleSummaries.length} position holders with results
            </span>
          </div>
          <p className="text-[10px] text-mute mb-4">
            Results are shown as averages and only when at least 3 respondents have submitted
            feedback for a position holder.
          </p>
          <div className="space-y-3">
            {cycleSummaries.length === 0 && (
              <p className="text-mute text-center py-8">
                No results yet. Feedback requires at least 3 respondents per position holder.
              </p>
            )}
            {cycleSummaries.map((s) => {
              const stars = Math.round(s.avgOverall);
              return (
                <div
                  key={s.targetId}
                  className="p-3 rounded-lg border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-ink">{s.targetName}</h4>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200`}
                      >
                        {s.respondentCount} respondent{s.respondentCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-ink font-bold">
                        {s.avgOverall.toFixed(1)} / 5
                      </div>
                      <div className="text-[10px] text-mute">Overall</div>
                    </div>
                  </div>
                  <div className="grid gap-2 grid-cols-4 text-xs mb-2">
                    <div>
                      <div className="text-[10px] text-mute uppercase">Communication</div>
                      <div className="font-mono text-ink">{s.avgCommunication.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-mute uppercase">Reliability</div>
                      <div className="font-mono text-ink">{s.avgReliability.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-mute uppercase">Fairness</div>
                      <div className="font-mono text-ink">{s.avgFairness.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-mute uppercase">Leadership</div>
                      <div className="font-mono text-ink">{s.avgLeadership.toFixed(1)}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <span
                        key={val}
                        className={`w-3 h-3 rounded-full ${
                          val <= stars ? 'bg-amber-500' : 'bg-muted/30'
                        }`}
                      />
                    ))}
                  </div>
                  {s.comments.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-medium text-mute uppercase mb-1">Comments</p>
                      <div className="space-y-1">
                        {s.comments.map((comment, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-muted/50 text-sm text-ink">
                            {comment}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
