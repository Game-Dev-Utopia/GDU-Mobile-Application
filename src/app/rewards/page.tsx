'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getCoinBalance,
  getCoinTransactions,
  getRewardCatalog,
  getRedemptions,
  requestRedemption,
  type RewardCatalog,
  type Redemption,
  FEATURE_FLAGS,
} from '@/lib/api';

const RARITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  common: { color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  uncommon: { color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  rare: { color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  epic: { color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
  legendary: { color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
};

export default function RewardsPage() {
  const { user, isLoading } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [rewards, setRewards] = useState<RewardCatalog[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemModal, setRedeemModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState<RewardCatalog | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'rewards' | 'cash'>('rewards');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [bal, txns, rwds, reds] = await Promise.all([
      getCoinBalance(user.id),
      getCoinTransactions(user.id),
      getRewardCatalog(),
      getRedemptions(),
    ]);
    setBalance(bal);
    setTransactions(txns);
    setRewards(rwds);
    setRedemptions(reds.filter((r) => r.memberId === user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user, loadData]);

  function openRedeem(reward: RewardCatalog) {
    setSelectedReward(reward);
    setRedeemModal(true);
  }

  async function handleRedeem() {
    if (!selectedReward) return;
    setSubmitting(true);
    try {
      await requestRedemption(selectedReward.id);
      setRedeemModal(false);
      setSelectedReward(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to request redemption.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <AppLayout activePath="/rewards">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const tabItems: { key: 'rewards' | 'cash'; label: string; disabled: boolean }[] = [
    { key: 'rewards', label: 'Rewards', disabled: false },
    { key: 'cash', label: 'Cash', disabled: !FEATURE_FLAGS.cashTab },
  ];

  return (
    <AppLayout activePath="/rewards">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Rewards Store</h1>
            <p className="text-mute">Spend your GDU Coins on rewards</p>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200`}
          >
            <span className="text-amber-700 font-mono font-bold">{balance}</span>
            <span className="text-xs text-amber-600">GDU Coins</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (!tab.disabled) setActiveTab(tab.key);
              }}
              disabled={tab.disabled}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === tab.key && !tab.disabled
                  ? 'bg-accent text-white'
                  : tab.disabled
                    ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                    : 'bg-card text-ink hover:bg-accent-soft'
              }`}
            >
              {tab.key === 'cash' && !FEATURE_FLAGS.cashTab ? (
                <>
                  Cash <span className="ml-1 text-[10px] opacity-70">Coming soon</span>
                </>
              ) : (
                tab.label
              )}
            </button>
          ))}
        </div>

        {activeTab === 'rewards' && (
          <>
            {/* Recent Transactions */}
            <div className="rounded-xl p-6 bg-card border border-line">
              <h2 className="font-heading font-bold text-ink mb-4">Coin Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-xs text-mute uppercase">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 10).map((t) => (
                      <tr key={t.id} className="border-b border-line/50 hover:bg-accent-soft/5">
                        <td className="px-4 py-3 text-sm font-mono text-mute">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink">{t.source.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm font-mono text-right">
                          {t.amount > 0 ? '+' : ''}
                          {t.amount}
                        </td>
                        <td className="px-4 py-3 text-sm text-mute">{t.description || '-'}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-mute">
                          No transactions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reward Catalog */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {rewards.map((reward) => {
                const rarityCfg = RARITY_CONFIG[reward.rarity];
                const canAfford = balance >= reward.costCoins;
                const inStock = reward.stock > 0;

                return (
                  <div
                    key={reward.id}
                    className={`rounded-xl p-5 border transition-all duration-300 ${
                      canAfford && inStock
                        ? 'bg-card border-line hover:border-accent/50'
                        : 'bg-muted/50 border-line/50 text-mute/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${rarityCfg.color} ${rarityCfg.bg} ${rarityCfg.border}`}
                      >
                        {rarityCfg.color.split('-')[1]}
                      </span>
                      <span className="text-xs text-mute">{reward.stock} left</span>
                    </div>
                    <h3 className={`font-heading font-bold text-ink mb-1`}>{reward.name}</h3>
                    <p
                      className={`text-xs ${canAfford ? 'text-mute' : 'text-muted-foreground/60'} mb-3 line-clamp-2`}
                    >
                      {reward.description || ''}
                    </p>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono font-bold text-ink">{reward.costCoins}</span>
                      <span className="text-xs text-mute">Coins</span>
                    </div>
                    <button
                      onClick={() => openRedeem(reward)}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                        canAfford && inStock
                          ? 'bg-accent text-white hover:bg-accent/90 disabled:opacity-50'
                          : 'bg-card border border-line text-muted-foreground hover:bg-accent-soft/5'
                      }`}
                      disabled={!canAfford || !inStock}
                    >
                      {!inStock ? 'Out of Stock' : canAfford ? 'Redeem' : 'Insufficient Coins'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* My Redemptions */}
            <div className="rounded-xl p-6 bg-card border border-line">
              <h2 className="font-heading font-bold text-ink mb-4">My Redemptions</h2>
              <div className="space-y-3">
                {redemptions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent-soft/5 border border-accent/20"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink">{r.rewardName}</div>
                      <div className="text-xs text-mute">{r.costCoins} Coins</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-ink">{r.status}</div>
                      <div className="text-xs text-mute">
                        {new Date(r.requestedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                {redemptions.length === 0 && (
                  <div className="px-4 py-8 text-center text-mute">No redemptions yet.</div>
                )}
              </div>
            </div>

            {/* Redeem Modal */}
            {redeemModal && selectedReward && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setRedeemModal(false)}
                />
                <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md border border-line">
                  <h2 className="font-heading font-bold text-ink mb-2">Redeem Reward</h2>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${RARITY_CONFIG[selectedReward.rarity].color} ${RARITY_CONFIG[selectedReward.rarity].bg}`}
                    >
                      {selectedReward.rarity}
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {selectedReward.costCoins} Coins
                    </span>
                  </div>
                  <p className="text-mute text-sm mb-6">
                    {selectedReward.description || ''}
                    <br />
                    Your balance: {balance} Coins
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setRedeemModal(false)}
                      className="flex-1 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRedeem}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        balance >= selectedReward.costCoins && selectedReward.stock > 0
                          ? 'bg-accent text-white hover:bg-accent/90 disabled:opacity-50'
                          : 'bg-card border border-line text-muted-foreground'
                      }`}
                      disabled={balance < selectedReward.costCoins || selectedReward.stock === 0}
                    >
                      {submitting ? 'Processing...' : 'Confirm Redemption'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'cash' && (
          <div className="rounded-xl p-12 bg-card border border-line text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💵</span>
            </div>
            <h2 className="font-heading font-bold text-ink mb-2">Cash</h2>
            <p className="text-mute mb-4">Cash release functionality coming soon.</p>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
              Feature disabled — coming soon
            </span>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
