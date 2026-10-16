import React from 'react';
import type { Activity } from '@/lib/api';
import { ActivityStatusBadge, DomainBadge } from '@/components/ui/StatusBadge';
import { Clock, Users, Star } from 'lucide-react';

interface ActivityCardProps {
  activity: Activity;
  onClick: () => void;
}

function DeadlineDisplay({ deadline, status }: { deadline: string; status: string }) {
  if (status === 'closed') return <span className="text-[11px] text-muted-foreground">Closed</span>;
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (diff < 0) return <span className="text-[11px] text-rosecustom font-medium">Expired</span>;
  if (days === 0) return <span className="text-[11px] text-rosecustom font-medium">{hours}h left ⚠️</span>;
  if (days <= 3) return <span className="text-[11px] text-ambercustom font-medium">{days}d left</span>;
  return <span className="text-[11px] text-muted-foreground">{days}d left</span>;
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={`dstar-${i}`}
          size={10}
          className={i < level ? 'text-ambercustom fill-ambercustom' : 'text-muted-foreground'}
        />
      ))}
    </div>
  );
}

export default function ActivityCard({ activity, onClick }: ActivityCardProps) {
  const isUrgent =
    activity.status === 'open' &&
    new Date(activity.deadline).getTime() - Date.now() < 3 * 86_400_000;

  return (
    <button
      onClick={onClick}
      className={`card-base card-hover text-left w-full p-4 flex flex-col gap-3 group transition-all duration-200 ${
        isUrgent ? 'border-ambercustom/30' : ''
      } ${activity.status === 'closed' ? 'opacity-60' : ''}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <DomainBadge domain={activity.domain} />
        <ActivityStatusBadge status={activity.status} />
      </div>

      {/* Title */}
      <div>
        <h4 className="text-sm font-heading font-semibold text-foreground leading-snug group-hover:text-violetcustom transition-colors duration-150 line-clamp-2">
          {activity.title}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {activity.description}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {activity.tags.slice(0, 3).map((tag) => (
          <span
            key={`tag-${activity.id}-${tag}`}
            className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
        <div className="flex items-center gap-3">
          <DifficultyStars level={activity.difficulty} />
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users size={10} />
            <span className="text-[10px]">
              {activity.claimedCount}
              {activity.maxClaims ? `/${activity.maxClaims}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock size={10} />
            <DeadlineDisplay deadline={activity.deadline} status={activity.status} />
          </div>
          <span className="badge-xp">+{activity.xpReward}</span>
        </div>
      </div>

      {activity.bonusXP && (
        <div className="text-[10px] text-ambercustom flex items-center gap-1">
          ⚡ +{activity.bonusXP} bonus XP available
        </div>
      )}

      {activity.branch !== 'all' && (
        <div className="text-[10px] text-muted-foreground">
          📍 {activity.branch} only
        </div>
      )}
    </button>
  );
}