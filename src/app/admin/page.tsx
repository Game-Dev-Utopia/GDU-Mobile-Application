'use client';

import React, { useEffect, useState } from 'react';
import { getActivityTypes, getAnnouncements, updateActivityType } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { ActivityType } from '@/lib/api';

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    name: string;
    expMin: number;
    expMax: number;
    seasonCap: number | null;
    difficulty: number;
    isActive: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user]);

  async function loadData() {
    setLoading(true);
    const [acts, anns] = await Promise.all([getActivityTypes(), getAnnouncements()]);
    setActivities(acts);
    setAnnouncements(anns);
    setLoading(false);
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/admin">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/admin">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Admin Console</h1>
            <p className="text-mute">Manage activity types and rubric configuration</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="col-span-1 lg:col-span-2 rounded-xl p-6 bg-card border border-line">
            <h2 className="font-heading font-bold text-ink mb-4">Activity Types (Rubric)</h2>
            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-accent-soft text-xs">
                    <th className="px-4 py-3 font-semibold text-mute">Name</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">EXP Range</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Difficulty</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Cap</th>
                    <th className="px-4 py-3 font-semibold text-mute text-center">Active</th>
                    <th className="px-4 py-3 font-semibold text-mute text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                      <td className="px-4 py-3 text-sm text-ink">{a.name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-ink text-center">
                        {a.expMin}–{a.expMax}
                      </td>
                      <td className="px-4 py-3 text-sm text-mute text-center">
                        {'★'.repeat(a.difficulty)}${'☆'.repeat(5 - a.difficulty)}
                      </td>
                      <td className="px-4 py-3 text-sm text-mute text-center">
                        {a.seasonCap ?? '∞'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {a.isActive ? (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-medium">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditing(a.id);
                            setEditData({
                              name: a.name,
                              expMin: a.expMin,
                              expMax: a.expMax,
                              seasonCap: a.seasonCap ?? 0,
                              difficulty: a.difficulty,
                              isActive: a.isActive,
                            });
                          }}
                          className="text-xs text-accent hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-mute">
                        No activity types configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-1 space-y-6">
            <div className="rounded-xl p-6 bg-card border border-line">
              <h3 className="font-heading font-bold text-ink mb-4">Announcements</h3>
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg bg-accent-soft/5 border border-accent/20"
                  >
                    <div className="text-xs font-medium text-accent">{a.title}</div>
                    <div className="text-xs text-mute mt-1">{a.body}</div>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div className="text-xs text-mute text-center py-4">No announcements.</div>
                )}
              </div>
            </div>

            {editing && editData && (
              <div className="rounded-xl p-6 bg-card border border-accent">
                <h3 className="font-heading font-bold text-ink mb-4">Edit Activity</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-mute mb-1">Name</label>
                    <input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="grid gap-3 grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-mute mb-1">EXP Min</label>
                      <input
                        type="number"
                        value={editData.expMin}
                        onChange={(e) =>
                          setEditData({ ...editData, expMin: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-mute mb-1">EXP Max</label>
                      <input
                        type="number"
                        value={editData.expMax}
                        onChange={(e) =>
                          setEditData({ ...editData, expMax: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mute mb-1">Season Cap</label>
                    <input
                      type="number"
                      value={editData.seasonCap ?? 0}
                      onChange={(e) =>
                        setEditData({ ...editData, seasonCap: Number(e.target.value) || null })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-line bg-card focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editData.isActive}
                      onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                      className="rounded border-line text-accent focus:ring-accent"
                    />
                    <label className="text-xs text-mute">Active</label>
                  </div>
                </div>
                <div className="flex gap-3 pt-6">
                  <button
                    onClick={() => {
                      setEditing(null);
                      setEditData(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!editing || !editData) return;
                      try {
                        await updateActivityType(editing, {
                          name: editData.name,
                          expMin: editData.expMin,
                          expMax: editData.expMax,
                          seasonCap: editData.seasonCap ?? 0,
                          difficulty: editData.difficulty,
                          isActive: editData.isActive,
                        });
                        setEditing(null);
                        setEditData(null);
                        await loadData();
                      } catch (err) {
                        alert('Failed to save activity changes.');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
