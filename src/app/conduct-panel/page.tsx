'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getConductCases,
  fileConductCase,
  fileConductCaseAppeal,
  getConductPanelMembers,
  recusePanelMember,
  getConductCaseAppeals,
  getProbationRecords,
  getLeaveOfAbsence,
  requestLeaveOfAbsenceFreeze,
  type ConductCase,
  type ConductPanelMember,
  type ConductCaseAppeal,
  type ProbationRecord,
  type LeaveOfAbsence,
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

const PROBATION_STAGE_COLORS: Record<string, string> = {
  healthy: 'bg-green-50 text-green-700 border-green-200',
  at_risk: 'bg-amber-50 text-amber-700 border-amber-200',
  probation: 'bg-orange-50 text-orange-700 border-orange-200',
  hearing: 'bg-rose-50 text-rose-700 border-rose-200',
  decision: 'bg-rose-100 text-rose-900 border-rose-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
};

const LOA_REASON_LABELS: Record<string, string> = {
  exams: 'Exams',
  internship: 'Internship',
  personal: 'Personal',
  medical: 'Medical',
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ConductPanelPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<ConductCase[]>([]);
  const [panelMembers, setPanelMembers] = useState<ConductPanelMember[]>([]);
  const [appeals, setAppeals] = useState<ConductCaseAppeal[]>([]);
  const [probationRecords, setProbationRecords] = useState<ProbationRecord[]>([]);
  const [loaRecords, setLoaRecords] = useState<LeaveOfAbsence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ConductCase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileForm, setFileForm] = useState({
    memberId: '',
    reasonCode: '',
    severity: 'minor' as const,
    description: '',
    evidenceLinks: '',
  });
  const [appealModal, setAppealModal] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [loaModal, setLoaModal] = useState(false);
  const [loaForm, setLoaForm] = useState({
    reason: 'personal' as const,
    startDate: '',
    endDate: '',
    freezeReason: '',
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [c, p, pr, loa] = await Promise.all([
        getConductCases(),
        getConductPanelMembers(),
        getProbationRecords(),
        getLeaveOfAbsence(),
      ]);
      setCases(c);
      setPanelMembers(p);
      setProbationRecords(pr);
      setLoaRecords(loa);

      const caseIds = c.map((caseItem) => caseItem.id);
      const allAppeals: ConductCaseAppeal[] = [];
      for (const caseId of caseIds) {
        const caseAppeals = await getConductCaseAppeals(caseId);
        allAppeals.push(...caseAppeals);
      }
      setAppeals(allAppeals);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFileCase(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
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
      setFileForm({
        memberId: '',
        reasonCode: '',
        severity: 'minor',
        description: '',
        evidenceLinks: '',
      });
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to file conduct case.');
    } finally {
      setSubmitting(false);
    }
  }

  const isPanelOrBoard =
    !!user &&
    (can(user.roles as any, 'claim.review', 'org', user.scopes as any) ||
      user.role === 'board_member' ||
      user.role === 'admin' ||
      user.role === 'conduct_panel_member');
  const canFile =
    !!user &&
    (user.role === 'team_lead' ||
      user.role === 'domain_head' ||
      user.role === 'council_member' ||
      user.role === 'board_member' ||
      user.role === 'admin' ||
      user.role === 'conduct_panel_member');
  const isMember = !!user && (user.role === 'member' || user.role === 'senior_member');

  const memberCases = useMemo(() => {
    if (!user) return [];
    return cases.filter((c) => c.memberId === user.id);
  }, [cases, user]);

  const panelCases = useMemo(() => {
    if (!isPanelOrBoard) return [];
    return cases.filter((c) => c.sensitive !== true);
  }, [cases, isPanelOrBoard]);

  const sensitiveCases = useMemo(() => {
    if (!isPanelOrBoard) return [];
    return cases.filter((c) => c.sensitive === true);
  }, [cases, isPanelOrBoard]);

  const myAppeals = useMemo(() => {
    if (!user) return [];
    return appeals.filter((a) => a.appellantId === user.id);
  }, [appeals, user]);

  if (loading || !user) {
    return (
      <AppLayout activePath="/conduct-panel">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/conduct-panel">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Conduct & Probation</h1>
            <p className="text-mute">
              Conduct cases, probation tracker, and leave-of-absence freeze requests
            </p>
          </div>
          {canFile && !isMember && (
            <button
              onClick={() =>
                setFileForm({
                  memberId: '',
                  reasonCode: '',
                  severity: 'minor',
                  description: '',
                  evidenceLinks: '',
                })
              }
              className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              File Conduct Case
            </button>
          )}
        </div>

        {/* Member's Own Cases (affected member sees only their own case) */}
        {isMember && memberCases.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">Your Cases</h2>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                Member View — Your cases only
              </span>
            </div>
            <div className="space-y-3">
              {memberCases.map((c) => {
                const stageCfg = STATUS_COLORS[c.status];
                const myAppeal = myAppeals.find((a) => a.conductCaseId === c.id);
                const canAppeal =
                  c.status === 'board_ratification' ||
                  c.status === 'decision' ||
                  c.status === 'resolved';
                return (
                  <div
                    key={c.id}
                    className="rounded-lg p-4 border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-mute">
                          Case #{c.id.slice(0, 8)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${SEVERITY_COLORS[c.severity]}`}
                        >
                          {c.severity}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${stageCfg}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-mute mb-2">{c.description}</p>
                    <div className="flex justify-between text-xs text-mute mb-3">
                      <span>Filed: {formatDate(c.filedAt)}</span>
                      {c.responseDeadline && (
                        <span>Response deadline: {formatDate(c.responseDeadline)}</span>
                      )}
                    </div>

                    {/* Respond (only in notice stage) */}
                    {c.status === 'notice' && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-medium text-mute uppercase mb-1">
                          Your Response
                        </p>
                        <textarea
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                          placeholder="Enter your response to the conduct notice…"
                        />
                        <button
                          className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                          onClick={() => {
                            setSelectedCase(c);
                            setAppealModal(false);
                          }}
                        >
                          Submit Response
                        </button>
                      </div>
                    )}

                    {/* Appeal */}
                    {canAppeal && !myAppeal && (
                      <div className="mt-3 pt-3 border-t border-line/50">
                        <p className="text-[10px] font-medium text-mute uppercase mb-1">Appeal</p>
                        <button
                          onClick={() => {
                            setSelectedCase(c);
                            setAppealModal(true);
                          }}
                          className="w-full py-2 rounded-lg border border-line bg-card text-sm font-medium hover:bg-accent-soft transition-colors"
                        >
                          File Appeal
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel & Board View */}
        {isPanelOrBoard && (
          <>
            {/* Conduct Panel Members */}
            <div className="rounded-xl p-6 bg-card border border-line">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-ink text-lg">
                  Conduct Panel (5 members)
                </h2>
                <span
                  className={`text-xs font-bold ${panelMembers.length >= 5 ? 'text-green-700 bg-green-50 border-green-200' : 'text-amber-700 bg-amber-50 border-amber-200'} px-2 py-0.5 rounded`}
                >
                  {panelMembers.length}/5
                </span>
              </div>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {panelMembers.length === 0 && (
                  <div className="col-span-full py-8 text-center text-mute">
                    No panel members appointed yet.
                  </div>
                )}
                {panelMembers.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      m.isRecused ? 'bg-rose-50 border-rose-200' : 'bg-card border-line'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink">{m.profileName}</span>
                      {m.isRecused && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                          Recused
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-mute mb-2">
                      {m.isRecused ? m.recusalReason || 'Recused' : 'Active'}
                    </p>
                    {!m.isRecused && (
                      <button
                        onClick={() => {
                          setSelectedCase(null);
                          recusePanelMember(m.id, 'Self-recusal');
                        }}
                        className="w-full py-1.5 rounded text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                      >
                        Recuse
                      </button>
                    )}
                  </div>
                ))}
                {panelMembers.length < 5 && (
                  <div className="col-span-full mt-4">
                    <p className="text-xs text-mute mb-2">
                      Appoint panel members to reach 5. Board or Admin only.
                    </p>
                    <input
                      type="text"
                      placeholder="Profile UUID to appoint"
                      className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent mb-2"
                    />
                    <button
                      className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                      onClick={() => {
                        // Appoint logic would go here
                      }}
                    >
                      Appoint Panel Member
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Case List */}
            <div className="rounded-xl p-6 bg-card border border-line">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-ink text-lg">Case List</h2>
                <span className="text-xs font-bold text-mute">{panelCases.length} cases</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute w-16">Case</th>
                      <th className="px-4 py-3 font-semibold text-mute">Member</th>
                      <th className="px-4 py-3 font-semibold text-mute w-20">Severity</th>
                      <th className="px-4 py-3 font-semibold text-mute w-24">Stage</th>
                      <th className="px-4 py-3 font-semibold text-mute w-20">Filed</th>
                      <th className="px-4 py-3 font-semibold text-mute w-20">Panel</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelCases.map((c) => {
                      const stageCfg = STATUS_COLORS[c.status];
                      const severityCfg = SEVERITY_COLORS[c.severity];
                      const appealsForCase = appeals.filter((a) => a.conductCaseId === c.id);
                      const hasAppeal = appealsForCase.length > 0;
                      const panelMember = panelMembers.find((m) => !m.isRecused);
                      return (
                        <tr
                          key={c.id}
                          className={`border-b border-line/50 hover:bg-accent-soft/5 transition-colors ${
                            c.sensitive ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-mute">#{c.id.slice(-6)}</td>
                          <td className="px-4 py-3 text-ink">{c.memberName}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${severityCfg}`}
                            >
                              {c.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${stageCfg}`}
                            >
                              {c.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-mute">{formatDate(c.filedAt)}</td>
                          <td className="px-4 py-3">
                            {panelMember ? (
                              <span
                                className={`text-xs font-medium ${panelMember.isRecused ? 'text-rose-600' : 'text-green-600'}`}
                              >
                                {panelMember.isRecused ? 'Recused' : 'Assigned'}
                              </span>
                            ) : (
                              <span className="text-xs text-mute">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.status === 'notice' && (
                              <button
                                onClick={() => {
                                  setSelectedCase(c);
                                  setAppealModal(false);
                                }}
                                className="px-3 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium hover:bg-blue-100 transition-colors"
                              >
                                Review
                              </button>
                            )}
                            {c.status === 'response' && !hasAppeal && (
                              <button
                                onClick={() => {
                                  setSelectedCase(c);
                                  setAppealModal(false);
                                }}
                                className="px-3 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-medium hover:bg-purple-100 transition-colors"
                              >
                                Panel Review
                              </button>
                            )}
                            {c.status === 'panel_review' && (
                              <button
                                onClick={() => {
                                  setSelectedCase(c);
                                  setAppealModal(false);
                                }}
                                className="px-3 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-medium hover:bg-rose-100 transition-colors"
                              >
                                Board Ratify
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {panelCases.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-mute">
                          No conduct cases for panel.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sensitive Cases (Board/Admin only) */}
            {sensitiveCases.length > 0 && (
              <div className="rounded-xl p-6 bg-rose-50 border border-rose-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-bold text-rose-900 text-lg">Sensitive Cases</h2>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded">
                    {sensitiveCases.length} sensitive
                  </span>
                </div>
                <p className="text-sm text-rose-700 mb-3">
                  Sensitive case details are hidden from non-panel members. Only Board, Admin, and
                  Conduct Panel members can view.
                </p>
                <div className="space-y-2">
                  {sensitiveCases.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg bg-card border border-line">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase text-mute">
                          Case #{c.id.slice(0, 8)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${SEVERITY_COLORS[c.severity]}`}
                        >
                          {c.severity}
                        </span>
                      </div>
                      <p className="text-sm text-rose-700 mb-1">{c.memberName}</p>
                      <p className="text-xs text-mute">
                        Stage: {c.status.replace('_', ' ')} · Filed {formatDate(c.filedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Probation Tracker */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-ink text-lg">Member Probation Tracker</h2>
            <span className="text-xs font-bold text-mute">{probationRecords.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-4 py-3 font-semibold text-mute">Member</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Stage</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Started</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Grace Expires</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Support Plan</th>
                  <th className="px-4 py-3 font-semibold text-mute text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {probationRecords.map((p) => {
                  const stageCfg = PROBATION_STAGE_COLORS[p.stage];
                  const graceExpired = p.graceExpiresAt && new Date(p.graceExpiresAt) < new Date();
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-line/50 hover:bg-accent-soft/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-ink">{p.memberName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${stageCfg}`}>
                          {p.stage.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-mute">{formatDate(p.startedAt)}</td>
                      <td className="px-4 py-3 font-mono text-mute">
                        {p.graceExpiresAt ? formatDate(p.graceExpiresAt) : '—'}
                        {graceExpired && (
                          <span className="text-rose-600 text-[10px] ml-1">(expired)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-mute text-xs">{p.supportPlan || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {isPanelOrBoard && p.stage !== 'resolved' && (
                          <button
                            onClick={() => {}}
                            className="px-3 py-1 rounded bg-accent-soft text-accent border border-accent/20 text-[10px] font-medium hover:bg-accent transition-colors"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {probationRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-mute">
                      No probation records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-mute mt-3">
            New position holders receive a 60-day grace period before probation stages apply.
          </p>
        </div>

        {/* Leave of Absence / Freeze Requests */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-ink text-lg">
              Leave of Absence & Freeze Requests
            </h2>
            <span className="text-xs font-bold text-mute">{loaRecords.length} requests</span>
          </div>
          {isMember && (
            <div className="mb-4">
              <button
                onClick={() => setLoaModal(true)}
                className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Request Leave of Absence / Freeze
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-4 py-3 font-semibold text-mute">Member</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Reason</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Start</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">End</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Status</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Freeze</th>
                </tr>
              </thead>
              <tbody>
                {loaRecords.map((l) => {
                  const isMine = l.memberId === user.id;
                  const visibleToMember = isMine || isPanelOrBoard;
                  if (!visibleToMember) return null;
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-line/50 hover:bg-accent-soft/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-ink">{l.memberName}</td>
                      <td className="px-4 py-3 font-mono text-mute">
                        {LOA_REASON_LABELS[l.reason]}
                      </td>
                      <td className="px-4 py-3 font-mono text-mute">{formatDate(l.startDate)}</td>
                      <td className="px-4 py-3 font-mono text-mute">{formatDate(l.endDate)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.status === 'approved'
                              ? 'text-green-700 bg-green-50 border-green-200'
                              : l.status === 'pending'
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-muted-foreground bg-muted/50 border border-border'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {l.isFreezeRequest ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200">
                            Freeze: {l.freezeReason || '—'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-mute">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {loaRecords.filter((l) => l.memberId === user.id || isPanelOrBoard).length ===
                  0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-mute">
                      No leave of absence records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* File Conduct Case Modal */}
        {canFile && !isMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() =>
                setFileForm({
                  memberId: '',
                  reasonCode: '',
                  severity: 'minor',
                  description: '',
                  evidenceLinks: '',
                })
              }
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFileForm({
                        memberId: '',
                        reasonCode: '',
                        severity: 'minor',
                        description: '',
                        evidenceLinks: '',
                      })
                    }
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

        {/* Appeal Modal */}
        {appealModal && selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setAppealModal(false)}
            />
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
              <h2 className="font-heading font-bold text-ink mb-2">File Appeal</h2>
              <p className="text-mute text-sm mb-4">
                Case #{selectedCase.id.slice(-6)} - {selectedCase.memberName}
              </p>
              <div>
                <label className="block text-xs font-medium text-mute mb-1">Appeal Reason</label>
                <textarea
                  rows={4}
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setAppealModal(false)}
                  className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!appealReason.trim() || !selectedCase || !user) return;
                    setSubmitting(true);
                    try {
                      await fileConductCaseAppeal(selectedCase.id, user.id, appealReason);
                      setAppealModal(false);
                      setAppealReason('');
                      await load();
                    } catch (err: any) {
                      alert(err.message || 'Failed to file appeal.');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting || !appealReason.trim()}
                  className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Filing...' : 'File Appeal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOA / Freeze Request Modal */}
        {loaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setLoaModal(false)}
            />
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
              <h2 className="font-heading font-bold text-ink mb-2">Request Leave of Absence</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Reason</label>
                  <select
                    value={loaForm.reason}
                    onChange={(e) => setLoaForm({ ...loaForm, reason: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                  >
                    <option value="exams">Exams</option>
                    <option value="internship">Internship</option>
                    <option value="personal">Personal</option>
                    <option value="medical">Medical</option>
                  </select>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-mute mb-1">Start Date</label>
                    <input
                      type="date"
                      value={loaForm.startDate}
                      onChange={(e) => setLoaForm({ ...loaForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mute mb-1">End Date</label>
                    <input
                      type="date"
                      value={loaForm.endDate}
                      onChange={(e) => setLoaForm({ ...loaForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Freeze Reason (if applicable)
                  </label>
                  <input
                    type="text"
                    value={loaForm.freezeReason}
                    onChange={(e) => setLoaForm({ ...loaForm, freezeReason: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                    placeholder="e.g. exam period freeze"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setLoaModal(false)}
                    className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!loaForm.startDate || !loaForm.endDate || !user) return;
                      setSubmitting(true);
                      try {
                        await requestLeaveOfAbsenceFreeze(
                          user.id,
                          loaForm.reason,
                          loaForm.startDate,
                          loaForm.endDate,
                          loaForm.freezeReason
                        );
                        setLoaModal(false);
                        await load();
                      } catch (err: any) {
                        alert(err.message || 'Failed to submit request.');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
