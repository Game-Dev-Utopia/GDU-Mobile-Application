'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { RequireRole } from '@/components/RequireRole';
import { Permission } from '@/lib/permissions';
import {
  getConductCases,
  fileConductCase,
  respondToConductCase,
  panelReviewConductCase,
  boardRatifyConductCase,
  type ConductCase,
} from '@/lib/api';

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'text-amber-700 bg-amber-50 border-amber-200',
  moderate: 'text-orange-700 bg-orange-50 border-orange-200',
  severe: 'text-rose-700 bg-rose-50 border-rose-200',
};

const STATUS_COLORS: Record<string, string> = {
  notice: 'bg-blue-50 text-blue-700 border-blue-200',
  response: 'bg-amber-50 text-amber-700 border-amber-200',
  panel_review: 'bg-purple-50 text-purple-700 border-purple-200',
  decision: 'bg-rose-50 text-rose-700 border-rose-200',
  board_ratification: 'bg-rose-100 text-rose-900 border-rose-200',
  appeal: 'bg-violet-50 text-violet-700 border-violet-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
};

export default function ConductPanelPage() {
  const { user, isLoading } = useAuth();
  const [cases, setCases] = useState<ConductCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filingModal, setFilingModal] = useState(false);
  const [respondModal, setRespondModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ConductCase | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fileForm, setFileForm] = useState({
    memberId: '',
    reasonCode: '',
    severity: 'minor' as const,
    description: '',
    evidenceLinks: '',
  });

  useEffect(() => {
    if (!isLoading && user) {
      loadCases();
    }
  }, [isLoading, user]);

  async function loadCases() {
    setLoading(true);
    const data = await getConductCases();
    setCases(data);
    setLoading(false);
  }

  function openFileModal() {
    setFilingModal(true);
  }

  async function handleFileCase(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fileConductCase({
        memberId: fileForm.memberId,
        reasonCode: fileForm.reasonCode,
        severity: fileForm.severity,
        description: fileForm.description,
        evidenceLinks: fileForm.evidenceLinks
          ? fileForm.evidenceLinks
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      });
      setFilingModal(false);
      setFileForm({
        memberId: '',
        reasonCode: '',
        severity: 'minor',
        description: '',
        evidenceLinks: '',
      });
      loadCases();
    } catch (err: any) {
      alert(err.message || 'Failed to file conduct case.');
    } finally {
      setSubmitting(false);
    }
  }

  function openRespond(caseItem: ConductCase) {
    setSelectedCase(caseItem);
    setRespondModal(true);
  }

  async function handleRespond(responseText: string) {
    if (!selectedCase) return;
    setSubmitting(true);
    try {
      await respondToConductCase(selectedCase.id, responseText);
      setRespondModal(false);
      setSelectedCase(null);
      loadCases();
    } catch (err: any) {
      alert(err.message || 'Failed to respond.');
    } finally {
      setSubmitting(false);
    }
  }

  function openReview(caseItem: ConductCase) {
    setSelectedCase(caseItem);
    setReviewModal(true);
  }

  async function handleReview(decision: string, reason: string) {
    if (!selectedCase) return;
    setSubmitting(true);
    try {
      if (selectedCase.status === 'response') {
        await panelReviewConductCase(selectedCase.id, decision, reason);
      } else if (selectedCase.status === 'panel_review') {
        await boardRatifyConductCase(selectedCase.id, decision === 'ratify', reason);
      }
      setReviewModal(false);
      setSelectedCase(null);
      loadCases();
    } catch (err: any) {
      alert(err.message || 'Failed to process review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/conduct-panel">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const canFile =
    user.role === 'team_lead' ||
    user.role === 'domain_head' ||
    user.role === 'council_member' ||
    user.role === 'board' ||
    user.role === 'admin' ||
    user.role === 'conduct_panel_member';
  const canPanelReview =
    user.role === 'board' || user.role === 'admin' || user.role === 'conduct_panel_member';

  return (
    <AppLayout activePath="/conduct-panel">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Conduct Panel</h1>
            <p className="text-mute">Conduct cases, penalties, and due process</p>
          </div>
          {canFile && (
            <button
              onClick={openFileModal}
              className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              File Conduct Case
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-line rounded-xl bg-card">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-accent-soft">
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Case</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Member</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Severity</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-mute uppercase text-right">
                  Filed
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line hover:bg-accent-soft/5 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-mono text-ink">#{c.id.slice(-6)}</td>
                  <td className="px-6 py-4 text-sm text-ink">{c.memberName}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${SEVERITY_COLORS[c.severity]}`}
                    >
                      {c.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}
                    >
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-mute text-right">
                    {new Date(c.filedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-mute">
                    No conduct cases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Action cards based on role */}
        <div className="grid gap-4 md:grid-cols-3">
          {canPanelReview && (
            <div className="rounded-xl p-6 bg-card border border-line">
              <h3 className="font-heading font-bold text-ink mb-3">Panel Review</h3>
              <p className="text-xs text-mute mb-4">Review cases in response stage.</p>
              {cases
                .filter((c) => c.status === 'response')
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openReview(c)}
                    className="w-full py-2 rounded-lg border border-line bg-card text-ink text-sm hover:bg-accent-soft transition-colors"
                  >
                    Review: #{c.id.slice(-6)} - {c.memberName}
                  </button>
                ))}
              {cases.filter((c) => c.status === 'response').length === 0 && (
                <p className="text-xs text-mute text-center">No cases pending panel review.</p>
              )}
            </div>
          )}
          {user.role === 'board' ||
            (user.role === 'admin' && (
              <div className="rounded-xl p-6 bg-card border border-line">
                <h3 className="font-heading font-bold text-ink mb-3">Board Ratification</h3>
                <p className="text-xs text-mute mb-4">Ratify panel decisions.</p>
                {cases
                  .filter((c) => c.status === 'panel_review')
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openReview(c)}
                      className="w-full py-2 rounded-lg border border-line bg-card text-ink text-sm hover:bg-accent-soft transition-colors"
                    >
                      Ratify: #{c.id.slice(-6)} - {c.memberName}
                    </button>
                  ))}
                {cases.filter((c) => c.status === 'panel_review').length === 0 && (
                  <p className="text-xs text-mute text-center">
                    No cases pending board ratification.
                  </p>
                )}
              </div>
            ))}
        </div>

        {/* File Conduct Case Modal */}
        {filingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setFilingModal(false)}
            />
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
              <h2 className="font-heading font-bold text-ink mb-2">File Conduct Case</h2>
              <form onSubmit={handleFileCase} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Member ID</label>
                  <input
                    type="text"
                    value={fileForm.memberId}
                    onChange={(e) => setFileForm({ ...fileForm, memberId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="Member UUID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Reason Code</label>
                  <input
                    type="text"
                    value={fileForm.reasonCode}
                    onChange={(e) => setFileForm({ ...fileForm, reasonCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="e.g. harassment, data_leak"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Severity</label>
                  <select
                    value={fileForm.severity}
                    onChange={(e) => setFileForm({ ...fileForm, severity: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                  >
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={fileForm.description}
                    onChange={(e) => setFileForm({ ...fileForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Evidence Links (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={fileForm.evidenceLinks}
                    onChange={(e) => setFileForm({ ...fileForm, evidenceLinks: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    placeholder="https://evidence1.com, https://evidence2.com"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFilingModal(false)}
                    className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    disabled={submitting}
                  >
                    {submitting ? 'Filing...' : 'File Case'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Respond / Review Modal */}
        {(respondModal || reviewModal) && selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setRespondModal(false);
                setReviewModal(false);
              }}
            />
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
              <h2 className="font-heading font-bold text-ink mb-2">
                {respondModal ? 'Respond to Case' : 'Panel Review'}
              </h2>
              <p className="text-mute text-sm mb-4">
                Case #{selectedCase.id.slice(-6)} - {selectedCase.memberName}
                <br />
                <span className={`text-xs ${SEVERITY_COLORS[selectedCase.severity]}`}>
                  {selectedCase.severity}
                </span>
              </p>
              <div className="bg-muted/50 p-3 rounded-lg mb-4">
                <p className="text-sm text-mute mb-1">{selectedCase.description}</p>
                {selectedCase.evidenceLinks.length > 0 && (
                  <div className="text-xs text-mute">
                    Evidence: {selectedCase.evidenceLinks.join(', ')}
                  </div>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (respondModal) {
                    handleRespond((e.target as any).responseText.value);
                  } else {
                    handleReview((e.target as any).decision.value, (e.target as any).reason.value);
                  }
                }}
              >
                {respondModal ? (
                  <div>
                    <label className="block text-xs font-medium text-mute mb-1">
                      Your Response
                    </label>
                    <textarea
                      name="responseText"
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-mute mb-1">Decision</label>
                      <select
                        name="decision"
                        className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                      >
                        <option value="escalate">Escalate to Board</option>
                        <option value="dismiss">Dismiss Case</option>
                        <option value="probation">Probation</option>
                        <option value="penalty">Apply Penalty</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-mute mb-1">Reason</label>
                      <textarea
                        name="reason"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setRespondModal(false);
                      setReviewModal(false);
                      setSelectedCase(null);
                    }}
                    className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    disabled={submitting}
                  >
                    {submitting
                      ? 'Processing...'
                      : respondModal
                        ? 'Submit Response'
                        : 'Submit Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
