'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getMotionById,
  getMotionDiscussions,
  addMotionDiscussion,
  castBallot,
  computeMotionResult,
  getMotionConfig,
  getBallots,
  getMyBallot,
  type Motion,
  type MotionDiscussion,
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

const CHAMBER_COLORS: Record<string, string> = {
  board: 'text-violet-600 bg-violet-50 border-violet-200',
  council: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  members: 'text-amber-600 bg-amber-50 border-amber-200',
};

const CHAMBER_LABELS: Record<string, string> = {
  board: 'Board',
  council: 'Council',
  members: 'Members',
};

const STATUS_ORDER: Motion['status'][] = ['draft', 'open', 'voting', 'result', 'closed'];
const STATUS_LABELS: Record<Motion['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  voting: 'Voting',
  result: 'Result',
  closed: 'Closed',
};

const DEADLOCK_LADDER: { step: string; label: string; description: string }[] = [
  {
    step: 'status-quo',
    label: 'Status Quo',
    description: 'Motion falls — current state continues unchanged.',
  },
  {
    step: 'mediator',
    label: 'Mediator Review',
    description: 'An independent mediator reviews the motion and facilitates discussion.',
  },
  {
    step: 'revote',
    label: 'Re-vote at Higher Quorum',
    description: 'Motion returns to vote with increased quorum requirements.',
  },
  {
    step: 'motion-falls',
    label: 'Motion Falls',
    description: 'Motion is defeated and cannot be re-submitted in the same session.',
  },
];

