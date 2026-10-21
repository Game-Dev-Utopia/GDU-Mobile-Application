'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import EmptyState from '@/components/ui/EmptyState';
import {
  getPartnerEvents,
  getPartnerOpportunities,
  getPartnerProjects,
  getPartnerReps,
  getPartnerSplits,
  getGuestPasses,
  createPartnerEvent,
  postPartnerOpportunity,
  proposePartnerProject,
  coSignSplit,
  issueGuestPass,
  type PartnerEvent,
  type PartnerOpportunity,
  type PartnerProject,
  type PartnerSplit,
  type GuestPass,
} from '@/lib/api';
import { Shield, Clock, User, AlertCircle, Loader2, Send, Gift, ExternalLink } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-rose-100 text-rose-700',
  open: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  filled: 'bg-amber-100 text-amber-700',
  proposed: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  co_signed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const EVENT_TYPE_LABEL: Record<string, string> = { event: 'Event', jam: 'Jam' };

export default function PartnerRepPortal() {
  const { user, isLoading } = useAuth();
  const roles = user?.roles || [];
  const isRep = roles.includes('partner_rep');

  const [error, setError] = useState<string | null>(null);

  // Rep context
  const [myPartner, setMyPartner] = useState<{ id: string; name: string } | null>(null);

  // Data
  const [events, setEvents] = useState<PartnerEvent[]>([]);
  const [opportunities, setOpportunities] = useState<PartnerOpportunity[]>([]);
  const [projects, setProjects] = useState<PartnerProject[]>([]);
  const [splits, setSplits] = useState<PartnerSplit[]>([]);
  const [passes, setPasses] = useState<GuestPass[]>([]);

  // Form state
  const [eventForm, setEventForm] = useState({
    title: '',
    eventType: 'event' as 'event' | 'jam',
    description: '',
    startsAt: '',
    endsAt: '',
    location: '',
    isVirtual: true,
  });
  const [opportunityForm, setOpportunityForm] = useState({
    title: '',
    opType: 'opportunity' as 'opportunity' | 'jam',
    description: '',
    link: '',
    expiresAt: '',
  });
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
  });
  const [splitForm, setSplitForm] = useState({
    sourceType: 'claim' as 'claim' | 'project',
    sourceId: '',
    partnerSharePercent: 50,
    memberSharePercent: 50,
  });
  const [passForm, setPassForm] = useState({
    guestEmail: '',
    guestName: '',
    purpose: '',
    expiresAt: '',
  });

  // Loading/submitting states
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [postingOpportunity, setPostingOpportunity] = useState(false);
  const [proposingProject, setProposingProject] = useState(false);
  const [coSigning, setCoSigning] = useState(false);
  const [issuingPass, setIssuingPass] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [repData] = await Promise.all([getPartnerReps()]);
      const primary = repData.find((r) => r.isPrimary) || repData[0];
      if (primary && primary.partnerName) {
        setMyPartner({ id: primary.partnerId, name: primary.partnerName });
      }

      if (primary) {
        const [ev, op, pr, sp, gp] = await Promise.all([
          getPartnerEvents({ partnerId: primary.partnerId }),
          getPartnerOpportunities({ partnerId: primary.partnerId }),
          getPartnerProjects({ partnerId: primary.partnerId }),
          getPartnerSplits(),
          getGuestPasses({ partnerId: primary.partnerId }),
        ]);
        setEvents(ev);
        setOpportunities(op);
        setProjects(pr);
        setSplits(sp);
        setPasses(gp);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rep portal.');
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      loadAll();
    }
  }, [isLoading, user, loadAll]);

  const partnerId = myPartner?.id;

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerId) return;
    setCreatingEvent(true);
    setError(null);
    try {
      await createPartnerEvent({
        partnerId,
        title: eventForm.title,
        eventType: eventForm.eventType,
        description: eventForm.description || null,
        startsAt: eventForm.startsAt || null,
        endsAt: eventForm.endsAt || null,
        location: eventForm.location || null,
        isVirtual: eventForm.isVirtual,
      });
      setEventForm({
        title: '',
        eventType: 'event',
        description: '',
        startsAt: '',
        endsAt: '',
        location: '',
        isVirtual: true,
      });
      const updated = await getPartnerEvents({ partnerId });
      setEvents(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event.');
    } finally {
      setCreatingEvent(false);
    }
  }

  async function handlePostOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerId) return;
    setPostingOpportunity(true);
    setError(null);
    try {
      await postPartnerOpportunity({
        partnerId,
        title: opportunityForm.title,
        opType: opportunityForm.opType,
        description: opportunityForm.description || null,
        link: opportunityForm.link || null,
        expiresAt: opportunityForm.expiresAt || null,
      });
      setOpportunityForm({
        title: '',
        opType: 'opportunity',
        description: '',
        link: '',
        expiresAt: '',
      });
      const updated = await getPartnerOpportunities({ partnerId });
      setOpportunities(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post opportunity.');
    } finally {
      setPostingOpportunity(false);
    }
  }

  async function handleProposeProject(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerId) return;
    setProposingProject(true);
    setError(null);
    try {
      await proposePartnerProject({
        partnerId,
        title: projectForm.title,
        description: projectForm.description || null,
      });
      setProjectForm({ title: '', description: '' });
      const updated = await getPartnerProjects({ partnerId });
      setProjects(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to propose project.');
    } finally {
      setProposingProject(false);
    }
  }

  async function handleCoSignSplit(e: React.FormEvent) {
    e.preventDefault();
    setCoSigning(true);
    setError(null);
    try {
      await coSignSplit({
        sourceType: splitForm.sourceType,
        sourceId: splitForm.sourceId,
        partnerSharePercent: splitForm.partnerSharePercent,
        memberSharePercent: splitForm.memberSharePercent,
      });
      setSplitForm({
        sourceType: 'claim',
        sourceId: '',
        partnerSharePercent: 50,
        memberSharePercent: 50,
      });
      const updated = await getPartnerSplits();
      setSplits(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to co-sign split.');
    } finally {
      setCoSigning(false);
    }
  }

  async function handleIssuePass(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerId) return;
    setIssuingPass(true);
    setError(null);
    try {
      await issueGuestPass({
        partnerId,
        guestEmail: passForm.guestEmail,
        guestName: passForm.guestName,
        purpose: passForm.purpose || null,
        expiresAt: passForm.expiresAt,
      });
      setPassForm({ guestEmail: '', guestName: '', purpose: '', expiresAt: '' });
      const updated = await getGuestPasses({ partnerId });
      setPasses(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue guest pass.');
    } finally {
      setIssuingPass(false);
    }
  }

  const statusBadge = (status: string) => (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLOR[status] || ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );

  const section = (title: string, icon: React.ElementType, children: React.ReactNode) => {
    const Icon = icon;
    return (
      <div className="rounded-xl p-6 bg-card border border-line">
        <div className="flex items-center gap-2 mb-4">
          <Icon size={18} className="text-accent" />
          <h2 className="font-heading font-bold text-ink">{title}</h2>
        </div>
        {children}
      </div>
    );
  };

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/partners/rep">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!isRep) {
    return (
      <AppLayout activePath="/partners/rep">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <Shield size={48} className="mx-auto mb-4 text-rose-500" />
            <h2 className="font-heading font-bold text-ink mb-2">Partner Rep Portal</h2>
            <p className="text-mute mb-6">
              This portal is for Partner Representatives only. Your account does not hold the{' '}
              <span className="font-mono text-xs">partner_rep</span> role.
            </p>
            <button
              onClick={() => {}}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Back to Partners
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout activePath="/partners/rep">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/partners/rep">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Partner Rep Portal</h1>
            <p className="text-mute">
              Co-host events &amp; jams, post opportunities, propose joint projects, co-sign splits,
              and issue guest passes.
            </p>
          </div>
          {myPartner && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-accent-soft/50 text-sm">
              <User size={16} className="text-mute" />
              <span className="font-medium text-ink">{myPartner.name}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Co-host Event / Jam */}
        {section(
          'Co-host Event / Jam',
          Clock,
          <>
            <form
              onSubmit={handleCreateEvent}
              className="grid gap-3 sm:grid-cols-4 items-end border rounded-lg p-4 bg-accent-soft/30"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Title</label>
                <input
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="Event title"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Type</label>
                <select
                  value={eventForm.eventType}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, eventType: e.target.value as 'event' | 'jam' })
                  }
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                >
                  <option value="event">Event</option>
                  <option value="jam">Jam</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Starts at</label>
                <input
                  type="datetime-local"
                  value={eventForm.startsAt}
                  onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Location / Virtual</label>
                <input
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="Room or link"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={creatingEvent}
                className="px-4 py-2 rounded-lg bg-accent text-white font-sm font-medium disabled:opacity-50 hover:bg-accent/90"
              >
                {creatingEvent ? 'Creating…' : 'Create'}
              </button>
            </form>
            {events.length > 0 ? (
              <div className="mt-4 overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">Title</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Type</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right">Starts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-b border-line/50">
                        <td className="px-4 py-3 text-sm text-ink">{e.title}</td>
                        <td className="px-4 py-3 text-sm text-mute text-center">
                          {EVENT_TYPE_LABEL[e.eventType]}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{statusBadge(e.status)}</td>
                        <td className="px-4 py-3 text-sm text-mute text-right">
                          {e.startsAt ? new Date(e.startsAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="No events yet"
                description="You haven't co-hosted any events or jams yet."
                action="Co-host Event"
              />
            )}
          </>
        )}

        {/* Post Opportunity */}
        {section(
          'Post Opportunity',
          ExternalLink,
          <>
            <form
              onSubmit={handlePostOpportunity}
              className="grid gap-3 sm:grid-cols-4 items-end border rounded-lg p-4 bg-accent-soft/30"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Title</label>
                <input
                  value={opportunityForm.title}
                  onChange={(e) =>
                    setOpportunityForm({ ...opportunityForm, title: e.target.value })
                  }
                  placeholder="Opportunity title"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Type</label>
                <select
                  value={opportunityForm.opType}
                  onChange={(e) =>
                    setOpportunityForm({
                      ...opportunityForm,
                      opType: e.target.value as 'opportunity' | 'jam',
                    })
                  }
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                >
                  <option value="opportunity">Opportunity</option>
                  <option value="jam">Jam</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Expires at</label>
                <input
                  type="datetime-local"
                  value={opportunityForm.expiresAt}
                  onChange={(e) =>
                    setOpportunityForm({ ...opportunityForm, expiresAt: e.target.value })
                  }
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Link</label>
                <input
                  value={opportunityForm.link}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, link: e.target.value })}
                  placeholder="Application link"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={postingOpportunity}
                className="px-4 py-2 rounded-lg bg-accent text-white font-sm font-medium disabled:opacity-50 hover:bg-accent/90"
              >
                {postingOpportunity ? 'Posting…' : 'Post'}
              </button>
            </form>
            {opportunities.length > 0 ? (
              <div className="mt-4 overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">Title</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((o) => (
                      <tr key={o.id} className="border-b border-line/50">
                        <td className="px-4 py-3 text-sm text-ink">{o.title}</td>
                        <td className="px-4 py-3 text-sm text-center">{statusBadge(o.status)}</td>
                        <td className="px-4 py-3 text-sm text-mute text-right">
                          {o.expiresAt ? new Date(o.expiresAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={LinkIcon}
                title="No opportunities yet"
                description="You haven't posted any opportunities."
                action="Post Opportunity"
              />
            )}
          </>
        )}

        {/* Propose Joint Project */}
        {section(
          'Propose Joint Project',
          Gift,
          <>
            <form
              onSubmit={handleProposeProject}
              className="grid gap-3 sm:grid-cols-2 items-end border rounded-lg p-4 bg-accent-soft/30"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Project title</label>
                <input
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="Project title"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Description</label>
                <input
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="What you'll build together"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={proposingProject}
                className="px-4 py-2 rounded-lg bg-accent text-white font-sm font-medium disabled:opacity-50 hover:bg-accent/90"
              >
                {proposingProject ? 'Proposing…' : 'Propose'}
              </button>
            </form>
            {projects.length > 0 ? (
              <div className="mt-4 overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">Title</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className="border-b border-line/50">
                        <td className="px-4 py-3 text-sm text-ink">{p.title}</td>
                        <td className="px-4 py-3 text-sm text-center">{statusBadge(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Gift}
                title="No projects yet"
                description="You haven't proposed any joint projects."
                action="Propose Project"
              />
            )}
          </>
        )}

        {/* Co-sign Split */}
        {section(
          'Co-sign Split',
          Send,
          <>
            <form
              onSubmit={handleCoSignSplit}
              className="grid gap-3 sm:grid-cols-4 items-end border rounded-lg p-4 bg-accent-soft/30"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Source type</label>
                <select
                  value={splitForm.sourceType}
                  onChange={(e) =>
                    setSplitForm({
                      ...splitForm,
                      sourceType: e.target.value as 'claim' | 'project',
                    })
                  }
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                >
                  <option value="claim">Claim</option>
                  <option value="project">Project</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Source ID</label>
                <input
                  value={splitForm.sourceId}
                  onChange={(e) => setSplitForm({ ...splitForm, sourceId: e.target.value })}
                  placeholder="Claim or project ID"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Partner share %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={splitForm.partnerSharePercent}
                  onChange={(e) =>
                    setSplitForm({ ...splitForm, partnerSharePercent: Number(e.target.value) || 0 })
                  }
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Member share %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={splitForm.memberSharePercent}
                  onChange={(e) =>
                    setSplitForm({ ...splitForm, memberSharePercent: Number(e.target.value) || 0 })
                  }
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={coSigning}
                className="px-4 py-2 rounded-lg bg-accent text-white font-sm font-medium disabled:opacity-50 hover:bg-accent/90"
              >
                {coSigning ? 'Signing…' : 'Co-sign'}
              </button>
            </form>
            {splits.length > 0 ? (
              <div className="mt-4 overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">Source</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Partner %</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Member %</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {splits.map((s) => (
                      <tr key={s.id} className="border-b border-line/50">
                        <td className="px-4 py-3 text-sm font-mono text-ink">
                          {s.sourceType} {s.sourceId.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{s.partnerSharePercent}%</td>
                        <td className="px-4 py-3 text-sm text-center">{s.memberSharePercent}%</td>
                        <td className="px-4 py-3 text-sm text-center">{statusBadge(s.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Send}
                title="No splits yet"
                description="You haven't co-signed any splits."
                action="Co-sign Split"
              />
            )}
          </>
        )}

        {/* Issue Guest Pass */}
        {section(
          'Issue Guest Pass',
          Shield,
          <>
            <form
              onSubmit={handleIssuePass}
              className="grid gap-3 sm:grid-cols-3 items-end border rounded-lg p-4 bg-accent-soft/30"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Guest email</label>
                <input
                  value={passForm.guestEmail}
                  onChange={(e) => setPassForm({ ...passForm, guestEmail: e.target.value })}
                  placeholder="guest@example.org"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Guest name</label>
                <input
                  value={passForm.guestName}
                  onChange={(e) => setPassForm({ ...passForm, guestName: e.target.value })}
                  placeholder="Guest name"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Expires at</label>
                <input
                  type="datetime-local"
                  value={passForm.expiresAt}
                  onChange={(e) => setPassForm({ ...passForm, expiresAt: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-mute">Purpose</label>
                <input
                  value={passForm.purpose}
                  onChange={(e) => setPassForm({ ...passForm, purpose: e.target.value })}
                  placeholder="Why they're visiting"
                  className="px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={issuingPass}
                className="px-4 py-2 rounded-lg bg-accent text-white font-sm font-medium disabled:opacity-50 hover:bg-accent/90"
              >
                {issuingPass ? 'Issuing…' : 'Issue'}
              </button>
            </form>
            {passes.length > 0 ? (
              <div className="mt-4 overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-accent-soft">
                      <th className="px-4 py-3 font-semibold text-mute">Guest</th>
                      <th className="px-4 py-3 font-semibold text-mute text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-mute text-right">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passes.map((p) => (
                      <tr key={p.id} className="border-b border-line/50">
                        <td className="px-4 py-3 text-sm text-ink">{p.guestName}</td>
                        <td className="px-4 py-3 text-sm text-center">{statusBadge(p.status)}</td>
                        <td className="px-4 py-3 text-sm text-mute text-right">
                          {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Shield}
                title="No guest passes yet"
                description="You haven't issued any guest passes."
                action="Issue Guest Pass"
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
