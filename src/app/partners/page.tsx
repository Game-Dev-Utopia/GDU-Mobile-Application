'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getPartnerScorecards,
  getPartners,
  createPartner,
  upsertPartnerScorecard,
  type Partner,
  type PartnerScorecard,
  type PartnerTier,
} from '@/lib/api';
import { Shield, Clock, Plus, AlertCircle, Loader2 } from 'lucide-react';

type Tab = 'directory' | 'scorecard';

const TIER_LABEL: Record<string, string> = {
  friend: 'Friend',
  partner: 'Partner',
  strategic: 'Strategic',
};

const TIER_COLOR: Record<string, string> = {
  friend: 'text-slate-600 bg-slate-100 border-slate-200',
  partner: 'text-blue-600 bg-blue-100 border-blue-200',
  strategic: 'text-purple-600 bg-purple-100 border-purple-200',
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-600',
  prospect: 'bg-amber-100 text-amber-700',
};

export default function PartnersPage() {
  const { user, isLoading } = useAuth();
  const roles = user?.roles || [];
  const isAdmin = roles.includes('board_member') || roles.includes('admin');

  const [tab, setTab] = useState<Tab>('directory');
  const [error, setError] = useState<string | null>(null);

  // Directory state
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<PartnerTier>('partner');
  const [newWebsite, setNewWebsite] = useState('');
  const [creating, setCreating] = useState(false);

  // Scorecard state
  const [scorecards, setScorecards] = useState<PartnerScorecard[]>([]);
  const [editScorecard, setEditScorecard] = useState<{
    partnerId: string;
    collaborations: number;
    jamsCohosted: number;
    projectsDelivered: number;
    memberFeedbackScore: number;
    feedbackCount: number;
  } | null>(null);
  const [savingScorecard, setSavingScorecard] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadPartners(), loadScorecards()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partners.');
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      loadAll();
    }
  }, [isLoading, user, loadAll]);

  async function loadPartners() {
    const data = await getPartners();
    setPartners(data);
  }

  async function loadScorecards() {
    const data = await getPartnerScorecards();
    setScorecards(data);
  }

  async function handleCreatePartner(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setError('Partner name is required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createPartner({ name: newName.trim(), tier: newTier, website: newWebsite || null });
      setNewName('');
      setNewWebsite('');
      await loadPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveScorecard(e: React.FormEvent) {
    e.preventDefault();
    if (!editScorecard) return;
    setSavingScorecard(true);
    setError(null);
    try {
      await upsertPartnerScorecard({
        partnerId: editScorecard.partnerId,
        collaborations: editScorecard.collaborations,
        jamsCohosted: editScorecard.jamsCohosted,
        projectsDelivered: editScorecard.projectsDelivered,
        memberFeedbackScore: editScorecard.memberFeedbackScore,
        feedbackCount: editScorecard.feedbackCount,
        periodStart: new Date().toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0],
      });
      setEditScorecard(null);
      await loadScorecards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scorecard.');
    } finally {
      setSavingScorecard(false);
    }
  }

  const tierBadge = (tier: string) => (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${TIER_COLOR[tier] || TIER_COLOR.friend}`}
    >
      {TIER_LABEL[tier] || tier}
    </span>
  );

  const statusBadge = (status: string) => (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLOR[status] || ''}`}>
      {status}
    </span>
  );

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/partners">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/partners">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Partners</h1>
            <p className="text-mute">Partner organizations, tiers, and the partner scorecard.</p>
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-line">
          {(['directory', 'scorecard'] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  active
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-transparent text-muted-foreground hover:bg-accent-soft/50'
                }`}
              >
                {t === 'directory' ? <Shield size={16} /> : <Clock size={16} />}
                <span>{t === 'directory' ? 'Directory' : 'Scorecard'}</span>
              </button>
            );
          })}
        </div>

        {/* DIRECTORY TAB */}
        {tab === 'directory' && (
          <div className="rounded-xl p-6 bg-card border border-line space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-ink">Partner Directory</h2>
                <p className="text-xs text-mute">Organizations partnered with GDU, by tier.</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {}}
                  className="px-3 py-2 rounded-lg border border-line bg-card text-sm text-ink hover:bg-accent-soft"
                >
                  <Plus size={14} /> Add Partner
                </button>
              )}
            </div>

            {isAdmin && (
              <form
                onSubmit={handleCreatePartner}
                className="grid gap-3 sm:grid-cols-4 items-end border rounded-lg p-4 bg-accent-soft/30 mb-4"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-mute">Name</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Partner name"
                    className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-mute">Tier</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as PartnerTier)}
                    className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  >
                    <option value="friend">Friend</option>
                    <option value="partner">Partner</option>
                    <option value="strategic">Strategic</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-mute">Website</label>
                  <input
                    value={newWebsite}
                    onChange={(e) => setNewWebsite(e.target.value)}
                    placeholder="https://example.org"
                    className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-accent text-white font-sm font-medium disabled:opacity-50 hover:bg-accent/90"
                >
                  {creating ? 'Adding…' : 'Add'}
                </button>
              </form>
            )}

            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line bg-accent-soft">
                    <th className="px-4 py-3 font-semibold text-mute">Name</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Tier</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-mute">Website</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Joined</th>
                    <th className="px-4 py-3 font-semibold text-mute text-right">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-mute">
                        No partners yet.
                      </td>
                    </tr>
                  ) : (
                    partners.map((p) => (
                      <tr key={p.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                        <td className="px-4 py-3 text-sm text-ink">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-center">{tierBadge(p.tier)}</td>
                        <td className="px-4 py-3 text-sm text-center">{statusBadge(p.status)}</td>
                        <td className="px-4 py-3 text-sm text-mute">{p.website || '—'}</td>
                        <td className="px-4 py-3 text-sm text-mute text-center">
                          {p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {p.contactName || p.contactEmail || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCORECARD TAB */}
        {tab === 'scorecard' && (
          <div className="rounded-xl p-6 bg-card border border-line space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-ink">Partner Scorecard</h2>
                <p className="text-xs text-mute">
                  Collaborations, jams co-hosted, projects delivered, and member feedback.
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {}}
                  className="px-3 py-2 rounded-lg border border-line bg-card text-sm text-ink hover:bg-accent-soft"
                >
                  <Plus size={14} /> Add Scorecard
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line bg-accent-soft">
                    <th className="px-4 py-3 font-semibold text-mute">Partner</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">
                      Collaborations
                    </th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Jams</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Projects</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Feedback</th>
                    <th className="px-4 py-3 font-semibold text-mute text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecards.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-mute">
                        No scorecards yet.
                      </td>
                    </tr>
                  ) : (
                    scorecards.map((s) => (
                      <tr key={s.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                        <td className="px-4 py-3 text-sm text-ink">{s.partnerName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-mute text-center">
                          {s.collaborations}
                        </td>
                        <td className="px-4 py-3 text-sm text-mute text-center">
                          {s.jamsCohosted}
                        </td>
                        <td className="px-4 py-3 text-sm text-mute text-center">
                          {s.projectsDelivered}
                        </td>
                        <td className="px-4 py-3 text-sm text-mute text-center">
                          {s.memberFeedbackScore?.toFixed(1) ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setEditScorecard({
                                  partnerId: s.partnerId,
                                  collaborations: s.collaborations,
                                  jamsCohosted: s.jamsCohosted,
                                  projectsDelivered: s.projectsDelivered,
                                  memberFeedbackScore: s.memberFeedbackScore ?? 0,
                                  feedbackCount: s.feedbackCount,
                                });
                              }}
                              className="text-xs text-accent hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {editScorecard && (
              <form
                onSubmit={handleSaveScorecard}
                className="rounded-lg p-4 bg-accent-soft/50 border border-accent/20 space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-4 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-mute">Collaborations</label>
                    <input
                      type="number"
                      value={editScorecard.collaborations}
                      onChange={(e) =>
                        setEditScorecard({
                          ...editScorecard,
                          collaborations: Number(e.target.value) || 0,
                        })
                      }
                      className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-mute">Jams Co-hosted</label>
                    <input
                      type="number"
                      value={editScorecard.jamsCohosted}
                      onChange={(e) =>
                        setEditScorecard({
                          ...editScorecard,
                          jamsCohosted: Number(e.target.value) || 0,
                        })
                      }
                      className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-mute">Projects Delivered</label>
                    <input
                      type="number"
                      value={editScorecard.projectsDelivered}
                      onChange={(e) =>
                        setEditScorecard({
                          ...editScorecard,
                          projectsDelivered: Number(e.target.value) || 0,
                        })
                      }
                      className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-mute">Feedback (0–5)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={editScorecard.memberFeedbackScore}
                      onChange={(e) =>
                        setEditScorecard({
                          ...editScorecard,
                          memberFeedbackScore: Number(e.target.value) || 0,
                        })
                      }
                      className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-mute">Feedback Count</label>
                  <input
                    type="number"
                    value={editScorecard.feedbackCount}
                    onChange={(e) =>
                      setEditScorecard({
                        ...editScorecard,
                        feedbackCount: Number(e.target.value) || 0,
                      })
                    }
                    className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingScorecard}
                    className="px-4 py-2 rounded-lg bg-accent text-white font-sm font-medium disabled:opacity-50 hover:bg-accent/90"
                  >
                    {savingScorecard ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditScorecard(null)}
                    className="px-4 py-2 rounded-lg border border-line bg-card text-ink font-sm font-medium hover:bg-accent-soft"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