export default function MotionDetailPage({ params }: { params: { id: string } }) {
  const { user, isLoading } = useAuth();
  const [motion, setMotion] = useState<Motion | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [ballots, setBallots] = useState<any[]>([]);
  const [myBallot, setMyBallot] = useState<any | null>(null);
  const [discussions, setDiscussions] = useState<MotionDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDiscussion, setNewDiscussion] = useState('');
  const [discussionSubmitting, setDiscussionSubmitting] = useState(false);
  const [voteModal, setVoteModal] = useState(false);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteValue, setVoteValue] = useState<'yes' | 'no' | 'abstain'>('yes');
  const [voteConfirm, setVoteConfirm] = useState(false);
  const [computing, setComputing] = useState(false);

  const canVote = user ? true : false;
  const canComputeResult = user
    ? can(user.roles as any, 'motion.create', 'org', user.scopes as any)
    : false;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [m, c, b, mb, d] = await Promise.all([
        getMotionById(params.id),
        getMotionConfig(),
        getBallots(params.id),
        getMyBallot(params.id),
        getMotionDiscussions(params.id),
      ]);
      setMotion(m);
      setConfig(c);
      setBallots(b);
      setMyBallot(mb);
      setDiscussions(d);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canViewMotion = user ? true : false;

  // Determine user's chamber
  const userChamber = useMemo(() => {
    if (!user) return 'members' as const;
    const role = user.role;
    if (role === 'board_member') return 'board';
    if (role === 'domain_head' || role === 'council_member' || role === 'team_lead')
      return 'council';
    return 'members';
  }, [user?.role]);

  // Check if user is recused (recall motion proposer cannot vote)
  const isRecused = useMemo(() => {
    if (!motion || !user) return false;
    if (motion.tier === 'recall' && motion.createdBy === user.id) return true;
    return false;
  }, [motion, user?.id]);

  // Check if user already voted
  const hasVoted = !!myBallot;

  // Compute chamber stats
  const chamberStats = useMemo(() => {
    const stats: Record<
      string,
      { yes: number; no: number; abstain: number; total: number; weight: number }
    > = {
      board: { yes: 0, no: 0, abstain: 0, total: 0, weight: 0 },
      council: { yes: 0, no: 0, abstain: 0, total: 0, weight: 0 },
      members: { yes: 0, no: 0, abstain: 0, total: 0, weight: 0 },
    };
    for (const b of ballots) {
      const s = stats[b.chamber as keyof typeof stats];
      if (s) {
        s.total += 1;
        s.weight += b.weight || 1;
        if (b.vote === 'yes') s.yes += 1;
        else if (b.vote === 'no') s.no += 1;
        else if (b.vote === 'abstain') s.abstain += 1;
      }
    }
    return stats;
  }, [ballots]);

  // Quorum calculations
  const quorumStatus = useMemo(() => {
    if (!config) return null;
    const board = chamberStats.board;
    const council = chamberStats.council;
    const boardQuorumMet = board.total >= config.boardQuorum;
    const councilQuorumMet =
      council.total > 0 &&
      (council.weight / config.memberWeight) * 100 >= config.councilQuorumPercent;
    return {
      boardQuorumMet,
      councilQuorumMet,
      boardTotal: board.total,
      boardQuorum: config.boardQuorum,
    };
  }, [chamberStats, config]);

  // Motion result explanation
  const resultExplanation = useMemo(() => {
    if (!motion || motion.status !== 'result' || !motion.resultDetails) return null;
    const rd = motion.resultDetails as any;
    const reasons: string[] = [];
    if (motion.tier === 'ordinary') {
      reasons.push('Ordinary motion: passes if >50% of weighted votes are in favor.');
    } else if (motion.tier === 'serious') {
      reasons.push(
        'Serious motion: requires 66.67% weighted approval AND majority in both Board and Council.'
      );
    } else if (motion.tier === 'constitutional') {
      reasons.push(
        'Constitutional motion: requires 66.67% weighted approval AND majority in both Board and Council.'
      );
    } else if (motion.tier === 'recall') {
      reasons.push(
        'Recall motion: requires 66.67% weighted approval AND at least 2 of 4 non-accused Board members concur.'
      );
    }
    reasons.push(`Overall pass rate: ${rd.pass_rate ?? 0}%`);
    reasons.push(`Board: ${rd.board?.yes ?? 0}/${rd.board?.total ?? 0} voted yes`);
    reasons.push(`Council: ${rd.council?.yes ?? 0}/${rd.council?.total ?? 0} voted yes`);
    reasons.push(`Members: ${rd.members?.yes ?? 0}/${rd.members?.total ?? 0} voted yes`);
    return reasons;
  }, [motion]);

  const loadDiscussions = useCallback(async () => {
    if (!user) return;
    const d = await getMotionDiscussions(params.id);
    setDiscussions(d);
  }, [user, params.id]);

  async function handleAddDiscussion() {
    if (!newDiscussion.trim() || !user) return;
    setDiscussionSubmitting(true);
    try {
      await addMotionDiscussion({ motionId: params.id, body: newDiscussion.trim() });
      setNewDiscussion('');
      await loadDiscussions();
    } catch (err: any) {
      alert(err.message || 'Failed to post discussion.');
    } finally {
      setDiscussionSubmitting(false);
    }
  }

  async function openVote() {
    if (isRecused || hasVoted || !motion) return;
    setVoteConfirm(false);
    setVoteValue('yes');
    setVoteModal(true);
  }

  async function handleCastVote(vote: 'yes' | 'no' | 'abstain') {
    if (!motion || !user) return;
    setVoteSubmitting(true);
    try {
      await castBallot(motion.id, vote, userChamber);
      setVoteModal(false);
      setVoteConfirm(false);
      const updated = await getMyBallot(motion.id);
      setMyBallot(updated);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to cast vote.');
    } finally {
      setVoteSubmitting(false);
    }
  }

  async function handleComputeResult() {
    if (!motion) return;
    setComputing(true);
    try {
      await computeMotionResult(motion.id);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to compute result.');
    } finally {
      setComputing(false);
    }
  }

  // Pre-compute chamber cards for voting display
  const chamberData = config
    ? ['board', 'council', 'members'].map((chamber) => {
        const weight =
          chamber === 'board'
            ? config.boardWeight
            : chamber === 'council'
              ? config.councilWeight
              : config.memberWeight;
        const stats = chamberStats[chamber];
        return { chamber, weight, stats };
      })
    : null;

  const chamberCards = chamberData ? (
    <div className="grid gap-3 grid-cols-3 mb-4">
      {chamberData.map(({ chamber, weight, stats }) => (
        <div key={chamber} className="p-3 rounded-lg border border-line bg-muted/50">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-bold ${CHAMBER_COLORS[chamber]}`}>
              {CHAMBER_LABELS[chamber]}
            </span>
            <span className="text-xs text-mute font-mono">{weight}%</span>
          </div>
          <div className="w-full bg-line rounded-full h-2 mb-1">
            <div
              className={`h-2 rounded-full ${CHAMBER_COLORS[chamber].replace('text-', 'bg-').replace('-50', '-500')}`}
              style={{
                width: Math.min(
                  100,
                  (stats.total / (chamber === 'board' ? config.boardQuorum : 1)) * 100
                ),
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-mute">
            <span>{stats.total} voted</span>
            <span>{stats.weight} weight</span>
          </div>
        </div>
      ))}
    </div>
  ) : null;

  // Pre-compute result chamber cards
  const resultChamberCards =
    motion.status === 'result' ? (
      <div className="grid gap-3 grid-cols-3 mb-4">
        {['board', 'council', 'members'].map((chamber) => {
          const stats = chamberStats[chamber];
          const yesPct = stats.total > 0 ? Math.round((stats.yes / stats.total) * 100) : 0;
          return (
            <div key={chamber} className="p-3 rounded-lg border border-line bg-muted/50">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${CHAMBER_COLORS[chamber]}`}>
                  {CHAMBER_LABELS[chamber]}
                </span>
                <span className="font-mono text-sm text-ink">{yesPct}% yes</span>
              </div>
              <div className="w-full bg-line rounded-full h-2 mb-1">
                <div className={`h-2 rounded-full bg-green-500`} style={{ width: yesPct }} />
              </div>
              <div className="flex justify-between text-[10px] text-mute">
                <span>{stats.yes} yes</span>
                <span>{stats.no} no</span>
                <span>{stats.abstain} abstain</span>
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  if (loading || !user || !motion) {
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
            <Link
              href="/governance"
              className="text-[11px] text-mute hover:text-foreground inline-flex items-center gap-1 mb-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Motions
            </Link>
            <h1 className="text-2xl font-heading font-bold text-ink mb-1">{motion.title}</h1>
            <p className="text-mute">{motion.text}</p>
          </div>
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
            <span className="text-xs text-mute font-mono">{motion.jurisdiction.toUpperCase()}</span>
          </div>
        </div>

        {/* Objection Window Banner (Org-list only) */}
        {motion.jurisdiction === 'org' &&
          motion.objectionWindowDeadline &&
          motion.status === 'open' && (
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
                  <h3 className="font-bold text-amber-800 text-sm">Objection Window Open</h3>
                  <p className="text-amber-700 text-sm">
                    Objections to this motion can be raised until{' '}
                    <span className="font-mono">
                      {new Date(motion.objectionWindowDeadline).toLocaleDateString()}
                    </span>
                    . If 2/3 of Council or 30% of Members object, the motion moves to the Concurrent
                    list.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* Motion meta */}
        <div className="rounded-xl p-4 bg-card border border-line">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase text-mute mb-1">Proposer</p>
              <p className="text-ink">{motion.proposerName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-mute mb-1">Created</p>
              <p className="text-ink">
                {new Date(motion.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-mute mb-1">Votes</p>
              <p className="font-mono text-ink">{motion.voteCount}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-mute mb-1">Jurisdiction</p>
              <p className="text-ink capitalize">{motion.jurisdiction}</p>
            </div>
          </div>
        </div>

        {/* Attachments */}
        {motion.attachmentUrls && motion.attachmentUrls.length > 0 && (
          <div className="rounded-xl p-4 bg-card border border-line">
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <h2 className="font-heading font-bold text-ink text-lg mb-0">Attachments</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {motion.attachmentUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-line bg-muted/30 text-xs text-violetcustom hover:bg-violetcustom/50 hover:text-violetcustom break-all"
                >
                  {url.length > 40 ? url.slice(0, 40) + '…' : url}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Voting Section */}
        {(motion.status === 'open' || motion.status === 'voting') && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink">Cast Your Vote</h2>
              <span className={`text-xs font-bold ${CHAMBER_COLORS[userChamber]}`}>
                Your Chamber: {CHAMBER_LABELS[userChamber]}
              </span>
            </div>

            {/* Chamber weights */}
            {config && chamberCards}

            {/* Quorum meters */}
            <div className="bg-muted/30 rounded-lg p-3 mb-4">
              <p className="text-xs font-bold uppercase text-mute mb-2">Quorum Status</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink">
                    Board Quorum ({config?.boardQuorum} of 5)
                  </span>
                  <span
                    className={`font-mono text-sm ${quorumStatus?.boardQuorumMet ? 'text-green-600' : 'text-rosecustom'}`}
                  >
                    {quorumStatus?.boardTotal}/{config?.boardQuorum}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink">
                    Council Quorum ({config?.councilQuorumPercent}%)
                  </span>
                  <span
                    className={`font-mono text-sm ${quorumStatus?.councilQuorumMet ? 'text-green-600' : 'text-rosecustom'}`}
                  >
                    {quorumStatus?.councilQuorumMet ? 'Met' : 'Not Met'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recusal banner */}
            {isRecused && (
              <div className="rounded-lg p-4 border border-line bg-mute/50 mb-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-muted-foreground mt-0.5"
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
                    <h4 className="font-bold text-ink text-sm">Recused from Voting</h4>
                    <p className="text-sm text-mute">
                      As the proposer of this recall motion, you cannot vote on it.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Already voted */}
            {hasVoted && !isRecused && myBallot && (
              <div className="rounded-lg p-4 bg-green-50 border border-green-200 mb-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-green-600 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h4 className="font-bold text-green-800 text-sm">Already Voted</h4>
                    <p className="text-sm text-green-700">
                      You voted <span className="font-bold">{myBallot.vote.toUpperCase()}</span> on
                      this motion.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Vote buttons */}
            {!isRecused && !hasVoted && (
              <div className="grid gap-2 grid-cols-3">
                <button
                  onClick={() => {
                    setVoteValue('yes');
                    setVoteConfirm(true);
                  }}
                  className="py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium hover:bg-green-100 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => {
                    setVoteValue('abstain');
                    setVoteConfirm(true);
                  }}
                  className="py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium hover:bg-amber-100 transition-colors"
                >
                  Abstain
                </button>
                <button
                  onClick={() => {
                    setVoteValue('no');
                    setVoteConfirm(true);
                  }}
                  className="py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium hover:bg-rose-100 transition-colors"
                >
                  No
                </button>
              </div>
            )}

            {/* Compute result button */}
            {motion.status === 'voting' && canComputeResult && (
              <button
                onClick={handleComputeResult}
                disabled={computing}
                className="mt-4 px-4 py-2 rounded-lg border border-line bg-card text-ink text-sm font-medium hover:bg-accent-soft disabled:opacity-50 transition-colors"
              >
                {computing ? 'Computing…' : 'Compute Result'}
              </button>
            )}
          </div>
        )}

        {/* Result Section */}
        {motion.status === 'result' && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink">Result</h2>
              <span
                className={`font-bold ${motion.result === 'passed' ? 'text-green-700' : 'text-rose-700'}`}
              >
                {motion.result?.toUpperCase()}
              </span>
            </div>
            <div className="mb-4">
              <p className="text-sm text-mute">
                {motion.resultDetails &&
                  `Pass rate: ${Math.round((motion.resultDetails as any).pass_rate || 0)}%`}
              </p>
            </div>

            {/* Chamber breakdown */}
            {resultChamberCards}

            {/* Explanation */}
            {resultExplanation && (
              <div className="rounded-lg p-3 bg-muted/50 border border-border mb-4">
                <p className="text-xs font-bold uppercase text-mute mb-1">Why this result:</p>
                <ul className="text-sm text-ink space-y-1 list-disc list-inside">
                  {resultExplanation.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Deadlock Ladder */}
            <div className="rounded-lg p-4 bg-mute/50 border border-border">
              <h3 className="text-xs font-bold uppercase text-mute mb-3">Deadlock Ladder</h3>
              <div className="space-y-2">
                {DEADLOCK_LADDER.map((step, i) => {
                  const isCurrent = i === 0;
                  const isCompleted = i > 0;
                  return (
                    <div
                      key={step.step}
                      className="flex items-center gap-3 p-2 rounded-lg border border-line bg-card"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCurrent
                            ? 'bg-accent text-white border-accent'
                            : isCompleted
                              ? 'bg-green-500 text-white border-green-500'
                              : 'bg-muted border-muted text-muted-foreground'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-ink">{step.label}</div>
                        <div className="text-[10px] text-mute">{step.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Discussion Thread */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-ink">Discussion</h2>
            <span className="text-xs font-medium text-mute">
              {discussions.length} comment{discussions.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-3">
            {discussions.map((d) => (
              <div key={d.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-muted/50 border border-border flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {d.authorName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-ink">{d.authorName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(d.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-ink whitespace-pre-line">{d.body}</p>
                </div>
              </div>
            ))}
            {discussions.length === 0 && (
              <div className="py-8 text-center text-mute">
                No discussion yet. Start the conversation below.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-line">
            <div className="flex gap-3">
              <textarea
                value={newDiscussion}
                onChange={(e) => setNewDiscussion(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm resize-none"
              />
              <button
                onClick={handleAddDiscussion}
                disabled={discussionSubmitting || !newDiscussion.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {discussionSubmitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
