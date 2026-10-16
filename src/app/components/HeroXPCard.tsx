'use client';
import React from 'react';
import type { Member } from '@/lib/api';
import CountUpNumber from '@/components/ui/CountUpNumber';
import XPBar from '@/components/ui/XPBar';
import { LeagueBadge } from '@/components/ui/StatusBadge';
import { Flame, Star, TrendingUp } from 'lucide-react';

interface HeroXPCardProps {
  member: Member;
}

export default function HeroXPCard({ member }: HeroXPCardProps) {
  const weeklyXP = 1000; // would come from aggregation

  return (
    <div className="gradient-hero-card border border-border rounded-2xl p-6 lg:p-8 relative overflow-hidden glow-violet">
      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-5"
        style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-1/2 w-96 h-32 opacity-5"
        style={{ background: 'radial-gradient(ellipse, var(--accent) 0%, transparent 70%)', transform: 'translateX(-50%)' }} />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Avatar + Identity */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={member.avatar}
              alt={`${member.name} avatar`}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl border-2 border-primary/40 bg-muted"
            />
            <div className="absolute -bottom-2 -right-2 bg-primary rounded-lg px-1.5 py-0.5">
              <span className="font-pixel text-[10px] text-white">LVL {member.level}</span>
            </div>
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-heading font-bold text-foreground">{member.name}</h2>
            <p className="text-sm text-muted-foreground">@{member.username}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <LeagueBadge tier={member.leagueTier} size="sm" />
              <span className="font-pixel text-[10px] text-muted-foreground">{member.levelName}</span>
            </div>
          </div>
        </div>

        {/* XP + Stats */}
        <div className="flex-1 space-y-4">
          {/* Total XP */}
          <div>
            <div className="flex items-end gap-3 mb-2">
              <CountUpNumber
                value={member.totalXP}
                className="text-4xl lg:text-5xl font-heading font-bold text-xp-lime"
              />
              <span className="text-lg font-heading font-semibold text-muted-foreground mb-1">XP</span>
              <span className="flex items-center gap-1 text-sm text-xp-lime mb-1 ml-1">
                <TrendingUp size={14} />
                +{weeklyXP} this week
              </span>
            </div>
            <XPBar
              current={member.xpInLevel}
              max={member.xpToNextLevel}
              height={10}
              showLabel={true}
              animate={true}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {member.xpToNextLevel - member.xpInLevel} XP to Level {member.level + 1}
            </p>
          </div>

          {/* Quick stats row */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Flame size={16} className="animate-streak-burn text-ambercustom" />
              <span className="text-sm font-semibold text-foreground">{member.streak}</span>
              <span className="text-sm text-muted-foreground">day streak</span>
            </div>
            <div className="flex items-center gap-2">
              <Star size={16} className="text-violetcustom" />
              <span className="text-sm font-semibold text-foreground">#{member.branchRank}</span>
              <span className="text-sm text-muted-foreground">in {member.branch}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Global:</span>
              <span className="text-sm font-semibold text-foreground">#{member.globalRank}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}