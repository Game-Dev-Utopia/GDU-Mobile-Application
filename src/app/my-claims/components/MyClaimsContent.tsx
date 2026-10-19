'use client';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import type { Claim, ClaimStatus } from '@/lib/api';
import { getMyClaims, getPenalties, type PenaltyRecord } from '@/lib/api';
import { ClaimsPageSkeleton } from '@/components/ui/LoadingSkeleton';
import ClaimsSummaryBar from './ClaimsSummaryBar';
import ClaimsStatusTabs from './ClaimsStatusTabs';
import ClaimRow from './ClaimRow';
import { FileCheck, Clock, AlertTriangle } from 'lucide-react';

const PENALTY_STATUS_LABELS: Record<string, string> = {
  filed: 'Filed',
  responded: 'Responded',
  reviewed: 'Reviewed',
  decided: 'Decided',
  appealed: 'Appealed',
  rejected: 'Rejected',
  upheld: 'Upheld',
};

const SEVERITY_BADGE: Record<string, string> = {
  minor: 'badge-amber',
  moderate: 'badge-orange',
  severe: 'badge-rose',
};

export default function MyClaimsContent() {
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'claims' | 'penalties'>('claims');
  const [activeStatus, setActiveStatus] = useState<ClaimStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [claimsData, penaltiesData] = await Promise.all([
      getMyClaims(),
      getPenalties({ limit: 50 }),
    ]);
    setClaims(claimsData);
    setPenalties(penaltiesData);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filteredClaims = useMemo(() => {
    if (activeStatus === 'all') return claims;
    return claims.filter((c) => c.status === activeStatus);
  }, [claims, activeStatus]);

  const memberPenalties = useMemo(() => {
    return [...penalties].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [penalties]);

  const counts = useMemo(
    () => ({
      all: claims.length,
      submitted: claims.filter((c) => c.status === 'submitted').length,
      under_review: claims.filter((c) => c.status === 'under_review').length,
      approved: claims.filter((c) => c.status === 'approved').length,
      rejected: claims.filter((c) => c.status === 'rejected').length,
    }),
    [claims]
  );

  const totalXPEarned = claims
    .filter((c) => c.status === 'approved')
    .reduce((s, c) => s + (c.xpCredited ?? 0), 0);

  const approvalRate = claims.length > 0 ? Math.round((counts.approved / claims.length) * 100) : 0;

  if (loading) return <ClaimsPageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">My Claims</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your submissions, reviewer feedback, and penalties
          </p>
        </div>
      </div>

      {/* Summary Bar */}
      <ClaimsSummaryBar
        totalXPEarned={totalXPEarned}
        pendingCount={counts.submitted + counts.under_review}
        approvalRate={approvalRate}
        totalClaims={claims.length}
      />

      {/* Tabs: Claims | Penalties */}
      <div className="flex gap-1 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('claims')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'claims'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Claims
        </button>
        <button
          onClick={() => setActiveTab('penalties')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'penalties'
              ? 'border-rose-500 text-rose-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle size={16} className="mr-1.5 text-rose-600" />
          Penalties
        </button>
      </div>

      {activeTab === 'claims' ? (
        <>
          {/* Status Tabs */}
          <ClaimsStatusTabs
            activeStatus={activeStatus}
            onStatusChange={setActiveStatus}
            counts={counts}
          />

          {/* Claims list */}
          {filteredClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileCheck size={40} className="text-muted-foreground mb-3" />
              <h3 className="text-base font-heading font-semibold text-muted-foreground">
                No {activeStatus === 'all' ? '' : activeStatus.replace('_', ' ')} claims yet
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {activeStatus === 'all'
                  ? 'Complete activities and submit claims to earn XP.'
                  : `You have no claims with "${activeStatus.replace('_', ' ')}" status.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClaims.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  expanded={expandedId === claim.id}
                  onToggle={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
                  onConfirmChange={() => load()}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h3 className="text-lg font-heading font-bold text-ink">Your Penalties</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Penalties filed against you, their status, and appeal options.
          </p>

          {memberPenalties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle size={40} className="text-green-500 mb-3" />
              <h3 className="text-base font-heading font-semibold text-muted-foreground">
                No penalties
              </h3>
              <p className="text-sm text-muted-foreground mt-1">You have no penalties on record.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {memberPenalties.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl p-4 border border-line bg-card hover:bg-accent-soft/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${SEVERITY_BADGE[p.severity]}`}
                        >
                          {p.severity.charAt(0).toUpperCase() + p.severity.slice(1)}
                        </span>
                        <AlertTriangle
                          size={14}
                          className={
                            p.severity === 'severe' ? 'text-rose-600' : 'text-muted-foreground'
                          }
                        />
                      </div>
                      <h4 className="font-heading font-bold text-ink">{p.activityName}</h4>
                      <p className="text-sm text-mute">{p.description}</p>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-2 text-sm">
                      <span className="font-mono text-mute">-{p.expDeduction} EXP</span>
                      <span className="font-mono text-mute">{PENALTY_STATUS_LABELS[p.status]}</span>
                      <span className="font-mono text-mute">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {p.status === 'filed' || p.status === 'responded' ? (
                      <button
                        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                        onClick={() => {
                          // Navigate to respond page or open modal
                          alert('Respond to penalty feature coming soon.');
                        }}
                      >
                        Respond
                      </button>
                    ) : p.status === 'decided' || p.status === 'upheld' ? (
                      <button
                        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                        onClick={() => {
                          alert('Appeal penalty feature coming soon.');
                        }}
                      >
                        Appeal
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
