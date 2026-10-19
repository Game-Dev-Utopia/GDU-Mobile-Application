'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import { getTeamHealth, type TeamHealthSnapshot, type TeamMemberHealth } from '@/lib/api';
import { AlertTriangle, Clock, Users } from 'lucide-react';

const ZONE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Safe: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Watch: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TeamHealthPage() {
  const { user, isLoading } = useAuth();
  const [teamHealth, setTeamHealth] = useState<TeamHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const health = await getTeamHealth();
      setTeamHealth(health);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const canViewTeamHealth = user
    ? can(user.roles as any, 'branch_health.view', 'org', user.scopes as any)
    : false;

  if (loading || !user) {
    return (
      <AppLayout activePath="/team-health">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canViewTeamHealth) {
    return (
      <AppLayout activePath="/team-health">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <AlertTriangle size={48} className="mx-auto mb-4 text-rosecustom" />
            <h2 className="font-heading font-bold text-ink mb-2">Not Authorized</h2>
            <p className="text-mute">
              Team Health is available to Team Leads, Domain Heads, Council Members, Board, Faculty,
              and Auditors.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!teamHealth) {
    return (
      <AppLayout activePath="/team-health">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <p className="text-mute">Team health data not available.</p>
        </div>
      </AppLayout>
    );
  }

  const membersNeedsSupport = teamHealth.members.filter((m) => m.needsSupport);
  const membersInWatch = teamHealth.members.filter((m) => m.zone === 'Watch');
  const membersInCritical = teamHealth.members.filter((m) => m.zone === 'Critical');

  return (
    <AppLayout activePath="/team-health">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Team Health</h1>
            <p className="text-mute">
              Aggregate gaps and members who may need support. No public labels — visible only to
              authorised seniors.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Team Size
            </div>
            <div className="text-2xl font-heading font-bold text-ink">{teamHealth.memberCount}</div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Avg Standing
            </div>
            <div className="text-2xl font-heading font-bold text-ink">
              {Math.round(teamHealth.avgStanding)}
            </div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              In Watch
            </div>
            <div className={`text-2xl font-heading font-bold ${ZONE_COLORS.Watch.text}`}>
              {teamHealth.membersInWatch}
            </div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Critical
            </div>
            <div className={`text-2xl font-heading font-bold ${ZONE_COLORS.Critical.text}`}>
              {teamHealth.membersInCritical}
            </div>
          </div>
        </div>

        {/* Members Needing Support */}
        {membersNeedsSupport.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-bold text-ink text-lg mb-1">
                  Members Who May Need Support
                </h2>
                <p className="text-sm text-mute">
                  Category gaps below position minimum. Reach out with "Offer help" — no public
                  labels.
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full ${ZONE_COLORS.Critical.bg} ${ZONE_COLORS.Critical.text} text-xs font-bold`}
              >
                {membersNeedsSupport.length} members
              </span>
            </div>
            <div className="space-y-3">
              {membersNeedsSupport.map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-start justify-between p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                      <Users size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-heading font-semibold text-ink text-sm line-clamp-1">
                          {m.name}
                        </h4>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${ZONE_COLORS[m.zone].bg} ${ZONE_COLORS[m.zone].text}`}
                        >
                          {m.zone}
                        </span>
                      </div>
                      <p className="text-xs text-mute">
                        {m.role} · {m.username}
                      </p>
                      <p className="text-xs text-mute mt-1">
                        Standing: {m.standing.toFixed(1)}
                        {m.positionMin ? ` / ${m.positionMin}` : ''}
                      </p>
                      {Object.entries(m.categoryGaps).length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] font-medium text-mute uppercase mb-1">
                            Category Gaps
                          </p>
                          <div className="flex gap-1">
                            {Object.entries(m.categoryGaps).map(([cat, gap]) => (
                              <span
                                key={cat}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200"
                              >
                                {cat}: −{gap.toFixed(0)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
                      onClick={() => {
                        // Offer help action - could open a modal or navigate
                        alert(`Offer help to ${m.name} — this would open a private outreach flow.`);
                      }}
                    >
                      Offer Help
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Team Members */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <h2 className="font-heading font-bold text-ink mb-4">Team Roster</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-4 py-3 font-semibold text-mute">Member</th>
                  <th className="px-4 py-3 font-semibold text-mute">Role</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Zone</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Standing</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Min</th>
                  <th className="px-4 py-3 font-semibold text-mute text-right">Gaps</th>
                  <th className="px-4 py-3 font-semibold text-mute w-16">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {teamHealth.members.map((m) => {
                  const cfg = ZONE_COLORS[m.zone];
                  const gapCount = Object.keys(m.categoryGaps).length;
                  return (
                    <tr
                      key={m.memberId}
                      className={`border-b border-line/50 hover:bg-accent-soft/5 transition-colors ${
                        m.needsSupport ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-ink">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                            <Users size={12} className="text-muted-foreground" />
                          </div>
                          <div>
                            <span className="font-medium text-ink">{m.name}</span>
                            <br />
                            <span className="text-[10px] text-muted-foreground">@{m.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-mute text-xs">{m.role}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.text} ${cfg.bg}`}
                        >
                          {m.zone}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-mute text-xs">
                        {m.standing.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 font-mono text-mute text-xs">
                        {m.positionMin ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {gapCount > 0 ? (
                          <span
                            className={`font-mono font-bold text-xs ${gapCount > 2 ? 'text-rosecustom' : 'text-ambercustom'}`}
                          >
                            −{gapCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-mute font-mono text-xs">
                        {formatDate(m.lastActivity)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {teamHealth.members.length === 0 && (
            <div className="py-8 text-center text-mute">No team members found.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
