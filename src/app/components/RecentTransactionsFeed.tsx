import React from 'react';
import type { XPTransaction } from '@/lib/api';

import { Zap } from 'lucide-react';

interface RecentTransactionsFeedProps {
  transactions: XPTransaction[];
}

const DOMAIN_ICONS: Record<string, string> = {
  Programming: '⌨️',
  Art: '🎨',
  Design: '✏️',
  Audio: '🎵',
  Writing: '📝',
  Marketing: '📣',
  Management: '🗂️',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function RecentTransactionsFeed({ transactions }: RecentTransactionsFeedProps) {
  return (
    <div className="card-base p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-heading font-semibold text-foreground">Recent XP</h3>
        <Zap size={16} className="text-xp-lime" />
      </div>
      {transactions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <Zap size={32} className="text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No XP earned yet</p>
          <p className="text-xs text-muted-foreground mt-1">Complete activities to start earning</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className="flex items-start gap-3 py-2 border-b border-border last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base flex-shrink-0">
                {DOMAIN_ICONS[txn.domain] || '⚡'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                  {txn.activityName}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatRelative(txn.timestamp)}
                </p>
              </div>
              <span className="text-sm font-bold text-xp-lime flex-shrink-0">
                +{txn.xpEarned}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}