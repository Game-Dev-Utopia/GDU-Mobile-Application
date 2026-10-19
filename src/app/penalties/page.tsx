'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getPenalties,
  filePenalty,
  type PenaltyRecord,
  type PenaltySeverity,
  type PenaltyRecordStatus,
} from '@/lib/api';
import { can } from '@/lib/permissions';
import { Plus, Search, Clock, User, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

const SEVERITY_LABELS: Record<PenaltySeverity, { label: string; color: string }> = {
  minor: { label: 'Minor', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  moderate: { label: 'Moderate', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  severe: { label: 'Severe', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const STATUS_LABELS: Record<PenaltyRecordStatus, string> = {
  filed: 'Filed',
  responded: 'Responded',
  reviewed: 'Reviewed',
  decided: 'Decided',
  appealed: 'Appealed',
  rejected: 'Rejected',
  upheld: 'Upheld',
};

export default function PenaltiesPage() {
  const { user, isLoading } = useAuth();
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<PenaltySeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PenaltyRecordStatus | 'all'>('all');
  const [filingOpen, setFilingOpen] = useState(false);
  const [filingForm, setFilingForm] = useState({
    memberId: '',
    activityTypeId: '',
    severity: 'minor' as PenaltySeverity,
    expDeduction: 0,
    description: '',
    evidenceUrls: [] as string[],
    responseDeadline: null as string | null,
  });

  const canFilePenalty = user
    ? can(user.roles as any, 'penalty.file', 'org', user.scopes as any)
    : false;

  useEffect(() => {
    if (!isLoading && user) {
      loadPenalties();
    }
  }, [isLoading, user]);

  async function loadPenalties() {
    setLoading(true);
    try {
      const data = await getPenalties({ limit: 100 });
      setPenalties(data);
    } catch (err) {
      console.error('Failed to load penalties:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = [...penalties];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.memberName.toLowerCase().includes(q) ||
          p.activityName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    if (severityFilter !== 'all') result = result.filter((p) => p.severity === severityFilter);
    if (statusFilter !== 'all') result = result.filter((p) => p.status === statusFilter);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [penalties, search, severityFilter, statusFilter]);

  async function handleFilePenalty() {
    if (!filingForm.memberId || !filingForm.activityTypeId || !filingForm.description) return;
    try {
      await filePenalty({
        memberId: filingForm.memberId,
        activityTypeId: filingForm.activityTypeId,
        severity: filingForm.severity,
        expDeduction: filingForm.expDeduction,
        description: filingForm.description,
        evidenceUrls: filingForm.evidenceUrls,
        responseDeadline: filingForm.responseDeadline ?? undefined,
      });
      setFilingOpen(false);
      setFilingForm({
        memberId: '',
        activityTypeId: '',
        severity: 'minor',
        expDeduction: 0,
        description: '',
        evidenceUrls: [],
        responseDeadline: null,
      });
      await loadPenalties();
    } catch (err: any) {
      alert(err.message || 'Failed to file penalty.');
    }
  }

  const ALL_SEVERITIES: PenaltySeverity[] = ['minor', 'moderate', 'severe'];

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/penalties">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/penalties">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Penalties</h1>
            <p className="text-mute">
              Decrement activities and penalty workflow.{' '}
              {canFilePenalty ? 'You can file penalties.' : ''}
            </p>
          </div>
          {canFilePenalty && (
            <button
              onClick={() => setFilingOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
            >
              <Plus size={16} /> File Penalty
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-xl p-4 bg-card border border-line">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="relative flex-1 lg:w-80">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search penalties…"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
            </div>
            <div className="flex gap-2 flex-1 lg:w-auto">
              {ALL_SEVERITIES.map((sev) => {
                const active = severityFilter === sev;
                const cfg = SEVERITY_LABELS[sev];
                return (
                  <button
                    key={`sev-${sev}`}
                    onClick={() => setSeverityFilter(active ? 'all' : sev)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-rose-900/20 border border-rose-500/40 text-rose-600'
                        : 'bg-muted/20 border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
              <button
                onClick={() => setStatusFilter('all' as const)}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-muted/20 border border-border text-muted-foreground hover:text-foreground"
              >
                All Status
              </button>
            </div>
          </div>
        </div>

        {/* Filing Form */}
        {filingOpen && (
          <div className="rounded-xl p-6 bg-card border border-line max-w-2xl">
            <h3 className="font-heading font-bold text-ink mb-4">File a Penalty</h3>
            <p className="text-mute text-sm mb-4">
              Filing a penalty triggers due process: the member is notified, has a response window,{' '}
              a second authority reviews, and a decision is made with an appeal option.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-mute mb-1">
                  Member <span className="text-rosecustom">*</span>
                </label>
                <input
                  type="text"
                  value={filingForm.memberId}
                  onChange={(e) => setFilingForm({ ...filingForm, memberId: e.target.value })}
                  placeholder="Member ID or name"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mute mb-1">
                  Activity <span className="text-rosecustom">*</span>
                </label>
                <input
                  type="text"
                  value={filingForm.activityTypeId}
                  onChange={(e) => setFilingForm({ ...filingForm, activityTypeId: e.target.value })}
                  placeholder="Penalty activity type ID"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Severity <span className="text-rosecustom">*</span>
                  </label>
                  <select
                    value={filingForm.severity}
                    onChange={(e) =>
                      setFilingForm({ ...filingForm, severity: e.target.value as PenaltySeverity })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  >
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    EXP Deduction <span className="text-rosecustom">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filingForm.expDeduction}
                    onChange={(e) =>
                      setFilingForm({ ...filingForm, expDeduction: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-mute mb-1">
                  Description <span className="text-rosecustom">*</span>
                </label>
                <textarea
                  rows={3}
                  value={filingForm.description}
                  onChange={(e) => setFilingForm({ ...filingForm, description: e.target.value })}
                  placeholder="Describe the infraction"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mute mb-1">
                  Evidence URLs (comma-separated)
                </label>
                <input
                  type="text"
                  value={filingForm.evidenceUrls.join(', ')}
                  onChange={(e) =>
                    setFilingForm({
                      ...filingForm,
                      evidenceUrls: e.target.value
                        .split(',')
                        .map((u) => u.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="https://evidence1.com, https://evidence2.com"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mute mb-1">
                  Response Deadline (optional)
                </label>
                <input
                  type="datetime-local"
                  value={filingForm.responseDeadline || ''}
                  onChange={(e) =>
                    setFilingForm({ ...filingForm, responseDeadline: e.target.value || null })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <button
                onClick={() => setFilingOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFilePenalty}
                className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                disabled={
                  !filingForm.memberId || !filingForm.activityTypeId || !filingForm.description
                }
              >
                File Penalty
              </button>
            </div>
          </div>
        )}

        {/* Penalties List */}
        <div className="rounded-xl border border-line bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-accent-soft">
                <th className="px-4 py-3 font-semibold text-mute">Member</th>
                <th className="px-4 py-3 font-semibold text-mute">Activity</th>
                <th className="px-4 py-3 font-semibold text-mute w-20">Severity</th>
                <th className="px-4 py-3 font-semibold text-mute w-20">EXP Deduction</th>
                <th className="px-4 py-3 font-semibold text-mute w-24">Status</th>
                <th className="px-4 py-3 font-semibold text-mute text-right">Filed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-mute">
                    No penalties found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                    <td className="px-4 py-3 text-ink">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-mute" />
                        <span>{p.memberName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-mute text-xs max-w-[200px] truncate">
                      {p.activityName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${SEVERITY_LABELS[p.severity].color}`}
                      >
                        {SEVERITY_LABELS[p.severity].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-mute text-xs">-{p.expDeduction}</td>
                    <td className="px-4 py-3 text-mute text-xs">{STATUS_LABELS[p.status]}</td>
                    <td className="px-4 py-3 text-mute font-mono text-xs text-right">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-line bg-accent-soft/50 text-xs text-mute flex justify-between">
              <span>
                {filtered.length} penalty entr{filtered.length === 1 ? 'y' : 'ies'}
              </span>
              <span>Most recent first</span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
