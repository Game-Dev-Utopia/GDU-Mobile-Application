'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type {
  Activity,
  ActivityDomain,
  ActivityStatus,
  ExpCategory,
  MemberStanding,
} from '@/lib/api';
import {
  getActivities,
  getActivitySubcategories,
  getMemberStanding,
  type ActivitySubcategory,
} from '@/lib/api';
import { ActivitiesPageSkeleton } from '@/components/ui/LoadingSkeleton';
import ActivityCard from './ActivityCard';
import ActivityDetailModal from './ActivityDetailModal';
import ActivityFilters from './ActivityFilters';
import { Zap, Search, Plus, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORY_LABELS: Record<ExpCategory, string> = {
  technical: 'Technical',
  social: 'Social',
  soft: 'Soft',
  management: 'Management',
};

export default function ActivitiesContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [subcategories, setSubcategories] = useState<ActivitySubcategory[]>([]);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<ActivityDomain | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ExpCategory | 'all'>('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string | 'all'>('all');
  const [sortBy, setSortBy] = useState<'xp' | 'deadline' | 'newest'>('xp');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [memberStanding, setMemberStanding] = useState<MemberStanding | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [acts, subs] = await Promise.all([getActivities(), getActivitySubcategories()]);
      if (user) {
        const standing = await getMemberStanding(user.id);
        if (!cancelled) setMemberStanding(standing);
      }
      if (!cancelled) {
        setActivities(acts);
        setSubcategories(subs);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    let result = [...activities];
    if (categoryFilter !== 'all') result = result.filter((a) => a.category === categoryFilter);
    if (subcategoryFilter !== 'all')
      result = result.filter((a) => a.subcategoryId === subcategoryFilter);
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
  }, [activities, categoryFilter, subcategoryFilter, domainFilter, statusFilter, search, sortBy]);

  const openCount = activities.filter((a) => a.status === 'open').length;
  const totalXPAvailable = activities
    .filter((a) => a.status === 'open')
    .reduce((s, a) => s + a.xpReward, 0);

  const filteredSubcategories = useMemo(() => {
    if (categoryFilter === 'all') return subcategories;
    return subcategories.filter((s) => s.category === categoryFilter);
  }, [subcategories, categoryFilter]);

  const handleCategoryChange = useCallback((cat: ExpCategory | 'all') => {
    setCategoryFilter(cat);
    setSubcategoryFilter('all');
  }, []);

  const ALL_CATEGORIES: (ExpCategory | 'all')[] = [
    'all',
    'technical',
    'social',
    'soft',
    'management',
  ];

  if (loading) return <ActivitiesPageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Activities</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-xp-lime font-semibold">{openCount}</span> open ·{' '}
            <span className="text-xp-lime font-semibold">
              +{totalXPAvailable.toLocaleString()} XP
            </span>{' '}
            available
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
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
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

      {/* Category + Subcategory filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <SlidersHorizontal size={14} className="text-muted-foreground flex-shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {ALL_CATEGORIES.map((cat) => {
              const isAll = cat === 'all';
              const active = categoryFilter === cat || (isAll && categoryFilter === 'all');
              return (
                <button
                  key={`cat-filter-${cat}`}
                  onClick={() => handleCategoryChange(isAll ? 'all' : cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
                    active
                      ? 'bg-cyan-900/30 border border-cyancustom/40 text-cyan-accent'
                      : 'bg-muted/20 border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isAll ? 'All Categories' : CATEGORY_LABELS[cat]}
                </button>
              );
            })}
            {categoryFilter !== 'all' &&
              filteredSubcategories.map((sc) => {
                const active = subcategoryFilter === sc.id;
                return (
                  <button
                    key={`subcat-filter-${sc.id}`}
                    onClick={() => setSubcategoryFilter(active ? 'all' : sc.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
                      active
                        ? 'bg-violet-900/30 border border-violetcustom/40 text-violet-accent'
                        : 'bg-muted/20 border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sc.displayName}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap size={40} className="text-muted-foreground mb-3" />
          <h3 className="text-base font-heading font-semibold text-muted-foreground">
            No activities match your filters
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting the category, domain, or status filter, or clear the search.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setDomainFilter('all');
              setStatusFilter('all');
              setCategoryFilter('all');
              setSubcategoryFilter('all');
            }}
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
              memberStanding={memberStanding}
              onClick={() => setSelectedActivity(activity)}
            />
          ))}
          {/* Propose a new activity card at the bottom */}
          <Link
            href="/activities/propose"
            className="card-base card-hover flex flex-col items-center justify-center p-6 gap-3 border-2 border-dashed border-border hover:border-accent transition-colors"
          >
            <Plus size={24} className="text-accent" />
            <p className="text-sm font-medium text-ink">Propose a New Activity</p>
            <p className="text-[11px] text-muted-foreground">
              Suggest a new activity type for review
            </p>
          </Link>
        </div>
      )}

      {/* Detail Modal */}
      <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
    </div>
  );
}
