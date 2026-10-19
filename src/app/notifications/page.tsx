'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getNotifications,
  markNotificationRead,
  dismissNotification,
  getSampleNotifications,
  getNotificationSettings,
  type Notification,
  type NotificationType,
} from '@/lib/api';
import { can } from '@/lib/permissions';

const TYPE_LABELS: Record<NotificationType, { label: string; color: string; icon: string }> = {
  weekly_digest: { label: 'Weekly Digest', color: 'text-cyancustom', icon: '📊' },
  watch_warning: { label: 'Watch Warning', color: 'text-ambercustom', icon: '⚠️' },
  critical_alert: { label: 'Critical Alert', color: 'text-rosecustom', icon: '🚨' },
  attendance_reminder: { label: 'Attendance Reminder', color: 'text-violetcustom', icon: '📅' },
  approver_reminder: { label: 'Approver Reminder', color: 'text-violetcustom', icon: '✅' },
  system: { label: 'System', color: 'text-muted-foreground', icon: 'ℹ️' },
  claim_update: { label: 'Claim Update', color: 'text-accent', icon: '📋' },
  reward: { label: 'Reward', color: 'text-greencustom', icon: '🏆' },
  penalty: { label: 'Penalty', color: 'text-rosecustom', icon: '⛔️' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(iso);
}

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [notifs, settingsData] = await Promise.all([
        getNotifications({ limit: 50 }),
        getNotificationSettings(),
      ]);
      setSettings(settingsData);
      // Use real notifications if available, otherwise sample data
      setNotifications(notifs.length > 0 ? notifs : getSampleNotifications(user.id));
    } catch {
      setNotifications(getSampleNotifications(user.id));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.isRead && !n.isDismissed).length;

  const canManageSettings = user
    ? can(user.roles as any, 'claim.submit_self', 'self', user.scopes as any)
    : false;

  async function handleMarkRead(id: string) {
    setReading((prev) => new Set([...prev, id]));
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
    } catch {
      // Error handled silently
    } finally {
      setReading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDismiss(id: string) {
    setDismissing((prev) => new Set([...prev, id]));
    try {
      await dismissNotification(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isDismissed: true, dismissedAt: new Date().toISOString() } : n
        )
      );
    } catch {
      // Error handled silently
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const typeFilter = useMemo(() => {
    const types = new Set(notifications.map((n) => n.type));
    return Array.from(types);
  }, [notifications]);

  if (loading || !user) {
    return (
      <AppLayout activePath="/notifications">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const activeNotifications = notifications.filter((n) => !n.isDismissed);

  return (
    <AppLayout activePath="/notifications">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Notifications</h1>
            <p className="text-mute">
              {unreadCount > 0 ? (
                <span className="font-semibold text-ink">{unreadCount} unread</span>
              ) : (
                'All caught up'
              )}{' '}
              · Manage preferences in Settings
            </p>
          </div>
          {canManageSettings && (
            <a
              href="/settings/notifications"
              className="px-4 py-2.5 rounded-lg border border-line bg-card text-sm font-medium hover:bg-accent-soft transition-colors"
            >
              Notification Settings
            </a>
          )}
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => {}}
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-colors"
          >
            All ({activeNotifications.length})
          </button>
          {typeFilter.map((t) => {
            const cfg = TYPE_LABELS[t as NotificationType];
            const count = activeNotifications.filter((n) => n.type === t).length;
            return (
              <button
                key={t}
                onClick={() => {}}
                className={`px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-bold text-mute hover:text-foreground transition-colors ${cfg.color}`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {activeNotifications.length === 0 ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <div className="w-16 h-16 bg-accent-soft/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="font-heading font-bold text-ink mb-2">No notifications</h3>
            <p className="text-mute">You're all caught up. Check back later for updates.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeNotifications.map((n) => {
              const cfg = TYPE_LABELS[n.type as NotificationType];
              const isUnread = !n.isRead;
              return (
                <div
                  key={n.id}
                  className={`rounded-xl p-4 border transition-colors hover:bg-accent-soft/5 ${
                    isUnread ? 'bg-accent-soft/30 border-accent/30' : 'border-line bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      <span className="text-[10px] text-mute font-mono">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          disabled={reading.has(n.id)}
                          className="p-1.5 rounded hover:bg-muted/30 transition-colors"
                          title="Mark as read"
                        >
                          <svg
                            className="w-3 h-3 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(n.id)}
                        disabled={dismissing.has(n.id)}
                        className="p-1.5 rounded hover:bg-muted/30 transition-colors"
                        title="Dismiss"
                      >
                        <svg
                          className="w-3 h-3 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <h3 className="font-heading font-bold text-ink mb-1">{n.title}</h3>
                  <p className="text-sm text-mute mb-3">{n.body}</p>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className={`text-muted-foreground font-mono`}>
                      {n.channel === 'in_app'
                        ? 'In-app'
                        : n.channel === 'discord_dm'
                          ? 'Discord DM'
                          : 'Email'}
                    </span>
                    {n.isRead && <span className="text-xs text-muted-foreground">Read</span>}
                    <span className="text-muted-foreground">{formatDate(n.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
