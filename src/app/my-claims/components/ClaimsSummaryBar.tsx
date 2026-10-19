'use client';
import React from 'react';
import CountUpNumber from '@/components/ui/CountUpNumber';
import { Zap, Clock, TrendingUp, FileCheck } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

interface ClaimsSummaryBarProps {
  totalXPEarned: number;
  pendingCount: number;
  approvalRate: number;
  totalClaims: number;
}

export default function ClaimsSummaryBar({
  totalXPEarned,
  pendingCount,
  approvalRate,
  totalClaims,
}: ClaimsSummaryBarProps) {
  const stats = [
    {
      id: 'summary-xp',
      label: 'XP Earned',
      icon: Zap,
      iconColor: 'text-xp-lime',
      cardClass: 'gradient-lime-card',
      value: totalXPEarned,
      suffix: ' XP',
      valueColor: 'text-xp-lime',
    },
    {
      id: 'summary-pending',
      label: 'Pending Review',
      icon: Clock,
      iconColor: pendingCount > 0 ? 'text-ambercustom' : 'text-muted-foreground',
      cardClass: pendingCount > 0 ? 'gradient-amber-card' : '',
      value: pendingCount,
      suffix: '',
      valueColor: pendingCount > 0 ? 'text-ambercustom' : 'text-foreground',
    },
    {
      id: 'summary-rate',
      label: 'Approval Rate',
      icon: TrendingUp,
      iconColor: 'text-cyan-accent',
      cardClass: 'gradient-cyan-card',
      value: approvalRate,
      suffix: '%',
      valueColor: 'text-cyan-accent',
    },
    {
      id: 'summary-total',
      label: 'Total Claims',
      icon: FileCheck,
      iconColor: 'text-violetcustom',
      cardClass: 'gradient-violet-card',
      value: totalClaims,
      suffix: '',
      valueColor: 'text-violetcustom',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.id} className={`card-base p-4 ${stat.cardClass}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                {stat.label}
              </span>
              <Icon size={15} className={stat.iconColor} />
            </div>
            <CountUpNumber
              value={stat.value}
              suffix={stat.suffix}
              className={`text-2xl font-heading font-bold ${stat.valueColor}`}
            />
          </div>
        );
      })}
    </div>
  );
}
