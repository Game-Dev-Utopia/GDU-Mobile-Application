'use client';
import React from 'react';
import type { Member } from '@/lib/api';
import CountUpNumber from '@/components/ui/CountUpNumber';
import { Flame, Clock, Zap, Trophy } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

interface StatBentoGridProps {
  member: Member;
}

export default function StatBentoGrid({ member }: StatBentoGridProps) {
  // 4 cards → 4-col single row (or 2×2 on mobile)
  const stats = [
    {
      id: 'stat-streak',
      label: 'Day Streak',
      value: member.streak,
      suffix: 'd',
      icon: Flame,
      cardClass: 'gradient-amber-card',
      iconColor: 'text-ambercustom',
      valueColor: 'text-ambercustom',
      note: member.streak >= 7 ? '🔥 On fire!' : 'Keep it going',
      alert: member.streak < 3,
    },
    {
      id: 'stat-pending',
      label: 'Pending Claims',
      value: member.pendingClaims,
      suffix: '',
      icon: Clock,
      cardClass: member.pendingClaims > 0 ? 'gradient-amber-card' : 'gradient-violet-card',
      iconColor: member.pendingClaims > 0 ? 'text-ambercustom' : 'text-violetcustom',
      valueColor: member.pendingClaims > 0 ? 'text-ambercustom' : 'text-violetcustom',
      note: member.pendingClaims > 0 ? 'Awaiting review' : 'All clear',
      alert: member.pendingClaims > 2,
    },
    {
      id: 'stat-weeklyxp',
      label: 'XP This Week',
      value: 1000,
      suffix: '',
      prefix: '+',
      icon: Zap,
      cardClass: 'gradient-lime-card',
      iconColor: 'text-xp-lime',
      valueColor: 'text-xp-lime',
      note: '↑ 24% vs last week',
      alert: false,
    },
    {
      id: 'stat-rank',
      label: 'League Rank',
      value: member.leagueRank,
      suffix: '',
      prefix: '#',
      icon: Trophy,
      cardClass: 'gradient-cyan-card',
      iconColor: 'text-cyan-accent',
      valueColor: 'text-cyan-accent',
      note: `${member.leagueTier} League`,
      alert: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            className={`card-base card-hover ${stat.cardClass} p-4 lg:p-5 relative overflow-hidden`}
          >
            {stat.alert && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-ambercustom animate-pulse" />
            )}
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                {stat.label}
              </span>
              <Icon size={16} className={stat.iconColor} />
            </div>
            <div
              className={`text-3xl font-heading font-bold ${stat.valueColor} count-up-value mb-1`}
            >
              <CountUpNumber
                value={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                className={`text-3xl font-heading font-bold ${stat.valueColor}`}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{stat.note}</p>
          </div>
        );
      })}
    </div>
  );
}
