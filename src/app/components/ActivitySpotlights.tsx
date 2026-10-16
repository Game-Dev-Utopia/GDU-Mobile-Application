import React from 'react';
import Link from 'next/link';
import type { Activity } from '@/lib/api';
import { ActivityStatusBadge, DomainBadge } from '@/components/ui/StatusBadge';
import { Clock, ChevronRight, Star } from 'lucide-react';

interface ActivitySpotlightsProps {
  activities: Activity[];
}

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (diff < 0) return <span className="text-rosecustom text-[11px] font-medium">Expired</span>;
  if (days === 0) return <span className="text-rosecustom text-[11px] font-medium">{hours}h left</span>;
  if (days <= 3) return <span className="text-ambercustom text-[11px] font-medium">{days}d left</span>;
  return <span className="text-muted-foreground text-[11px]">{days}d left</span>;
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={`star-${i}`}
          size={10}
          className={i < level ? 'text-ambercustom fill-ambercustom' : 'text-muted-foreground'}
        />
      ))}
    </div>
  );
}

export default function ActivitySpotlights({ activities }: ActivitySpotlightsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-heading font-semibold text-foreground">
          🏆 High-XP Spotlights
        </h3>
        <Link
          href="/activities"
          className="flex items-center gap-1 text-xs text-violetcustom hover:text-primary/80 transition-colors duration-150"
        >
          View all <ChevronRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activities.map((act) => (
          <Link
            key={act.id}
            href="/activities"
            className="card-base card-hover p-4 flex flex-col gap-3 group"
          >
            <div className="flex items-start justify-between gap-2">
              <DomainBadge domain={act.domain} />
              <ActivityStatusBadge status={act.status} />
            </div>
            <div>
              <h4 className="text-sm font-heading font-semibold text-foreground leading-snug group-hover:text-violetcustom transition-colors duration-150 line-clamp-2">
                {act.title}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{act.description}</p>
            </div>
            <div className="flex items-center justify-between mt-auto">
              <DifficultyStars level={act.difficulty} />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock size={10} />
                  <DeadlineCountdown deadline={act.deadline} />
                </div>
                <span className="badge-xp text-[11px]">+{act.xpReward} XP</span>
              </div>
            </div>
            {act.bonusXP && (
              <div className="flex items-center gap-1 text-[10px] text-ambercustom">
                <span>⚡ +{act.bonusXP} bonus XP available</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}