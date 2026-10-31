'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { canAnyScope, type Role } from '@/lib/permissions';
import {
  getActivityTypes,
  getActivitySubcategories,
  searchMembers,
  submitClaim,
  uploadProof,
  type ActivityType,
  type ActivitySubcategory,
  type MemberOption,
} from '@/lib/api';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
  Plus,
  X,
  UploadCloud,
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  social: 'Social',
  soft: 'Soft',
  management: 'Management',
};
const CATEGORY_ORDER: string[] = ['technical', 'social', 'soft', 'management'];
const DONUT_COLORS = ['#7C5CFF', '#22D3EE', '#A3E635', '#F59E0B', '#F43F5E', '#94A3B8'];

const MAX_PROOFS = 5;
const MAX_PROOF_BYTES = 2 * 1024 * 1024;
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

const STEPS = ['Activity', 'Details', 'Split', 'Review'];

interface Contributor {
  member: MemberOption;
  percent: number;
}
interface ProofItem {
  file: File;
  preview: string | null;
}

function Donut({ contributors }: { contributors: Contributor[] }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const total = contributors.reduce((s, x) => s + x.percent, 0);
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90" role="img" aria-label="Split chart">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="14" opacity="0.1" />
      {contributors.map((x, i) => {
        const len = (Math.min(x.percent, 100) / 100) * c;
        const el = (
          <circle
            key={x.member.id}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        className="rotate-90 origin-center fill-current text-[16px] font-bold"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}
      >
        {total}%
      </text>
    </svg>
  );
}

function MemberPicker({
  placeholder,
  exclude,
  onPick,
}: {
  placeholder: string;
  exclude: string[];
  onPick: (m: MemberOption) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MemberOption[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      setResults(await searchMembers(q));
      setBusy(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
      />
      {q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-card shadow-card max-h-56 overflow-y-auto">
          {busy && <div className="px-3 py-2 text-xs text-mute">Searching…</div>}
          {!busy && results.filter((m) => !exclude.includes(m.id)).length === 0 && (
            <div className="px-3 py-2 text-xs text-mute">No members found.</div>
          )}
          {results
            .filter((m) => !exclude.includes(m.id))
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onPick(m);
                  setQ('');
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent-soft"
              >
                <span className="text-ink">{m.displayName}</span>{' '}
                <span className="text-xs text-mute">@{m.username}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default function ClaimWizardPage() {
  const { user, isLoading } = useAuth();
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [subcategories, setSubcategories] = useState<ActivitySubcategory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [step, setStep] = useState(0);
  const [activity, setActivity] = useState<ActivityType | null>(null);

  // Step 2
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [links, setLinks] = useState<string[]>(['']);
  const [impactNotes, setImpactNotes] = useState('');

  // Step 3
  const [suggestedExp, setSuggestedExp] = useState(0);
  const [submitFor, setSubmitFor] = useState<MemberOption | null>(null);
  const [extra, setExtra] = useState<Contributor[]>([]);
  const [claimantPercent, setClaimantPercent] = useState(100);

  // Step 4
  const [proofs, setProofs] = useState<ProofItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ status: string; proofError: string | null } | null>(null);

  const canSubmitForOthers = useMemo(
    () => !!user && canAnyScope(user.roles as Role[], 'claim.submit_on_behalf'),
    [user]
  );

  useEffect(() => {
    if (isLoading) return;
    (async () => {
      const [acts, subs] = await Promise.all([getActivityTypes(), getActivitySubcategories()]);
      setActivities(acts.filter((a) => a.kind === 'increment' && a.isActive));
      setSubcategories(subs);
    })();
  }, [isLoading]);

  // Free object URLs when proofs change / on unmount.
  useEffect(() => {
    return () => {
      proofs.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    };
  }, [proofs]);

  const claimant: MemberOption | null = useMemo(() => {
    if (submitFor) return submitFor;
    if (!user) return null;
    return { id: user.id, username: user.username, displayName: user.name ?? 'You' };
  }, [submitFor, user]);

  const contributors: Contributor[] = useMemo(
    () => (claimant ? [{ member: claimant, percent: claimantPercent }, ...extra] : []),
    [claimant, claimantPercent, extra]
  );
  const splitTotal = contributors.reduce((s, c) => s + c.percent, 0);

  const filteredActivities = useMemo(() => {
    let r = activities;
    if (selectedCategory !== 'all') r = r.filter((a) => a.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((a) => a.name.toLowerCase().includes(q));
    }
    return r;
  }, [activities, selectedCategory, search]);

  function pickActivity(a: ActivityType) {
    setActivity(a);
    setSuggestedExp(Math.round((a.expMin + a.expMax) / 2));
    setTitle((t) => t || a.name);
    setError(null);
    setStep(1);
  }

  function setExtraPercent(id: string, percent: number) {
    setExtra((list) => list.map((c) => (c.member.id === id ? { ...c, percent } : c)));
  }

  function splitEvenly() {
    const n = contributors.length;
    const base = Math.floor(100 / n);
    setClaimantPercent(base + (100 - base * n));
    setExtra((list) => list.map((c) => ({ ...c, percent: base })));
  }

  function addFiles(list: FileList | File[]) {
    setError(null);
    const next = [...proofs];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_PROOFS) {
        setError(`You can attach at most ${MAX_PROOFS} files.`);
        break;
      }
      if (!PROOF_TYPES.includes(file.type)) {
        setError(`${file.name}: only JPG, PNG, WebP, MP4 and WebM files are allowed.`);
        continue;
      }
      if (file.size > MAX_PROOF_BYTES) {
        setError(
          `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files must be 2 MB or less` +
            (file.type.startsWith('video/') ? ' — for longer videos, paste a link instead.' : '.')
        );
        continue;
      }
      next.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      });
    }
    setProofs(next);
  }

  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
  const linkProblem = cleanLinks.find((l) => !/^https?:\/\/\S+$/.test(l));

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!title.trim()) return 'Give your claim a title.';
      if (!activityDate || activityDate > new Date().toISOString().split('T')[0])
        return 'Pick the date the activity happened (not in the future).';
      if (linkProblem) return `"${linkProblem}" is not a valid link. Links must start with http:// or https://.`;
      if (!impactNotes.trim()) return 'Impact notes are required: explain what changed because of your work.';
    }
    if (s === 2) {
      if (splitTotal !== 100) return `Splits must total exactly 100% (currently ${splitTotal}%).`;
      if (contributors.some((c) => c.percent < 1)) return 'Every contributor needs at least 1%.';
    }
    if (s === 3 && activity?.evidenceRequired && cleanLinks.length === 0 && proofs.length === 0) {
      return 'This activity requires evidence: add a link or upload a file.';
    }
    return null;
  }

  function next() {
    const problem = validateStep(step);
    setError(problem);
    if (!problem) setStep(step + 1);
  }

  async function submit() {
    if (!activity || !user) return;
    const problem = validateStep(1) || validateStep(2) || validateStep(3);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { claimId, status } = await submitClaim({
        activityTypeId: activity.id,
        title: title.trim(),
        description: description.trim() || title.trim(),
        activityDate,
        evidenceLinks: cleanLinks,
        suggestedExp,
        analysisPointers: impactNotes.trim(),
        contributors: contributors.map((c) => ({
          memberId: c.member.id,
          sharePercent: c.percent,
        })),
        submittedOnBehalfOf: submitFor?.id,
      });
      let proofError: string | null = null;
      if (proofs.length > 0) {
        try {
          await uploadProof(
            claimId,
            proofs.map((p) => p.file)
          );
        } catch (e) {
          proofError = e instanceof Error ? e.message : 'Upload failed';
        }
      }
      setResult({ status, proofError });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the claim.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(0);
    setActivity(null);
    setTitle('');
    setDescription('');
    setLinks(['']);
    setImpactNotes('');
    setSubmitFor(null);
    setExtra([]);
    setClaimantPercent(100);
    setProofs([]);
    setResult(null);
    setError(null);
  }

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/claims/new">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (result) {
    const behalf = result.status === 'awaiting_confirmation';
    return (
      <AppLayout activePath="/claims/new">
        <div className="max-w-2xl mx-auto rounded-xl p-8 bg-card border border-line space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-lime-900/20 border border-xplime/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-xp-lime" />
            </div>
            <h2 className="font-heading font-bold text-ink text-xl">Claim submitted</h2>
            {result.proofError && (
              <p role="alert" className="text-sm text-rosecustom mt-2">
                Your claim was saved, but the files could not be uploaded: {result.proofError}. You
                can add them again from My Claims.
              </p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-mute mb-3">
              What happens next
            </h3>
            <ol className="space-y-3 text-sm text-ink">
              {[
                behalf
                  ? `${submitFor?.displayName} confirms or disputes the claim.`
                  : 'An approver in your domain is assigned.',
                'They score your work on their own, without seeing your suggested EXP.',
                'EXP is split between contributors and added to the ledger once approved.',
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent-soft text-accent text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex gap-3 justify-center">
            <Link
              href="/my-claims"
              className="px-4 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft"
            >
              View My Claims
            </Link>
            <button
              onClick={reset}
              className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90"
            >
              Submit another
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/claims/new">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            href="/activities"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={14} /> Back to Activities
          </Link>
          <h1 className="text-2xl font-heading font-bold text-ink mt-2">Submit a Claim</h1>
        </div>

        {/* Progress */}
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Claim steps"
        >
          <div className="flex gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />
                <div
                  className={`mt-1 text-[11px] ${i === step ? 'text-ink font-medium' : 'text-mute'}`}
                >
                  {i + 1}. {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* Step 1: activity */}
        {step === 0 && (
          <>
            <div className="rounded-xl p-4 bg-card border border-line flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search activities…"
                  aria-label="Search activities"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', ...CATEGORY_ORDER].map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(active ? 'all' : cat)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        active
                          ? 'bg-accent text-white'
                          : 'bg-muted/20 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            {CATEGORY_ORDER.map((cat) => {
              const list = filteredActivities.filter((a) => a.category === cat);
              if (list.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {list.map((a) => {
                      const sub = subcategories.find((s) => s.id === a.subcategoryId);
                      return (
                        <button
                          key={a.id}
                          onClick={() => pickActivity(a)}
                          className="group flex flex-col gap-3 p-4 rounded-xl border border-line bg-card hover:border-accent hover:bg-accent-soft/50 text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-heading font-bold text-ink group-hover:text-accent">
                                {a.name}
                              </h4>
                              <p className="text-xs text-mute mt-1 line-clamp-1">
                                {sub?.displayName || CATEGORY_LABELS[a.category]}
                              </p>
                            </div>
                            <span className="badge-xp text-xs font-bold whitespace-nowrap">
                              +{a.expMin}–{a.expMax} XP
                            </span>
                          </div>
                          <ChevronRight size={14} className="self-end text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filteredActivities.length === 0 && (
              <div className="rounded-xl p-12 bg-card border border-line text-center text-mute">
                No activities found.
              </div>
            )}
          </>
        )}

        {/* Step 2: details */}
        {step === 1 && activity && (
          <div className="rounded-xl p-6 bg-card border border-line space-y-5">
            <div>
              <h2 className="font-heading font-bold text-ink text-lg">{activity.name}</h2>
              <p className="text-sm text-mute">
                {CATEGORY_LABELS[activity.category]} · {activity.expMin}–{activity.expMax} XP
              </p>
            </div>
            <div>
              <label htmlFor="title" className="block text-xs font-medium text-mute mb-1">
                Title <span className="text-rosecustom">*</span>
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="w-full px-4 py-3 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="desc" className="block text-xs font-medium text-mute mb-1">
                Description
              </label>
              <textarea
                id="desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                className="w-full px-4 py-3 rounded-lg border border-line bg-background text-sm resize-none focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="date" className="block text-xs font-medium text-mute mb-1">
                Date of activity <span className="text-rosecustom">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={activityDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setActivityDate(e.target.value)}
                className="px-4 py-3 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="block text-xs font-medium text-mute mb-1">
                Evidence links{activity.evidenceRequired && ' (evidence required)'}
              </div>
              <div className="space-y-2">
                {links.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="url"
                      value={l}
                      placeholder="https://github.com/you/project"
                      aria-label={`Evidence link ${i + 1}`}
                      onChange={(e) =>
                        setLinks((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      className="flex-1 px-4 py-2.5 rounded-lg border border-line bg-background text-sm focus:outline-none focus:border-accent"
                    />
                    {links.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remove link"
                        onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}
                        className="px-2 text-mute hover:text-ink"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {links.length < 5 && (
                <button
                  type="button"
                  onClick={() => setLinks((arr) => [...arr, ''])}
                  className="mt-2 flex items-center gap-1 text-xs text-accent"
                >
                  <Plus size={12} /> Add another link
                </button>
              )}
            </div>
            <div>
              <label htmlFor="impact" className="block text-xs font-medium text-mute mb-1">
                Impact notes <span className="text-rosecustom">*</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-1">
                What changed because of your work? Who benefited, how many, how long will it last?
              </p>
              <textarea
                id="impact"
                rows={4}
                value={impactNotes}
                onChange={(e) => setImpactNotes(e.target.value)}
                maxLength={1000}
                className="w-full px-4 py-3 rounded-lg border border-line bg-background text-sm resize-none focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {/* Step 3: suggested EXP + split */}
        {step === 2 && activity && claimant && (
          <div className="space-y-6">
            <div className="rounded-xl p-6 bg-card border border-line space-y-3">
              <label htmlFor="exp" className="block text-sm font-medium text-ink">
                Suggested EXP: <span className="font-mono text-accent">{suggestedExp}</span>
              </label>
              <input
                id="exp"
                type="range"
                min={activity.expMin}
                max={activity.expMax}
                value={suggestedExp}
                onChange={(e) => setSuggestedExp(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-mute">
                <span>{activity.expMin}</span>
                <span>{activity.expMax}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This is only a suggestion. Your approver scores independently and will not see it
                until they have submitted their own score.
              </p>
            </div>

            {canSubmitForOthers && (
              <div className="rounded-xl p-6 bg-card border border-line space-y-3">
                <h3 className="text-sm font-medium text-ink">Submitting for</h3>
                {submitFor ? (
                  <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-sm">
                    <span>
                      {submitFor.displayName}{' '}
                      <span className="text-xs text-mute">
                        — they will be asked to confirm or dispute
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitFor(null);
                        setExtra((l) => l.filter((c) => c.member.id !== submitFor.id));
                      }}
                      className="text-xs text-accent"
                    >
                      Submit as me
                    </button>
                  </div>
                ) : (
                  <MemberPicker
                    placeholder="Submit for another member (leave empty for yourself)…"
                    exclude={[user.id, ...extra.map((c) => c.member.id)]}
                    onPick={(m) => {
                      setSubmitFor(m);
                      setExtra((l) => l.filter((c) => c.member.id !== m.id));
                    }}
                  />
                )}
              </div>
            )}

            <div className="rounded-xl p-6 bg-card border border-line space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink">Contributors &amp; split</h3>
                <button
                  type="button"
                  onClick={splitEvenly}
                  className="text-xs text-accent"
                  disabled={contributors.length < 2}
                >
                  Split evenly
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <Donut contributors={contributors} />
                <ul className="flex-1 w-full space-y-2">
                  {contributors.map((c, i) => (
                    <li key={c.member.id} className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      <span className="flex-1 text-sm text-ink truncate">
                        {c.member.displayName}
                        {i === 0 && <span className="text-xs text-mute"> (claimant)</span>}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={c.percent}
                        aria-label={`${c.member.displayName} share percent`}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
                          if (i === 0) setClaimantPercent(v);
                          else setExtraPercent(c.member.id, v);
                        }}
                        className="w-20 px-2 py-1.5 rounded-lg border border-line bg-background text-sm text-right"
                      />
                      <span className="text-xs text-mute">%</span>
                      {i > 0 ? (
                        <button
                          type="button"
                          aria-label={`Remove ${c.member.displayName}`}
                          onClick={() => setExtra((l) => l.filter((x) => x.member.id !== c.member.id))}
                          className="text-mute hover:text-ink"
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <span className="w-[14px]" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <p
                className={`text-xs ${splitTotal === 100 ? 'text-green-600' : 'text-rosecustom'}`}
                aria-live="polite"
              >
                Total: {splitTotal}% {splitTotal === 100 ? '✓' : '— must equal 100%'}
              </p>
              {extra.length < 9 && (
                <MemberPicker
                  placeholder="Add a contributor…"
                  exclude={contributors.map((c) => c.member.id)}
                  onPick={(m) => {
                    setExtra((l) => [...l, { member: m, percent: 0 }]);
                  }}
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Anyone in the split cannot review this claim.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: proofs + review */}
        {step === 3 && activity && (
          <div className="space-y-6">
            <div className="rounded-xl p-6 bg-card border border-line space-y-3">
              <h3 className="text-sm font-medium text-ink">
                Proof files{' '}
                <span className="text-xs text-mute">
                  (optional · JPG, PNG, WebP, MP4, WebM · 2 MB each · up to {MAX_PROOFS})
                </span>
              </h3>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={`rounded-lg border-2 border-dashed p-6 text-center text-sm ${
                  dragOver ? 'border-accent bg-accent-soft' : 'border-line'
                }`}
              >
                <UploadCloud className="mx-auto mb-2 text-mute" size={24} />
                <p className="text-mute">Drag files here or</p>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="mt-1 text-accent font-medium"
                >
                  browse
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  accept={PROOF_TYPES.join(',')}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
              {proofs.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {proofs.map((p, i) => (
                    <li key={i} className="relative rounded-lg border border-line overflow-hidden">
                      {p.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.preview} alt={p.file.name} className="h-20 w-full object-cover" />
                      ) : (
                        <div className="h-20 flex items-center justify-center text-xs text-mute">
                          Video
                        </div>
                      )}
                      <div className="px-2 py-1 text-[10px] truncate">{p.file.name}</div>
                      <button
                        type="button"
                        aria-label={`Remove ${p.file.name}`}
                        onClick={() => setProofs((l) => l.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl p-6 bg-card border border-line space-y-2 text-sm">
              <h3 className="text-sm font-medium text-ink mb-2">Review</h3>
              <Row k="Activity" v={activity.name} />
              <Row k="Title" v={title} />
              <Row k="Date" v={activityDate} />
              <Row k="Suggested EXP" v={String(suggestedExp)} />
              <Row
                k="Submitting for"
                v={submitFor ? `${submitFor.displayName} (needs their confirmation)` : 'Yourself'}
              />
              <Row
                k="Split"
                v={contributors.map((c) => `${c.member.displayName} ${c.percent}%`).join(', ')}
              />
              <Row k="Links" v={cleanLinks.length ? cleanLinks.join(', ') : '—'} />
              <Row k="Files" v={`${proofs.length}`} />
            </div>
          </div>
        )}

        {/* Navigation */}
        {step > 0 && (
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep(step - 1);
              }}
              disabled={submitting}
              className="px-4 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft disabled:opacity-50"
            >
              Back
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit claim'}
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-mute">{k}</span>
      <span className="text-ink break-words min-w-0">{v}</span>
    </div>
  );
}
