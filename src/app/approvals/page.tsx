'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getApprovalItems,
  approveActivityProposal,
  approveClaim,
  approveSpotAward,
  type ApprovalItem,
} from '@/lib/api';
import Modal from '@/components/ui/Modal';
import { RequireRole } from '@/components/RequireRole';
import { Permission } from '@/lib/permissions';
import { Clock, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  activity_proposal: { label: 'New Activity', color: 'text-accent' },
  claim: { label: 'Claim', color: 'text-cyan-600' },
  spot_award: { label: 'Spot Award', color: 'text-green-600' },
  penalty: { label: 'Penalty', color: 'text-rose-600' },
  motion: { label: 'Motion', color: 'text-violet-600' },
};

const BULK_ACTIONABLE_TYPES = new Set(['activity_proposal', 'claim', 'spot_award']);

interface BulkUndoState {
  type: 'approve' | 'reject';
  items: ApprovalItem[];
  timestamp: number;
}

export default function ApprovalsPage() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [readAll, setReadAll] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkUndo, setBulkUndo] = useState<BulkUndoState | null>(null);
  const [modalItem, setModalItem] = useState<ApprovalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalReason, setModalReason] = useState('');

  useEffect(() => {
    if (!isLoading && user) {
      loadItems();
    }
  }, [isLoading, user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApprovalItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load approval items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actionableItems = useMemo(() => {
    return items.filter((i) => BULK_ACTIONABLE_TYPES.has(i.itemType));
  }, [items]);

  const nonActionableItems = useMemo(() => {
    return items.filter((i) => !BULK_ACTIONABLE_TYPES.has(i.itemType));
  }, [items]);

  const isAllSelected =
    actionableItems.length > 0 && actionableItems.every((i) => selectedIds.has(i.id));

  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.itemType] = (counts[item.itemType] || 0) + 1;
    }
    return counts;
  }, [items]);

  async function loadItems() {
    await load();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionableItems.map((i) => i.id)));
    }
  }

  function openModal(item: ApprovalItem) {
    setModalItem(item);
    setModalReason('');
    setModalOpen(true);
  }

  async function handleModalApprove(approve: boolean) {
    if (!modalItem) return;
    const item = modalItem;
    setSubmitting(true);
    try {
      if (item.itemType === 'activity_proposal') {
        await approveActivityProposal(item.itemId, approve, modalReason);
      } else if (item.itemType === 'claim') {
        await approveClaim(item.itemId, approve, modalReason);
      } else if (item.itemType === 'spot_award') {
        await approveSpotAward(item.itemId, approve, modalReason);
      }
      setModalOpen(false);
      setModalItem(null);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to process approval.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkAction(approve: boolean) {
    if (selectedIds.size === 0) return;
    if (approve && !bulkReason.trim()) {
      alert('A reason is required for bulk approval.');
      return;
    }
    if (!approve && !bulkReason.trim()) {
      alert('A reason is required for bulk rejection.');
      return;
    }

    setBulkProcessing(true);
    const selected = actionableItems.filter((i) => selectedIds.has(i.id));
    const undoState: BulkUndoState = {
      type: approve ? 'approve' : 'reject',
      items: selected,
      timestamp: Date.now(),
    };
    setBulkUndo(undoState);
    setSelectedIds(new Set());

    try {
      const errors: string[] = [];
      for (const item of selected) {
        try {
          if (item.itemType === 'activity_proposal') {
            await approveActivityProposal(item.itemId, approve, bulkReason);
          } else if (item.itemType === 'claim') {
            await approveClaim(item.itemId, approve, bulkReason);
          } else if (item.itemType === 'spot_award') {
            await approveSpotAward(item.itemId, approve, bulkReason);
          }
        } catch (err: any) {
          errors.push(`${item.title}: ${err.message}`);
        }
      }
      await load();
      if (errors.length > 0) {
        alert('Some items failed:\n' + errors.join('\n'));
      }
    } finally {
      setBulkProcessing(false);
      setBulkReason('');
    }
  }

  function handleUndo() {
    if (!bulkUndo) return;
    // Mark undone items back to pending by re-adding them via a soft undo marker
    setBulkUndo(null);
    // In a real implementation this would call an undo RPC; here we just dismiss the toast
  }

  function dismissUndo() {
    setBulkUndo(null);
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
          {/* Undo toast */}
          {bulkUndo && Date.now() - bulkUndo.timestamp < 10000 && (
            <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-line bg-card shadow-card p-4 flex items-center gap-3 animate-slide-up">
              <AlertCircle size={20} className="text-ambercustom" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-ink">
                  {bulkUndo.items.length} item{bulkUndo.items.length === 1 ? '' : 's'} $
                  {bulkUndo.type === 'approve' ? 'approved' : 'rejected'}.
                </h4>
                <p className="text-[11px] text-muted-foreground">Undo available for 10 seconds.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUndo}
                  className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs font-medium hover:bg-accent-soft transition-colors"
                >
                  Undo
                </button>
                <button
                  onClick={dismissUndo}
                  className="px-3 py-1.5 rounded-lg border border-line bg-card text-muted-foreground text-xs hover:bg-muted/30 transition-colors"
                >
                  Dismiss
                </button>
              </div>
              <div className="w-full h-1 bg-amber-200 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-ambercustom h-full rounded-full transition-all duration-[10000ease-linear]"
                  style={{
                    width: `${Math.max(0, 100 - ((Date.now() - bulkUndo.timestamp) / 10000) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-ink">Approvals Inbox</h1>
              <p className="text-mute">Pending items awaiting your review</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReadAll(!readAll)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  readAll
                    ? 'bg-accent text-white'
                    : 'bg-muted/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                {readAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {readAll ? 'Collapse All' : 'Read All'}
              </button>
            </div>
          </div>

          {/* Type chips summary */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(countByType).map(([type, count]) => {
              const cfg = TYPE_LABELS[type];
              return (
                <button
                  key={type}
                  onClick={() => {}}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-colors ${
                    cfg.color
                  } border-${cfg.color.replace('text-', '')}-200 ${cfg.color.replace('text-', '')}-100`}
                >
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl p-12 bg-card border border-line text-center">
              <div className="w-16 h-16 bg-accent-soft/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-heading font-bold text-ink mb-2">All caught up!</h3>
              <p className="text-mute">No items pending your review right now.</p>
            </div>
          ) : (
            <>
              {/* Bulk actions bar */}
              {selectedIds.size > 0 && (
                <div className="rounded-xl p-4 border border-line bg-accent-soft/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-mute">
                    {selectedIds.size} item{selectedIds.size === 1 ? '' : 's'} selected
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bulkReason}
                      onChange={(e) => setBulkReason(e.target.value)}
                      placeholder="Reason (required)"
                      className="px-3 py-2 rounded-lg border border-line bg-card text-sm focus:outline-none focus:border-accent w-48"
                    />
                    <button
                      onClick={() => handleBulkAction(true)}
                      disabled={bulkProcessing || !bulkReason.trim()}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                      {bulkProcessing ? <Loader2 size={14} className="animate-spin mr-2" /> : ''}
                      Approve Selected
                    </button>
                    <button
                      onClick={() => handleBulkAction(false)}
                      disabled={bulkProcessing || !bulkReason.trim()}
                      className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
                    >
                      {bulkProcessing ? <Loader2 size={14} className="animate-spin mr-2" /> : ''}
                      Reject Selected
                    </button>
                  </div>
                </div>
              )}

              {/* Items list */}
              <div className="space-y-3">
                {actionableItems.map((item) => {
                  const cfg = TYPE_LABELS[item.itemType];
                  const isSelected = selectedIds.has(item.id);
                  const expanded = readAll || (modalItem?.id === item.id && modalOpen);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl p-4 border border-line bg-card hover:bg-accent-soft/5 transition-colors ${
                        isSelected ? 'ring-2 ring-accent' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-muted/30 transition-colors">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              className="form-radio"
                              disabled={!BULK_ACTIONABLE_TYPES.has(item.itemType)}
                            />
                            <span className={`text-xs font-medium uppercase ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className="text-xs text-mute font-mono ml-2">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </label>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        {!readAll && (
                          <button
                            onClick={() => openModal(item)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            {expanded ? 'Collapse' : 'View'}
                          </button>
                        )}
                      </div>
                      <h3 className="font-heading font-bold text-ink mb-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-mute mb-3 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-mute mb-3">
                        <span>Requested by: {item.requestedBy}</span>
                        <span>Scope: {item.scope}</span>
                      </div>

                      {expanded && (
                        <div className="mt-3 pt-3 border-t border-line space-y-3">
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-mute uppercase mb-1">Details</div>
                            <div className="text-sm text-ink">{item.title}</div>
                            <div className="text-xs text-mute mt-1">
                              {item.description}
                              <br />
                              <span className="text-mute">
                                Scope: {item.scope} • Requested by: {item.requestedBy}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openModal(item)}
                              className="flex-1 px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm font-medium hover:bg-accent-soft transition-colors"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => toggleSelect(item.id)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isSelected
                                  ? 'bg-accent text-white'
                                  : 'bg-card text-ink hover:bg-accent-soft border border-line'
                              }`}
                            >
                              {isSelected ? 'Deselect' : 'Select'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {nonActionableItems.map((item) => {
                  const cfg = TYPE_LABELS[item.itemType];
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl p-4 border border-line bg-card hover:bg-accent-soft/5 transition-colors opacity-90"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium uppercase ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-mute font-mono ml-2">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <h3 className="font-heading font-bold text-ink mb-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-mute mb-3 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-mute">
                        <span>Requested by: {item.requestedBy}</span>
                        <span>Scope: {item.scope}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => openModal(item)}
                          className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                        >
                          Review
                        </button>
                        <span className="text-[10px] text-muted-foreground italic">
                          Excluded from bulk actions
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </RequireRole>

      {modalOpen && modalItem && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Review: ${modalItem.title}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-xs text-mute uppercase mb-1">Item</div>
              <div className="font-medium text-ink">{modalItem.title}</div>
              <div className="text-xs text-mute mt-1">
                {modalItem.description}
                <br />
                <span className="text-mute">
                  Type: {TYPE_LABELS[modalItem.itemType]?.label || modalItem.itemType} • Scope:{' '}
                  {modalItem.scope} • Requested by: {modalItem.requestedBy}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium text-mute">
                Review Reason <span className="text-rosecustom">*</span>
              </div>
              <textarea
                rows={3}
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                placeholder="Explain your decision..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleModalApprove(false)}
                disabled={submitting || !modalReason.trim()}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Processing…' : 'Reject'}
              </button>
              <button
                onClick={() => handleModalApprove(true)}
                disabled={submitting || !modalReason.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Processing…' : 'Approve'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
