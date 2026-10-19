'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { getAuditLogs, type AuditLogEntry } from '@/lib/api';
import { can } from '@/lib/permissions';
import { FileCheck, Clock, User } from 'lucide-react';

export default function AuditPage() {
  const { user, isLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    actor: '',
    action: '',
    table: '',
    startDate: '',
    endDate: '',
  });
  const [exporting, setExporting] = useState(false);

  const canViewAudit = user
    ? can(user.roles as any, 'audit.view', 'org', user.scopes as any)
    : false;

  useEffect(() => {
    if (!isLoading && user) {
      loadLogs();
    }
  }, [isLoading, user, filters]);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        actorId: filters.actor || undefined,
        action: filters.action || undefined,
        tableName: filters.table || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        limit: 500,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (logs.length === 0) return;
    setExporting(true);
    const headers = [
      'ID',
      'Actor',
      'Action',
      'Table',
      'Record ID',
      'Old Values',
      'New Values',
      'Created At',
    ];
    const rows = logs.map((l) => [
      l.id,
      l.actorName || '',
      l.action,
      l.tableName || '',
      l.recordId || '',
      JSON.stringify(l.oldValues ?? ''),
      JSON.stringify(l.newValues ?? ''),
      l.createdAt,
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

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/audit">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canViewAudit) {
    return (
      <AppLayout activePath="/audit">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <Clock size={48} className="mx-auto mb-4 text-rose-500" />
            <h2 className="font-heading font-bold text-ink mb-2">Access Denied</h2>
            <p className="text-mute mb-6">
              You need the <span className="font-mono text-rose-600">audit.view</span> permission to
              view the audit trail.
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

  const actions = [...new Set(logs.map((l) => l.action))].sort();
  const tables = [...new Set(logs.map((l) => l.tableName).filter((t): t is string => !!t))].sort();

  return (
    <AppLayout activePath="/audit">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Audit Trail</h1>
            <p className="text-mute">
              Immutable log of all system actions. Requires{' '}
              <span className="font-mono text-xs">audit.view</span> permission.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              disabled={exporting || logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line bg-card text-sm text-ink hover:bg-accent-soft disabled:opacity-50 transition-colors"
            >
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-mute mb-2">Actor</label>
              <input
                value={filters.actor}
                onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
                placeholder="Filter by actor name..."
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-mute mb-2">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              >
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-mute mb-2">Table</label>
              <select
                value={filters.table}
                onChange={(e) => setFilters({ ...filters, table: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              >
                <option value="">All tables</option>
                {tables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-mute mb-2">Date Range</label>
              <div className="grid gap-2 grid-cols-2">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
            </div>
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
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-mute">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                      <td className="px-4 py-3 text-mute font-mono text-xs">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-mute" />
                          <span>{l.actorName || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{l.action}</td>
                      <td className="px-4 py-3 text-mute text-xs">{l.tableName ?? '—'}</td>
                      <td className="px-4 py-3 text-mute font-mono text-xs">{l.recordId || '—'}</td>
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
          {logs.length > 0 && (
            <div className="px-4 py-3 border-t border-line bg-accent-soft/50 text-xs text-mute flex justify-between">
              <span>
                {logs.length} log entr{logs.length === 1 ? 'y' : 'ies'}
              </span>
              <span>Showing most recent 500 entries</span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
