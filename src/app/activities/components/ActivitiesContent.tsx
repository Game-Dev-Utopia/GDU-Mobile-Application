'use client';
import React, { useEffect, useState, useMemo } from 'react';
import type { Activity, ActivityDomain, ActivityStatus } from '@/lib/api';
import { getActivities } from '@/lib/api';
import { ActivitiesPageSkeleton } from '@/components/ui/LoadingSkeleton';
import ActivityCard from './ActivityCard';
import ActivityDetailModal from './ActivityDetailModal';
import ActivityFilters from './ActivityFilters';
import { Zap, Search, Plus } from 'lucide-react';
import Link from 'next/link';

export default function ActivitiesContent() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<ActivityDomain | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'xp' | 'deadline' | 'newest'>('xp');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getActivities();
      if (!cancelled) {
        setActivities(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let result = [...activities];
    if (domainFilter !== 'all') result = result.filter((a) => a.domain === domainFilter);
    if (statusFilter !== 'all') result = result.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some((t) => t.includes(q))
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'xp') return b.xpReward - a.xpReward;
      if (sortBy === 'deadline')
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
    return result;
  }, [activities, domainFilter, statusFilter, search, sortBy]);

  const openCount = activities.filter((a) => a.status === 'open').length;
  const totalXPAvailable = activities
    .filter((a) => a.status === 'open')
    .reduce((s, a) => s + a.xpReward, 0);

  if (loading) return <ActivitiesPageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Activities</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-xp-lime font-semibold">{openCount}</span> open ·{' '}
            <span className="text-xp-lime font-semibold">+{totalXPAvailable.toLocaleString()} XP</span> available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/activities/propose"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus size={16} /> Propose New Activity
          </Link>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities…"
              className="w-full bg-input border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <ActivityFilters
        domainFilter={domainFilter}
        statusFilter={statusFilter}
        sortBy={sortBy}
        onDomainChange={setDomainFilter}
        onStatusChange={setStatusFilter}
        onSortChange={setSortBy}
        counts={{
          all: activities.length,
          open: activities.filter((a) => a.status === 'open').length,
          claimed: activities.filter((a) => a.status === 'claimed').length,
          closed: activities.filter((a) => a.status === 'closed').length,
          upcoming: activities.filter((a) => a.status === 'upcoming').length,
        }}
      />

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap size={40} className="text-muted-foreground mb-3" />
          <h3 className="text-base font-heading font-semibold text-muted-foreground">
            No activities match your filters
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting the domain or status filter, or clear the search.
          </p>
          <button
            onClick={() => { setSearch(''); setDomainFilter('all'); setStatusFilter('all'); }}
            className="mt-4 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-violetcustom text-sm font-medium hover:bg-primary/20 transition-colors duration-150"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={() => setSelectedActivity(activity)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  );
}