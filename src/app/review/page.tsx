'use client';

import React, { useEffect, useState } from 'react';
import { getReviewQueue, reviewClaim, finalizeClaim } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/ui/Modal';
import AppIcon from '@/components/ui/AppIcon';

export default function ReviewPage() {
  const { user, isLoading } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      loadQueue();
    }
  }, [isLoading, user]);

  async function loadQueue() {
    setLoading(true);
    const data = await getReviewQueue();
    setQueue(data);
    setLoading(false);
  }

  function openReview(claim: any) {
    setSelectedClaim(claim);
    setReviewModal(true);
  }

  async function handleReview(score: number, reason: string) {
    if (!selectedClaim) return;
    setSubmitting(true);
    try {
      await reviewClaim(selectedClaim.id, score, reason);
      await finalizeClaim(selectedClaim.id);
      setReviewModal(false);
      setSelectedClaim(null);
      loadQueue();
    } catch (err) {
      console.error('Review failed:', err);
      alert('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/review">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/review">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Review Queue</h1>
            <p className="text-mute">Claims pending your review as a domain head</p>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <div className="w-16 h-16 bg-accent-soft/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AppIcon name="CheckCircleIcon" size={32} className="text-accent" />
            </div>
            <h3 className="font-heading font-bold text-ink mb-2">All caught up!</h3>
            <p className="text-mute">No claims waiting for your review right now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-line rounded-xl bg-card">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Claim</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Member</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Suggested EXP</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Submitted</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((claim) => (
                  <tr key={claim.id} className="border-b border-line/50 hover:bg-accent-soft/5 transition-colors">
                    <td className="px-6 py-4 text-sm text-ink">{claim.activityTitle}</td>
                    <td className="px-6 py-4 text-sm text-mute">{claim.reviewerName || 'Anonymous'}</td>
                    <td className="px-6 py-4 text-sm font-mono text-ink">{claim.xpReward}</td>
                    <td className="px-6 py-4 text-sm font-mono text-mute">
                      {new Date(claim.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openReview(claim)}
                        className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                        disabled={submitting}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal
          open={reviewModal}
          onClose={() => setReviewModal(false)}
          title="Review Claim"
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-xs text-mute uppercase mb-1">Activity</div>
              <div className="font-medium text-ink">{selectedClaim?.activityTitle}</div>
              <div className="text-xs text-mute mt-1">{selectedClaim?.notes}</div>
              <div className="mt-2 text-xs text-mute">
                Suggested EXP: <span className="font-mono text-ink">{selectedClaim?.xpReward}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-mute">Your Score</div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={150}
                  className="w-24 px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                />
                <span className="text-sm text-mute">EXP points</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-mute mb-1">Review Reason</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                placeholder="Explain your scoring decision..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setReviewModal(false)}
                className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview(100, 'Approved')}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Approve & Finalize'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
