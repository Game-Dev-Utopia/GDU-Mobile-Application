'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  proposeActivity,
  getActivitySubcategories,
  type ActivitySubcategory,
  type ExpCategory,
} from '@/lib/api';

const CATEGORY_LABELS: Record<ExpCategory, string> = {
  technical: 'Technical',
  social: 'Social',
  soft: 'Soft',
  management: 'Management',
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Trivial',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Expert',
};

export default function ProposeActivityPage() {
  const { user, isLoading } = useAuth();
  const [subcategories, setSubcategories] = useState<ActivitySubcategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: '' as ExpCategory,
    subcategoryId: '' as string | null,
    domainId: '' as string | null,
    kind: 'increment' as string,
    expMin: 0,
    expMax: 0,
    seasonCap: '',
    difficulty: 3 as const,
    evidenceRequired: true,
    approversNeeded: 1 as const,
    description: '',
    justification: '',
  });

  useEffect(() => {
    if (!isLoading) {
      loadSubcategories();
    }
  }, [isLoading]);

  async function loadSubcategories() {
    const data = await getActivitySubcategories();
    setSubcategories(data);
  }

  function handleChange(key: string, value: any) {
    setForm({ ...form, [key]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      await proposeActivity({
        name: form.name,
        category: form.category,
        subcategoryId: form.subcategoryId || null,
        domainId: form.domainId || null,
        kind: form.kind,
        expMin: form.expMin,
        expMax: form.expMax,
        seasonCap: form.seasonCap ? Number(form.seasonCap) : null,
        difficulty: form.difficulty,
        evidenceRequired: form.evidenceRequired,
        approversNeeded: form.approversNeeded,
        description: form.description,
        justification: form.justification,
      });
      setMessage({
        type: 'success',
        text: 'Activity proposal submitted! It will be reviewed by your Domain Head, then an Admin before going live.',
      });
      setForm({
        name: '',
        category: '' as ExpCategory,
        subcategoryId: null,
        domainId: null,
        kind: 'increment',
        expMin: 0,
        expMax: 0,
        seasonCap: '',
        difficulty: 3,
        evidenceRequired: true,
        approversNeeded: 1,
        description: '',
        justification: '',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit proposal.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/activities/propose">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/activities/propose">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Propose a New Activity</h1>
            <p className="text-mute">
              Suggest a new activity type for the GDU XP rubric. It will be reviewed by your Domain
              Head, then an Admin before becoming available to all members.
            </p>
          </div>
          {message && (
            <div
              className={`px-4 py-3 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl p-6 bg-card border border-line">
            <h3 className="font-heading font-bold text-ink mb-4">Activity Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-mute uppercase">Activity Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Hackathon Organization"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-mute uppercase">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value as ExpCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                  required
                >
                  <option value="">Select a category</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key as ExpCategory}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-mute uppercase">Subcategory</label>
                <select
                  value={form.subcategoryId ?? ''}
                  onChange={(e) => handleChange('subcategoryId', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                >
                  <option value="">Select a subcategory (optional)</option>
                  {subcategories
                    .filter((s) => s.category === form.category || !form.category)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-mute uppercase">Domain</label>
                <select
                  value={form.domainId ?? ''}
                  onChange={(e) => handleChange('domainId', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                >
                  <option value="">Select a domain (optional)</option>
                  <option value="game-dev">Game Dev</option>
                  <option value="design">Design</option>
                  <option value="content">Content</option>
                  <option value="ai">AI</option>
                  <option value="web-devops">Web/DevOps</option>
                  <option value="r-d">R&D</option>
                  <option value="marketing">Marketing</option>
                  <option value="ops">Ops</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-mute uppercase">EXP Minimum</label>
                <input
                  type="number"
                  min="0"
                  value={form.expMin}
                  onChange={(e) => handleChange('expMin', Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-mute uppercase">EXP Maximum</label>
                <input
                  type="number"
                  min="0"
                  value={form.expMax}
                  onChange={(e) => handleChange('expMax', Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-mute uppercase">
                  Season Cap (max claims per season)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.seasonCap}
                  onChange={(e) => handleChange('seasonCap', e.target.value)}
                  placeholder="Leave blank for unlimited"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-mute uppercase">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) =>
                    handleChange('difficulty', Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                >
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {d} - {DIFFICULTY_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-mute uppercase">Approvers Needed</label>
                <select
                  value={form.approversNeeded}
                  onChange={(e) =>
                    handleChange('approversNeeded', Number(e.target.value) as 1 | 2 | 3)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                >
                  <option value={1}>1 Approver</option>
                  <option value={2}>2 Approvers</option>
                  <option value={3}>Board Majority</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.evidenceRequired}
                    onChange={(e) => handleChange('evidenceRequired', e.target.checked)}
                    className="rounded border-line text-accent focus:ring-accent"
                  />
                  Evidence required (links, screenshots, etc.)
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-6 bg-card border border-line">
            <h3 className="font-heading font-bold text-ink mb-4">Justification</h3>
            <div className="space-y-2">
              <label className="text-xs font-medium text-mute uppercase">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="What does this activity involve? What deliverables are expected?"
                className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-mute uppercase">
                Why this activity matters
              </label>
              <textarea
                rows={4}
                value={form.justification}
                onChange={(e) => handleChange('justification', e.target.value)}
                placeholder="Explain why this activity should be recognized with EXP, who benefits, and how it aligns with GDU goals."
                className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="px-4 py-2.5 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
              disabled={
                submitting ||
                !form.name ||
                !form.category ||
                !form.justification ||
                form.expMax < form.expMin
              }
            >
              {submitting ? 'Submitting…' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
