'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { can } from '@/lib/permissions';
import {
  getRewardCatalog,
  createReward,
  updateReward,
  deleteReward,
  type RewardCatalog,
} from '@/lib/api';

const RARITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  common: { color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  uncommon: { color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  rare: { color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  epic: { color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
  legendary: { color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
};

export default function AdminCatalogPage() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<RewardCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{
    name: string;
    description: string;
    costCoins: number;
    stock: number;
    rarity: RewardCatalog['rarity'];
    imageUrl: string;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    costCoins: 0,
    stock: 0,
    rarity: 'common',
    imageUrl: '',
    isActive: true,
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getRewardCatalog();
      setRewards(data);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = user
    ? can(user.roles as any, 'claim.finalize', 'org', user.scopes as any) ||
      user.role === 'board_member' ||
      user.role === 'admin'
    : false;

  if (loading || !user) {
    return (
      <AppLayout activePath="/admin/rewards">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return (
      <AppLayout activePath="/admin/rewards">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <h2 className="font-heading font-bold text-ink mb-2">Not Authorized</h2>
            <p className="text-mute">
              Reward catalog editor is available to Board and Admin roles only.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const rarityOptions: { value: RewardCatalog['rarity']; label: string }[] = [
    { value: 'common', label: 'Common' },
    { value: 'uncommon', label: 'Uncommon' },
    { value: 'rare', label: 'Rare' },
    { value: 'epic', label: 'Epic' },
    { value: 'legendary', label: 'Legendary' },
  ];

  const startEdit = (reward: RewardCatalog) => {
    setForm({
      name: reward.name,
      description: reward.description ?? '',
      costCoins: reward.costCoins,
      stock: reward.stock,
      rarity: reward.rarity,
      imageUrl: reward.imageUrl ?? '',
      isActive: reward.isActive,
    });
    setEditing(reward.id);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      costCoins: 0,
      stock: 0,
      rarity: 'common',
      imageUrl: '',
      isActive: true,
    });
  };

  const startCreate = () => {
    setForm({
      name: '',
      description: '',
      costCoins: 0,
      stock: 0,
      rarity: 'common',
      imageUrl: '',
      isActive: true,
    });
    setCreating(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting((prev) => new Set([...prev, editing ?? 'new']));
    try {
      if (editing) {
        await updateReward(editing, {
          name: form.name,
          description: form.description,
          costCoins: form.costCoins,
          stock: form.stock,
          rarity: form.rarity,
          imageUrl: form.imageUrl || null,
          isActive: form.isActive,
        });
      } else {
        await createReward({
          name: form.name,
          description: form.description,
          costCoins: form.costCoins,
          stock: form.stock,
          rarity: form.rarity,
          imageUrl: form.imageUrl || null,
        });
      }
      cancelEdit();
      setCreating(false);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to save reward.');
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(editing ?? 'new');
        return next;
      });
    }
  };

  const handleDelete = async (rewardId: string) => {
    if (!confirm('Delete this reward? This cannot be undone.')) return;
    setSubmitting((prev) => new Set([...prev, rewardId]));
    try {
      await deleteReward(rewardId);
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to delete reward.');
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(rewardId);
        return next;
      });
    }
  };

  return (
    <AppLayout activePath="/admin/rewards">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Reward Catalog Editor</h1>
            <p className="text-mute">Manage GDU Coins reward items. Board and Admin only.</p>
          </div>
          <button
            onClick={startCreate}
            className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            + Add Reward
          </button>
        </div>

        {/* Catalog Table */}
        <div className="rounded-xl p-6 bg-card border border-line">
          <h2 className="font-heading font-bold text-ink mb-4">Reward Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-accent-soft">
                  <th className="px-4 py-3 font-semibold text-mute text-left">Name</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20 text-center">Cost</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20 text-center">Stock</th>
                  <th className="px-4 py-3 font-semibold text-mute w-20 text-center">Rarity</th>
                  <th className="px-4 py-3 font-semibold text-mute w-16 text-center">Active</th>
                  <th className="px-4 py-3 font-semibold text-mute text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rewards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-mute">
                      No rewards in catalog.
                    </td>
                  </tr>
                ) : (
                  rewards.map((r) => {
                    const isEditing = editing === r.id;
                    const rarityCfg = RARITY_CONFIG[r.rarity];
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-line/50 hover:bg-accent-soft/5 transition-colors ${
                          isEditing ? 'bg-accent-soft/30' : ''
                        }`}
                      >
                        {isEditing ? (
                          <td colSpan={6} className="p-4">
                            <div className="grid gap-3 md:grid-cols-4">
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-mute mb-1">
                                  Name
                                </label>
                                <input
                                  type="text"
                                  value={form.name}
                                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-mute mb-1">
                                  Cost (Coins)
                                </label>
                                <input
                                  type="number"
                                  value={form.costCoins}
                                  onChange={(e) =>
                                    setForm({ ...form, costCoins: parseInt(e.target.value) || 0 })
                                  }
                                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-mute mb-1">
                                  Stock
                                </label>
                                <input
                                  type="number"
                                  value={form.stock}
                                  onChange={(e) =>
                                    setForm({ ...form, stock: parseInt(e.target.value) || 0 })
                                  }
                                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-mute mb-1">
                                  Rarity
                                </label>
                                <select
                                  value={form.rarity}
                                  onChange={(e) =>
                                    setForm({ ...form, rarity: e.target.value as any })
                                  }
                                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                                >
                                  {rarityOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-mute mb-1">
                                  Description
                                </label>
                                <textarea
                                  value={form.description}
                                  onChange={(e) =>
                                    setForm({ ...form, description: e.target.value })
                                  }
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-mute mb-1">
                                  Image URL
                                </label>
                                <input
                                  type="text"
                                  value={form.imageUrl}
                                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                                  placeholder="https://…"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-mute mb-1">
                                  Active
                                </label>
                                <select
                                  value={form.isActive ? 'true' : 'false'}
                                  onChange={(e) =>
                                    setForm({ ...form, isActive: e.target.value === 'true' })
                                  }
                                  className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                                >
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </div>
                              <div className="col-span-2 flex gap-2">
                                <button
                                  onClick={handleSave}
                                  disabled={submitting.has(r.id)}
                                  className="flex-1 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 transition-colors"
                                >
                                  {submitting.has(r.id) ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-ink font-medium">{r.name}</td>
                            <td className="px-4 py-3 font-mono text-center text-ink">
                              {r.costCoins}
                            </td>
                            <td className="px-4 py-3 font-mono text-center text-ink">{r.stock}</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${rarityCfg.color} ${rarityCfg.bg} ${rarityCfg.border}`}
                              >
                                {r.rarity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.isActive ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-green-700 bg-green-50 border border-green-200">
                                  Yes
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                                  No
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={() => startEdit(r)}
                                  disabled={submitting.has(r.id)}
                                  className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-ink hover:bg-accent-soft transition-colors disabled:opacity-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(r.id)}
                                  disabled={submitting.has(r.id)}
                                  className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Create Form */}
          {creating && (
            <div className="mt-6 p-4 rounded-xl bg-accent-soft/50 border border-accent/20">
              <h3 className="font-heading font-bold text-ink mb-3">Add New Reward</h3>
              <form onSubmit={handleSave} className="grid gap-3 md:grid-cols-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-mute mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Cost (Coins)</label>
                  <input
                    type="number"
                    value={form.costCoins}
                    onChange={(e) => setForm({ ...form, costCoins: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Stock</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mute mb-1">Rarity</label>
                  <select
                    value={form.rarity}
                    onChange={(e) => setForm({ ...form, rarity: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                  >
                    {rarityOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-mute mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-mute mb-1">Image URL</label>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                    placeholder="https://…"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-mute mb-1">Active</label>
                  <select
                    value={form.isActive ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-background focus:outline-none focus:border-accent"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={submitting.has('new')}
                    className="flex-1 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 transition-colors"
                  >
                    {submitting.has('new') ? 'Creating…' : 'Create Reward'}
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
