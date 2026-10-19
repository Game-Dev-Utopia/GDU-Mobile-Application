'use client';
import React, { useState } from 'react';
import type { OnboardingData } from '@/contexts/AuthContext';

const INTERESTS = [
  'Unity',
  'Godot',
  'Unreal',
  'Pixel Art',
  'Concept Art',
  '3D Modeling',
  'Sound Design',
  'Game Jams',
  'Narrative Design',
  'Shaders',
  'AI/ML in Games',
  'Indie Dev',
  'Multiplayer',
  'Mobile Games',
  'VR/AR',
  'Speedrunning',
];

const AVAILABILITY_OPTIONS: {
  value: OnboardingData['weeklyAvailability'];
  label: string;
  sublabel: string;
}[] = [
  { value: '1-3', label: '1–3 hrs/week', sublabel: 'Casual contributor' },
  { value: '3-6', label: '3–6 hrs/week', sublabel: 'Regular member' },
  { value: '6+', label: '6+ hrs/week', sublabel: 'Power contributor' },
];

interface Props {
  interests: string[];
  availability: OnboardingData['weeklyAvailability'];
  onFinish: (interests: string[], availability: OnboardingData['weeklyAvailability']) => void;
  onBack: () => void;
  saving: boolean;
}

export default function OnboardingStep3Interests({
  interests,
  availability,
  onFinish,
  onBack,
  saving,
}: Props) {
  const [picks, setPicks] = useState<string[]>(interests);
  const [avail, setAvail] = useState<OnboardingData['weeklyAvailability']>(availability);

  function toggleInterest(item: string) {
    setPicks((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-10">
        <span className="font-pixel text-xs text-xp-lime">STEP 3 OF 3</span>
        <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mt-3 mb-3">
          Interests & availability
        </h2>
        <p className="text-muted-foreground font-sans text-base">
          Help us surface the right activities for you.
        </p>
      </div>

      {/* Interests */}
      <div className="mb-8">
        <p className="text-sm font-heading font-semibold text-foreground mb-3">
          What are you into?{' '}
          <span className="text-muted-foreground font-sans font-normal">(pick any)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((item) => {
            const active = picks.includes(item);
            return (
              <button
                key={item}
                onClick={() => toggleInterest(item)}
                className="px-3 py-1.5 rounded-lg text-sm font-sans font-medium transition-all duration-150 hover:scale-[1.04] active:scale-[0.97] focus:outline-none"
                style={{
                  background: active ? 'rgba(124,92,255,0.2)' : 'rgba(255,255,255,0.04)',
                  border: active
                    ? '1px solid rgba(124,92,255,0.5)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#7C5CFF' : '#A0AEC0',
                }}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weekly availability */}
      <div className="mb-8">
        <p className="text-sm font-heading font-semibold text-foreground mb-3">
          Weekly availability
        </p>
        <div className="grid grid-cols-3 gap-3">
          {AVAILABILITY_OPTIONS.map((opt) => {
            const active = avail === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setAvail(opt.value)}
                className="card-base p-4 flex flex-col items-center gap-1 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] focus:outline-none"
                style={{
                  borderColor: active ? '#A3E635' : undefined,
                  boxShadow: active ? '0 0 16px rgba(163,230,53,0.2)' : undefined,
                  background: active ? 'rgba(163,230,53,0.08)' : undefined,
                }}
              >
                <span
                  className="font-heading font-bold text-sm"
                  style={{ color: active ? '#A3E635' : '#E2E8F0' }}
                >
                  {opt.label}
                </span>
                <span className="text-[10px] text-muted-foreground font-sans text-center">
                  {opt.sublabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex-1 py-4 rounded-2xl font-heading font-semibold text-base text-muted-foreground border border-border hover:border-violet-500/40 hover:text-foreground transition-all duration-200 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={() => onFinish(picks, avail)}
          disabled={saving}
          className="flex-[2] py-4 rounded-2xl font-heading font-semibold text-base text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #7C5CFF, #A3E635)' }}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            "Let's go! 🚀"
          )}
        </button>
      </div>
    </div>
  );
}
