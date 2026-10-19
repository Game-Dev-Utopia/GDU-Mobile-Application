'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { RequireRole } from '@/components/RequireRole';
import { Permission } from '@/lib/permissions';
import {
  getArticlesVersions,
  getMouRegister,
  getFilingCalendar,
  type ArticlesVersion,
  type MouRegister,
  type FilingCalendar,
} from '@/lib/api';

export default function CompliancePage() {
  const { user, isLoading } = useAuth();
  const [articles, setArticles] = useState<ArticlesVersion[]>([]);
  [articles];
  const [mous, setMous] = useState<MouRegister[]>([]);
  [mous];
  const [filings, setFilings] = useState<FilingCalendar[]>([]);
  [filings];
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user]);

  async function loadData() {
    setLoading(true);
    const [arts, mouList, fileList] = await Promise.all([
      getArticlesVersions(),
      getMouRegister(),
      getFilingCalendar(),
    ]);
    setArticles(arts);
    setMous(mouList);
    setFilings(fileList);
    setLoading(false);
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/compliance">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const expiringSoon = mous.filter((m) => {
    const days = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 30 && days > 0;
  });

  return (
    <AppLayout activePath="/compliance">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Compliance Console</h1>
            <p className="text-mute">Articles, MoUs, filings, and audit pack</p>
          </div>
        </div>

        {/* Expiry Alerts */}
        {expiringSoon.length > 0 && (
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
            <h3 className="font-bold text-amber-800 text-sm mb-2">MoU Expiry Alerts</h3>
            <p className="text-amber-700 text-xs">
              {expiringSoon.length} MoU(s) expiring within 30 days:{' '}
              {expiringSoon.map((m) => m.partnerName).join(', ')}
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Articles */}
          <div className="rounded-xl p-6 bg-card border border-line">
            <h3 className="font-heading font-bold text-ink mb-4">Articles & Bylaws</h3>
            <div className="space-y-3">
              {articles.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent-soft/5 border border-accent/20"
                >
                  <div>
                    <div className="text-sm font-medium text-ink">{a.versionLabel}</div>
                    <div className="text-xs text-mute">
                      {new Date(a.effectiveFrom).toLocaleDateString()}
                    </div>
                  </div>
                  <a
                    href={a.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    View Document
                  </a>
                </div>
              ))}
              {articles.length === 0 && (
                <div className="text-xs text-mute text-center py-4">No articles versions.</div>
              )}
            </div>
          </div>

          {/* MoU Register */}
          <div className="rounded-xl p-6 bg-card border border-line">
            <h3 className="font-heading font-bold text-ink mb-3">MoU Register</h3>
            <div className="space-y-3">
              {mous.map((m) => {
                const days = Math.ceil(
                  (new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isExpiring = days <= 30 && days > 0;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${isExpiring ? 'bg-amber-50 border border-amber-200' : 'bg-accent-soft/5 border border-accent/20'}`}
                  >
                    <div>
                      <div className="text-sm font-medium text-ink">{m.partnerName}</div>
                      <div className="text-xs text-mute">
                        {m.partnerType} • Expires {new Date(m.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold ${isExpiring ? 'text-amber-700' : 'text-mute'}`}
                    >
                      {m.status}
                    </span>
                  </div>
                );
              })}
              {mous.length === 0 && (
                <div className="text-xs text-mute text-center py-4">No MoUs registered.</div>
              )}
            </div>
          </div>

          {/* Filing Calendar */}
          <div className="rounded-xl p-6 bg-card border border-line">
            <h3 className="font-heading font-bold text-ink mb-3">Filing Calendar</h3>
            <div className="space-y-3">
              {filings.map((f) => {
                const days = Math.ceil(
                  (new Date(f.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isOverdue = days < 0;
                const isDueSoon = days <= 7 && days >= 0;
                return (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${isOverdue ? 'bg-rose-50 border border-rose-200' : isDueSoon ? 'bg-amber-50 border border-amber-200' : 'bg-accent-soft/5 border border-accent/20'}`}
                  >
                    <div>
                      <div className="text-sm font-medium text-ink">{f.filingName}</div>
                      <div className="text-xs text-mute">
                        {f.filingType} • Due {new Date(f.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold ${isOverdue ? 'text-rose-700' : isDueSoon ? 'text-amber-700' : 'text-mute'}`}
                    >
                      {f.status}
                    </span>
                  </div>
                );
              })}
              {filings.length === 0 && (
                <div className="text-xs text-mute text-center py-4">No filings scheduled.</div>
              )}
            </div>
          </div>
        </div>

        {/* Audit Pack */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <h3 className="font-heading font-bold text-ink mb-4">Export Audit Pack</h3>
          <p className="text-xs text-mute mb-4">
            Exportable audit pack for your CS or CA. Includes Articles/bylaw versions, motion
            records, MoU register, filing calendar, and full audit log.
          </p>
          <button className="px-4 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors">
            Export Audit Pack
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
