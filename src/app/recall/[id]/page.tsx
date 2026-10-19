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
  getRecallPetition,
  signRecallPetition,
  getRightOfReply,
  submitRightOfReply,
  type Motion,
  type MotionDiscussion,
} from '@/lib/api';
import Link from 'next/link';

const RECALL_THRESHOLD = 5;

export default function RecallDetailPage({ params }: { params: { id: string } }) {
  const { user, isLoading } = useAuth();
  const [motion, setMotion] = useState<Motion | null>(null);
  const [petition, setPetition] = useState<any>(null);
  const [reply, setReply] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [ballots, setBallots] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<MotionDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDiscussion, setNewDiscussion] = useState('');
  const [discussionSubmitting, setDiscussionSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [computing, setComputing] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const canVote = user ? true : false;
  const canComputeResult = user
    ? can(user.roles as any, 'motion.create', 'org', user.scopes as any)
    : false;
  const isAccused = user ? motion?.createdBy === user.id : false;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [m, p, r, c, b, mb, d] = await Promise.all([
        getMotionById(params.id),
        getRecallPetition(params.id),
        getRightOfReply(params.id),
        getMotionConfig(),
        // Note: getBallots and getMyBallot not yet imported; using placeholder
        [],
        null,
        getMotionDiscussions(params.id),
      ]);
      setMotion(m);
      setPetition(p);
      setReply(r);
      setConfig(c);
      setBallots(b);
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

  const userChamber = useMemo(() => {
    if (!user) return 'members' as const;
    const role = user.role;
    if (role === 'board_member') return 'board';
    if (role === 'domain_head' || role === 'council_member' || role === 'team_lead')
      return 'council';
    return 'members';
  }, [user?.role]);

  const isRecused = useMemo(() => {
    if (!motion || !user) return false;
    if (motion.tier === 'recall' && motion.createdBy === user.id) return true;
    return false;
  }, [motion, user?.id]);

  const hasVoted = false; // Simplified - would check myBallot

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

  const progress = petition
    ? Math.min(100, (petition.currentSignatures / petition.requiredSignatures) * 100)
    : 0;

  async function handleAddDiscussion() {
    if (!newDiscussion.trim() || !user) return;
    setDiscussionSubmitting(true);
    try {
      await addMotionDiscussion({ motionId: params.id, body: newDiscussion.trim() });
      setNewDiscussion('');
      const updated = await getMotionDiscussions(params.id);
      setDiscussions(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to post discussion.');
    } finally {
      setDiscussionSubmitting(false);
    }
  }

  async function signPetition() {
    if (!petition) return;
    setVoteSubmitting(true);
    try {
      await signRecallPetition(petition.id);
      const updated = await getRecallPetition(params.id);
      setPetition(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to sign petition.');
    } finally {
      setVoteSubmitting(false);
    }
  }

  async function submitReply() {
    // Handled in the reply form
  }

  async function handleCastVote(vote: 'yes' | 'no' | 'abstain') {
    if (!motion || !user) return;
    setVoteSubmitting(true);
    try {
      await castBallot(motion.id, vote, userChamber);
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

  if (loading || !user || !motion) {
    return (
      <AppLayout activePath="/recall">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/recall">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Link
              href="/recall"
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
              Back to Recall Petitions
            </Link>
            <h1 className="text-2xl font-heading font-bold text-ink mb-1">{motion.title}</h1>
            <p className="text-mute">{motion.text}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-rose-900 bg-rose-100 border border-rose-200">
              Recall
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${mStatusColor(motion.status)}`}
            >
              {motion.status}
            </span>
            <span className="text-xs text-mute font-mono">{motion.jurisdiction.toUpperCase()}</span>
          </div>
        </div>

        {/* Petition Threshold Banner */}
        {petition && (
          <div className="rounded-xl p-4 border border-line bg-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-mute">
                  Recall Petition Threshold
                </span>
                <span
                  className={`font-mono text-ink ${progress >= 100 ? 'text-rose-700' : 'text-accent'}`}
                >
                  {progress >= 100 ? 'REACHED' : `${Math.round(progress)}%`}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${progress >= 100 ? 'text-rose-700 bg-rose-50 border border-rose-200' : 'text-accent bg-accent-soft border border-accent/20'}`}
              >
                {petition.currentSignatures}/{petition.requiredSignatures}
              </span>
            </div>
            <div className="w-full bg-line rounded-full h-2">
              <div
                className={`h-2 rounded-full ${progress >= 100 ? 'bg-rose-500' : 'bg-accent'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-mute mt-1">
              <span>
                {progress >= 100
                  ? 'Threshold reached — motion ready for voting'
                  : `${petition.requiredSignatures - petition.currentSignatures} more signatures needed`}
              </span>
              <span>{petition.thresholdReachedAt ? 'Threshold met' : 'Collecting signatures'}</span>
            </div>
          </div>
        )}

        {/* Right of Reply (for accused) */}
        {isAccused && motion.status === 'open' && (
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 mt-0.5">⚖️</span>
              <div>
                <h3 className="font-bold text-amber-800 text-sm">Right of Reply</h3>
                <p className="text-amber-700 text-sm mb-3">
                  As the accused, you may submit a response to this recall petition before it
                  proceeds to voting.
                </p>
                {reply ? (
                  <div className="p-3 bg-white border border-line rounded-lg text-sm text-ink">
                    <p className="text-mute text-[10px] uppercase mb-1">Your Reply</p>
                    <p>{reply.replyText}</p>
                    <p className="text-[10px] text-mute mt-1">
                      Submitted {new Date(reply.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value=""
                      onChange={(e) => setNewDiscussion(e.target.value)}
                      placeholder="Enter your response to the recall petition…"
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                    <button
                      onClick={() => {
                        // Submit reply - will wire up below
                        alert('Right of reply submission would be wired here.');
                      }}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      Submit Reply
                    </button>
                  </div>
                )}
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
              <p className="text-[10px] font-bold uppercase text-mute mb-1">Status</p>
              <p
                className={`font-mono text-ink ${motion.status === 'open' ? 'text-accent' : 'text-muted-foreground'}`}
              >
                {motion.status}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-mute mb-1">Jurisdiction</p>
              <p className="text-ink capitalize">{motion.jurisdiction}</p>
            </div>
          </div>
        </div>

        {/* Voting Section */}
        {(motion.status === 'open' || motion.status === 'voting') && progress >= 100 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink">Cast Your Vote</h2>
              <span className={`text-xs font-bold text-violet-600 bg-violet-50 border-violet-200`}>
                Your Chamber: {userChamber.charAt(0).toUpperCase() + userChamber.slice(1)}
              </span>
            </div>

            <div className="grid gap-3 grid-cols-3 mb-4">
              <button
                onClick={() => handleCastVote('yes')}
                disabled={isRecused || hasVoted || voteSubmitting}
                className="py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
              >
                {voteSubmitting ? 'Voting…' : 'Yes'}
              </button>
              <button
                onClick={() => handleCastVote('abstain')}
                disabled={isRecused || hasVoted || voteSubmitting}
                className="py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                Abstain
              </button>
              <button
                onClick={() => handleCastVote('no')}
                disabled={isRecused || hasVoted || voteSubmitting}
                className="py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium hover:bg-rose-100 disabled:opacity-50 transition-colors"
              >
                No
              </button>
            </div>

            {isRecused && (
              <div className="rounded-lg p-4 border border-line bg-mute/50 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-muted-foreground mt-0.5">⚠️</span>
                  <div>
                    <h4 className="font-bold text-ink text-sm">Recused from Voting</h4>
                    <p className="text-sm text-mute">
                      As the proposer of this recall motion, you cannot vote on it.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
              <h2 className="font-heading font-bold text-ink">Recall Result</h2>
              <span
                className={`font-bold ${motion.result === 'passed' ? 'text-rose-700' : 'text-green-700'}`}
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
            <div className="grid gap-3 grid-cols-3 mb-4">
              {['board', 'council', 'members'].map((chamber) => {
                const stats = chamberStats[chamber];
                const yesPct = stats.total > 0 ? Math.round((stats.yes / stats.total) * 100) : 0;
                return (
                  <div key={chamber} className="p-3 rounded-lg border border-line bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-mute">
                        {chamber.charAt(0).toUpperCase() + chamber.slice(1)}
                      </span>
                      <span className="font-mono text-sm text-ink">{yesPct}% yes</span>
                    </div>
                    <div className="w-full bg-line rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full bg-${yesPct >= 66.67 ? 'rose-500' : 'green-500'}`}
                        style={{ width: yesPct }}
                      />
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
            {motion.result === 'passed' && (
              <div className="rounded-lg p-4 bg-rose-50 border border-rose-200">
                <h3 className="text-xs font-bold uppercase text-rose-700 mb-1">Recall Passed</h3>
                <p className="text-sm text-rose-700">
                  The recalled member is removed from their position. Faculty review may be
                  initiated at 90% support.
                </p>
              </div>
            )}
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

function mStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'text-accent bg-accent-soft border-accent/20';
    case 'voting':
      return 'text-cyan-600 bg-cyan-50 border-cyan-200';
    case 'result':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'closed':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
