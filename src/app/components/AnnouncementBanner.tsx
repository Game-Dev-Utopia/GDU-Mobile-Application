'use client';
import React, { useState } from 'react';
import type { Announcement } from '@/lib/api';
import { X, Megaphone, Gift, AlertTriangle, Info } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';

interface AnnouncementBannerProps {
  announcements: Announcement[];
}

const TYPE_CONFIG = {
  info: {
    icon: Info,
    cls: 'border-border bg-muted/30 text-foreground',
    iconCls: 'text-cyancustom',
  },
  event: {
    icon: Megaphone,
    cls: 'border-violetcustom/30 bg-violet-900/10 text-foreground',
    iconCls: 'text-violetcustom',
  },
  warning: {
    icon: AlertTriangle,
    cls: 'border-ambercustom/30 bg-amber-900/10 text-foreground',
    iconCls: 'text-ambercustom',
  },
  reward: {
    icon: Gift,
    cls: 'border-xplime/30 bg-lime-900/10 text-foreground',
    iconCls: 'text-xp-lime',
  },
};

export default function AnnouncementBanner({ announcements }: AnnouncementBannerProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = announcements.filter((a) => !dismissed.includes(a.id));

  if (visible.length === 0) return null;

  // Show most recent one
  const ann = visible[0];
  const cfg = TYPE_CONFIG[ann.type];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${cfg.cls}`}>
      <Icon size={16} className={`${cfg.iconCls} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{ann.title}</span>
        <span className="text-muted-foreground ml-2">{ann.body}</span>
      </div>
      {visible.length > 1 && (
        <span className="text-[11px] text-muted-foreground flex-shrink-0">
          +{visible.length - 1} more
        </span>
      )}
      <button
        onClick={() => setDismissed((d) => [...d, ann.id])}
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}
