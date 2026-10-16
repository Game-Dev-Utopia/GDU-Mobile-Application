'use client';
import React, { useState } from 'react';

const BRANCHES = [
  {
    id: 'PICT',
    name: 'PICT',
    fullName: 'Pune Institute of Computer Technology',
    members: 210,
    color: '#7C5CFF',
    emoji: '🎮',
  },
  {
    id: 'IIITK',
    name: 'IIITK',
    fullName: 'IIIT Kottayam',
    members: 130,
    color: '#22D3EE',
    emoji: '⚡',
  },
];

interface Props {
  selected: string;
  onNext: (branch: string) => void;
}

export default function OnboardingStep1Branch({ selected, onNext }: Props) {
  const [pick, setPick] = useState(selected);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-10">
        <span className="font-pixel text-xs text-violet-400">STEP 1 OF 3</span>
        <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mt-3 mb-3">
          Pick your branch
        </h2>
        <p className="text-muted-foreground font-sans text-base">
          Your branch determines your local leaderboard and team events.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {BRANCHES.map((branch) => {
          const active = pick === branch.id;
          return (
            <button
              key={branch.id}
              onClick={() => setPick(branch.id)}
              className="card-base p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none"
              style={{
                borderColor: active ? branch.color : undefined,
                boxShadow: active ? `0 0 24px ${branch.color}30` : undefined,
                background: active ? `${branch.color}10` : undefined,
              }}
            >
              <div className="text-3xl mb-3">{branch.emoji}</div>
              <div className="font-pixel text-lg font-bold mb-1" style={{ color: branch.color }}>
                {branch.name}
              </div>
              <div className="text-sm text-foreground font-sans font-medium mb-2">{branch.fullName}</div>
              <div className="text-xs text-muted-foreground font-sans">{branch.members} members</div>
              {active && (
                <div
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md"
                  style={{ background: `${branch.color}20`, color: branch.color }}
                >
                  ✓ Selected
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        disabled={!pick}
        onClick={() => onNext(pick)}
        className="w-full py-4 rounded-2xl font-heading font-semibold text-base text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background: pick ? 'linear-gradient(135deg, #7C5CFF, #22D3EE)' : undefined,
          backgroundColor: !pick ? '#1E2847' : undefined,
        }}
      >
        Continue →
      </button>
    </div>
  );
}
