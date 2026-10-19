'use client';
import React, { useCallback, useState } from 'react';
import type { Claim } from '@/lib/api';
import { ClaimStatusBadge, DomainBadge } from '@/components/ui/StatusBadge';
import { confirmClaim } from '@/lib/api';
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
  FileCheck,
  User,
} from 'lucide-react';

interface ClaimRowProps {
  claim: Claim;
  expanded: boolean;
  onToggle: () => void;
  onConfirmChange?: () => void;
}

const STATUS_ICONS = {
  submitted: Send,
  under_review: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  awaiting_confirmation: Clock,
};

const STATUS_ICON_COLORS = {
  submitted: 'text-cyan-accent',
  under_review: 'text-ambercustom',
  approved: 'text-green-400',
  rejected: 'text-rosecustom',
  awaiting_confirmation: 'text-ambercustom',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function isImage(fileType: string) {
  return fileType.startsWith('image/');
}

export default function ClaimRow({ claim, expanded, onToggle, onConfirmChange }: ClaimRowProps) {
  const StatusIcon = STATUS_ICONS[claim.status];
  const iconColor = STATUS_ICON_COLORS[claim.status];
  const isAwaiting = claim.status === 'awaiting_confirmation';
  const [confirming, setConfirming] = useState<'confirm' | 'dispute' | null>(null);

  const handleConfirm = useCallback(
    async (confirm: boolean) => {
      setConfirming(confirm ? 'confirm' : 'dispute');
      try {
        await confirmClaim(claim.id, confirm);
        onConfirmChange?.();
      } catch (err: any) {
        alert(err.message || 'Failed to process confirmation.');
      } finally {
        setConfirming(null);
      }
    },
    [claim.id, onConfirmChange]
  );

  return (
    <div
      className={`card-base transition-all duration-200 overflow-hidden ${
        claim.status === 'rejected' ? 'border-rosecustom/20' : ''
      } ${claim.status === 'approved' ? 'border-green-700/20' : ''} ${isAwaiting ? 'border-ambercustom/20' : ''}`}
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
            {claim.submittedOnBehalfOf && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 border border-ambercustom/40 text-ambercustom">
                On Behalf
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Submitted {formatDate(claim.submittedAt)}</span>
            {claim.submittedByName && (
              <span className="hidden sm:inline">By: {claim.submittedByName}</span>
            )}
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
          {/* Proofs Gallery */}
          {claim.proofFiles && claim.proofFiles.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium mb-2">
                Proof Files ({claim.proofFiles.length})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {claim.proofFiles.map((pf) => (
                  <div key={pf.id} className="flex flex-col items-center gap-1">
                    {isImage(pf.fileType) ? (
                      <a
                        href={pf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-16 h-16 rounded-lg object-cover border border-border"
                      >
                        <img
                          src={pf.url}
                          alt={pf.fileName}
                          className="w-full h-full rounded-lg object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={pf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-1 w-16 h-16 rounded-lg bg-muted/50 border border-border"
                      >
                        <FileCheck size={20} className="text-muted-foreground" />
                        <span
                          className="text-[10px] text-muted-foreground truncate"
                          title={pf.fileName}
                        >
                          {pf.fileName}
                        </span>
                      </a>
                    )}
                    <span
                      className="text-[10px] text-muted-foreground truncate w-16"
                      title={pf.fileName}
                    >
                      {pf.fileName}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {formatFileSize(pf.fileSize)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof link (legacy text URL) */}
          {claim.proofUrl && !claim.proofFiles?.length && (
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
          )}

          {/* Confirm / Dispute for awaiting confirmation */}
          {isAwaiting && (
            <div className="rounded-xl p-4 border border-ambercustom/20 bg-amber-900/10">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-ambercustom" />
                <span className="text-xs font-medium text-ambercustom uppercase tracking-widest">
                  Member Confirmation Required
                </span>
              </div>
              <p className="text-sm text-mute mb-3">
                This claim was submitted on your behalf. Please confirm or dispute it.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={confirming === 'confirm'}
                  className="flex-1 px-3 py-2 rounded-lg bg-green-900/20 border border-green-700/30 text-green-400 text-sm font-medium hover:bg-green-900/40 disabled:opacity-60 transition-colors"
                >
                  {confirming === 'confirm' ? 'Confirming…' : 'Confirm'}
                </button>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={confirming === 'dispute'}
                  className="flex-1 px-3 py-2 rounded-lg bg-rose-900/20 border border-rose-700/30 text-rose-400 text-sm font-medium hover:bg-rose-900/40 disabled:opacity-60 transition-colors"
                >
                  {confirming === 'dispute' ? 'Disputing…' : 'Dispute'}
                </button>
              </div>
            </div>
          )}

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
                claim.status === 'approved'
                  ? 'bg-green-900/10 border-green-700/30'
                  : 'bg-rose-900/10 border-rosecustom/30'
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
                <span className="font-bold text-xp-lime">+{claim.xpCredited} XP</span> credited to
                your account
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
                Being reviewed by{' '}
                <span className="font-medium text-ambercustom">{claim.reviewerName}</span>. Expect a
                response within 2–3 business days.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
