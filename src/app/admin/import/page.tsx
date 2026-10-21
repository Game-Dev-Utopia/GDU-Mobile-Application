'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  createImportJob,
  confirmImport,
  getMembers,
  getActivityTypes,
  type ActivityType,
  type ImportRow,
  type MemberOption,
} from '@/lib/api';
import { can } from '@/lib/permissions';
import { AlertCircle, CheckCircle, Loader2, Upload, User } from 'lucide-react';

type Step = 'upload' | 'map' | 'preview' | 'done';

interface RawRow {
  [key: string]: string;
}

export default function AdminImportPage() {
  const { user, isLoading } = useAuth();
  const roles = user?.roles || [];
  const scopes = user?.scopes || [];
  const canImport = can(roles as any, 'roles.manage', 'org', scopes as any);

  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Reference data
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);

  // Upload state
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Mapping state
  const [mapping, setMapping] = useState<Record<string, string>>({
    member: '',
    activity: '',
    date: '',
    exp: '',
  });

  // Preview state
  const [rows, setRows] = useState<
    {
      raw: RawRow;
      mapped: ImportRow;
      errors: string[];
    }[]
  >([]);

  // Job/confirm state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const loadReference = useCallback(async () => {
    const [m, a] = await Promise.all([getMembers(), getActivityTypes()]);
    setMembers(m);
    setActivities(a);
  }, []);

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/admin/import">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canImport) {
    return (
      <AppLayout activePath="/admin/import">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <AlertCircle size={48} className="mx-auto mb-4 text-rose-500" />
            <h2 className="font-heading font-bold text-ink mb-2">Not Authorized</h2>
            <p className="text-mute">Importing claims requires board/admin permissions.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const stepLabel: Record<Step, string> = {
    upload: '1. Upload CSV',
    map: '2. Map Columns',
    preview: '3. Preview & Validate',
    done: '4. Complete',
  };

  const parseCsv = (text: string): RawRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.replace(/"/g, '').trim());
      const row: RawRow = {};
      header.forEach((h, i) => {
        row[h] = values[i] ?? '';
      });
      return row;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setError(null);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = parseCsv(text);
        setRawRows(parsed);
        setHeaders(parsed.length > 0 ? Object.keys(parsed[0]) : []);
        setMapping({ member: '', activity: '', date: '', exp: '' });
        setStep('map');
      } catch {
        setError('Failed to parse CSV file.');
      }
    };
    reader.readAsText(e.target.files?.[0]!);
  };

  const goToPreview = () => {
    const required = ['member', 'activity', 'date', 'exp'];
    const missing = required.filter((k) => !mapping[k]);
    if (missing.length > 0) {
      setError(`Please map: ${missing.join(', ')}.`);
      return;
    }
    setError(null);
    const mappedRows = rawRows.map((raw) => {
      const mapped: ImportRow = {
        member: raw[mapping.member] ?? '',
        activity: raw[mapping.activity] ?? '',
        date: raw[mapping.date] ?? '',
        exp: Number(raw[mapping.exp] ?? ''),
      };
      const errors: string[] = [];
      if (!mapped.member) errors.push('Missing member');
      if (!mapped.activity) errors.push('Missing activity');
      if (!mapped.date || isNaN(new Date(mapped.date).getTime())) errors.push('Invalid date');
      if (!mapped.exp || mapped.exp <= 0) errors.push('Invalid EXP');
      return { raw, mapped, errors };
    });
    setRows(mappedRows);
    setStep('preview');
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const job = await createImportJob('import.csv');
      const importRows = rows.map((r) => r.mapped);
      const result = await confirmImport(job, importRows);
      setResult(result);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const memberByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.displayName.toLowerCase(), m.id);
      map.set(m.username.toLowerCase(), m.id);
    }
    return map;
  }, [members]);

  const activityByName = useMemo(() => {
    const map = new Map<string, ActivityType>();
    for (const a of activities) map.set(a.name.toLowerCase(), a);
    return map;
  }, [activities]);

  const validatedRows = useMemo(() => {
    return rows.map((row) => {
      const errors: string[] = [...row.errors];
      const memberId = memberByName.get(row.mapped.member.toLowerCase());
      const activity = activityByName.get(row.mapped.activity.toLowerCase());
      if (!memberId) errors.push(`Unknown member: ${row.mapped.member}`);
      if (!activity) errors.push(`Unknown activity: ${row.mapped.activity}`);
      else if (row.mapped.exp < activity.expMin || row.mapped.exp > activity.expMax) {
        errors.push(`EXP ${row.mapped.exp} outside range [${activity.expMin}-${activity.expMax}]`);
      }
      return { ...row, memberId, activity, errors };
    });
  }, [rows, memberByName, activityByName]);

  const canConfirm = validatedRows.every((r) => r.errors.length === 0) && validatedRows.length > 0;

  const StepContent = () => {
    if (step === 'upload') {
      return (
        <div className="rounded-xl p-8 bg-card border border-line text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-6">
            <Upload size={48} className="text-accent" />
          </div>
          <h2 className="font-heading font-bold text-ink mb-2">Import Claims from CSV</h2>
          <p className="text-mute mb-6">
            Upload a CSV with columns:{' '}
            <code className="font-mono text-xs text-accent">member, activity, date, exp</code>{' '}
            <span className="text-xs text-mute">(example: alice, Bug Fix, 2026-10-15, 150)</span>
          </p>
          <label className="block">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={submitting}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-accent-hover hover:file:bg-accent/90"
            />
          </label>
          {rawRows.length > 0 && (
            <div className="mt-6 overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-accent-soft">
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold text-mute">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b border-line/50">
                      {headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-mute font-mono">
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rawRows.length > 10 && (
                    <tr>
                      <td colSpan={headers.length} className="px-3 py-2 text-center text-mute">
                        …and {rawRows.length - 10} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (step === 'map') {
      const selectOptions = (value: string, options: { label: string; value: string }[]) => (
        <select
          value={mapping[value] ?? ''}
          onChange={(e) => setMapping({ ...mapping, [value]: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
        >
          <option value="">— Select column —</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      );
      return (
        <div className="rounded-xl p-8 bg-card border border-line max-w-2xl mx-auto">
          <h2 className="font-heading font-bold text-ink mb-6">Map Columns</h2>
          <p className="text-mute mb-6">Match each CSV column to the corresponding import field.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">Member</label>
              {selectOptions('member', [])}
            </div>
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">Activity</label>
              {selectOptions('activity', [])}
            </div>
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">Date</label>
              {selectOptions('date', [])}
            </div>
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">EXP</label>
              {selectOptions('exp', [])}
            </div>
          </div>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Back
            </button>
            <button
              onClick={goToPreview}
              disabled={!mapping.member || !mapping.activity || !mapping.date || !mapping.exp}
              className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (step === 'preview') {
      const totalErrors = validatedRows.reduce((sum, r) => sum + r.errors.length, 0);
      return (
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading font-bold text-ink">Preview &amp; Validate</h2>
              <p className="text-mute">
                {validatedRows.length} row(s) found.{' '}
                {totalErrors > 0 ? (
                  <span className="text-rose-600 font-medium">
                    {totalErrors} validation error(s) must be fixed before import.
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">All rows valid.</span>
                )}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto border border-line rounded-lg mb-6">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-4 py-3 font-semibold text-mute">Member</th>
                  <th className="px-4 py-3 font-semibold text-mute">Activity</th>
                  <th className="px-4 py-3 font-semibold text-mute text-center">Date</th>
                  <th className="px-4 py-3 font-semibold text-mute text-center">EXP</th>
                  <th className="px-4 py-3 font-semibold text-mute text-right">Errors</th>
                </tr>
              </thead>
              <tbody>
                {validatedRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-line/50 ${row.errors.length > 0 ? 'bg-rose-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm text-ink">
                      {row.mapped.member}
                      {row.memberId ? ' ✓' : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {row.mapped.activity}
                      {row.activity ? ' ✓' : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-mute text-center">{row.mapped.date}</td>
                    <td className="px-4 py-3 text-sm text-mute text-center">{row.mapped.exp}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {row.errors.length > 0 ? (
                        <span className="text-rose-600 text-xs">{row.errors.join('; ')}</span>
                      ) : (
                        <span className="text-green-600 text-xs">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('map')}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting || !canConfirm}
              className="px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
            >
              {submitting ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </div>
      );
    }

    if (step === 'done') {
      return (
        <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md mx-auto">
          <div className="flex items-center justify-center mb-6">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <h2 className="font-heading font-bold text-ink mb-2">Import Complete</h2>
          <p className="text-mute mb-6">
            {result?.imported} entr{result?.imported === 1 ? 'y' : 'ies'} imported.{' '}
            {result && result.errors.length > 0 ? (
              <span className="text-rose-600">{result.errors.length} had errors.</span>
            ) : null}
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => {
                setStep('upload');
                setResult(null);
                setRawRows([]);
                setHeaders([]);
                setRows([]);
              }}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Import Another
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <AppLayout activePath="/admin/import">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Admin Import</h1>
            <p className="text-mute">
              Bulk import claims from CSV. Rows are tagged 'imported' in history.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-accent-soft/50 text-sm">
            <User size={16} className="text-mute" />
            <span>{stepLabel[step]}</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 flex items-start gap-2">
            <CheckCircle size={16} className="mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        <StepContent />
      </div>
    </AppLayout>
  );
}
