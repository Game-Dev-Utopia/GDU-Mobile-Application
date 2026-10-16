'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Activity } from '@/lib/api';
import { submitClaim } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import { ActivityStatusBadge, DomainBadge } from '@/components/ui/StatusBadge';
import { Clock, Users, Star, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
}

interface ClaimFormData {
  proofUrl: string;
  notes: string;
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={`mstar-${i}`}
          size={12}
          className={i < level ? 'text-ambercustom fill-ambercustom' : 'text-muted-foreground'}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">Difficulty {level}/5</span>
    </div>
  );
}

export default function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClaimFormData>();

  function handleClose() {
    reset();
    setSubmitted(false);
    setSubmitError('');
    onClose();
  }

  async function onSubmit(data: ClaimFormData) {
    if (!activity) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // TODO: POST /api/claims — see lib/api.ts submitClaim
      await submitClaim({ activityId: activity.id, proofUrl: data.proofUrl, notes: data.notes });
      setSubmitted(true);
      reset();
    } catch {
      setSubmitError('Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!activity) return null;

  const daysLeft = Math.floor(
    (new Date(activity.deadline).getTime() - Date.now()) / 86_400_000
  );
  const canClaim = activity.status === 'open' || activity.status === 'upcoming';

  return (
    <Modal open={!!activity} onClose={handleClose} title={activity.title} size="lg">
      <div className="space-y-5">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <DomainBadge domain={activity.domain} />
          <ActivityStatusBadge status={activity.status} />
          {activity.branch !== 'all' && (
            <span className="badge-muted text-[11px] px-2 py-0.5">📍 {activity.branch}</span>
          )}
        </div>

        {/* XP reward hero */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-lime-900/10 border border-xplime/20">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">XP Reward</p>
            <p className="text-3xl font-heading font-bold text-xp-lime">+{activity.xpReward}</p>
          </div>
          {activity.bonusXP && (
            <div className="border-l border-border pl-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">Bonus</p>
              <p className="text-xl font-heading font-bold text-ambercustom">+{activity.bonusXP}</p>
            </div>
          )}
          <div className="border-l border-border pl-4 ml-auto">
            <DifficultyStars level={activity.difficulty} />
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <Users size={12} />
              <span>{activity.claimedCount}{activity.maxClaims ? `/${activity.maxClaims}` : ''} claimed</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5">Description</h4>
          <p className="text-sm text-foreground leading-relaxed">{activity.description}</p>
        </div>

        {/* Requirements */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Requirements</h4>
          <ul className="space-y-1.5">
            {activity.requirements.map((req, i) => (
              <li key={`req-${activity.id}-${i}`} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle size={14} className="text-xp-lime flex-shrink-0 mt-0.5" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        {/* Submission format */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
          <ExternalLink size={14} className="text-cyancustom flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">Submission Format</p>
            <p className="text-sm text-foreground">{activity.submissionFormat}</p>
          </div>
        </div>

        {/* Deadline */}
        <div className="flex items-center gap-2 text-sm">
          <Clock size={14} className={daysLeft <= 3 ? 'text-ambercustom' : 'text-muted-foreground'} />
          <span className="text-muted-foreground">Deadline:</span>
          <span className={`font-medium ${daysLeft <= 3 ? 'text-ambercustom' : 'text-foreground'}`}>
              {new Date(activity.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {daysLeft >= 0 && ` (${daysLeft}d left)`}
            </span>
          </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {activity.tags.map((tag) => (
            <span
              key={`modal-tag-${activity.id}-${tag}`}
              className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Claim form */}
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-lime-900/20 border border-xplime/30 flex items-center justify-center mb-3">
              <CheckCircle size={28} className="text-xp-lime" />
            </div>
            <h3 className="text-base font-heading font-semibold text-foreground mb-1">
              Claim Submitted!
            </h3>
            <p className="text-sm text-muted-foreground">
              Your claim for <span className="text-foreground font-medium">+{activity.xpReward} XP</span> is now under review.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll be notified once a reviewer approves or requests changes.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-5 py-2 rounded-xl bg-primary/20 border border-primary/40 text-violetcustom text-sm font-medium hover:bg-primary/30 transition-colors duration-150"
            >
              Back to Activities
            </button>
          </div>
        ) : canClaim ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-5">
            <h4 className="text-sm font-heading font-semibold text-foreground">Submit Your Claim</h4>

            {/* Proof URL */}
            <div>
              <label htmlFor="proofUrl" className="block text-xs font-medium text-muted-foreground mb-1">
                Proof Link <span className="text-rosecustom">*</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                {activity.submissionFormat} — must be publicly accessible
              </p>
              <input
                id="proofUrl"
                type="url"
                placeholder="https://github.com/yourname/project"
                {...register('proofUrl', {
                  required: 'Proof link is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Must be a valid URL starting with http:// or https://',
                  },
                })}
                className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
              />
              {errors.proofUrl && (
                <p className="text-xs text-rosecustom mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.proofUrl.message}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="claimNotes" className="block text-xs font-medium text-muted-foreground mb-1">
                Notes for Reviewer
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Describe what you did, any challenges faced, or extra context for the reviewer.
              </p>
              <textarea
                id="claimNotes"
                rows={3}
                placeholder="I implemented a BSP tree algorithm for room generation and used Dijkstra's for corridors..."
                {...register('notes', {
                  maxLength: { value: 1000, message: 'Notes must be under 1000 characters' },
                })}
                className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150 resize-none"
              />
              {errors.notes && (
                <p className="text-xs text-rosecustom mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.notes.message}
                </p>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-900/10 border border-rosecustom/30 text-rosecustom text-sm">
                <AlertCircle size={14} />
                {submitError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted/30 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>Submit Claim · +{activity.xpReward} XP</>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border text-muted-foreground text-sm">
              <AlertCircle size={14} />
              This activity is {activity.status === 'closed' ? 'closed and no longer accepting claims' : 'not yet open for claims'}.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}