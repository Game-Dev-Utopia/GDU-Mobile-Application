'use client';

import React, { useEffect, useState } from 'react';
import {
  getLeaderboard,
  Branch,
  LeaderboardEntry,
  type LeaderboardGroup,
  type LeaderboardPeriod,
  type LeaderboardMetric,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import AppIcon from '@/components/ui/AppIcon';

const GROUP_LABELS: Record<LeaderboardGroup, string> = {
  all: 'All Members',
  my_branch: 'My Branch',
  my_level: 'My Level',
  my_team: 'My Team',
};

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  halfyearly: 'Half-yearly',
  yearly: 'Yearly',
};

const METRIC_LABELS: Record<LeaderboardMetric, string> = {
  season: 'Season EXP',
  lifetime: 'Lifetime EXP',
};

export default function LeaderboardPage() {
  const { user, isLoading } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [branchFilter, setBranchFilter] = useState<Branch | 'all'>('all');
  const [groupFilter, setGroupFilter] = useState<LeaderboardGroup>('all');
  const [periodFilter, setPeriodFilter] = useState<LeaderboardPeriod>('biweekly');
  const [metricFilter, setMetricFilter] = useState<LeaderboardMetric>('season');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      loadLeaderboard();
    }
  }, [isLoading, user, branchFilter, groupFilter, periodFilter, metricFilter]);

  async function loadLeaderboard() {
    setLoading(true);
    const data = await getLeaderboard({
      branch: branchFilter === 'all' ? undefined : branchFilter,
      group: groupFilter,
      period: periodFilter,
      metric: metricFilter,
      currentMemberId: user?.id,
    });
    setEntries(data);
    setLoading(false);
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/leaderboard">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const showPercentile = groupFilter === 'all';

  return (
    <AppLayout activePath="/leaderboard">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Leaderboard</h1>
            <p className="text-mute">
              {metricFilter === 'season' ? 'Season' : 'Lifetime'} EXP leaderboard
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMetricFilter(key as LeaderboardMetric)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    metricFilter === (key as LeaderboardMetric)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-ink border-line hover:bg-accent-soft'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriodFilter(key as LeaderboardPeriod)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    periodFilter === (key as LeaderboardPeriod)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-ink border-line hover:bg-accent-soft'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {Object.entries(GROUP_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setGroupFilter(key as LeaderboardGroup)}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                groupFilter === (key as LeaderboardGroup)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-ink border-line hover:bg-accent-soft'
              }`}
            >
              {label}
            </button>
          ))}
          {branchFilter !== 'all' && (
            <button
              onClick={() => setBranchFilter('all')}
              className="px-4 py-2 rounded-xl border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              All Branches
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <p className="text-mute">No leaderboard data available yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-line rounded-xl bg-card">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Rank</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Member</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Branch</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Level</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">League</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase text-right">
                    EXP
                  </th>
                  {showPercentile && (
                    <th className="px-6 py-3 text-xs font-semibold text-mute uppercase text-right">
                      Percentile
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.memberId}
                    className="border-b border-line hover:bg-accent-soft transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-medium text-ink">{entry.rank}</td>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <img src={entry.avatar} alt={entry.name} className="w-10 h-10 rounded-full" />
                      <div>
                        <div className="font-medium text-ink">{entry.name}</div>
                        <div className="text-xs text-mute">@{entry.username}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium">
                        <AppIcon name="BuildingIcon" size={12} />
                        {entry.branch}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-ink">{entry.level}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium">
                        {entry.leagueTier}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-ink text-right">
                      {entry.totalXP.toLocaleString()}
                    </td>
                    {showPercentile && entry.percentile !== undefined && (
                      <td className="px-6 py-4 font-mono font-medium text-ink text-right">
                        Top {entry.percentile}%
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
