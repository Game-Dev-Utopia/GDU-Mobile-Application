'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/permissions';
import AppLayout from '@/components/AppLayout';
import {
  getActiveRoleAssignments,
  getAdminConfigVersions,
  getAuditLogs,
  getFeatureFlags,
  getRoleAssignmentHistory,
  grantRole,
  publishAdminConfigVersion,
  revokeRole,
  setFeatureFlag,
  type AdminConfigPayload,
  type AdminConfigVersion,
  type AuditLogEntry,
  type FeatureFlag,
  type FeatureFlagMode,
  type RoleAssignmentInfo,
  type RoleAssignmentHistoryEntry,
} from '@/lib/api';
import { Shield, FileCheck, Clock, User, Plus, Settings } from 'lucide-react';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

type Tab = 'config' | 'flags' | 'roles' | 'audit';

export default function AdminConsole() {
  const { user, isLoading } = useAuth();

  const roles = user?.roles || [];
  const scopes = user?.scopes || [];

  const canManageConfig = can(roles as any, 'roles.manage', 'org', scopes as any);
  const canViewAudit = can(roles as any, 'audit.view', 'org', scopes as any);

  const [tab, setTab] = useState<Tab>('config');
  const [error, setError] = useState<string | null>(null);

  // Config state
  const [configVersions, setConfigVersions] = useState<AdminConfigVersion[]>([]);
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newEffectiveFrom, setNewEffectiveFrom] = useState('');
  const [newConfigJson, setNewConfigJson] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');

  // Roles state
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignmentInfo[]>([]);
  const [roleHistory, setRoleHistory] = useState<RoleAssignmentHistoryEntry[]>([]);
  const [grantProfileId, setGrantProfileId] = useState('');
  const [grantRoleName, setGrantRoleName] = useState('member');
  const [grantScope, setGrantScope] = useState('org');
  const [grantEntityId, setGrantEntityId] = useState('');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilters, setAuditFilters] = useState({
    actor: '',
    action: '',
    table: '',
    startDate: '',
    endDate: '',
  });
  const [exporting, setExporting] = useState(false);

  const tabLabel: Record<Tab, string> = {
    config: 'Configuration Versions',
    flags: 'Feature Flags',
    roles: 'Role Assignments',
    audit: 'Audit Log',
  };

  const tabIcon: Record<Tab, any> = {
    config: Settings,
    flags: Shield,
    roles: User,
    audit: FileCheck,
  };

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadConfigs(), loadFlags(), loadRoles(), loadAudit()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    }
  }, [loadConfigs, loadFlags, loadRoles, loadAudit]);

  useEffect(() => {
    if (!isLoading && user) {
      loadAll();
    }
  }, [isLoading, user, loadAll]);

  async function loadConfigs() {
    const data = await getAdminConfigVersions();
    setConfigVersions(data);
  }

  async function loadFlags() {
    const data = await getFeatureFlags();
    setFeatureFlags(data);
  }

  async function loadRoles() {
    const [assignments, history] = await Promise.all([
      getActiveRoleAssignments(),
      getRoleAssignmentHistory({ limit: 50 }),
    ]);
    setRoleAssignments(assignments);
    setRoleHistory(history);
  }

  async function loadAudit() {
    const data = await getAuditLogs({
      actorId: auditFilters.actor || undefined,
      action: auditFilters.action || undefined,
      tableName: auditFilters.table || undefined,
      startDate: auditFilters.startDate || undefined,
      endDate: auditFilters.endDate || undefined,
      limit: 500,
    });
    setAuditLogs(data);
  }

  const defaultConfig: AdminConfigPayload = {
    weights: {
      board: 40,
      council: 35,
      member: 25,
      branch_health: {
        active_members: 25,
        events_held: 20,
        shipped_output: 25,
        retention: 15,
        exp_per_member: 10,
        faculty_coordination: 5,
      },
    },
    caps: { season_exp_cap: 5000, max_claims_per_day: 5, max_claim_exp: 500 },
    thresholds: {
      ordinary: 50,
      serious: 66.67,
      constitutional: 66.67,
      recall: 66.67,
      standing_window_days: 90,
      standing_half_life_days: 45,
      pink_slip_value: 40,
      branch_health_floor: 40,
    },
    class_shares: { technical: 40, social: 20, soft: 20, management: 20 },
    quorum: { board: 3, council_percent: 50, recall_board_concurrence: 2 },
    league_sizes: [
      {
        name: 'bronze',
        displayName: 'Bronze',
        minExp: 0,
        maxExp: 999,
        color: '#b45309',
        sortOrder: 1,
        isLocked: false,
      },
      {
        name: 'silver',
        displayName: 'Silver',
        minExp: 1000,
        maxExp: 2499,
        color: '#94a3b8',
        sortOrder: 2,
        isLocked: false,
      },
      {
        name: 'gold',
        displayName: 'Gold',
        minExp: 2500,
        maxExp: 4999,
        color: '#ca8a04',
        sortOrder: 3,
        isLocked: false,
      },
      {
        name: 'platinum',
        displayName: 'Platinum',
        minExp: 5000,
        maxExp: 9999,
        color: '#7dd3fc',
        sortOrder: 4,
        isLocked: false,
      },
      {
        name: 'emerald',
        displayName: 'Emerald',
        minExp: 10000,
        maxExp: 19999,
        color: '#34d399',
        sortOrder: 5,
        isLocked: false,
      },
      {
        name: 'diamond',
        displayName: 'Diamond',
        minExp: 20000,
        maxExp: null,
        color: '#a78bfa',
        sortOrder: 6,
        isLocked: true,
      },
    ],
  };

  const effectiveVersion = useMemo(
    () => configVersions.find((v) => v.isEffective),
    [configVersions]
  );

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!newVersionLabel.trim() || !newEffectiveFrom) {
      setError('Version label and effective date are required.');
      return;
    }
    try {
      let config: AdminConfigPayload = defaultConfig;
      if (newConfigJson.trim()) {
        config = JSON.parse(newConfigJson) as AdminConfigPayload;
      }
      setPublishing(true);
      setError(null);
      await publishAdminConfigVersion({
        versionLabel: newVersionLabel.trim(),
        effectiveFrom: newEffectiveFrom,
        config,
        notes: newNotes.trim() || null,
      });
      setNewVersionLabel('');
      setNewEffectiveFrom('');
      setNewConfigJson('');
      setNewNotes('');
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish config version.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleToggleFlag(flag: FeatureFlag) {
    const nextMode: FeatureFlagMode = flag.mode === 'shadow' ? 'live' : 'shadow';
    setTogglingFlag(flag.key);
    try {
      await setFeatureFlag({
        key: flag.key,
        mode: nextMode,
        reason: flagReason.trim() || undefined,
      });
      setFlagReason('');
      await loadFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag.');
    } finally {
      setTogglingFlag(null);
    }
  }

  async function handleGrantRole(e: React.FormEvent) {
    e.preventDefault();
    if (!grantProfileId) {
      setError('Select a member to grant a role to.');
      return;
    }
    try {
      setGrantLoading(true);
      setError(null);
      await grantRole({
        profileId: grantProfileId,
        role: grantRoleName,
        scope: grantScope,
        scopeEntityId: grantEntityId || null,
        expiresAt: grantExpiresAt || null,
        reason: grantReason.trim() || undefined,
      });
      setGrantProfileId('');
      setGrantRoleName('member');
      setGrantScope('org');
      setGrantEntityId('');
      setGrantExpiresAt('');
      setGrantReason('');
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant role.');
    } finally {
      setGrantLoading(false);
    }
  }

  async function handleRevokeRole(roleAssignmentId: string) {
    setRevokingId(roleAssignmentId);
    try {
      setError(null);
      await revokeRole({ roleAssignmentId, reason: revokeReason.trim() || undefined });
      setRevokeReason('');
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke role.');
    } finally {
      setRevokingId(null);
    }
  }

  function exportCSV() {
    if (auditLogs.length === 0) return;
    setExporting(true);
    const headers = [
      'ID',
      'Created At',
      'Actor',
      'Action',
      'Table',
      'Record ID',
      'Old Values',
      'New Values',
    ];
    const rows = auditLogs.map((l) => [
      l.id,
      l.createdAt ?? '',
      l.actorName ?? '',
      l.action,
      l.tableName ?? '',
      l.recordId ?? '',
      JSON.stringify(l.oldValues ?? ''),
      JSON.stringify(l.newValues ?? ''),
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  function exportJSON() {
    if (auditLogs.length === 0) return;
    setExporting(true);
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/admin-console">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const activeTabs: Tab[] = useMemo(() => {
    const tabs: Tab[] = [];
    if (canManageConfig) tabs.push('config', 'flags', 'roles');
    if (canViewAudit) tabs.push('audit');
    return tabs;
  }, [canManageConfig, canViewAudit]);

  const showAccess = !canManageConfig && !canViewAudit;
  if (showAccess) {
    return (
      <AppLayout activePath="/admin-console">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <Shield size={48} className="mx-auto mb-4 text-rose-500" />
            <h2 className="font-heading font-bold text-ink mb-2">Access Restricted</h2>
            <p className="text-mute mb-6">
              You need board/admin configuration permissions ({'config.manage'}) or the{' '}
              <span className="font-mono text-xs">audit.view</span> permission to open the Admin
              Console.
            </p>
            <button
              onClick={() => {}}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/admin-console">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Admin Console</h1>
            <p className="text-mute">
              Governance configuration, feature flags, role assignments, and audit trail.
            </p>
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2">
              <Settings size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-line">
          {activeTabs.map((t) => {
            const Icon = tabIcon[t];
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
                <Icon size={16} />
                <span className={active ? 'font-semibold' : ''}>{tabLabel[t]}</span>
              </button>
            );
          })}
        </div>

        {tab === 'config' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="col-span-1 lg:col-span-1 rounded-xl p-6 bg-card border border-line">
              <div className="flex items-center gap-2 mb-4">
                <Settings size={18} className="text-accent" />
                <h2 className="font-heading font-bold text-ink">Configuration Versions</h2>
              </div>
              <p className="text-xs text-mute mb-4">
                Each version carries an effective-from date. Only the latest effective version
                governs motion weights, quorum, standing, pink-slip and branch-health behaviour.
              </p>
              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">Version</th>
                      <th className="px-4 py-3 font-semibold text-mute">Effective From</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configVersions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-mute">
                          No configuration versions published yet.
                        </td>
                      </tr>
                    ) : (
                      configVersions.map((v) => (
                        <tr key={v.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                          <td className="px-4 py-3 text-sm font-mono text-ink">{v.versionLabel}</td>
                          <td className="px-4 py-3 text-sm text-mute">
                            {formatDate(v.effectiveFrom)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            {v.isScheduled ? (
                              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                                Scheduled
                              </span>
                            ) : v.isEffective ? (
                              <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                                Effective
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                                Superseded
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                const cfg = v.config ? JSON.stringify(v.config, null, 2) : 'null';
                                alert(
                                  `Version ${v.versionLabel}\nEffective: ${v.effectiveFrom}\n\n${cfg}`
                                );
                              }}
                              className="text-xs text-accent hover:underline"
                            >
                              View JSON
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {effectiveVersion && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800">
                  <strong>In effect:</strong> {effectiveVersion.versionLabel} •{' '}
                  {formatDate(effectiveVersion.effectiveFrom)}
                </div>
              )}
            </div>

            <div className="col-span-1 lg:col-span-1 rounded-xl p-6 bg-card border border-line space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Plus size={18} className="text-accent" />
                <h2 className="font-heading font-bold text-ink">Publish New Version</h2>
              </div>
              <form onSubmit={handlePublish} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Version label</label>
                  <input
                    value={newVersionLabel}
                    onChange={(e) => setNewVersionLabel(e.target.value)}
                    placeholder="e.g. v2"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Effective from (date/time)
                  </label>
                  <input
                    type="datetime-local"
                    value={newEffectiveFrom}
                    onChange={(e) => setNewEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Config JSON</label>
                  <textarea
                    value={newConfigJson}
                    onChange={(e) => setNewConfigJson(e.target.value)}
                    rows={6}
                    placeholder="Paste config JSON (leave blank for defaults)"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background font-mono text-xs focus:outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-mute mt-1">
                    Sections: weights, caps, thresholds, class_shares, quorum, league_sizes.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Notes</label>
                  <input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Optional change notes"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={publishing}
                  className="w-full px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
                >
                  {publishing ? 'Publishing…' : 'Publish Version'}
                </button>
              </form>
              <button
                onClick={() => setNewConfigJson(JSON.stringify(defaultConfig, null, 2))}
                className="text-xs text-mute hover:text-accent underline"
              >
                Load default config template
              </button>
            </div>
          </div>
        )}

        {tab === 'flags' && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-accent" />
              <h2 className="font-heading font-bold text-ink">Feature Flags</h2>
            </div>
            <p className="text-xs text-mute mb-4">
              Toggle each feature between Shadow (computed but not enforced) and Live (fully
              enforced).
            </p>
            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line bg-accent-soft">
                    <th className="px-4 py-3 font-semibold text-mute">Feature</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Mode</th>
                    <th className="px-4 py-3 font-semibold text-mute">Description</th>
                    <th className="px-4 py-3 font-semibold text-mute text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {featureFlags.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-mute">
                        No feature flags configured.
                      </td>
                    </tr>
                  ) : (
                    featureFlags.map((f) => (
                      <tr key={f.key} className="border-b border-line/50 hover:bg-accent-soft/5">
                        <td className="px-4 py-3 text-sm font-mono text-ink">{f.key}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button
                            onClick={() => handleToggleFlag(f)}
                            disabled={togglingFlag === f.key}
                            className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                              f.mode === 'live'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >
                            {f.mode === 'live' ? 'Live' : 'Shadow'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-mute">{f.description ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {togglingFlag === f.key ? (
                            <span className="text-xs text-mute animate-pulse">Applying…</span>
                          ) : (
                            <button
                              onClick={() => handleToggleFlag(f)}
                              className="text-xs text-accent hover:underline"
                            >
                              {f.mode === 'live' ? 'Set Shadow' : 'Set Live'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-lg p-3 bg-accent-soft/50 border border-accent/20">
              <label className="block text-xs font-medium text-mute mb-2">Reason for toggle</label>
              <input
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Optional reason (audited)"
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
            </div>
          </div>
        )}

        {tab === 'roles' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="col-span-1 lg:col-span-2 rounded-xl p-6 bg-card border border-line">
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className="text-accent" />
                <h2 className="font-heading font-bold text-ink">Active Role Assignments</h2>
              </div>
              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">Member</th>
                      <th className="px-4 py-3 font-semibold text-mute">Role</th>
                      <th className="px-4 py-3 font-semibold text-mute">Scope</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Granted</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-mute">
                          No active role assignments.
                        </td>
                      </tr>
                    ) : (
                      roleAssignments.map((r) => (
                        <tr key={r.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                          <td className="px-4 py-3 text-sm text-ink">{r.profileName}</td>
                          <td className="px-4 py-3 text-sm text-mute">{r.role}</td>
                          <td className="px-4 py-3 text-sm text-mute">{r.scope}</td>
                          <td className="px-4 py-3 text-sm text-mute text-center">
                            {formatDate(r.grantedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRevokeRole(r.id)}
                              disabled={revokingId === r.id}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              {revokingId === r.id ? 'Revoking…' : 'Revoke'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-span-1 lg:col-span-1 rounded-xl p-6 bg-card border border-line space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Plus size={18} className="text-accent" />
                <h2 className="font-heading font-bold text-ink">Grant Role</h2>
              </div>
              <form onSubmit={handleGrantRole} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Member (profile ID)
                  </label>
                  <input
                    value={grantProfileId}
                    onChange={(e) => setGrantProfileId(e.target.value)}
                    placeholder="Paste member profile ID"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm font-mono"
                  />
                </div>
                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-mute mb-1">Role</label>
                    <input
                      value={grantRoleName}
                      onChange={(e) => setGrantRoleName(e.target.value)}
                      placeholder="e.g. domain_head"
                      className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mute mb-1">Scope</label>
                    <select
                      value={grantScope}
                      onChange={(e) => setGrantScope(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    >
                      <option value="self">Self</option>
                      <option value="team">Team</option>
                      <option value="domain">Domain</option>
                      <option value="branch">Branch</option>
                      <option value="org">Org</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">
                    Scope entity ID
                  </label>
                  <input
                    value={grantEntityId}
                    onChange={(e) => setGrantEntityId(e.target.value)}
                    placeholder="Optional branch/domain/team ID"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Expires at</label>
                  <input
                    type="datetime-local"
                    value={grantExpiresAt}
                    onChange={(e) => setGrantExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Reason</label>
                  <input
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    placeholder="Optional reason (audited)"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={grantLoading}
                  className="w-full px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
                >
                  {grantLoading ? 'Granting…' : 'Grant Role'}
                </button>
              </form>
            </div>

            <div className="col-span-1 lg:col-span-2 rounded-xl p-6 bg-card border border-line mt-0 lg:mt-auto">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={18} className="text-accent" />
                <h2 className="font-heading font-bold text-ink">Role Assignment History</h2>
              </div>
              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">When</th>
                      <th className="px-4 py-3 font-semibold text-mute">Member</th>
                      <th className="px-4 py-3 font-semibold text-mute">Action</th>
                      <th className="px-4 py-3 font-semibold text-mute">Role / Scope</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-mute">
                          No role history yet.
                        </td>
                      </tr>
                    ) : (
                      roleHistory.map((h) => (
                        <tr key={h.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                          <td className="px-4 py-3 text-sm font-mono text-mute">
                            {formatDate(h.changedAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-ink">{h.profileName}</td>
                          <td className="px-4 py-3 text-sm font-mono text-ink">{h.action}</td>
                          <td className="px-4 py-3 text-sm text-mute">
                            {h.role ?? '—'} / {h.scope ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-mute text-right">
                            {h.reason ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading font-bold text-ink">Audit Trail</h2>
                <p className="text-mute">
                  Immutable log of all system actions. Requires{' '}
                  <span className="font-mono text-xs">audit.view</span> permission.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportCSV}
                  disabled={exporting || auditLogs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line bg-card text-sm text-ink disabled:opacity-50 hover:bg-accent-soft transition-colors"
                >
                  <FileCheck size={16} /> Export CSV
                </button>
                <button
                  onClick={exportJSON}
                  disabled={exporting || auditLogs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line bg-card text-sm text-ink disabled:opacity-50 hover:bg-accent-soft transition-colors"
                >
                  <FileCheck size={16} /> Export JSON
                </button>
              </div>
            </div>

            <div className="rounded-xl p-6 bg-card border border-line">
              <div className="flex flex-col lg:flex-row gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-mute mb-2">Actor</label>
                  <input
                    value={auditFilters.actor}
                    onChange={(e) => setAuditFilters({ ...auditFilters, actor: e.target.value })}
                    placeholder="Filter by actor name…"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-mute mb-2">Action</label>
                  <input
                    value={auditFilters.action}
                    onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                    placeholder="Filter by action…"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-mute mb-2">Table</label>
                  <input
                    value={auditFilters.table}
                    onChange={(e) => setAuditFilters({ ...auditFilters, table: e.target.value })}
                    placeholder="Filter by table…"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-mute mb-2">Date Range</label>
                  <div className="grid gap-2 grid-cols-2">
                    <input
                      type="date"
                      value={auditFilters.startDate}
                      onChange={(e) =>
                        setAuditFilters({ ...auditFilters, startDate: e.target.value })
                      }
                      className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                    <input
                      type="date"
                      value={auditFilters.endDate}
                      onChange={(e) =>
                        setAuditFilters({ ...auditFilters, endDate: e.target.value })
                      }
                      className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={loadAudit}
                  className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute w-24">Created At</th>
                      <th className="px-4 py-3 font-semibold text-mute">Actor</th>
                      <th className="px-4 py-3 font-semibold text-mute w-40">Action</th>
                      <th className="px-4 py-3 font-semibold text-mute w-32">Table</th>
                      <th className="px-4 py-3 font-semibold text-mute w-24">Record ID</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right">Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-mute">
                          No audit logs found.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((l) => (
                        <tr key={l.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                          <td className="px-4 py-3 text-mute font-mono text-xs">
                            {formatDate(l.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-ink">
                            <div className="flex items-center gap-2">
                              <User size={14} className="text-mute" />
                              <span>{l.actorName || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink">{l.action}</td>
                          <td className="px-4 py-3 text-mute text-xs">{l.tableName ?? '—'}</td>
                          <td className="px-4 py-3 text-mute font-mono text-xs">
                            {l.recordId || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                const detail = `Old: ${JSON.stringify(l.oldValues)}\nNew: ${JSON.stringify(l.newValues)}`;
                                alert(detail);
                              }}
                              className="text-xs text-accent hover:underline"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {auditLogs.length > 0 && (
                <div className="px-4 py-3 border-t border-line bg-accent-soft/50 text-xs text-mute flex justify-between">
                  <span>
                    {auditLogs.length} log entr{auditLogs.length === 1 ? 'y' : 'ies'}
                  </span>
                  <span>Showing most recent 500 entries</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
