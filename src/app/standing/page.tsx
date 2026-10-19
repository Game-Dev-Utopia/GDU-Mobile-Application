'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getActivityTypes,
  getMemberStanding,
  getMemberCategoryStanding,
  getStandingConfig,
  getStandingZone,
  type ActivityType,
  type CategoryStanding,
  type MemberStanding,
  type StandingZone,
} from '@/lib/api';

const ZONE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Safe: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Watch: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const CATEGORY_ORDER: string[] = ['technical', 'social', 'soft', 'management'];

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  social: 'Social',
  soft: 'Soft',
  management: 'Management',
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function StandingPage() {
  const { user, isLoading } = useAuth();
  const [standing, setStanding] = useState<MemberStanding | null>(null);
  const [categoryStandings, setCategoryStandings] = useState<CategoryStanding[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [zone, setZone] = useState<{ zone: string; runwayDays: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  // What-if simulator state
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [simLoading, setSimLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (!user) return;
    const uid = user.id;
    const [s, cs, c, acts] = await Promise.all([
      getMemberStanding(uid),
      getMemberCategoryStanding(uid),
      getStandingConfig(),
      getActivityTypes(),
    ]);
    setStanding(s);
    setCategoryStandings(cs);
    setConfig(c);
    setActivityTypes(acts.filter((a) => a.kind === 'increment' && a.isActive));

    if (s && c) {
      const z = await getStandingZone(s.standing, s.positionMinTotal ?? 0, c.halfLifeDays);
      setZone(z);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const canViewZone = useMemo(() => {
    if (!user || !standing) return false;
    // The member themselves can always view their own zone
    if (user.id === standing.memberId) return true;
    // Authorised seniors can view zones of members in their scope
    const userRoles = (user.roles || []) as string[];
    const seniorRoles = [
      'domain_head',
      'council_member',
      'board_member',
      'admin',
      'faculty',
      'auditor',
      'conduct_panel_member',
    ];
    return userRoles.some((r) => seniorRoles.includes(r));
  }, [user, standing]);

  const zoneCfg = zone ? ZONE_COLORS[zone.zone] : null;
  const positionMin = standing?.positionMinTotal ?? 0;
  const standingPct =
    positionMin > 0 && standing ? Math.min(100, (standing.standing / positionMin) * 100) : 100;

  // What-if calculations
  const selectedActivities = useMemo(() => {
    return activityTypes.filter((a) => selectedActivityIds.has(a.id));
  }, [activityTypes, selectedActivityIds]);

  const projectedExpGain = useMemo(() => {
    return selectedActivities.reduce((sum, a) => sum + a.expMax, 0);
  }, [selectedActivities]);

  const projectedStanding = useMemo(() => {
    if (!standing) return 0;
    return standing.standing + projectedExpGain;
  }, [standing, projectedExpGain]);

  const projectedZone = useMemo(() => {
    if (!standing || !config) return null;
    const ps = projectedStanding;
    // Estimate new zone using same logic as getStandingZone but inline
    const positionMin = standing.positionMinTotal ?? 0;
    if (ps >= positionMin && positionMin > 0) {
      const ratio = ps / positionMin;
      if (ratio <= 1) return { zone: 'Critical', runwayDays: 0 };
      const runwayDays = (config.halfLifeDays * Math.log(ratio)) / Math.log(2);
      if (runwayDays < 10) return { zone: 'Critical', runwayDays: Math.round(runwayDays) };
      if (runwayDays < 30) return { zone: 'Watch', runwayDays: Math.round(runwayDays) };
      return { zone: 'Safe', runwayDays: Math.round(runwayDays) };
    } else if (ps < positionMin) {
      return { zone: 'Critical', runwayDays: 0 };
    }
    return { zone: 'Safe', runwayDays: null };
  }, [standing, config, projectedStanding]);

  const toggleActivity = (id: string) => {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedActivityIds(new Set());

  if (loading || !user) {
    return (
      <AppLayout activePath="/standing">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!standing || !config || !zone) {
    return (
      <AppLayout activePath="/standing">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <p className="text-mute">Standing data not available yet.</p>
        </div>
      </AppLayout>
    );
  }

  // Visibility: zones only visible to member and authorised seniors
  const showZone = canViewZone;

  return (
    <AppLayout activePath="/standing">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Standing</h1>
            <p className="text-mute">
              Your recent activity health (rolling 90-day window with half-life decay)
            </p>
          </div>
          {showZone && zoneCfg && (
            <div
              className={`px-4 py-2 rounded-full ${zoneCfg.bg} ${zoneCfg.text} ${zoneCfg.border} text-xs font-medium`}
            >
              {zone.zone} Zone
            </div>
          )}
        </div>

        {config.shadow_mode && (
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-bold text-amber-800 text-sm">Shadow Season</h3>
                <p className="text-amber-700 text-xs">
                  Thresholds are not enforced yet. This is a tuning period to calibrate from real
                  data.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Standing Ring (zone visible only to member & authorised seniors) */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="font-heading font-bold text-ink text-lg mb-1">Your Standing</h2>
              <p className="text-mute text-sm">
                vs position minimum: {positionMin.toLocaleString()}
              </p>
              <div className="relative w-48 h-48 mt-4">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx={120} cy={120} r={100} fill="none" stroke="#e5e7eb" strokeWidth={12} />
                  {showZone && zoneCfg && (
                    <circle
                      cx={120}
                      cy={120}
                      r={100}
                      fill="none"
                      stroke={zoneCfg.text.replace('text-', '')}
                      strokeWidth={12}
                      strokeDasharray={`${Math.min(standingPct, 100) * 6.283} 628.3`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {showZone ? (
                    <>
                      <div className="text-3xl font-mono font-bold text-ink">
                        {Math.round(standing.standing)}
                      </div>
                      <div className="text-xs text-mute">Standing</div>
                    </>
                  ) : (
                    <div className="text-mute text-xs">Zone visibility restricted</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {showZone && (
                <>
                  <div className="p-4 rounded-xl bg-accent-soft border border-accent/20">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-mute">Runway</span>
                      <span className={`font-mono font-bold ${zoneCfg!.text}`}>
                        {zone.runwayDays ?? '∞'} days
                      </span>
                    </div>
                    <p className="text-xs text-mute">
                      Days until Standing drops below position minimum at current pace
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-accent-soft border border-accent/20">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-mute">Lifetime EXP</span>
                      <span className="font-mono font-bold text-ink">
                        {standing.lifetimeExp.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-line rounded-full h-1.5 mt-2">
                      <div
                        className="h-1.5 rounded-full bg-accent"
                        style={{ width: Math.min(100, standingPct) + '%' }}
                      />
                    </div>
                  </div>
                </>
              )}
              {!showZone && (
                <div className="p-6 rounded-xl bg-muted/50 border border-line text-center">
                  <p className="text-mute text-sm">
                    Zone visibility is restricted to you and authorised seniors.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Per-Category Standing (category bars visible only to member & authorised seniors) */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <h2 className="font-heading font-bold text-ink mb-4">Category Standing</h2>
          <p className="text-mute text-sm mb-4">
            Per-category minimum bars vs position minimums.
            {showZone ? '' : '(Category detail restricted to you and authorised seniors.)'}
          </p>
          <div className="space-y-3">
            {CATEGORY_ORDER.map((cat) => {
              const cs = categoryStandings.find((c) => c.category === cat);
              if (!cs) return null;
              const catMin = cs.positionMin ?? 0;
              const catPct = catMin > 0 ? Math.min(100, (cs.standing / catMin) * 100) : 100;
              const catZone = cs.standing < catMin ? 'Critical' : 'Safe';
              return (
                <div
                  key={cat}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent-soft/50 border border-accent/20"
                >
                  <div>
                    <div className="text-xs font-medium text-mute uppercase">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className="text-sm text-ink">
                      {cs.standing.toFixed(1)} / {catMin}
                    </div>
                  </div>
                  {showZone ? (
                    <>
                      <div className="w-40 bg-line rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${catZone === 'Critical' ? 'bg-rose-500' : 'bg-accent'}`}
                          style={{ width: Math.min(100, catPct) + '%' }}
                        />
                      </div>
                      <div className="text-xs font-mono text-mute">{catPct.toFixed(0)}%</div>
                    </>
                  ) : (
                    <div className="w-40 text-mute text-xs text-center">Restricted</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Runway Info (visible only to member & authorised seniors) */}
        {showZone && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <h2 className="font-heading font-bold text-ink mb-4">Runway Projection</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-mute">Current Standing</span>
                <span className="font-mono font-bold text-ink">{standing.standing.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mute">Position Minimum</span>
                <span className="font-mono font-bold text-ink">{positionMin}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-mute ${zone.zone !== 'Safe' ? 'font-bold' : ''}`}>
                  Zone: {zone.zone}
                </span>
                <span className={`font-mono ${zoneCfg!.text}`}>{zone.zone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mute">Days Until Watch</span>
                <span className="font-mono font-bold text-ink">{zone.runwayDays ?? '∞'}</span>
              </div>
            </div>
          </div>
        )}

        {/* What-If Simulator */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-ink mb-0">What-If Simulator</h2>
            <button
              onClick={clearSelection}
              disabled={selectedActivityIds.size === 0}
              className="text-xs text-mute hover:text-foreground underline underline-offset-4"
            >
              Clear selection
            </button>
          </div>
          <p className="text-mute text-sm mb-4">
            Select activities to see how they would affect your Standing and runway.
          </p>

          {/* Activity selection */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-mute uppercase mb-2">Select Activities</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {activityTypes.map((activity) => {
                const isSelected = selectedActivityIds.has(activity.id);
                return (
                  <button
                    key={activity.id}
                    onClick={() => toggleActivity(activity.id)}
                    className={`flex flex-col gap-2 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-accent-soft border-accent'
                        : 'bg-card border-line hover:border-accent/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-medium text-ink">{activity.name}</h4>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {activity.kind}
                      </span>
                    </div>
                    <p className="text-xs text-mute line-clamp-1">
                      {activity.category} • {activity.domain}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        +{activity.expMin}–{activity.expMax} EXP
                      </span>
                      <span>Difficulty {activity.difficulty}/5</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Projection results */}
          {selectedActivityIds.size > 0 && (
            <div className="mt-6 rounded-xl p-4 bg-accent-soft/50 border border-accent/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-mute uppercase">Selected</span>
                <span className="text-xs font-mono text-ink">{selectedActivityIds.size}</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-mute text-sm">Projected EXP Gain</span>
                  <span className={`font-mono font-bold text-accent text-sm`}>
                    +{projectedExpGain}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-mute text-sm">New Standing</span>
                  <span className={`font-mono font-bold text-ink text-sm`}>
                    {Math.round(projectedStanding)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-mute text-sm">Projected Zone</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      projectedZone?.zone === 'Safe'
                        ? 'text-green-600'
                        : projectedZone?.zone === 'Watch'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                    }`}
                  >
                    {projectedZone?.zone}
                  </span>
                </div>
                {projectedZone?.runwayDays !== null && projectedZone?.runwayDays !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-mute text-sm">New Runway</span>
                    <span className="font-mono font-bold text-sm">
                      {projectedZone.runwayDays} days
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
