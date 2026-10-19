'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import {
  getQuests,
  getMemberQuests,
  claimQuestReward,
  getOrCreateMemberQuest,
  type Quest,
  type MemberQuest,
} from '@/lib/api';

const TYPE_LABELS: Record<Quest['type'], string> = {
  weekly: 'Weekly',
  seasonal: 'Seasonal',
  team: 'Team',
  one_time: 'One-time',
};

const TYPE_COLORS: Record<Quest['type'], string> = {
  weekly: 'text-cyan-600 bg-cyan-50 border-cyan-100',
  seasonal: 'text-purple-600 bg-purple-50 border-purple-100',
  team: 'text-amber-600 bg-amber-50 border-amber-100',
  one_time: 'text-rose-600 bg-rose-50 border-rose-100',
};

export default function QuestsPage() {
  const { user, isLoading } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [memberQuests, setMemberQuests] = useState<MemberQuest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user]);

  async function loadData() {
    setLoading(true);
    const [allQuests, myQuests] = await Promise.all([getQuests(), getMemberQuests()]);
    setQuests(allQuests);
    setMemberQuests(myQuests);
    setLoading(false);
  }

  const questProgress = new Map<string, MemberQuest>();
  memberQuests.forEach((mq) => questProgress.set(mq.questId, mq));

  const totalQuestXP = memberQuests
    .filter((mq) => mq.completed && mq.claimed)
    .reduce((sum, mq) => sum + mq.quest.xpReward, 0);

  if (isLoading || !user) {
    return (
      <AppLayout activePath="/quests">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/quests">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-ink">Quests</h1>
            <p className="text-mute">Complete quests to earn bonus XP and Coins</p>
          </div>
          <div
            className={`px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-medium border border-accent/20`}
          >
            +{totalQuestXP.toLocaleString()} XP earned
          </div>
        </div>

        {[...new Set(quests.map((q) => q.type))].map((type) => {
          const typeQuests = quests.filter((q) => q.type === type);
          return (
            <section key={type} className="space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${TYPE_COLORS[type]}`}
                >
                  {TYPE_LABELS[type]}
                </span>
                {type === 'weekly' && (
                  <span className="text-xs text-mute">Resets every Monday</span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {typeQuests.map((quest) => {
                  const mq = questProgress.get(quest.id);
                  const isCompleted = mq?.completed || false;
                  const isClaimed = mq?.claimed || false;
                  const progress = mq?.progress || 0;
                  const threshold = Number(quest.criteria?.threshold || 1);
                  const progressPct = Math.min(100, Math.max(0, (progress / threshold) * 100));

                  return (
                    <div
                      key={quest.id}
                      className={`rounded-xl p-5 border transition-all duration-300 ${
                        isClaimed
                          ? 'bg-green-50 border-green-200'
                          : isCompleted
                            ? 'bg-accent-soft border-accent'
                            : 'bg-card border-line hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3
                            className={`font-heading font-bold ${isClaimed ? 'text-green-700' : 'text-ink'} mb-1`}
                          >
                            {quest.title}
                          </h3>
                          <p className={`text-xs ${isClaimed ? 'text-green-600' : 'text-mute'}`}>
                            {quest.description}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${isClaimed ? 'text-green-600 bg-green-100' : 'text-accent bg-accent-soft'}`}
                        >
                          {isClaimed ? 'Claimed' : `+${quest.xpReward} XP`}
                        </span>
                      </div>

                      <div className="w-full bg-accent-soft/50 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-accent' : 'bg-muted'
                          } w-${progressPct}`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-mute mb-3">
                        <span>
                          {progress} / {threshold}
                        </span>
                        <span>
                          {quest.type === 'weekly' || quest.type === 'seasonal'
                            ? quest.criteria?.period || ''
                            : ''}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {isClaimed ? (
                          <button
                            disabled
                            className="flex-1 px-4 py-2 rounded-lg bg-green-200 text-green-700 text-sm font-medium"
                          >
                            Claimed
                          </button>
                        ) : isCompleted ? (
                          <button
                            onClick={async () => {
                              const mqId = mq?.id ?? (await getOrCreateMemberQuest(quest.id));
                              const xp = await claimQuestReward(mqId);
                              setLoading(true);
                              await new Promise((r) => setTimeout(r, 500));
                              setLoading(false);
                              loadData();
                            }}
                            className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                          >
                            Claim Reward
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 px-4 py-2 rounded-lg border border-line bg-card text-muted-foreground"
                          >
                            In Progress
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </AppLayout>
  );
}
