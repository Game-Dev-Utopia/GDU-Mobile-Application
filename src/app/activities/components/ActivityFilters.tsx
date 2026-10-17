'use client';
import React from 'react';
import type { ActivityDomain, ActivityStatus } from '@/lib/api';
import { SlidersHorizontal } from 'lucide-react';

const DOMAINS: (ActivityDomain | 'all')[] = [
  'all', 'Game Dev (Coding)', 'Web & DevOps', 'AI & ML', 'Marketing', 'Eternal Affairs', 'Design & Digital Arts', 'Research & Development (R&D)',
];

const STATUSES: { value: ActivityStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed', label: 'Closed' },
];

const SORTS: { value: 'xp' | 'deadline' | 'newest'; label: string }[] = [
  { value: 'xp', label: 'Highest XP' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'newest', label: 'Newest' },
];

interface ActivityFiltersProps {
  domainFilter: ActivityDomain | 'all';
  statusFilter: ActivityStatus | 'all';
  sortBy: 'xp' | 'deadline' | 'newest';
  onDomainChange: (v: ActivityDomain | 'all') => void;
  onStatusChange: (v: ActivityStatus | 'all') => void;
  onSortChange: (v: 'xp' | 'deadline' | 'newest') => void;
  counts: Record<string, number>;
}

export default function ActivityFilters({
  domainFilter,
  statusFilter,
  sortBy,
  onDomainChange,
  onStatusChange,
  onSortChange,
  counts,
}: ActivityFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={`status-filter-${s.value}`}
            onClick={() => onStatusChange(s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              statusFilter === s.value
                ? 'bg-primary/20 border border-primary/40 text-violetcustom'
                : 'bg-muted/30 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {s.label}
            {counts[s.value] !== undefined && (
              <span className="ml-1.5 opacity-70">{counts[s.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Domain + Sort row */}
      <div className="flex items-center gap-3 flex-wrap">
        <SlidersHorizontal size={14} className="text-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {DOMAINS.map((d) => (
            <button
              key={`domain-filter-${d}`}
              onClick={() => onDomainChange(d)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
                domainFilter === d
                  ? 'bg-cyan-900/30 border border-cyancustom/40 text-cyan-accent' :'bg-muted/20 border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {d === 'all' ? 'All Domains' : d}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as 'xp' | 'deadline' | 'newest')}
          className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SORTS.map((s) => (
            <option key={`sort-${s.value}`} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}