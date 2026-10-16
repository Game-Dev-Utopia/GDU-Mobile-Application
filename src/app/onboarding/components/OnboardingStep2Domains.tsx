'use client';
import React, { useState } from 'react';

const DOMAINS = [
  { id: 'game-dev', label: 'Game Dev', emoji: '🎮', color: '#7C5CFF' },
  { id: 'design', label: 'Design', emoji: '🎨', color: '#22D3EE' },
  { id: 'content', label: 'Content', emoji: '✍️', color: '#A3E635' },
  { id: 'ai', label: 'AI', emoji: '🤖', color: '#F59E0B' },
  { id: 'web-devops', label: 'Web/DevOps', emoji: '🌐', color: '#22D3EE' },
  { id: 'r-and-d', label: 'R&D', emoji: '🔬', color: '#F43F5E' },
  { id: 'marketing', label: 'Marketing', emoji: '📣', color: '#F59E0B' },
  { id: 'ops', label: 'Ops', emoji: '⚙️', color: '#64748B' },
];

interface Props {
  selected: string[];
  onNext: (domains: string[]) => void;
  onBack: () => void;
}

export default function OnboardingStep2Domains({ selected, onNext, onBack }: Props) {
  const [picks, setPicks] = useState<string[]>(selected);

  function toggle(id: string) {
    setPicks((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-10">
        <span className="font-pixel text-xs text-cyan-400">STEP 2 OF 3</span>
        <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mt-3 mb-3">
          Pick your domains
        </h2>
        <p className="text-muted-foreground font-sans text-base">
          Choose one or more areas you want to contribute in. You can always change this later.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {DOMAINS.map((domain) => {
          const active = picks.includes(domain.id);
          return (
            <button
              key={domain.id}
              onClick={() => toggle(domain.id)}
              className="card-base p-4 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] focus:outline-none"
              style={{
                borderColor: active ? domain.color : undefined,
                boxShadow: active ? `0 0 16px ${domain.color}25` : undefined,
                background: active ? `${domain.color}12` : undefined,
              }}
            >
              <span className="text-2xl">{domain.emoji}</span>
              <span
                className="text-xs font-heading font-semibold text-center leading-tight"
                style={{ color: active ? domain.color : undefined }}
              >
                {domain.label}
              </span>
              {active && (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: domain.color }}
                >
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {picks.length > 0 && (
        <p className="text-center text-xs text-muted-foreground font-sans mb-4">
          {picks.length} domain{picks.length > 1 ? 's' : ''} selected
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-2xl font-heading font-semibold text-base text-muted-foreground border border-border hover:border-violet-500/40 hover:text-foreground transition-all duration-200"
        >
          ← Back
        </button>
        <button
          disabled={picks.length === 0}
          onClick={() => onNext(picks)}
          className="flex-[2] py-4 rounded-2xl font-heading font-semibold text-base text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: picks.length > 0 ? 'linear-gradient(135deg, #7C5CFF, #22D3EE)' : undefined,
            backgroundColor: picks.length === 0 ? '#1E2847' : undefined,
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
