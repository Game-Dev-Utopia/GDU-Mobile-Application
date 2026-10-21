'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getMotions,
  getRecallPetition,
  createRecallPetition,
  signRecallPetition,
  type Motion,
} from '@/lib/api';
import Link from 'next/link';
import EmptyState from '@/components/ui/EmptyState';

const RECALL_THRESHOLD = 5; // Required signatures for recall petition

export default function RecallPage() {
  const { user, isLoading } = useAuth();
  const [motions, setMotions] = useState<Motion[]>([]);
  const [petitions, setPetitions] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newPetitionMotion, setNewPetitionMotion] = useState<string | null>(null);

  const canCreateMotion = user
    ? can(user.roles as any, 'motion.create', 'org', user.scopes as any)
    : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await getMotions();
      const recallMotions = m.filter((motion) => motion.tier === 'recall');
      setMotions(recallMotions);

      // Load petitions for each recall motion
      const petitionMap = new Map<string, any>();
      for (const motion of recallMotions) {
        const p = await getRecallPetition(motion.id);
        if (p) petitionMap.set(motion.id, p);
      }
      setPetitions(petitionMap);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createPetition(motionId: string) {
    setCreating(true);
    try {
      await createRecallPetition(motionId, RECALL_THRESHOLD);
      setNewPetitionMotion(null);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to create petition.');
    } finally {
      setCreating(false);
    }
  }

  async function signPetition(motionId: string) {
    const petition = petitions.get(motionId);
    if (!petition) return;

    setSigning((prev) => new Set([...prev, motionId]));
    try {
      await signRecallPetition(petition.id);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to sign petition.');
    } finally {
      setSigning((prev) => {
        const next = new Set(prev);
        next.delete(motionId);
        return next;
      });
    }
  }

  const recallMotionsWithPetition = motions.map((m) => {
    const petition = petitions.get(m.id);
    const progress = petition
      ? Math.min(100, (petition.currentSignatures / petition.requiredSignatures) * 100)
      : 0;
    return { ...m, petition, progress };
  });

  if (loading || !user) {
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
            <h1 className="text-2xl font-heading font-bold text-ink">Recall Petitions</h1>
            <p className="text-mute">
              Recall motions require {RECALL_THRESHOLD} signatures to proceed to voting.
            </p>
          </div>
          {canCreateMotion && recallMotionsWithPetition.some((m) => !m.petition) && (
            <div className="text-xs text-mute">
              Select a motion without a petition to start one.
            </div>
                  )}

              </div>

        {recallMotionsWithPetition.length === 0 ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <p className="text-mute">No recall motions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recallMotionsWithPetition.length === 0 ? (
              <EmptyState
                title="No motions to recall"
                description="There are no motions available for recall petitions."
              />
            ) : (
              <div className="space-y-3">
                {recallMotionsWithPetition.map((m) => {
              const petition = m.petition;
              const hasPetition = !!petition;
              const alreadySigned = petition
                ? false // Would need to check signatures table; simplified for now
                : false;
              const progress = m.progress;

              return (
                <div
                  key={m.id}
                  className="rounded-xl p-5 border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-rose-900 bg-rose-100 border border-rose-200">
                        Recall
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.status === 'open' ? 'text-accent bg-accent-soft border-accent/20' : 'bg-muted text-muted-foreground'}`}
                      >
                        {m.status}
                      </span>
                      <span className="text-xs text-mute font-mono">
                        {m.jurisdiction.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <Link href={`/recall/${m.id}`} className="block">
                    <h3 className="font-heading font-bold text-ink mb-1 group-hover:text-violetcustom transition-colors">
                      {m.title}
                    </h3>
                    <p className="text-sm text-mute mb-3 line-clamp-2">{m.text}</p>
                  </Link>

                  <div className="flex items-center justify-between text-xs text-mute mb-3">
                    <span>Proposed by {m.proposerName}</span>
                    <span className="font-mono">{m.voteCount} votes</span>
                  </div>

                  {/* Petition Threshold Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-mute">
                        Petition Signatures
                      </span>
                      <span className="font-mono text-ink">
                        {petition ? petition.currentSignatures : 0} / {RECALL_THRESHOLD}
                      </span>
                    </div>
                    <div className="w-full bg-line rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${progress >= 100 ? 'bg-rose-500' : 'bg-accent'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-mute">
                      <span>
                        {progress >= 100
                          ? 'Threshold reached'
                          : RECALL_THRESHOLD -
                            (petition ? petition.currentSignatures : 0) +
                            ' more needed'}
                      </span>
                      <span>{petition?.thresholdReachedAt ? 'Threshold met' : 'Open'}</span>
                    </div>
                  </div>

                  {/* Petition Actions */}
                  <div className="flex gap-2">
                    {!hasPetition && canCreateMotion && (
                      <button
                        onClick={() => createPetition(m.id)}
                        disabled={creating}
                        className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                      >
                        {creating ? 'Creatingâ€¦' : 'Start Petition'}
                      </button>
                    )}
                    {hasPetition && !alreadySigned && (
                      <button
                        onClick={() => signPetition(m.id)}
                        disabled={signing.has(m.id)}
                        className="flex-1 px-4 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium hover:bg-rose-100 disabled:opacity-50 transition-colors"
                      >
                        {signing.has(m.id) ? 'Signingâ€¦' : 'Sign Petition'}
                      </button>
                    )}
                    {hasPetition && alreadySigned && (
                      <span className="flex-1 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                        Signed
                      </span>
                    )}
                    {hasPetition && progress >= 100 && (
                      <span className="flex-1 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
                        Ready for Vote
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
