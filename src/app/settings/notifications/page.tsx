'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSetting,
} from '@/lib/api';
import { can } from '@/lib/permissions';
import { Bell, Clock, Send, AlertTriangle } from 'lucide-react';

export default function SettingsNotificationsPage() {
  const { user, isLoading } = useAuth();
  const [settings, setSettings] = useState<NotificationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    inApp: boolean;
    discordDm: boolean;
    email: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    maxProactiveNudgesPerWeek: number;
    autoPauseOnLeave: boolean;
    autoPauseOnExams: boolean;
    leaveUntil: string;
    examUntil: string;
  }>({
    inApp: true,
    discordDm: false,
    email: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    maxProactiveNudgesPerWeek: 2,
    autoPauseOnLeave: false,
    autoPauseOnExams: false,
    leaveUntil: '',
    examUntil: '',
  });

  const canManageSettings = user
    ? can(user.roles as any, 'claim.submit_self', 'self', user.scopes as any)
    : false;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const s = await getNotificationSettings();
      if (s) {
        setSettings(s);
        setForm({
          inApp: s.inApp,
          discordDm: s.discordDm,
          email: s.email,
          quietHoursStart: s.quietHoursStart,
          quietHoursEnd: s.quietHoursEnd,
          maxProactiveNudgesPerWeek: s.maxProactiveNudgesPerWeek,
          autoPauseOnLeave: s.autoPauseOnLeave,
          autoPauseOnExams: s.autoPauseOnExams,
          leaveUntil: s.leaveUntil ?? '',
          examUntil: s.examUntil ?? '',
        });
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!canManageSettings) return;
    setSaving(true);
    try {
      await updateNotificationSettings({
        inApp: form.inApp,
        discordDm: form.discordDm,
        email: form.email,
        quietHoursStart: form.quietHoursStart,
        quietHoursEnd: form.quietHoursEnd,
        maxProactiveNudgesPerWeek: form.maxProactiveNudgesPerWeek,
        autoPauseOnLeave: form.autoPauseOnLeave,
        autoPauseOnExams: form.autoPauseOnExams,
        leaveUntil: form.leaveUntil || null,
        examUntil: form.examUntil || null,
      });
      if (settings) {
        setSettings({ ...settings, ...form, updatedAt: new Date().toISOString() });
      }
      alert('Notification settings saved.');
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/settings/notifications">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canManageSettings) {
    return (
      <AppLayout activePath="/settings/notifications">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <AlertTriangle size={48} className="mx-auto mb-4 text-rosecustom" />
            <h2 className="font-heading font-bold text-ink mb-2">Not Authorized</h2>
            <p className="text-mute">You don't have permission to access notification settings.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/settings/notifications">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Notification Settings</h1>
            <p className="text-mute">
              Choose how you want to receive GDU XP notifications and set your availability
              preferences.
            </p>
          </div>
        </div>

        {/* Delivery Channels */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center gap-2 mb-6">
            <Bell size={20} className="text-accent" />
            <h2 className="font-heading font-bold text-ink">Delivery Channels</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-line bg-muted/30">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-muted-foreground" />
                <div>
                  <p className="font-medium text-ink text-sm">In-App Notifications</p>
                  <p className="text-[11px] text-muted-foreground">
                    Receive notifications directly in the GDU XP app
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.inApp}
                  onChange={(e) => setForm({ ...form, inApp: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border peer peer-focus:outline-none rounded-full peer-checked:bg-accent after:absolute after:after:left-1 after:top-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-line bg-muted/30">
              <div className="flex items-center gap-3">
                <Send size={18} className="text-muted-foreground" />
                <div>
                  <p className="font-medium text-ink text-sm">Discord DM</p>
                  <p className="text-[11px] text-muted-foreground">
                    Receive notifications via Discord direct message
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.discordDm}
                  onChange={(e) => setForm({ ...form, discordDm: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border peer peer-focus:outline-none rounded-full peer-checked:bg-accent after:absolute after:after:left-1 after:top-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-line bg-muted/30">
              <div className="flex items-center gap-3">
                <Send size={18} className="text-muted-foreground" />
                <div>
                  <p className="font-medium text-ink text-sm">Email</p>
                  <p className="text-[11px] text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border peer peer-focus:outline-none rounded-full peer-checked:bg-accent after:absolute after:after:left-1 after:top-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center gap-2 mb-6">
            <Clock size={20} className="text-ambercustom" />
            <h2 className="font-heading font-bold text-ink">Quiet Hours</h2>
          </div>
          <p className="text-sm text-mute mb-4">
            Notifications will be silenced during your quiet hours.
          </p>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">Start</label>
              <input
                type="time"
                value={form.quietHoursStart}
                onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">End</label>
              <input
                type="time"
                value={form.quietHoursEnd}
                onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
            </div>
          </div>
        </div>

        {/* Proactive Nudges */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center gap-2 mb-6">
            <Clock size={20} className="text-violetcustom" />
            <h2 className="font-heading font-bold text-ink">Proactive Nudges</h2>
          </div>
          <p className="text-sm text-mute mb-4">
            Maximum number of proactive nudges per week (weekly digest, watch warnings, etc.).
          </p>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-mute">Max per week</label>
            <input
              type="number"
              min="0"
              max="10"
              value={form.maxProactiveNudgesPerWeek}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxProactiveNudgesPerWeek: Math.min(10, Math.max(0, Number(e.target.value) || 0)),
                })
              }
              className="w-20 px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
            />
            <p className="text-xs text-muted-foreground">Default: 2 nudges per week</p>
          </div>
        </div>

        {/* Auto-Pause */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle size={20} className="text-ambercustom" />
            <h2 className="font-heading font-bold text-ink">Auto-Pause</h2>
          </div>
          <p className="text-sm text-mute mb-4">
            Automatically pause notifications during leave or exam periods.
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-line bg-muted/50">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-muted-foreground" />
                <div>
                  <p className="font-medium text-ink text-sm">Pause during leave</p>
                  <p className="text-[11px] text-muted-foreground">
                    Suspend notifications while on approved leave
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoPauseOnLeave}
                  onChange={(e) => setForm({ ...form, autoPauseOnLeave: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border peer peer-focus:outline-none rounded-full peer-checked:bg-accent after:absolute after:after:left-1 after:top-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">
                Leave until (optional)
              </label>
              <input
                type="datetime-local"
                value={form.leaveUntil}
                onChange={(e) => setForm({ ...form, leaveUntil: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-line bg-muted/50">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-ambercustom" />
                <div>
                  <p className="font-medium text-ink text-sm">Pause during exams</p>
                  <p className="text-[11px] text-muted-foreground">
                    Suspend notifications during exam periods
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoPauseOnExams}
                  onChange={(e) => setForm({ ...form, autoPauseOnExams: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-border peer peer-focus:outline-none rounded-full peer-checked:bg-accent after:absolute after:after:left-1 after:top-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-mute mb-1.5">
                Exams until (optional)
              </label>
              <input
                type="datetime-local"
                value={form.examUntil}
                onChange={(e) => setForm({ ...form, examUntil: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
