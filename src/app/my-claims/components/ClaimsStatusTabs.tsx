import React from 'react';
import type { ClaimStatus } from '@/lib/api';

const TABS: { value: ClaimStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

interface ClaimsStatusTabsProps {
  activeStatus: ClaimStatus | 'all';
  onStatusChange: (s: ClaimStatus | 'all') => void;
  counts: Record<string, number>;
}

export default function ClaimsStatusTabs({
  activeStatus,
  onStatusChange,
  counts,
}: ClaimsStatusTabsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TABS.map((tab) => {
        const isActive = activeStatus === tab.value;
        const count = counts[tab.value] ?? 0;

        const activeStyles: Record<string, string> = {
          all: 'bg-primary/20 border-primary/40 text-violetcustom',
          submitted: 'bg-cyan-900/20 border-cyancustom/40 text-cyan-accent',
          under_review: 'bg-amber-900/20 border-ambercustom/40 text-ambercustom',
          approved: 'bg-green-900/20 border-green-700/40 text-green-400',
          rejected: 'bg-rose-900/20 border-rosecustom/40 text-rosecustom',
        };

        return (
          <button
            key={`claims-tab-${tab.value}`}
            onClick={() => onStatusChange(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
              isActive
                ? activeStyles[tab.value]
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 bg-transparent'
            }`}
          >
            {tab.label}
            {count > 0 && (
              <span className="ml-1.5 opacity-70">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}