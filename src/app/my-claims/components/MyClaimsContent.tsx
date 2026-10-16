'use client';
import React, { useEffect, useState, useMemo } from 'react';
import type { Claim, ClaimStatus } from '@/lib/api';
import { getMyClaims } from '@/lib/api';
import { ClaimsPageSkeleton } from '@/components/ui/LoadingSkeleton';
import ClaimsSummaryBar from './ClaimsSummaryBar';
import ClaimsStatusTabs from './ClaimsStatusTabs';
import ClaimRow from './ClaimRow';
import { FileCheck } from 'lucide-react';

export default function MyClaimsContent() {
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeStatus, setActiveStatus] = useState<ClaimStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // TODO: GET /api/members/me/claims — see lib/api.ts
      const data = await getMyClaims();
      if (!cancelled) {
        setClaims(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (activeStatus === 'all') return claims;
    return claims.filter((c) => c.status === activeStatus);
  }, [claims, activeStatus]);

  const counts = useMemo(() => ({
    all: claims.length,
    submitted: claims.filter((c) => c.status === 'submitted').length,
    under_review: claims.filter((c) => c.status === 'under_review').length,
    approved: claims.filter((c) => c.status === 'approved').length,
    rejected: claims.filter((c) => c.status === 'rejected').length,
  }), [claims]);

  const totalXPEarned = claims
    .filter((c) => c.status === 'approved')
    .reduce((s, c) => s + (c.xpCredited ?? 0), 0);

  const approvalRate = claims.length > 0
    ? Math.round((counts.approved / claims.length) * 100)
    : 0;

  if (loading) return <ClaimsPageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-foreground">My Claims</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track your submissions and reviewer feedback
        </p>
      </div>

      {/* Summary Bar */}
      <ClaimsSummaryBar
        totalXPEarned={totalXPEarned}
        pendingCount={counts.submitted + counts.under_review}
        approvalRate={approvalRate}
        totalClaims={claims.length}
      />

      {/* Status Tabs */}
      <ClaimsStatusTabs
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        counts={counts}
      />

      {/* Claims list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileCheck size={40} className="text-muted-foreground mb-3" />
          <h3 className="text-base font-heading font-semibold text-muted-foreground">
            No {activeStatus === 'all' ? '' : activeStatus.replace('_', ' ')} claims yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {activeStatus === 'all' ?'Complete activities and submit claims to earn XP.'
              : `You have no claims with "${activeStatus.replace('_', ' ')}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              expanded={expandedId === claim.id}
              onToggle={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}