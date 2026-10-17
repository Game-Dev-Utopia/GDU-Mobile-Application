'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { getBadges, getMemberBadges, type Badge, type MemberBadge, BADGE_RARITY_CONFIG } from '@/lib/api';
import AppIcon from '@/components/ui/AppIcon';

const ICON_MAP: Record<string, React.ElementType> = {
  FileCheck: AppIcon,
  ClipboardList: AppIcon,
  Clock: AppIcon,
  Trophy: AppIcon,
  Shield: AppIcon,
  Zap: AppIcon,
  User: AppIcon,
  Star: AppIcon,
};

export default function BadgesPage() {
  const { user, isLoading } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [memberBadges, setMemberBadges] = useState<MemberBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user]);

  async function loadData() {
    setLoading(true);
    const [allBadges, myBadges] = await Promise.all([getBadges(), getMemberBadges()]);
    setBadges(allBadges);
    setMemberBadges(myBadges);
    setLoading(false);
  }

  const earnedBadgeIds = new Set(memberBadges.map((mb) => mb.badgeId));

  const rarityOrder: Record<Badge['rarity'], number> = {
    common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4,
  };

  const sortedBadges = [...badges].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/badges">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/badges">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Badges</h1>
            <p className="text-mute">
              Earned {memberBadges.length} of {badges.length} badges
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium border border-accent/20`}>
            {memberBadges.length}/{badges.length}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedBadges.map((badge) => {
            const earned = earnedBadgeIds.has(badge.id);
            const memberBadge = memberBadges.find((mb) => mb.badgeId === badge.id);
            const rarityCfg = BADGE_RARITY_CONFIG[badge.rarity];
            const Icon = ICON_MAP[badge.icon] || AppIcon;

            return (
              <div
                key={badge.id}
                className={`rounded-xl p-5 border transition-all duration-300 ${
                  earned
                    ? 'bg-card border-line hover:border-accent/50'
                    : 'bg-muted/50 border-line/50 text-mute/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      earned
                        ? `bg-${rarityCfg.color.split('-')[1]}-100 text-${rarityCfg.color.split('-')[1]}-600`
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon name={badge.icon} size={20} />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${rarityCfg.color}`}>
                    {rarityCfg.label}
                  </span>
                </div>

                <h3 className={`font-heading font-bold ${earned ? 'text-ink' : 'text-muted-foreground'} mb-1`}>
                  {badge.name}
                </h3>
                <p className={`text-xs ${earned ? 'text-mute' : 'text-muted-foreground/60'} mb-3 line-clamp-2`}>
                  {badge.description}
                </p>

                {earned && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-accent font-medium">Earned</span>
                    <span className="text-mute">
                      {new Date(memberBadge!.earnedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {!earned && (
                  <div className="mt-3 pt-3 border-t border-muted/30">
                    <span className="text-xs text-muted-foreground">Locked</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {badges.length === 0 && (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <p className="text-mute">No badges available yet.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
