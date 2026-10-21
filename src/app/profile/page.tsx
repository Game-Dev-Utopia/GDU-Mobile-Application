'use client';

import React, { useEffect, useState } from 'react';
import { getCurrentMember, getMyClaims, getWeeklyXP, toggleAlumniMode } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import XPBar from '@/components/ui/XPBar';
import { Shield } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  technology_innovation_wisdom: '#7C5CFF',
  motivation_initiative_learning_mindset: '#22D3EE',
  social_soft_skills: '#A3E635',
  leadership_management: '#F59E0B',
};

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const [member, setMember] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [weeklyXP, setWeeklyXP] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alumniLoading, setAlumniLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      loadProfile();
    }
  }, [isLoading, user]);

  async function loadProfile() {
    setLoading(true);
    const [memberData, claimsData, weeklyData] = await Promise.all([
      getCurrentMember(),
      getMyClaims(),
      getWeeklyXP(),
    ]);
    setMember(memberData);
    setClaims(claimsData);
    setWeeklyXP(weeklyData);
    setLoading(false);
  }

  async function handleToggleAlumni() {
    setAlumniLoading(true);
    try {
      const msg = await toggleAlumniMode();
      alert(msg);
      setMember((prev: any) => ({
        ...prev,
        isAlumni: !prev.isAlumni,
        alumniBadge: !prev.isAlumni ? 'Alumni · ' + new Date().getFullYear() : null,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle alumni mode.');
    } finally {
      setAlumniLoading(false);
    }
  }

  const categoryXP = [
    {
      name: 'Technology',
      value: Math.floor((member?.totalXP || 0) * 0.35),
      color: CATEGORY_COLORS.technology_innovation_wisdom,
    },
    {
      name: 'Motivation',
      value: Math.floor((member?.totalXP || 0) * 0.25),
      color: CATEGORY_COLORS.motivation_initiative_learning_mindset,
    },
    {
      name: 'Social',
      value: Math.floor((member?.totalXP || 0) * 0.2),
      color: CATEGORY_COLORS.social_soft_skills,
    },
    {
      name: 'Leadership',
      value: Math.floor((member?.totalXP || 0) * 0.2),
      color: CATEGORY_COLORS.leadership_management,
    },
  ];

  if (loading || !member) {
    return (
      <AppLayout activePath="/profile">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/profile">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">{member.name}</h1>
            <p className="text-mute">
              @{member.username} • {member.role}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium border border-accent/20">
              Level {member.level}
            </span>
            <span className="px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium border border-accent/20">
              {member.leagueTier}
            </span>
            {member.isAlumni && (
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium border border-green-200">
                {member.alumniBadge || 'Alumnus'}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="col-span-1 lg:col-span-2 rounded-xl p-6 bg-card border border-line">
            <div className="flex items-start gap-4 mb-6">
              <img
                src={member.avatar}
                alt={member.name}
                className="w-24 h-24 rounded-full border-2 border-line"
              />
              <div>
                <h2 className="font-heading font-bold text-ink text-xl">{member.name}</h2>
                <p className="text-mute">
                  @{member.username} • {member.branch}
                </p>
                <div className="mt-2 flex gap-2">
                  <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    {member.domain}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-mute">Total EXP</span>
                  <span className="font-mono font-bold text-ink">
                    {member.totalXP.toLocaleString()}
                  </span>
                </div>
                <XPBar current={member.xpInLevel} max={member.xpToNextLevel} showLabel animate />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-mute">Level</span>
                  <span className="font-mono font-bold text-ink">{member.level}</span>
                </div>
                <div className="w-full bg-accent-soft/50 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{
                      width: Math.min(100, (member.xpInLevel / member.xpToNextLevel) * 100) + '%',
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                  <div className="text-xs text-mute uppercase mb-1">League Tier</div>
                  <div className="font-bold text-accent">{member.leagueTier}</div>
                </div>
                <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                  <div className="text-xs text-mute uppercase mb-1">Branch Rank</div>
                  <div className="font-bold text-accent">#{member.branchRank}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-1 space-y-6">
            <div className="rounded-xl p-6 bg-card border border-line">
              <h3 className="font-heading font-bold text-ink mb-4">Skill Radar</h3>
              <div className="space-y-3">
                {categoryXP.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-mute">{cat.name}</span>
                      <span className="font-mono text-ink">{cat.value}</span>
                    </div>
                    <div className="w-full bg-line rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          backgroundColor: cat.color,
                          width: Math.min(100, (cat.value / (member.totalXP || 1)) * 100) + '%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-6 bg-card border border-line">
              <h3 className="font-heading font-bold text-ink mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-mute">Claims Submitted</span>
                  <span className="font-mono text-ink">{claims.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-mute">Weekly XP</span>
                  <span className="font-mono text-ink">
                    {weeklyXP.reduce((s, w) => s + w.xp, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-mute">Streak</span>
                  <span className="font-mono text-ink">{member.streak} days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {member.isAlumni ? null : (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <Shield size={20} className="text-accent" />
              <h3 className="font-heading font-bold text-ink">Graduate as Alumnus</h3>
            </div>
            <p className="text-mute text-sm mb-4">
              Freeze your profile as an alumnus and receive a permanent alumni badge plus a public
              transcript verification code.
            </p>
            <button
              onClick={handleToggleAlumni}
              disabled={alumniLoading}
              className="w-full px-4 py-3 rounded-lg bg-accent text-white font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
            >
              {alumniLoading ? 'Freezing profile…' : 'Become Alumnus'}
            </button>
            <p className="text-[10px] text-mute mt-3">
              Once enabled, your profile is frozen and your transcript becomes publicly verifiable
              at /verify.
            </p>
          </div>
        )}

        <div className="rounded-xl bg-card border border-line overflow-hidden">
          <h3 className="px-6 py-4 font-heading font-bold text-ink border-b border-line">
            Contribution History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-mute border-b border-line">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Activity</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">EXP</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.slice(0, 10).map((claim) => (
                  <tr
                    key={claim.id}
                    className="border-b border-line/50 hover:bg-accent-soft/5 transition-colors"
                  >
                    <td className="px-6 py-3 text-sm font-mono text-mute">
                      {new Date(claim.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-ink">{claim.activityTitle}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                        {claim.activityDomain}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-ink text-right">
                      {claim.xpCredited ?? claim.xpReward}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          claim.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : claim.status === 'rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-accent-soft text-accent'
                        }`}
                      >
                        {claim.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {claims.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-mute">
                      No claims yet. Start by submitting one from the Activities page.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
