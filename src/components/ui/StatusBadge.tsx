import React from 'react';
import type { ClaimStatus, ActivityStatus, LeagueTier } from '@/lib/api';

interface ClaimStatusBadgeProps {
  status: ClaimStatus;
}

export function ClaimStatusBadge({ status }: ClaimStatusBadgeProps) {
  const map: Record<ClaimStatus, { label: string; cls: string }> = {
    submitted: { label: 'Submitted', cls: 'badge-cyan' },
    under_review: { label: 'Under Review', cls: 'badge-amber' },
    approved: { label: 'Approved', cls: 'badge-green' },
    rejected: { label: 'Rejected', cls: 'badge-rose' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

interface ActivityStatusBadgeProps {
  status: ActivityStatus;
}

export function ActivityStatusBadge({ status }: ActivityStatusBadgeProps) {
  const map: Record<ActivityStatus, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'badge-green' },
    claimed: { label: 'Claimed', cls: 'badge-cyan' },
    closed: { label: 'Closed', cls: 'badge-muted' },
    upcoming: { label: 'Upcoming', cls: 'badge-violet' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

interface LeagueBadgeProps {
  tier: LeagueTier;
  size?: 'sm' | 'md' | 'lg';
}

const LEAGUE_CONFIG: Record<LeagueTier, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  Bronze: { label: 'Bronze', color: 'text-amber-700', bg: 'bg-amber-900/20', border: 'border-amber-800/40', emoji: '🥉' },
  Silver: { label: 'Silver', color: 'text-slate-300', bg: 'bg-slate-700/20', border: 'border-slate-600/40', emoji: '🥈' },
  Gold: { label: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-700/40', emoji: '🥇' },
  Platinum: { label: 'Platinum', color: 'text-cyan-300', bg: 'bg-cyan-900/20', border: 'border-cyan-700/40', emoji: '💎' },
  Diamond: { label: 'Diamond', color: 'text-violet-300', bg: 'bg-violet-900/20', border: 'border-violet-700/40', emoji: '💠' },
};

export function LeagueBadge({ tier, size = 'md' }: LeagueBadgeProps) {
  const cfg = LEAGUE_CONFIG[tier];
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-1';
  return (
    <span className={`inline-flex items-center gap-1 border rounded-md font-pixel ${cfg.color} ${cfg.bg} ${cfg.border} ${sizeClass}`}>
      <span>{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

interface DomainBadgeProps {
  domain: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  Programming: 'badge-violet',
  Art: 'badge-cyan',
  Design: 'badge-green',
  Audio: 'badge-amber',
  Writing: 'badge-muted',
  Marketing: 'badge-rose',
  Management: 'badge-xp',
};

export function DomainBadge({ domain }: DomainBadgeProps) {
  const cls = DOMAIN_COLORS[domain] || 'badge-muted';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {domain}
    </span>
  );
}