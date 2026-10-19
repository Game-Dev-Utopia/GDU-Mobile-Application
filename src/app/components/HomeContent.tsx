'use client';
import React, { useEffect, useState } from 'react';
import type { Member, WeeklyXPPoint, XPTransaction, Activity, Announcement } from '@/lib/api';
import {
  getCurrentMember,
  getWeeklyXP,
  getRecentTransactions,
  getSpotlightActivities,
  getAnnouncements,
} from '@/lib/api';
import { HomePageSkeleton } from '@/components/ui/LoadingSkeleton';
import HeroXPCard from './HeroXPCard';
import StatBentoGrid from './StatBentoGrid';
import WeeklyXPChart from './WeeklyXPChart';
import RecentTransactionsFeed from './RecentTransactionsFeed';
import ActivitySpotlights from './ActivitySpotlights';
import AnnouncementBanner from './AnnouncementBanner';
import CoachCard from './CoachCard';

export default function HomeContent() {
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [weeklyXP, setWeeklyXP] = useState<WeeklyXPPoint[]>([]);
  const [transactions, setTransactions] = useState<XPTransaction[]>([]);
  const [spotlights, setSpotlights] = useState<Activity[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // TODO: Replace with real API calls — see lib/api.ts
      const [m, w, t, s, a] = await Promise.all([
        getCurrentMember(),
        getWeeklyXP(),
        getRecentTransactions(5),
        getSpotlightActivities(),
        getAnnouncements(),
      ]);
      if (!cancelled) {
        setMember(m);
        setWeeklyXP(w);
        setTransactions(t);
        setSpotlights(s);
        setAnnouncements(a);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <HomePageSkeleton />;
  if (!member) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">
            Welcome back, <span className="text-violetcustom">{member.name.split(' ')[0]}</span> 👾
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {' · '}
            <span className="text-foreground font-medium">{member.branch}</span> Branch
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-xplime inline-block animate-pulse" />
          Live
        </div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && <AnnouncementBanner announcements={announcements} />}

      {/* Hero XP Card */}
      <HeroXPCard member={member} />

      {/* Stat bento grid */}
      <StatBentoGrid member={member} />

      {/* Charts + Feed row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WeeklyXPChart data={weeklyXP} />
        </div>
        <div>
          <RecentTransactionsFeed transactions={transactions} />
        </div>
      </div>

      {/* Activity Spotlights */}
      <ActivitySpotlights activities={spotlights} />

      {/* Coach Card */}
      <CoachCard />
    </div>
  );
}
