'use client';

import React, { useEffect, useState } from 'react';
import { getLeaderboard, Branch, LeaderboardEntry } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import AppIcon from '@/components/ui/AppIcon';

export default function LeaderboardPage() {
  const { user, isLoading } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [branchFilter, setBranchFilter] = useState<Branch | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      loadLeaderboard();
    }
  }, [isLoading, user, branchFilter]);

  async function loadLeaderboard() {
    setLoading(true);
    const data = await getLeaderboard(branchFilter === 'all' ? undefined : branchFilter);
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

  return (
    <AppLayout activePath="/leaderboard">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Leaderboard</h1>
            <p className="text-mute">Ranked by season EXP across all branches</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setBranchFilter('all')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                branchFilter === 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-ink border-line hover:bg-accent-soft'
              }`}
            >
              All Branches
            </button>
            <button
              onClick={() => setBranchFilter('PICT')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                branchFilter === 'PICT'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-ink border-line hover:bg-accent-soft'
              }`}
            >
              PICT
            </button>
            <button
              onClick={() => setBranchFilter('IIITK')}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                branchFilter === 'IIITK'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-ink border-line hover:bg-accent-soft'
              }`}
            >
              IIITK
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-line rounded-xl bg-card">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-accent-soft">
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Rank</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Member</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Branch</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Level</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">League</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase text-right">Season EXP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.memberId} className="border-b border-line hover:bg-accent-soft transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-ink">{entry.rank}</td>
                  <td className="px-6 py-4 flex items-center gap-3">
                    <img
                      src={entry.avatar}
                      alt={entry.name}
                      className="w-10 h-10 rounded-full"
                    />
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
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-mute">
                    No leaderboard data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
