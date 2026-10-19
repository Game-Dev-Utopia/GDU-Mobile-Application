'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Activity, ClaimStatus, ProofFile } from '@/lib/api';
import {
  submitClaim,
  uploadProof,
  getProofFiles,
  type ProofFile as ProofFileType,
} from '@/lib/api';
import Modal from '@/components/ui/Modal';
import { ActivityStatusBadge, DomainBadge } from '@/components/ui/StatusBadge';
import {
  Clock,
  Users,
  Star,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Plus,
  XCircle,
  FileCheck,
} from 'lucide-react';

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
}

interface ClaimFormData {
  submittingFor: string;
  memberId: string;
  proofUrl: string;
  notes: string;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

function isImage(file: File | string) {
  if (typeof file === 'string') return file.startsWith('image/');
  return file.type.startsWith('image/');
}

function isVideo(file: File | string) {
  if (typeof file === 'string') return file.startsWith('video/');
  return file.type.startsWith('video/');
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [proofFiles, setProofFiles] = useState<ProofFileType[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClaimFormData>({
    defaultValues: {
      submittingFor: 'me',
      memberId: '',
      proofUrl: '',
      notes: '',
    },
  });

  function handleClose() {
    reset();
    setSubmitted(false);
    setSubmitError('');
    setFilesToUpload([]);
    setUploadProgress({});
    setProofFiles([]);
    onClose();
  }

  async function loadProofs(claimId: string) {
    const proofs = await getProofFiles(claimId);
    setProofFiles(proofs);
  }

  async function onSubmit(data: ClaimFormData) {
    if (!activity) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await submitClaim({
        activityTypeId: activity.id,
        title: activity.title,
        description: activity.description,
        activityDate: new Date().toISOString().split('T')[0],
        evidenceLinks: data.proofUrl ? [data.proofUrl] : [],
        suggestedExp: activity.xpReward,
        analysisPointers: data.notes,
        contributors: [{ memberId: 'current-user', sharePercent: 100 }],
        submittedOnBehalfOf:
          data.submittingFor === 'other' && data.memberId ? data.memberId : undefined,
      });

      // Upload files if any
      if (filesToUpload.length > 0) {
        setUploading(true);
        try {
          await uploadProof(result.claimId, filesToUpload);
          loadProofs(result.claimId);
        } catch {
          // Upload errors are handled by uploadProof throwing
        } finally {
          setUploading(false);
          setFilesToUpload([]);
        }
      }

      setSubmitted(true);
      reset();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  }

  function addFiles(files: File[]) {
    const newFiles: File[] = [];
    for (const file of files) {
      if (filesToUpload.length + newFiles.length >= MAX_FILES) break;
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" exceeds 2 MB limit. Consider pasting a link instead.`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`File type "${file.type}" not supported. Use JPG, PNG, WebP, MP4, or WebM.`);
        continue;
      }
      newFiles.push(file);
    }
    setFilesToUpload((prev) => [...prev, ...newFiles]);
  }

  function removeFile(index: number) {
    setFilesToUpload((prev) => prev.filter((_, i) => i !== index));
  }

  function removeProof(proofId: string) {
    setProofFiles((prev) => prev.filter((p) => p.id !== proofId));
  }

  const [submittingFor, setSubmittingFor] = useState<'me' | 'other'>('me');

  const proofUrlInputRef = useRef<HTMLInputElement>(null);

  if (!activity) return null;

  const daysLeft = Math.floor((new Date(activity.deadline).getTime() - Date.now()) / 86_400_000);
  const canClaim = activity.status === 'open' || activity.status === 'upcoming';
  const showOnBehalf = submittingFor === 'other';

  return (
    <Modal open={!!activity} onClose={handleClose} title={activity.title} size="lg">
      <div className="space-y-5">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <DomainBadge domain={activity.domain} />
          <ActivityStatusBadge status={activity.status} />
          {activity.branch !== 'all' && (
            <span className="badge-muted text-[11px] px-2 py-0.5">📍 {activity.branch}</span>
          )}
        </div>

        {/* XP reward hero */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-lime-900/10 border border-xplime/20">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">
              XP Reward
            </p>
            <p className="text-3xl font-heading font-bold text-xp-lime">+{activity.xpReward}</p>
          </div>
          {activity.bonusXP && (
            <div className="border-l border-border pl-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">
                Bonus
              </p>
              <p className="text-xl font-heading font-bold text-ambercustom">+{activity.bonusXP}</p>
            </div>
          )}
          <div className="border-l border-border pl-4 ml-auto">
            <DifficultyStars level={activity.difficulty} />
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <Users size={12} />
              <span>
                {activity.claimedCount}
                {activity.maxClaims ? `/${activity.maxClaims}` : ''} claimed
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
            Description
          </h4>
          <p className="text-sm text-foreground leading-relaxed">{activity.description}</p>
        </div>

        {/* Requirements */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
            Requirements
          </h4>
          <ul className="space-y-1.5">
            {activity.requirements.map((req, i) => (
              <li
                key={`req-${activity.id}-${i}`}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <CheckCircle size={14} className="text-xp-lime flex-shrink-0 mt-0.5" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        {/* Submission format */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
          <ExternalLink size={14} className="text-cyancustom flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
              Submission Format
            </p>
            <p className="text-sm text-foreground">{activity.submissionFormat}</p>
          </div>
        </div>

        {/* Deadline */}
        <div className="flex items-center gap-2 text-sm">
          <Clock
            size={14}
            className={daysLeft <= 3 ? 'text-ambercustom' : 'text-muted-foreground'}
          />
          <span className="text-muted-foreground">Deadline:</span>
          <span className={`font-medium ${daysLeft <= 3 ? 'text-ambercustom' : 'text-foreground'}`}>
            {new Date(activity.deadline).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            {daysLeft >= 0 && ` (${daysLeft}d left)`}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {activity.tags.map((tag) => (
            <span
              key={`modal-tag-${activity.id}-${tag}`}
              className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Claim form */}
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-lime-900/20 border border-xplime/30 flex items-center justify-center mb-3">
              <CheckCircle size={28} className="text-xp-lime" />
            </div>
            <h3 className="text-base font-heading font-semibold text-foreground mb-1">
              Claim Submitted!
            </h3>
            <p className="text-sm text-muted-foreground">
              Your claim for{' '}
              <span className="text-foreground font-medium">+{activity.xpReward} XP</span> is now
              under review.
            </p>
            {proofFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
                  Proof Files
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {proofFiles.map((pf) => (
                    <div key={pf.id} className="flex flex-col items-center gap-1">
                      {isImage(pf.fileType) ? (
                        <img
                          src={pf.url}
                          alt={pf.fileName}
                          className="w-16 h-16 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
                          <FileCheck size={24} className="text-muted-foreground" />
                        </div>
                      )}
                      <span
                        className="text-[10px] text-muted-foreground truncate w-16"
                        title={pf.fileName}
                      >
                        {pf.fileName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              You'll be notified once a reviewer approves or requests changes.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-5 py-2 rounded-xl bg-primary/20 border border-primary/40 text-violetcustom text-sm font-medium hover:bg-primary/30 transition-colors duration-150"
            >
              Back to Activities
            </button>
          </div>
        ) : canClaim ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-5">
            <h4 className="text-sm font-heading font-semibold text-foreground">
              Submit Your Claim
            </h4>

            {/* Submitting For */}
            <div className="rounded-lg p-3 border border-line bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Submitting For
                </span>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-accent-soft/50 transition-colors">
                  <input
                    type="radio"
                    value="me"
                    checked={submittingFor === 'me'}
                    onChange={() => setSubmittingFor('me')}
                    className="form-radio"
                  />
                  <span className="text-sm text-foreground">Me (self-submission)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-accent-soft/50 transition-colors">
                  <input
                    type="radio"
                    value="other"
                    checked={submittingFor === 'other'}
                    onChange={() => setSubmittingFor('other')}
                    className="form-radio"
                  />
                  <span className="text-sm text-foreground">
                    Submit on behalf of another member
                  </span>
                </label>
                {submittingFor === 'other' && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-mute mb-1">
                      Member ID or Username <span className="text-rosecustom">*</span>
                    </label>
                    <input
                      id="memberId"
                      type="text"
                      placeholder="e.g. johndoe or UUID"
                      {...register('memberId', {
                        required: 'Member ID is required when submitting on behalf',
                      })}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Only Team Leads (team), Council (branch), or Board (org) can submit on behalf.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Proofs Upload */}
            <div className="rounded-lg p-4 border border-line bg-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Plus size={16} className="text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    Proof Files
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Max {MAX_FILES} files • 2 MB each • JPG, PNG, WebP, MP4, WebM
                </span>
              </div>

              {/* Drag and drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  dragActive
                    ? 'border-accent bg-accent-soft/50'
                    : 'border-border bg-muted/20 hover:border-accent/50'
                }`}
              >
                <input
                  id="fileInput"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
                <label htmlFor="fileInput" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Plus size={24} className="text-muted-foreground" />
                    <p className="text-sm text-foreground">Drag and drop files here</p>
                    <p className="text-[10px] text-muted-foreground">
                      or click to browse • Images (JPG, PNG, WebP) • Videos (MP4, WebM)
                    </p>
                  </div>
                </label>
              </div>

              {/* Selected files list */}
              {filesToUpload.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
                    Selected Files ({filesToUpload.length}/{MAX_FILES})
                  </p>
                  {filesToUpload.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center">
                        {isImage(file) ? (
                          <FileCheck size={16} className="text-muted-foreground" />
                        ) : (
                          <Clock size={16} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground truncate" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <div className="w-full bg-muted h-1 rounded-full mt-1">
                          <div
                            className="bg-accent h-full rounded-full transition-all duration-300"
                            style={{ width: `${(uploadProgress[file.name] || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-[10px] text-rosecustom hover:text-rosecustom/70"
                      >
                        <XCircle size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Text note and links */}
            <div>
              <label htmlFor="proofUrl" className="block text-xs font-medium text-mute mb-1">
                Additional Link (optional)
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Publicly accessible link (GitHub, portfolio, etc.)
              </p>
              <input
                id="proofUrl"
                type="url"
                placeholder="https://github.com/yourname/project"
                {...register('proofUrl', {
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Must be a valid URL starting with http:// or https://',
                  },
                })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
              />
              {errors.proofUrl && (
                <p className="text-xs text-rosecustom mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.proofUrl.message}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="claimNotes"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Notes for Reviewer
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Describe what you did, any challenges faced, or extra context for the reviewer.
              </p>
              <textarea
                id="claimNotes"
                rows={3}
                placeholder="I implemented a BSP tree algorithm for room generation and used Dijkstra's for corridors..."
                {...register('notes', {
                  maxLength: { value: 1000, message: 'Notes must be under 1000 characters' },
                })}
                className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150 resize-none"
              />
              {errors.notes && (
                <p className="text-xs text-rosecustom mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.notes.message}
                </p>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-900/10 border border-rosecustom/30 text-rosecustom text-sm">
                <AlertCircle size={14} />
                {submitError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors disabled:opacity-50"
                disabled={submitting || uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploading}
                className="flex-1 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {submitting || uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    {uploading ? 'Uploading Proofs…' : 'Submitting…'}
                  </>
                ) : (
                  <>Submit Claim · +{activity.xpReward} XP</>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border text-muted-foreground text-sm">
              <AlertCircle size={14} />
              This activity is{' '}
              {activity.status === 'closed'
                ? 'closed and no longer accepting claims'
                : 'not yet open for claims'}
              .
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={`mstar-${i}`}
          size={12}
          className={i < level ? 'text-ambercustom fill-ambercustom' : 'text-muted-foreground'}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">Difficulty {level}/5</span>
    </div>
  );
}
