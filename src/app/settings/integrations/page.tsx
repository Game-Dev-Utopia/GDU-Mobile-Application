'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getIntegrations,
  toggleIntegration,
  type Integration,
  type IntegrationProvider,
} from '@/lib/api';
import { can } from '@/lib/permissions';
import { AlertCircle, Github, Loader2, Mail, Shield } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

const INTEGRATION_DETAILS: Record<IntegrationProvider, { icon: any; note: string }> = {
  github: {
    icon: Github,
    note: 'Ingests PR merges, issue closes, review activity and commit counts from connected repos.',
  },
  discord: {
    icon: Mail,
    note: 'Ingests message reactions, event RSVPs and voice-channel attendance from the Discord server.',
  },
  social: {
    icon: Shield,
    note: 'Ingests public stars, shares and community mentions across social platforms.',
  },
};

export default function SettingsIntegrationsPage() {
  const { user, isLoading } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = user
    ? can(user.roles as any, 'roles.manage', 'org', user.scopes as any)
    : false;

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getIntegrations();
      setIntegrations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(provider: IntegrationProvider, connected: boolean) {
    setToggling(provider);
    setError(null);
    try {
      await toggleIntegration(provider, connected);
      setIntegrations((prev) =>
        prev.map((i) =>
          i.provider === provider
            ? {
                ...i,
                connected,
                connectedAt: connected ? new Date().toISOString() : i.connectedAt,
              }
            : i
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update integration.');
    } finally {
      setToggling(null);
    }
  }

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/settings/integrations">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/settings/integrations">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Integrations</h1>
            <p className="text-mute">
              Connect third-party services to ingest activity data into GDU XP.
            </p>
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {integrations.length === 0 ? (
            <EmptyState
              icon={Github}
              title="No integrations connected"
              description="Connect GitHub, Discord, or social accounts to ingest activity data."
              action="Connect"
            />
          ) : (
            <>
              {Object.entries(INTEGRATION_DETAILS).map(([provider, detail]) => {
            const integration = integrations.find((i) => i.provider === provider);
            const connected = integration?.connected ?? false;
            const Icon = detail.icon;
            return (
              <div
                key={provider}
                className={`rounded-xl p-6 bg-card border border-line transition-colors ${
                  connected ? 'bg-accent/10 border-accent/50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Icon
                      size={20}
                      className={connected ? 'text-accent' : 'text-muted-foreground'}
                    />
                    <div>
                      <p className="font-medium text-ink text-sm">{provider}</p>
                      <p className="text-[11px] text-muted-foreground">{detail.note}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      connected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-line/50">
                  <button
                    onClick={() => handleToggle(provider as IntegrationProvider, !connected)}
                    disabled={toggling === provider || !canManage}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      canManage
                        ? connected
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : 'bg-accent text-white hover:bg-accent/90'
                        : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {toggling === provider ? 'Updating…' : connected ? 'Disconnect' : 'Connect'}
                  </button>
                  {!canManage && (
                    <span className="text-[10px] text-muted-foreground">Admin only</span>
                  )}
                </div>
              </div>
            );
          })}
            </>
          )}
        </div>

        {!canManage && (
          <div className="rounded-xl p-6 bg-card border border-line">
            <h2 className="font-heading font-bold text-ink mb-2">Manage Integrations</h2>
            <p className="text-mute text-sm mb-4">
              Connecting and disconnecting integrations requires board/admin permissions.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
