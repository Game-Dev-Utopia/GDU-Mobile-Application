'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getMediationCases,
  classifyJurisdiction,
  mediateDeadlock,
  type MediationCase,
} from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  classified: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  mediated: 'bg-green-50 text-green-700 border-green-200',
  resolved: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function FacultyMediationPage() {
  const { user, isLoading } = useAuth();
  const [cases, setCases] = useState<MediationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState<Set<string>>(new Set());
  const [mediating, setMediating] = useState<Set<string>>(new Set());

  const canMediate = user
    ? can(user.roles as any, 'claim.review', 'org', user.scopes as any)
    : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getMediationCases();
      setCases(c);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCases = cases.filter((c) => c.status === 'pending');
  const classifiedCases = cases.filter((c) => c.status === 'classified');
  const mediatedCases = cases.filter((c) => c.status === 'mediated');

  function getTimeRemaining(deadline: string | null): string {
    if (!deadline) return 'No deadline';
    const now = new Date();
    const end = new Date(deadline);
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMinutes = Math.floor((diffMs % 3600000) / 60000);
    return `${diffHours}h ${diffMinutes}m remaining`;
  }

  async function handleClassify(caseId: string, classification: string) {
    setClassifying((prev) => new Set([...prev, caseId]));
    try {
      await classifyJurisdiction(caseId, classification);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to classify jurisdiction.');
    } finally {
      setClassifying((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    }
  }

  async function handleMediate(caseId: string, resolution: string) {
    setMediating((prev) => new Set([...prev, caseId]));
    try {
      await mediateDeadlock(caseId, resolution);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to mediate deadlock.');
    } finally {
      setMediating((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    }
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/faculty/mediation">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canMediate) {
    return (
      <AppLayout activePath="/faculty/mediation">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <span className="text-rose-600 mt-0.5">⚖️</span>
            <h2 className="font-heading font-bold text-ink mb-2">Not Authorized</h2>
            <p className="text-mute">
              Faculty mediation is available to Faculty, Board, and Admin roles only.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/faculty/mediation">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Faculty Mediator</h1>
            <p className="text-mute">
              Classify disputed jurisdictions and mediate deadlocks. Classification must be
              completed within 72 hours.
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Pending Classification
            </div>
            <div className="text-2xl font-heading font-bold text-ink">{pendingCases.length}</div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Classified
            </div>
            <div className="text-2xl font-heading font-bold text-ink">{classifiedCases.length}</div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Mediated
            </div>
            <div className="text-2xl font-heading font-bold text-ink">{mediatedCases.length}</div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Total Cases
            </div>
            <div className="text-2xl font-heading font-bold text-ink">{cases.length}</div>
          </div>
        </div>

        {/* Pending Classification Section */}
        {pendingCases.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">Pending Classification</h2>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                72-hour deadline
              </span>
            </div>
            <div className="space-y-3">
              {pendingCases.map((c) => {
                const timeRemaining = getTimeRemaining(c.deadline);
                const isExpired = timeRemaining === 'Expired';
                return (
                  <div
                    key={c.id}
                    className="rounded-lg p-4 border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-mute">
                          Case #{c.id.slice(0, 8)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isExpired ? 'text-rose-700 bg-rose-50 border border-rose-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}
                        >
                          {isExpired ? 'EXPIRED' : 'URGENT'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-mute">{timeRemaining}</span>
                    </div>
                    <p className="text-sm text-mute mb-3">
                      Disputed jurisdiction:{' '}
                      <span className="font-mono text-ink capitalize">
                        {c.disputedJurisdiction}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      {['org', 'branch', 'concurrent'].map((jurisdiction) => (
                        <button
                          key={jurisdiction}
                          onClick={() => handleClassify(c.id, jurisdiction)}
                          disabled={classifying.has(c.id) || isExpired}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                            classifying.has(c.id)
                              ? 'bg-muted text-muted-foreground opacity-50'
                              : 'bg-card border border-line text-ink hover:bg-accent-soft hover:text-accent'
                          }`}
                        >
                          {classifying.has(c.id)
                            ? 'Classifying…'
                            : jurisdiction.charAt(0).toUpperCase() + jurisdiction.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Classified Cases (awaiting mediation) */}
        {classifiedCases.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">
                Classified — Awaiting Mediation
              </h2>
            </div>
            <div className="space-y-3">
              {classifiedCases.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg p-4 border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-mute">
                        Case #{c.id.slice(0, 8)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200">
                        Classified
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-mute">
                      Classification: {c.classification}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value=""
                      onChange={(e) => {}}
                      placeholder="Enter mediation resolution…"
                      rows={2}
                      className="flex-1 px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                    <button
                      onClick={() => {
                        // Wire up mediation with resolution text
                        alert('Mediation resolution would be submitted here.');
                      }}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                      disabled={mediating.has(c.id)}
                    >
                      {mediating.has(c.id) ? 'Mediating…' : 'Mediate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved Cases */}
        {mediatedCases.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">Resolved Cases</h2>
            </div>
            <div className="space-y-3">
              {mediatedCases.map((c) => (
                <div key={c.id} className="rounded-lg p-3 border border-line bg-card opacity-80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase text-mute">
                      Case #{c.id.slice(0, 8)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-green-700 bg-green-50 border border-green-200">
                      Mediated
                    </span>
                  </div>
                  <p className="text-sm text-mute mb-1">{c.resolution || 'No resolution text'}</p>
                  <div className="flex justify-between text-[10px] text-mute">
                    <span>{c.classification}</span>
                    <span>{new Date(c.resolvedAt || c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cases.length === 0 && (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <p className="text-mute">No mediation cases found.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
