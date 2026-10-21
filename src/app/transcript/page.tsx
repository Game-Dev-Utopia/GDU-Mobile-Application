'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getTranscript,
  toggleAlumniMode,
  type TranscriptCategoryTotal,
  type TranscriptData,
} from '@/lib/api';
import { AlertCircle, Loader2, Download, Shield } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  technology_innovation_wisdom: '#7C5CFF',
  motivation_initiative_learning_mindset: '#22D3EE',
  social_soft_skills: '#A3E635',
  leadership_management: '#F59E0B',
};

function CategoryRow({ cat, max }: { cat: TranscriptCategoryTotal; max: number }) {
  const width = max > 0 ? (cat.totalXP / max) * 100 : 0;
  return (
    <div key={cat.category} className="group">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-mute">{cat.label}</span>
        <span className="font-mono text-ink">{cat.totalXP.toLocaleString()}</span>
      </div>
      <div className="w-full bg-line rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{
            backgroundColor: CATEGORY_COLORS[cat.category] ?? '#64748b',
            width: `${Math.min(100, width)}%`,
          }}
        />
      </div>
      <div className="text-[10px] text-mute">
        {cat.count === 1 ? '1 contribution' : `${cat.count} contributions`}
      </div>
    </div>
  );
}

export default function TranscriptPage() {
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTranscript();
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcript.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      load();
    }
  }, [isLoading, user, load]);

  const maxCategoryXP = useMemo(
    () => Math.max(...(data?.categoryTotals.map((c) => c.totalXP) ?? []), 0),
    [data?.categoryTotals]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleToggleAlumni = async () => {
    setLoading(true);
    try {
      const msg = await toggleAlumniMode();
      alert(msg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle alumni mode.');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <AppLayout activePath="/transcript">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (loading || !data) {
    return (
      <AppLayout activePath="/transcript">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const { member } = data;
  const isAlumni = member.isAlumni ?? false;

  return (
    <AppLayout activePath="/transcript">
      <div className="space-y-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Contribution Transcript</h1>
            <p className="text-mute">
              Official record of XP contributions. Print or share your verification code.
            </p>
          </div>
          <div className="flex gap-3">
            {isAlumni && (
              <span className="px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium border border-accent/20">
                {member.alumniBadge || 'Alumnus'}
              </span>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors flex items-center gap-2"
            >
              <Download size={16} /> Print Transcript
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Printable transcript card */}
        <div className="rounded-xl p-8 bg-card border border-line shadow-sm min-h-[600px]">
          {/* Header */}
          <div className="mb-8 border-b border-line pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-heading font-bold text-ink">{member.name}</h2>
              <p className="text-mute text-sm">
                @{member.username} • {member.branch} • {member.domain}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium border border-accent/20">
                  Level {member.level}
                </span>
                <span className="px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium border border-accent/20">
                  {member.leagueTier}
                </span>
                {isAlumni && (
                  <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium border border-green-200">
                    Alumnus
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-ink">
                {data.totalXP.toLocaleString()}
              </div>
              <div className="text-xs text-mute">Total EXP</div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
              <div className="text-xs text-mute uppercase mb-1">Branch</div>
              <div className="font-medium text-ink">{member.branch}</div>
            </div>
            <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
              <div className="text-xs text-mute uppercase mb-1">Period</div>
              <div className="font-medium text-ink">{data.period}</div>
            </div>
            <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
              <div className="text-xs text-mute uppercase mb-1">Joined</div>
              <div className="font-medium text-ink">
                {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>

          {/* Category totals */}
          <div className="mb-8">
            <h3 className="font-heading font-bold text-ink mb-4">EXP by Category</h3>
            <div className="space-y-3">
              {data.categoryTotals.map((cat) => (
                <CategoryRow key={cat.category} cat={cat} max={maxCategoryXP} />
              ))}
            </div>
          </div>

          {/* Key contributions */}
          <div className="mb-8">
            <h3 className="font-heading font-bold text-ink mb-4">Key Contributions</h3>
            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line bg-accent-soft">
                    <th className="px-4 py-3 font-semibold text-mute">Activity</th>
                    <th className="px-4 py-3 font-semibold text-mute">Category</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Date</th>
                    <th className="px-4 py-3 font-semibold text-mute text-right">EXP</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.keyContributions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-mute">
                        No approved contributions yet.
                      </td>
                    </tr>
                  ) : (
                    data.keyContributions.map((c) => (
                      <tr key={c.id} className="border-b border-line/50">
                        <td className="px-4 py-3 text-sm text-ink">{c.activityTitle}</td>
                        <td className="px-4 py-3 text-sm text-mute">
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                            {c.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-mute text-center font-mono">
                          {new Date(c.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-ink text-right">
                          {c.xpCredited.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verification */}
          <div className="mt-8 pt-8 border-t border-line rounded-xl p-6 bg-accent-soft/30 border border-dashed border-accent/40">
            <div className="flex items-center gap-3 mb-4">
              <Shield size={20} className="text-accent" />
              <h3 className="font-heading font-bold text-ink">Verify This Transcript</h3>
            </div>
            <p className="text-sm text-mute mb-4">
              Share this verification code. Anyone can confirm this transcript is genuine at{' '}
              <span className="font-mono text-accent">/verify</span> with the code below.
            </p>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line bg-card text-sm font-mono text-ink select-all">
              {data.verificationCode || '—'}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.verificationCode || '').then(() => {
                    alert('Verification code copied to clipboard.');
                  });
                }}
                className="ml-2 text-xs text-accent hover:underline"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Alumni toggle (only for non-alumni members) */}
        {!isAlumni && (
          <div className="rounded-xl p-6 bg-card border border-line no-print">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-ink">Graduate as Alumnus</h3>
                <p className="text-mute text-sm">
                  Freeze your profile as an alumnus and receive a permanent alumni badge plus a
                  public transcript verification code.
                </p>
              </div>
              <Shield size={20} className="text-accent" />
            </div>
            <button
              onClick={handleToggleAlumni}
              disabled={loading}
              className="w-full px-4 py-3 rounded-lg bg-accent text-white font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
            >
              {loading ? 'Freezing profile…' : 'Become Alumnus'}
            </button>
            <p className="text-[10px] text-mute mt-3">
              Once enabled, your profile is frozen and your transcript becomes publicly verifiable.
            </p>
          </div>
        )}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .transcript-card {
              break-inside: avoid;
              box-shadow: none !important;
              border: 1px solid #000 !important;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background: #ffffff !important;
                margin: 0 !important;
              }
              .print-only {
                display: block !important;
              }
            }
          `,
        }}
      />
    </AppLayout>
  );
}
