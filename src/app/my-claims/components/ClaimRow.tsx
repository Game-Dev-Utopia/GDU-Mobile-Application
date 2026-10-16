'use client';
import React from 'react';
import type { Claim } from '@/lib/api';
import { ClaimStatusBadge, DomainBadge } from '@/components/ui/StatusBadge';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Send,
} from 'lucide-react';

interface ClaimRowProps {
  claim: Claim;
  expanded: boolean;
  onToggle: () => void;
}

const STATUS_ICONS = {
  submitted: Send,
  under_review: Clock,
  approved: CheckCircle,
  rejected: XCircle,
};

const STATUS_ICON_COLORS = {
  submitted: 'text-cyan-accent',
  under_review: 'text-ambercustom',
  approved: 'text-green-400',
  rejected: 'text-rosecustom',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ClaimRow({ claim, expanded, onToggle }: ClaimRowProps) {
  const StatusIcon = STATUS_ICONS[claim.status];
  const iconColor = STATUS_ICON_COLORS[claim.status];

  return (
    <div
      className={`card-base transition-all duration-200 overflow-hidden ${
        claim.status === 'rejected' ? 'border-rosecustom/20' : ''
      } ${claim.status === 'approved' ? 'border-green-700/20' : ''}`}
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/20 transition-colors duration-150"
      >
        {/* Status icon */}
        <div className={`flex-shrink-0 ${iconColor}`}>
          <StatusIcon size={18} />
        </div>

        {/* Activity info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-medium text-foreground truncate">{claim.activityTitle}</p>
            <DomainBadge domain={claim.activityDomain} />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Submitted {formatDate(claim.submittedAt)}</span>
            {claim.reviewerName && (
              <span className="hidden sm:inline">Reviewer: {claim.reviewerName}</span>
            )}
            {claim.reviewedAt && (
              <span className="hidden md:inline">Reviewed {formatDate(claim.reviewedAt)}</span>
            )}
          </div>
        </div>

        {/* XP + Status */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {claim.status === 'approved' && claim.xpCredited ? (
            <span className="badge-xp text-xs px-2 py-1">+{claim.xpCredited} XP</span>
          ) : (
            <span className="text-xs text-muted-foreground font-medium">+{claim.xpReward} XP</span>
          )}
          <ClaimStatusBadge status={claim.status} />
          <span className="text-muted-foreground">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-5 border-t border-border pt-4 space-y-4 animate-slide-up">
          {/* Proof link */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">
              Proof Submitted
            </p>
            <a
              href={claim.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-violetcustom hover:text-primary/80 transition-colors duration-150"
            >
              <ExternalLink size={13} />
              {claim.proofUrl.length > 60 ? claim.proofUrl.slice(0, 60) + '…' : claim.proofUrl}
            </a>
          </div>

          {/* Notes */}
          {claim.notes && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">
                Your Notes
              </p>
              <p className="text-sm text-foreground leading-relaxed bg-muted/20 rounded-lg p-3 border border-border">
                {claim.notes}
              </p>
            </div>
          )}

          {/* Reviewer feedback */}
          {claim.feedback && (
            <div
              className={`rounded-xl p-4 border ${
                claim.status === 'approved' ?'bg-green-900/10 border-green-700/30' :'bg-rose-900/10 border-rosecustom/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare
                  size={14}
                  className={claim.status === 'approved' ? 'text-green-400' : 'text-rosecustom'}
                />
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Reviewer Feedback · {claim.reviewerName}
                </p>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{claim.feedback}</p>
            </div>
          )}

          {/* Approved XP credited */}
          {claim.status === 'approved' && claim.xpCredited && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-lime-900/10 border border-xplime/20">
              <CheckCircle size={16} className="text-xp-lime" />
              <p className="text-sm text-foreground">
                <span className="font-bold text-xp-lime">+{claim.xpCredited} XP</span> credited to your account
                {claim.reviewedAt && ` on ${formatDate(claim.reviewedAt)}`}.
              </p>
            </div>
          )}

          {/* Rejected — resubmit CTA */}
          {claim.status === 'rejected' && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-900/10 border border-rosecustom/20">
              <div>
                <p className="text-sm font-medium text-rosecustom">Claim Rejected</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Address the reviewer's feedback and resubmit.
                </p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-violetcustom text-xs font-medium hover:bg-primary/30 transition-colors duration-150">
                <RefreshCw size={12} />
                Resubmit
              </button>
            </div>
          )}

          {/* Under review info */}
          {claim.status === 'under_review' && claim.reviewerName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-900/10 border border-ambercustom/20">
              <Clock size={14} className="text-ambercustom" />
              <p className="text-sm text-foreground">
                Being reviewed by <span className="font-medium text-ambercustom">{claim.reviewerName}</span>.
                Expect a response within 2–3 business days.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}