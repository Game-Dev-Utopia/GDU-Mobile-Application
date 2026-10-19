'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { RequireRole } from '@/components/RequireRole';
import { Permission } from '@/lib/permissions';
import {
  getCashReleases,
  prepareCashRelease,
  approveCashRelease,
  releaseCash,
  type CashRelease,
} from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  prepared: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  released: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function CashPage() {
  const { user, isLoading } = useAuth();
  const [releases, setReleases] = useState<CashRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [prepareModal, setPrepareModal] = useState(false);
  const [actionModal, setActionModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<CashRelease | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [prepareForm, setPrepareForm] = useState({
    recipientId: '',
    amountCents: '',
    currency: 'INR',
    purpose: '',
    justification: '',
    ledgerEntryIds: '',
    authority: '',
  });

  useEffect(() => {
    if (!isLoading && user) {
      loadReleases();
    }
  }, [isLoading, user]);

  async function loadReleases() {
    setLoading(true);
    const data = await getCashReleases();
    setReleases(data);
    setLoading(false);
  }

  function openPrepareModal() {
    setPrepareModal(true);
  }

  async function handlePrepare(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ledgerEntryIds = prepareForm.ledgerEntryIds
        ? prepareForm.ledgerEntryIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      await prepareCashRelease({
        recipientId: prepareForm.recipientId,
        amountCents: parseInt(prepareForm.amountCents, 10) || 0,
        currency: prepareForm.currency,
        purpose: prepareForm.purpose,
        justification: prepareForm.justification,
        ledgerEntryIds,
        authority: prepareForm.authority,
      });
      setPrepareModal(false);
      setPrepareForm({
        recipientId: '',
        amountCents: '',
        currency: 'INR',
        purpose: '',
        justification: '',
        ledgerEntryIds: '',
        authority: '',
      });
      loadReleases();
    } catch (err: any) {
      alert(err.message || 'Failed to prepare cash release.');
    } finally {
      setSubmitting(false);
    }
  }

  function openAction(release: CashRelease) {
    setSelectedRelease(release);
    setActionModal(true);
  }

  async function handleAction(approve: boolean) {
    if (!selectedRelease) return;
    setSubmitting(true);
    try {
      if (selectedRelease.status === 'prepared') {
        await approveCashRelease(selectedRelease.id, approve);
      } else if (selectedRelease.status === 'approved') {
        await releaseCash(selectedRelease.id);
      }
      setActionModal(false);
      setSelectedRelease(null);
      loadReleases();
    } catch (err: any) {
      alert(err.message || 'Failed to process cash release.');
    } finally {
      setSubmitting(false);
    }
  }

  const canPrepare = user
    ? (user.roles as string[]).includes('board_member') ||
      (user.roles as string[]).includes('admin') ||
      (user.roles as string[]).includes('finance_compliance_officer')
    : false;
  const canApprove = user
    ? (user.roles as string[]).includes('board_member') ||
      (user.roles as string[]).includes('admin')
    : false;

  if (loading || !user) {
    return (
      <AppLayout activePath="/cash">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const myReleases = releases.filter((r) => r.preparedBy === user.id);
  const pendingApproval = releases.filter((r) => r.status === 'prepared');
  const pendingRelease = releases.filter((r) => r.status === 'approved');

  return (
    <AppLayout activePath="/cash">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Cash Release Console</h1>
            <p className="text-mute">Maker-checker cash flow for fund disbursements</p>
          </div>
          {canPrepare && (
            <button
              onClick={openPrepareModal}
              className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Prepare Cash Release
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="text-xs font-semibold text-mute uppercase">Total Releases</div>
            <div className="text-2xl font-bold text-ink">{releases.length}</div>
          </div>
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="text-xs font-semibold text-mute uppercase">Pending Approval</div>
            <div className="text-2xl font-bold text-ink">{pendingApproval.length}</div>
          </div>
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="text-xs font-semibold text-mute uppercase">Pending Release</div>
            <div className="text-2xl font-bold text-ink">{pendingRelease.length}</div>
          </div>
        </div>

        {/* Cash Releases Table */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <h2 className="font-heading font-bold text-ink mb-4">Cash Releases</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">ID</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Recipient</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase text-right">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Purpose</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-mute uppercase text-right">
                    Prepared
                  </th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-line hover:bg-accent-soft/5 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-mono text-ink">#{r.id.slice(-6)}</td>
                    <td className="px-6 py-4 text-sm text-ink">{r.recipientName}</td>
                    <td className="px-6 py-4 text-sm font-mono text-right text-ink">
                      {(r.amountCents / 100).toLocaleString()} {r.currency}
                    </td>
                    <td className="px-6 py-4 text-sm text-mute">{r.purpose}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}
                      >
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-mute text-right">
                      {new Date(r.preparedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {canApprove && r.status === 'prepared' && r.preparedBy !== user.id && (
                        <button
                          onClick={() => openAction(r)}
                          className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-ink hover:bg-accent-soft transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {r.status === 'approved' && r.approvedBy !== user.id && (
                        <button
                          onClick={() => openAction(r)}
                          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700 transition-colors"
                        >
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {releases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-mute">
                      No cash releases yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* My Releases */}
        {myReleases.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <h2 className="font-heading font-bold text-ink mb-4">My Prepared Releases</h2>
            <div className="space-y-3">
              {myReleases.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent-soft/5 border border-accent/20"
                >
                  <div>
                    <div className="text-sm font-medium text-ink">{r.purpose}</div>
                    <div className="text-xs text-mute">
                      {(r.amountCents / 100).toLocaleString()} {r.currency} to {r.recipientName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-ink">{r.status}</div>
                    <div className="text-xs text-mute">
                      {new Date(r.preparedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prepare Cash Release Modal */}
        {prepareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setPrepareModal(false)}
            />
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
              <h2 className="font-heading font-bold text-ink mb-2">Prepare Cash Release</h2>
              <form onSubmit={handlePrepare} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Recipient Member ID
                  </label>
                  <input
                    type="text"
                    value={prepareForm.recipientId}
                    onChange={(e) =>
                      setPrepareForm({ ...prepareForm, recipientId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="Member UUID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Amount</label>
                  <input
                    type="number"
                    value={prepareForm.amountCents}
                    onChange={(e) =>
                      setPrepareForm({ ...prepareForm, amountCents: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="Amount in cents"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Currency</label>
                  <select
                    value={prepareForm.currency}
                    onChange={(e) => setPrepareForm({ ...prepareForm, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Purpose</label>
                  <input
                    type="text"
                    value={prepareForm.purpose}
                    onChange={(e) => setPrepareForm({ ...prepareForm, purpose: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="e.g. Honorarium, Reimbursement"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Justification</label>
                  <textarea
                    rows={3}
                    value={prepareForm.justification}
                    onChange={(e) =>
                      setPrepareForm({ ...prepareForm, justification: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Ledger Entry IDs (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={prepareForm.ledgerEntryIds}
                    onChange={(e) =>
                      setPrepareForm({ ...prepareForm, ledgerEntryIds: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="uuid1, uuid2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Authority</label>
                  <input
                    type="text"
                    value={prepareForm.authority}
                    onChange={(e) => setPrepareForm({ ...prepareForm, authority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="Board motion ID or config reference"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPrepareModal(false)}
                    className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    disabled={submitting}
                  >
                    {submitting ? 'Preparing...' : 'Prepare Release'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Approve / Release Modal */}
        {actionModal && selectedRelease && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setActionModal(false);
                setSelectedRelease(null);
              }}
            />
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
              <h2 className="font-heading font-bold text-ink mb-2">
                {selectedRelease.status === 'prepared' ? 'Approve Cash Release' : 'Release Cash'}
              </h2>
              <p className="text-mute text-sm mb-4">
                Release #{selectedRelease.id.slice(-6)} to {selectedRelease.recipientName}
                <br />
                <span className="font-mono text-ink">
                  {(selectedRelease.amountCents / 100).toLocaleString()} {selectedRelease.currency}
                </span>
              </p>
              <div className="bg-muted/50 p-3 rounded-lg mb-4">
                <p className="text-sm text-mute mb-1">{selectedRelease.purpose}</p>
                {selectedRelease.justification && (
                  <p className="text-xs text-mute">{selectedRelease.justification}</p>
                )}
              </div>
              {selectedRelease.status === 'prepared' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAction((e.target as any).approve.value === 'true');
                  }}
                >
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-mute mb-1">Decision</label>
                    <select
                      name="approve"
                      className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    >
                      <option value="true">Approve</option>
                      <option value="false">Reject</option>
                    </select>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setActionModal(false);
                        setSelectedRelease(null);
                      }}
                      className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedRelease.status === 'prepared'
                          ? 'bg-accent text-white hover:bg-accent/90 disabled:opacity-50'
                          : 'bg-card border border-line text-muted-foreground'
                      }`}
                      disabled={submitting}
                    >
                      {submitting
                        ? 'Processing...'
                        : selectedRelease.status === 'prepared'
                          ? 'Approve Release'
                          : 'Release Cash'}
                    </button>
                  </div>
                </form>
              )}
              {selectedRelease.status === 'approved' && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      setActionModal(false);
                      setSelectedRelease(null);
                    }}
                    className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleAction(false);
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50`}
                    disabled={submitting}
                  >
                    {submitting ? 'Releasing...' : 'Release Cash'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
