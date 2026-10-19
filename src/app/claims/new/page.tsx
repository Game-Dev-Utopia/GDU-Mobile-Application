'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getActivityTypes,
  getActivitySubcategories,
  submitClaim,
  type ActivityType,
  type ActivitySubcategory,
} from '@/lib/api';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  social: 'Social',
  soft: 'Soft',
  management: 'Management',
};

const CATEGORY_ORDER: string[] = ['technical', 'social', 'soft', 'management'];

interface ClaimWizardState {
  step: 'select' | 'form' | 'submitted';
  selectedActivity: ActivityType | null;
}

export default function ClaimWizardPage() {
  const { user, isLoading } = useAuth();
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [subcategories, setSubcategories] = useState<ActivitySubcategory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [wizard, setWizard] = useState<ClaimWizardState>({
    step: 'select',
    selectedActivity: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ proofUrl: string; notes: string }>();

  useEffect(() => {
    if (!isLoading) {
      loadData();
    }
  }, [isLoading]);

  async function loadData() {
    const [acts, subs] = await Promise.all([getActivityTypes(), getActivitySubcategories()]);
    setActivities(acts);
    setSubcategories(subs);
  }

  const filteredActivities = useMemo(() => {
    let result = activities;
    if (selectedCategory !== 'all') {
      result = result.filter((a) => a.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) || (a.category && a.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activities, selectedCategory, search]);

  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityType[]> = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = filteredActivities.filter((a) => a.category === cat);
    }
    return groups;
  }, [filteredActivities]);

  async function onClaimSubmit(data: { proofUrl: string; notes: string }) {
    if (!wizard.selectedActivity) return;
    setSubmitting(true);
    try {
      await submitClaim({
        activityTypeId: wizard.selectedActivity.id,
        title: wizard.selectedActivity.name,
        description: wizard.selectedActivity.name,
        activityDate: new Date().toISOString().split('T')[0],
        evidenceLinks: data.proofUrl ? [data.proofUrl] : [],
        suggestedExp: (wizard.selectedActivity.expMin + wizard.selectedActivity.expMax) / 2,
        analysisPointers: data.notes,
        contributors: [{ memberId: 'current-user', sharePercent: 100 }],
      });
      setWizard({ step: 'submitted', selectedActivity: null });
      reset();
    } catch {
      // Error handled by UI
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    setWizard({ step: 'select', selectedActivity: null });
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

  return (
    <AppLayout activePath="/claims/new">
      <div className="max-w-4xl mx-auto space-y-6">
        {wizard.step === 'select' ? (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <Link
                  href="/activities"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft size={14} /> Back to Activities
                </Link>
                <h1 className="text-2xl font-heading font-bold text-ink mt-2">Submit a Claim</h1>
                <p className="text-mute">Select an activity type to claim XP for your work.</p>
              </div>
            </div>

            {/* Search + Category filter */}
            <div className="rounded-xl p-4 bg-card border border-line">
              <div className="flex flex-col lg:flex-row gap-4 items-end">
                <div className="relative flex-1 lg:w-96">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search activities…"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                </div>
                <div className="flex gap-2 flex-1 lg:w-auto">
                  {['all', ...CATEGORY_ORDER].map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={`cat-${cat}`}
                        onClick={() => setSelectedCategory(active ? 'all' : cat)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? 'bg-accent text-white'
                            : 'bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        {cat === 'all' ? 'All Categories' : CATEGORY_LABELS[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Activity list grouped by category */}
            <div className="space-y-6">
              {CATEGORY_ORDER.map((cat) => {
                const catActivities = groupedActivities[cat];
                if (catActivities.length === 0) return null;
                return (
                  <div key={cat} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-4">
                      {CATEGORY_LABELS[cat]}
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {catActivities.map((activity) => {
                        const subcat = subcategories.find((s) => s.id === activity.subcategoryId);
                        return (
                          <button
                            key={activity.id}
                            onClick={() => setWizard({ step: 'form', selectedActivity: activity })}
                            className="group flex flex-col gap-3 p-4 rounded-xl border border-line bg-card hover:border-accent hover:bg-accent-soft/50 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-heading font-bold text-ink group-hover:text-accent transition-colors">
                                  {activity.name}
                                </h4>
                                <p className="text-xs text-mute mt-1 line-clamp-1">
                                  {subcat?.displayName || activity.category}
                                </p>
                              </div>
                              <span className="badge-xp text-xs font-bold">
                                +{activity.expMin}–{activity.expMax} XP
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{activity.kind}</span>
                              <ChevronRight
                                size={14}
                                className="group-hover:text-accent transition-colors"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredActivities.length === 0 && (
              <div className="rounded-xl p-12 bg-card border border-line text-center">
                <p className="text-mute">No activities found matching your filters.</p>
              </div>
            )}
          </>
        ) : wizard.step === 'form' && wizard.selectedActivity ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-sm font-medium text-ink">{wizard.selectedActivity.name}</span>
            </div>

            <div className="rounded-xl p-6 bg-card border border-line">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-heading font-bold text-ink text-lg">
                    {wizard.selectedActivity.name}
                  </h2>
                  <p className="text-sm text-mute">
                    {wizard.selectedActivity.expMin}–{wizard.selectedActivity.expMax} XP •
                    Difficulty {wizard.selectedActivity.difficulty}/5
                  </p>
                </div>
                <span className="badge-xp text-xs font-bold px-2 py-1 rounded bg-accent-soft text-accent">
                  Increment
                </span>
              </div>

              <form onSubmit={handleSubmit(onClaimSubmit)} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-mute mb-2">
                    Proof Link <span className="text-rosecustom">*</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Publicly accessible link to your work (GitHub, portfolio, etc.)
                  </p>
                  <input
                    type="url"
                    placeholder="https://github.com/yourname/project"
                    {...register('proofUrl', {
                      required: 'Proof link is required',
                      pattern: {
                        value: /^https?:\/\/.+/,
                        message: 'Must be a valid URL starting with http:// or https://',
                      },
                    })}
                    className="w-full px-4 py-3 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                  />
                  {errors.proofUrl && (
                    <p className="text-xs text-rosecustom mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.proofUrl.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-mute mb-2">
                    Notes for Reviewer
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Describe what you did and any context for the reviewer.
                  </p>
                  <textarea
                    rows={4}
                    placeholder="I implemented a BSP tree algorithm for room generation..."
                    {...register('notes', {
                      maxLength: { value: 1000, message: 'Notes must be under 1000 characters' },
                    })}
                    className="w-full px-4 py-3 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm resize-none"
                  />
                  {errors.notes && (
                    <p className="text-xs text-rosecustom mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.notes.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-line">
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-4 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors disabled:opacity-50"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" /> Submitting…
                      </>
                    ) : (
                      <>
                        Submit Claim · +
                        {Math.round(
                          (wizard.selectedActivity.expMin + wizard.selectedActivity.expMax) / 2
                        )}{' '}
                        XP est.
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : wizard.step === 'submitted' ? (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <div className="w-16 h-16 rounded-full bg-lime-900/20 border border-xplime/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-xp-lime" />
            </div>
            <h2 className="font-heading font-bold text-ink mb-2">Claim Submitted!</h2>
            <p className="text-mute mb-6">
              Your claim is now under review. You'll be notified once a reviewer approves or
              requests changes.
            </p>
            <button
              onClick={goBack}
              className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
            >
              Submit Another Claim
            </button>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
