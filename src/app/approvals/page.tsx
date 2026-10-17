'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { getApprovalItems, approveActivityProposal, type ApprovalItem } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import { RequireRole } from '@/components/RequireRole';
import { Permission } from '@/lib/permissions';

export default function ApprovalsPage() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [approveModal, setApproveModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      loadItems();
    }
  }, [isLoading, user]);

  async function loadItems() {
    setLoading(true);
    const data = await getApprovalItems();
    setItems(data);
    setLoading(false);
  }

  function openApprove(item: ApprovalItem) {
    setSelectedItem(item);
    setApproveModal(true);
  }

  async function handleApprove(approve: boolean, reason: string) {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      if (selectedItem.itemType === 'activity_proposal') {
        await approveActivityProposal(selectedItem.itemId, approve, reason);
      }
      setApproveModal(false);
      setSelectedItem(null);
      loadItems();
    } catch (err: any) {
      alert(err.message || 'Failed to process approval.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/approvals">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/approvals">
      <RequireRole permission="claim.review" targetScope="domain">
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-ink">Approvals Inbox</h1>
              <p className="text-mute">Pending items awaiting your review</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl p-12 bg-card border border-line text-center">
              <div className="w-16 h-16 bg-accent-soft/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-heading font-bold text-ink mb-2">All caught up!</h3>
              <p className="text-mute">No items pending your review right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl p-5 border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium uppercase ${
                        item.itemType === 'activity_proposal'
                          ? 'text-accent'
                          : item.itemType === 'claim'
                            ? 'text-cyan-600'
                            : item.itemType === 'spot_award'
                              ? 'text-green-600'
                              : item.itemType === 'penalty'
                                ? 'text-rose-600'
                                : 'text-mute'
                      }`}>
                        {item.itemType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-mute font-mono">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      item.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-ink mb-1">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-mute mb-3">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-mute">
                    <span>Requested by: {item.requestedBy}</span>
                    <span>Scope: {item.scope}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openApprove(item)}
                      className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openApprove(item)}
                      className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </RequireRole>

      <Modal
        open={approveModal}
        onClose={() => setApproveModal(false)}
        title={`Review: ${selectedItem?.title}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-xs text-mute uppercase mb-1">Item</div>
            <div className="font-medium text-ink">{selectedItem?.title}</div>
            <div className="text-xs text-mute mt-1">
              {selectedItem?.description}
              <br />
              <span className="text-mute">Scope: {selectedItem?.scope} • Requested by: {selectedItem?.requestedBy}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-medium text-mute">Review Reason</div>
            <textarea
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
              placeholder="Explain your decision..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setApproveModal(false)}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleApprove(false, '')}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
              disabled={submitting}
            >
              {submitting ? 'Processing…' : 'Reject'}
            </button>
            <button
              onClick={() => handleApprove(true, '')}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
              disabled={submitting}
            >
              {submitting ? 'Processing…' : 'Approve'}
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
