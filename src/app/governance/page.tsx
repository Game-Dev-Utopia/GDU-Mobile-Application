'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getMotions,
  castBallot,
  computeMotionResult,
  getMotionConfig,
  createMotion,
  type Motion,
} from '@/lib/api';
import Link from 'next/link';

const TIER_COLORS: Record<string, string> = {
  ordinary: 'text-accent bg-accent-soft border-accent/20',
  serious: 'text-amber-700 bg-amber-50 border-amber-200',
  constitutional: 'text-rose-700 bg-rose-50 border-rose-200',
  recall: 'text-rose-900 bg-rose-100 border-rose-200',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-accent-soft text-accent',
  voting: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  result: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-muted text-muted-foreground',
};

const JURISDICTIONS: { value: Motion['jurisdiction']; label: string }[] = [
  { value: 'org', label: 'Org' },
  { value: 'branch', label: 'Branch' },
  { value: 'concurrent', label: 'Concurrent' },
];

const STATUSES: { value: Motion['status']; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'voting', label: 'Voting' },
  { value: 'result', label: 'Result' },
  { value: 'closed', label: 'Closed' },
];

export default function GovernancePage() {
  const { user, isLoading } = useAuth();
  const [motions, setMotions] = useState<Motion[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [votingMotion, setVotingMotion] = useState<Motion | null>(null);
  const [voteModal, setVoteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<Motion['jurisdiction'] | 'all'>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<Motion['status'] | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [createModal, setCreateModal] = useState(false);

  const canCreateMotion = user
    ? can(user.roles as any, 'motion.create', 'org', user.scopes as any)
    : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([getMotions(), getMotionConfig()]);
      setMotions(m);
      setConfig(c);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMotions = useMemo(() => {
    return motions.filter((m) => {
      if (jurisdictionFilter !== 'all' && m.jurisdiction !== jurisdictionFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      return true;
    });
  }, [motions, jurisdictionFilter, statusFilter]);

  function openVote(motion: Motion) {
    setVotingMotion(motion);
    setVoteModal(true);
  }

  async function castVote(vote: 'yes' | 'no' | 'abstain') {
    if (!votingMotion || !user) return;
    setSubmitting(true);
    try {
      const role = user.role;
      let chamber: 'board' | 'council' | 'members' = 'members';
      if (role === 'board_member') chamber = 'board';
      else if (role === 'domain_head' || role === 'council_member' || role === 'team_lead')
        chamber = 'council';

      await castBallot(votingMotion.id, vote, chamber);
      setVoteModal(false);
      setVotingMotion(null);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to cast vote.');
    } finally {
      setSubmitting(false);
    }
  }

  async function computeResult(motion: Motion) {
    try {
      await computeMotionResult(motion.id);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to compute result.');
    }
  }

  async function handleCreateMotion(data: {
    title: string;
    text: string;
    tier: Motion['tier'];
    jurisdiction: Motion['jurisdiction'];
    attachmentUrls?: string[];
  }) {
    setCreating(true);
    try {
      await createMotion(data);
      setCreateModal(false);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to create motion.');
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/governance">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/governance">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Governance</h1>
            <p className="text-mute">Motions and voting across org, branch, and concurrent lists</p>
          </div>
          {canCreateMotion && (
            <button
              onClick={() => setCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Motion
            </button>
          )}
        </div>

        {config && (
          <div className="grid grid-cols-4 gap-3 p-4 rounded-xl bg-accent-soft border border-line">
            <div className="text-center">
              <div className="text-xs text-mute uppercase">Board Weight</div>
              <div className="font-mono font-bold text-ink">{config.boardWeight}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-mute uppercase">Council Weight</div>
              <div className="font-mono font-bold text-ink">{config.councilWeight}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-mute uppercase">Member Weight</div>
              <div className="font-mono font-bold text-ink">{config.memberWeight}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-mute uppercase">Quorum</div>
              <div className="font-mono font-bold text-ink">
                Board {config.boardQuorum}/5 &#8226; Council {config.councilQuorumPercent}%
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-[10px] font-bold uppercase text-mute mb-1 block">
            Jurisdiction
          </label>
          <div className="flex gap-1">
            {JURISDICTIONS.map((j) => {
              const active = jurisdictionFilter === j.value;
              return (
                <button
                  key={j.value}
                  onClick={() => setJurisdictionFilter(active ? 'all' : j.value)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    active
                      ? 'bg-accent text-white'
                      : 'bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  {j.label}
                </button>
              );
            })}
          </div>
          <label className="text-[10px] font-bold uppercase text-mute mb-1 block">Status</label>
          <div className="flex gap-1">
            {STATUSES.map((s) => {
              const active = statusFilter === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(active ? 'all' : s.value)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    active
                      ? 'bg-accent text-white'
                      : 'bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredMotions.length === 0 ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <p className="text-mute">No motions match your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMotions.map((motion) => (
              <div
                key={motion.id}
                className="rounded-xl p-5 border border-line bg-card hover:bg-accent-soft/5 transition-colors cursor-pointer group"
                onClick={() => {}}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${TIER_COLORS[motion.tier]}`}
                    >
                      {motion.tier}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[motion.status]}`}
                    >
                      {motion.status}
                    </span>
                    <span className="text-xs text-mute font-mono">
                      {motion.jurisdiction.toUpperCase()}
                    </span>
                  </div>
                </div>
                <Link href={`/governance/motions/${motion.id}`} className="block">
                  <h3 className="font-heading font-bold text-ink mb-1 group-hover:text-violetcustom transition-colors">
                    {motion.title}
                  </h3>
                  <p className="text-sm text-mute mb-3 line-clamp-2">{motion.text}</p>
                </Link>
                <div className="flex items-center justify-between text-xs text-mute mb-3">
                  <span>Proposed by {motion.proposerName}</span>
                  <span className="font-mono">{motion.voteCount} votes</span>
                </div>

                {motion.status === 'open' || motion.status === 'voting' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openVote(motion);
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                      disabled={submitting}
                    >
                      Cast Vote
                    </button>
                    {motion.status === 'voting' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          computeResult(motion);
                        }}
                        className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                        disabled={submitting}
                      >
                        Compute Result
                      </button>
                    )}
                  </div>
                ) : motion.status === 'result' ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold ${motion.result === 'passed' ? 'text-green-700' : 'text-rose-700'}`}
                    >
                      {motion.result?.toUpperCase()}
                    </span>
                    {motion.resultDetails && (
                      <span className="text-xs text-mute">
                        {Math.round(motion.resultDetails.pass_rate || 0)}% pass rate
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {voteModal && votingMotion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setVoteModal(false)}
            />
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
              <h2 className="font-heading font-bold text-ink mb-2">Cast Vote</h2>
              <p className="text-mute text-sm mb-4">{votingMotion.title}</p>
              <div className="space-y-3">
                <button
                  onClick={() => castVote('yes')}
                  className="w-full py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
                  disabled={submitting}
                >
                  {submitting ? 'Voting...' : 'Yes'}
                </button>
                <button
                  onClick={() => castVote('abstain')}
                  className="w-full py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  disabled={submitting}
                >
                  Abstain
                </button>
                <button
                  onClick={() => castVote('no')}
                  className="w-full py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium hover:bg-rose-100 disabled:opacity-50 transition-colors"
                  disabled={submitting}
                >
                  No
                </button>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setVoteModal(false)}
                  className="w-full py-2 rounded-lg border border-line bg-card text-ink text-sm font-medium hover:bg-accent-soft transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {createModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setCreateModal(false)}
            />
            <CreateMotionModal
              onClose={() => setCreateModal(false)}
              onSuccess={handleCreateMotion}
              submitting={creating}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function CreateMotionModal({
  onClose,
  onSuccess,
  submitting,
}: {
  onClose: () => void;
  onSuccess: (data: {
    title: string;
    text: string;
    tier: Motion['tier'];
    jurisdiction: Motion['jurisdiction'];
    attachmentUrls?: string[];
  }) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    title: '',
    text: '',
    tier: 'ordinary' as Motion['tier'],
    jurisdiction: 'org' as Motion['jurisdiction'],
    attachmentUrls: '' as string,
  });
  const [submittingLocal, setSubmittingLocal] = useState(false);

  const TIER_LABELS: Record<Motion['tier'], string> = {
    ordinary: 'Ordinary',
    serious: 'Serious',
    constitutional: 'Constitutional',
    recall: 'Recall',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingLocal(true);
    try {
      const attachmentUrls = form.attachmentUrls
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      onSuccess({
        title: form.title,
        text: form.text,
        tier: form.tier,
        jurisdiction: form.jurisdiction,
        attachmentUrls,
      });
    } finally {
      setSubmittingLocal(false);
    }
  }

  return (
    <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
      <h2 className="font-heading font-bold text-ink mb-2">Create Motion</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-mute mb-1">
            Title <span className="text-rosecustom">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-mute mb-1">
            Text <span className="text-rosecustom">*</span>
          </label>
          <textarea
            rows={4}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
            required
          />
        </div>
        <div className="grid gap-3 grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-mute mb-1">Tier</label>
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value as Motion['tier'] })}
              className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
            >
              {Object.entries(TIER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-mute mb-1">Jurisdiction</label>
            <select
              value={form.jurisdiction}
              onChange={(e) =>
                setForm({ ...form, jurisdiction: e.target.value as Motion['jurisdiction'] })
              }
              className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-mute mb-1">
            Attachment URLs (comma-separated)
          </label>
          <input
            type="text"
            value={form.attachmentUrls}
            onChange={(e) => setForm({ ...form, attachmentUrls: e.target.value })}
            placeholder="https://example.com/doc1.pdf, https://example.com/doc2.pdf"
            className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Paste publicly accessible URLs separated by commas.
          </p>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors disabled:opacity-50"
            disabled={submittingLocal || submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            disabled={submittingLocal || submitting}
          >
            {submittingLocal || submitting ? 'Creating…' : 'Create Motion'}
          </button>
        </div>
      </form>
    </div>
  );
}
