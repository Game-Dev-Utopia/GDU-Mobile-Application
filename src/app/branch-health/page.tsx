'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getCurrentBranchHealth,
  getBranchHealthConfig,
  getBranchHealthHistory,
  getBranchOverrideCases,
  getBranchOverrideRightOfReplies,
  submitBranchOverrideRightOfReply,
  fileBranchOverrideAppeal,
  decideBranchOverride,
  type BranchHealthSnapshot,
  type BranchHealthConfig,
  type BranchHealthHistoryPoint,
  type BranchOverrideCase,
  type BranchOverrideRightOfReply,
} from '@/lib/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

const STAGE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  Healthy: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  Watch: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Recovery plan': { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  'Board review': { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  Decision: { color: 'text-rose-900', bg: 'bg-rose-100', border: 'border-rose-200' },
};

const DECISION_OPTIONS: Record<string, { label: string; threshold: string; color: string }> = {
  extend: {
    label: 'Extend Plan',
    threshold: 'Simple majority',
    color: 'bg-accent-soft text-accent border-accent/20',
  },
  supervised_admin: {
    label: 'Supervised Administration',
    threshold: '3/5 board concurrence',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  merge_dormant: {
    label: 'Merge or Dormant',
    threshold: 'Simple majority',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  wind_down: {
    label: 'Wind-down',
    threshold: '4/5 board concurrence',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

const RESPONDENT_ROLES: Record<string, { label: string; color: string }> = {
  branch_council: { label: 'Branch Council', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  faculty_coordinator: {
    label: 'Faculty Coordinator',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  college_student_council: {
    label: 'College Student Council',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BranchHealthPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<BranchHealthSnapshot[]>([]);
  const [config, setConfig] = useState<BranchHealthConfig | null>(null);
  const [history, setHistory] = useState<Record<string, BranchHealthHistoryPoint[]>>({});
  const [overrideCases, setOverrideCases] = useState<BranchOverrideCase[]>([]);
  const [rightOfReplies, setRightOfReplies] = useState<
    Record<string, BranchOverrideRightOfReply[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState<Set<string>>(new Set());
  const [submittingDecision, setSubmittingDecision] = useState<Set<string>>(new Set());
  const [submittingAppeal, setSubmittingAppeal] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState('');
  const [appealText, setAppealText] = useState('');
  const [selectedRespondentRole, setSelectedRespondentRole] = useState<
    'branch_council' | 'faculty_coordinator' | 'college_student_council'
  >('branch_council');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionVotesYes, setDecisionVotesYes] = useState(0);
  const [decisionVotesTotal, setDecisionVotesTotal] = useState(5);
  const [activeDecisionCase, setActiveDecisionCase] = useState<BranchOverrideCase | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<
    'extend' | 'supervised_admin' | 'merge_dormant' | 'wind_down'
  >('extend');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [h, c] = await Promise.all([getCurrentBranchHealth(), getBranchHealthConfig()]);
      setHealth(h);
      setConfig(c);

      const historyMap: Record<string, BranchHealthHistoryPoint[]> = {};
      for (const b of h) {
        const hist = await getBranchHealthHistory(b.branchId);
        historyMap[b.branchId] = hist;
      }
      setHistory(historyMap);

      const cases = await getBranchOverrideCases();
      setOverrideCases(cases);

      const repliesMap: Record<string, BranchOverrideRightOfReply[]> = {};
      for (const c of cases) {
        const replies = await getBranchOverrideRightOfReplies(c.id);
        repliesMap[c.id] = replies;
      }
      setRightOfReplies(repliesMap);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const canViewBranchHealth = user
    ? can(user.roles as any, 'branch_health.view', 'org', user.scopes as any)
    : false;
  const canBoardDecide = user
    ? can(user.roles as any, 'motion.create', 'org', user.scopes as any)
    : false;

  const selectedHealth = useMemo(() => {
    if (!selectedBranchId) return health[0] || null;
    return health.find((h) => h.branchId === selectedBranchId) || null;
  }, [health, selectedBranchId]);

  const selectedHistory = useMemo(() => {
    if (!selectedBranchId) return [];
    return history[selectedBranchId] || [];
  }, [history, selectedBranchId]);

  const perCapitaComparison = useMemo(() => {
    if (!config) return [];
    return [...health]
      .sort((a, b) => b.healthScore - a.healthScore)
      .map((b, idx) => ({
        rank: idx + 1,
        ...b,
        perCapitaScore: b.healthScore,
      }));
  }, [health, config]);

  const userId = user?.id;

  if (loading || !user) {
    return (
      <AppLayout activePath="/branch-health">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canViewBranchHealth) {
    return (
      <AppLayout activePath="/branch-health">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <AlertTriangle size={48} className="mx-auto mb-4 text-rosecustom" />
            <h2 className="font-heading font-bold text-ink mb-2">Not Authorized</h2>
            <p className="text-mute">
              Branch Health is available to Team Leads, Domain Heads, Council Members, Board,
              Faculty, and Auditors.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/branch-health">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Branch Health</h1>
            <p className="text-mute">Branch performance score and board override status</p>
          </div>
          {config && (
            <div
              className={`px-3 py-1 rounded-full ${config.shadowMode ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'} text-xs font-medium border`}
            >
              {config.shadowMode ? 'Shadow Mode' : 'Live Enforcement'} • Floor: {config.floorScore}
            </div>
          )}
        </div>

        {/* Shadow Mode Notice */}
        {config?.shadowMode && (
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 text-sm">Shadow Mode Active</h3>
                <p className="text-amber-700 text-xs">
                  Enforcement is off. Scores and stages are computed but no board actions are
                  triggered automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Overview Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Total Branches
            </div>
            <div className="text-2xl font-heading font-bold text-ink">{health.length}</div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Healthy
            </div>
            <div className="text-2xl font-heading font-bold text-green-700">
              {health.filter((h) => h.stage === 'Healthy').length}
            </div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              At Risk
            </div>
            <div className="text-2xl font-heading font-bold text-amber-700">
              {health.filter((h) => h.stage === 'Watch' || h.stage === 'Recovery plan').length}
            </div>
          </div>
          <div className="rounded-xl p-5 bg-card border border-line">
            <div className="text-xs font-medium text-mute uppercase tracking-widest mb-2">
              Board Review / Decision
            </div>
            <div className="text-2xl font-heading font-bold text-rose-700">
              {health.filter((h) => h.stage === 'Board review' || h.stage === 'Decision').length}
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        {selectedHealth && selectedHistory.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">
                Health Score Trend — {selectedHealth.branchName}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${STAGE_CONFIG[selectedHealth.stage].color} ${STAGE_CONFIG[selectedHealth.stage].bg} ${STAGE_CONFIG[selectedHealth.stage].border}`}
              >
                {selectedHealth.stage}
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="quarterStart" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['dataMin', 'dataMax']} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="healthScore"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-6 text-xs">
              <div>
                <div className="text-mute">Health Score</div>
                <div className="font-mono font-bold text-ink">
                  {selectedHealth.healthScore.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-mute">Floor</div>
                <div
                  className={`font-mono font-bold ${selectedHealth.healthScore >= (config?.floorScore ?? 50) ? 'text-green-700' : 'text-rose-600'}`}
                >
                  {config?.floorScore ?? 50}
                </div>
              </div>
              <div>
                <div className="text-mute">Active Members</div>
                <div className="font-mono font-bold text-ink">
                  {selectedHealth.activeMemberShare?.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-mute">Events Held</div>
                <div className="font-mono font-bold text-ink">{selectedHealth.eventsHeld}</div>
              </div>
              <div>
                <div className="text-mute">Shipped Output</div>
                <div className="font-mono font-bold text-ink">{selectedHealth.shippedOutput}</div>
              </div>
              <div>
                <div className="text-mute">Exp / Member</div>
                <div className="font-mono font-bold text-ink">
                  {selectedHealth.expPerActiveMember?.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-Capita Branch Comparison */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-ink text-lg">
              Per-Capita Branch Comparison
            </h2>
            <p className="text-[10px] text-mute">
              Scores normalised per active member for fair cross-branch comparison
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-4 py-3 font-semibold text-mute w-16">Rank</th>
                  <th className="px-4 py-3 font-semibold text-mute">Branch</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Score</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20">Stage</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Active Members</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Events</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Retention</th>
                  <th className="px-4 py-3 font-semibold text-mute w-24">Exp/Member</th>
                  <th className="px-4 py-3 font-semibold text-mute text-right w-24">Vs Floor</th>
                </tr>
              </thead>
              <tbody>
                {perCapitaComparison.map((b) => {
                  const floor = config?.floorScore ?? 50;
                  const vsFloor = b.healthScore - floor;
                  const stageCfg = STAGE_CONFIG[b.stage];
                  return (
                    <tr
                      key={b.branchId}
                      className={`border-b border-line/50 hover:bg-accent-soft/5 transition-colors cursor-pointer ${
                        selectedBranchId === b.branchId ? 'bg-accent-soft/30' : ''
                      }`}
                      onClick={() => setSelectedBranchId(b.branchId)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-mute">{b.rank}</td>
                      <td className="px-4 py-3 text-ink font-medium">{b.branchName}</td>
                      <td className="px-4 py-3 font-mono text-ink">{b.healthScore.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${stageCfg.color} ${stageCfg.bg} ${stageCfg.border}`}
                        >
                          {b.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-mute">
                        {b.activeMemberShare?.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 font-mono text-mute">{b.eventsHeld}</td>
                      <td className="px-4 py-3 font-mono text-mute">
                        {b.retentionRate?.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 font-mono text-mute">
                        {b.expPerActiveMember?.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={vsFloor >= 0 ? 'text-green-600' : 'text-rose-600'}>
                          {vsFloor >= 0 ? '+' : ''}
                          {vsFloor.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {health.length === 0 && (
            <div className="py-8 text-center text-mute">No branch health data available yet.</div>
          )}
        </div>

        {/* Branch Detail Card */}
        {selectedHealth && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">
                Components — {selectedHealth.branchName}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${STAGE_CONFIG[selectedHealth.stage].color} ${STAGE_CONFIG[selectedHealth.stage].bg} ${STAGE_CONFIG[selectedHealth.stage].border}`}
              >
                {selectedHealth.stage}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                <div className="text-xs font-medium text-mute uppercase mb-1">
                  Active Member Share
                </div>
                <div className="text-2xl font-heading font-bold text-ink">
                  {selectedHealth.activeMemberShare?.toFixed(1)}%
                </div>
                <div className="w-full bg-line rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: Math.min(100, selectedHealth.activeMemberShare ?? 0) + '%' }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                <div className="text-xs font-medium text-mute uppercase mb-1">Events Held</div>
                <div className="text-2xl font-heading font-bold text-ink">
                  {selectedHealth.eventsHeld}
                </div>
                <div className="w-full bg-line rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: Math.min(100, selectedHealth.eventsHeld * 10) + '%' }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                <div className="text-xs font-medium text-mute uppercase mb-1">Shipped Output</div>
                <div className="text-2xl font-heading font-bold text-ink">
                  {selectedHealth.shippedOutput}
                </div>
                <div className="w-full bg-line rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: Math.min(100, selectedHealth.shippedOutput * 10) + '%' }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                <div className="text-xs font-medium text-mute uppercase mb-1">Retention Rate</div>
                <div className="text-2xl font-heading font-bold text-ink">
                  {selectedHealth.retentionRate?.toFixed(1)}%
                </div>
                <div className="w-full bg-line rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: Math.min(100, selectedHealth.retentionRate ?? 0) + '%' }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                <div className="text-xs font-medium text-mute uppercase mb-1">
                  Exp per Active Member
                </div>
                <div className="text-2xl font-heading font-bold text-ink">
                  {selectedHealth.expPerActiveMember?.toFixed(1)}
                </div>
                <div className="w-full bg-line rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{
                      width: Math.min(100, (selectedHealth.expPerActiveMember ?? 0) / 2) + '%',
                    }}
                  />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
                <div className="text-xs font-medium text-mute uppercase mb-1">
                  Faculty Coordination
                </div>
                <div className="text-2xl font-heading font-bold text-ink">
                  {selectedHealth.facultyCoordinationScore?.toFixed(1)}
                </div>
                <div className="w-full bg-line rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{
                      width: Math.min(100, selectedHealth.facultyCoordinationScore ?? 0) + '%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Board Override Timeline */}
        {overrideCases.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-ink text-lg">Board Override Timeline</h2>
              <span
                className={`text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded`}
              >
                Board Action Required
              </span>
            </div>
            <p className="text-xs text-mute mb-4">
              Branches in Board review or Decision stage enter the override timeline. Right-of-reply
              is invited from branch council, faculty coordinator, and college student council
              (notified, no veto).
            </p>
            <div className="space-y-3">
              {overrideCases.map((c) => {
                const replies = rightOfReplies[c.id] || [];
                const hasReplied = replies.some((r) => r.respondentId === userId);
                const cfg = RESPONDENT_ROLES;
                const pendingRoles = Object.keys(cfg).filter(
                  (role) => !replies.some((r) => r.respondentRole === role)
                );
                return (
                  <div
                    key={c.id}
                    className="rounded-lg p-4 border border-line bg-card hover:bg-accent-soft/5 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-mute">
                          Case #{c.id.slice(0, 8)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${c.stage === 'Board review' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-rose-700 bg-rose-50 border border-rose-200'}`}
                        >
                          {c.stage.charAt(0).toUpperCase() + c.stage.slice(1)}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-mute">
                        {formatDate(c.triggeredAt)}
                      </span>
                    </div>
                    <p className="text-sm text-mute mb-3">
                      Branch: <span className="font-mono text-ink">{c.branchName}</span>
                      {c.boardDecision && (
                        <span className="ml-2 text-xs font-medium text-ink">
                          Decision: {c.boardDecision.replace(/_/g, ' ')}
                        </span>
                      )}
                    </p>

                    {/* Right of Reply Section */}
                    {!c.boardDecision && (
                      <div className="mb-3">
                        <p className="text-[10px] font-medium text-mute uppercase mb-2">
                          Right of Reply (Notified — No Veto)
                        </p>
                        <div className="flex gap-2 flex-wrap mb-2">
                          {pendingRoles.map((role) => (
                            <span
                              key={role}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg[role as keyof typeof cfg].color}`}
                            >
                              {cfg[role as keyof typeof cfg].label}
                            </span>
                          ))}
                        </div>
                        {userId && !hasReplied && canBoardDecide && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-mute uppercase block mb-1">
                              Submit as:
                            </label>
                            <select
                              value={selectedRespondentRole}
                              onChange={(e) => setSelectedRespondentRole(e.target.value as any)}
                              className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                            >
                              {Object.entries(RESPONDENT_ROLES).map(([key, val]) => (
                                <option key={key} value={key}>
                                  {val.label}
                                </option>
                              ))}
                            </select>
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Enter right of reply statement…"
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                            />
                            <button
                              onClick={async () => {
                                if (!replyText.trim() || !userId) return;
                                setSubmittingReply((prev) => new Set([...prev, c.id]));
                                try {
                                  await submitBranchOverrideRightOfReply(
                                    c.id,
                                    selectedRespondentRole,
                                    userId,
                                    replyText
                                  );
                                  setReplyText('');
                                  const updated = await getBranchOverrideRightOfReplies(c.id);
                                  setRightOfReplies((prev) => ({ ...prev, [c.id]: updated }));
                                  await load();
                                } catch (err: any) {
                                  alert(err.message || 'Failed to submit right of reply.');
                                } finally {
                                  setSubmittingReply((prev) => {
                                    const next = new Set(prev);
                                    next.delete(c.id);
                                    return next;
                                  });
                                }
                              }}
                              disabled={submittingReply.has(c.id) || !replyText.trim()}
                              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                              {submittingReply.has(c.id) ? 'Submitting…' : 'Submit Right of Reply'}
                            </button>
                          </div>
                        )}
                        {userId && hasReplied && (
                          <div className="p-3 rounded-lg bg-green-50 text-green-700 text-xs border border-green-200">
                            Right of reply submitted.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Existing Replies */}
                    {replies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-line/50">
                        <p className="text-[10px] font-medium text-mute uppercase mb-2">
                          Replies Received
                        </p>
                        <div className="space-y-2">
                          {replies.map((r) => (
                            <div
                              key={r.id}
                              className="p-3 rounded-lg bg-muted/50 border border-border"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-ink">
                                  {r.respondentName}
                                </span>
                                <span
                                  className={`text-[10px] font-bold ${RESPONDENT_ROLES[r.respondentRole as keyof typeof RESPONDENT_ROLES]?.color ?? 'text-muted-foreground'}`}
                                >
                                  {RESPONDENT_ROLES[
                                    r.respondentRole as keyof typeof RESPONDENT_ROLES
                                  ]?.label || r.respondentRole}
                                </span>
                              </div>
                              <p className="text-sm text-ink">{r.replyText}</p>
                              <p className="text-[10px] text-mute mt-1">
                                {formatDate(r.submittedAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Board Decision Section */}
                    {!c.boardDecision && canBoardDecide && (
                      <div className="mt-4 pt-4 border-t border-line">
                        <p className="text-[10px] font-medium text-mute uppercase mb-2">
                          Board Decision
                        </p>
                        <div className="space-y-2">
                          <div className="grid gap-2 md:grid-cols-2">
                            {Object.entries(DECISION_OPTIONS).map(([key, opt]) => {
                              const decisionKey = key as
                                | 'extend'
                                | 'supervised_admin'
                                | 'merge_dormant'
                                | 'wind_down';
                              return (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setActiveDecisionCase(c);
                                    setSelectedDecision(decisionKey);
                                    setDecisionReason('');
                                    setDecisionVotesYes(
                                      decisionKey === 'supervised_admin'
                                        ? 3
                                        : decisionKey === 'wind_down'
                                          ? 4
                                          : 3
                                    );
                                    setDecisionVotesTotal(
                                      decisionKey === 'supervised_admin' ||
                                        decisionKey === 'wind_down'
                                        ? 5
                                        : 3
                                    );
                                  }}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${opt.color} ${selectedDecision === decisionKey ? 'ring-2 ring-accent' : ''} hover:opacity-90`}
                                >
                                  {opt.label}{' '}
                                  <span className="text-[10px] opacity-70">({opt.threshold})</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-mute">Yes votes:</span>
                            <input
                              type="number"
                              value={decisionVotesYes}
                              onChange={(e) => setDecisionVotesYes(parseInt(e.target.value) || 0)}
                              className="w-12 px-2 py-1 rounded border border-line bg-background text-sm"
                              min="0"
                              max={decisionVotesTotal}
                            />
                            <span className="text-mute">of</span>
                            <input
                              type="number"
                              value={decisionVotesTotal}
                              onChange={(e) => setDecisionVotesTotal(parseInt(e.target.value) || 5)}
                              className="w-12 px-2 py-1 rounded border border-line bg-background text-sm"
                              min="1"
                            />
                            <span className="text-mute">board members</span>
                          </div>
                          <textarea
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            placeholder="Decision rationale…"
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                          />
                          <button
                            onClick={async () => {
                              if (!activeDecisionCase || !decisionReason.trim() || !userId) return;
                              setSubmittingDecision(
                                (prev) => new Set([...prev, activeDecisionCase.id])
                              );
                              try {
                                await decideBranchOverride(
                                  activeDecisionCase.id,
                                  userId,
                                  selectedDecision,
                                  decisionReason,
                                  decisionVotesYes,
                                  decisionVotesTotal
                                );
                                await load();
                              } catch (err: any) {
                                alert(err.message || 'Failed to record decision.');
                              } finally {
                                setSubmittingDecision((prev) => {
                                  const next = new Set(prev);
                                  next.delete(activeDecisionCase!.id);
                                  return next;
                                });
                              }
                            }}
                            disabled={submittingDecision.has(c.id) || !decisionReason.trim()}
                            className="w-full px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50 transition-colors hover:bg-rose-700"
                          >
                            Record Decision
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Appeal Section */}
                    {c.boardDecision && (
                      <div className="mt-3 pt-3 border-t border-line/50">
                        <p className="text-[10px] font-medium text-mute uppercase mb-2">Appeal</p>
                        <p className="text-xs text-mute mb-2">
                          One appeal is permitted against this board decision.
                        </p>
                        {userId && canBoardDecide && (
                          <div className="space-y-2">
                            <textarea
                              value={appealText}
                              onChange={(e) => setAppealText(e.target.value)}
                              placeholder="Enter appeal reason…"
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                            />
                            <button
                              onClick={async () => {
                                if (!appealText.trim() || !userId) return;
                                setSubmittingAppeal((prev) => new Set([...prev, c.id]));
                                try {
                                  await fileBranchOverrideAppeal(c.id, userId, appealText);
                                  setAppealText('');
                                  await load();
                                } catch (err: any) {
                                  alert(err.message || 'Failed to file appeal.');
                                } finally {
                                  setSubmittingAppeal((prev) => {
                                    const next = new Set(prev);
                                    next.delete(c.id);
                                    return next;
                                  });
                                }
                              }}
                              disabled={submittingAppeal.has(c.id) || !appealText.trim()}
                              className="w-full px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                              {submittingAppeal.has(c.id) ? 'Filing…' : 'File Appeal'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {overrideCases.length === 0 && health.length > 0 && (
          <div className="rounded-xl p-6 bg-card border border-line text-center">
            <p className="text-mute">No board override cases at this time.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
