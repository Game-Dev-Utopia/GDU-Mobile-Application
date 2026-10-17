'use client';

import React, { useEffect, useState } from 'react';
import { getAnnouncements } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      loadNotifications();
    }
  }, [isLoading, user]);

  async function loadNotifications() {
    setLoading(true);
    const data = await getAnnouncements();
    setAnnouncements(data);
    setLoading(false);
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/notifications">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/notifications">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Notifications</h1>
            <p className="text-mute">Announcements and updates from the GDU team</p>
          </div>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <div className="w-16 h-16 bg-accent-soft/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.343C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="font-heading font-bold text-ink mb-2">No notifications yet</h3>
            <p className="text-mute">Check back later for updates from the GDU team.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl p-5 border transition-colors hover:bg-accent-soft/5 ${
                  a.type === 'warning'
                    ? 'border-amber-200 bg-amber-50'
                    : a.type === 'reward'
                      ? 'border-green-200 bg-green-50'
                      : a.type === 'event'
                        ? 'border-accent-soft bg-accent-soft/5'
                        : 'border-line bg-card'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-medium uppercase ${getTypeColor(a.type)}`}>
                    {a.type}
                  </span>
                  <span className="text-xs text-mute font-mono">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-ink mb-1">{a.title}</h3>
                <p className="text-sm text-mute">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'warning': return 'text-amber-700';
    case 'reward': return 'text-green-700';
    case 'event': return 'text-accent';
    default: return 'text-mute';
  }
}
