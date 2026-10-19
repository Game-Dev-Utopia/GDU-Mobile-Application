'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingStep1Branch from './components/OnboardingStep1Branch';
import OnboardingStep2Domains from './components/OnboardingStep2Domains';
import OnboardingStep3Interests from './components/OnboardingStep3Interests';
import OnboardingWelcome from './components/OnboardingWelcome';
import { saveOnboarding } from '@/lib/api';
import type { OnboardingData } from '@/contexts/AuthContext';

export default function OnboardingPage() {
  const { user, isLoading, completeOnboarding } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<Partial<OnboardingData>>({
    branch: '',
    domains: [],
    interests: [],
    weeklyAvailability: '1-3',
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/landing');
    }
    if (!isLoading && user?.onboardingComplete) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  async function handleFinish(finalData: OnboardingData) {
    setSaving(true);
    try {
      await saveOnboarding(finalData);
      completeOnboarding(finalData);
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (done) {
    return <OnboardingWelcome onEnter={() => router.push('/')} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-cyan-400/5 blur-[80px]" />
      </div>

      {/* Progress bar */}
      <div className="relative z-10 w-full h-1 bg-muted">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${(step / 3) * 100}%`,
            background: 'linear-gradient(90deg, #7C5CFF, #22D3EE)',
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)' }}
          >
            <span className="font-pixel text-white text-[9px] font-bold">GDU</span>
          </div>
          <span className="font-heading font-bold text-base text-foreground">
            GDU <span className="text-xp-lime">XP</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-heading transition-all duration-300"
                style={{
                  background:
                    s < step
                      ? '#7C5CFF'
                      : s === step
                        ? 'rgba(124,92,255,0.2)'
                        : 'rgba(255,255,255,0.05)',
                  border: s <= step ? '1px solid #7C5CFF' : '1px solid rgba(255,255,255,0.1)',
                  color: s <= step ? '#fff' : '#64748B',
                }}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 3 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        {step === 1 && (
          <OnboardingStep1Branch
            selected={data.branch || ''}
            onNext={(branch) => {
              setData((d) => ({ ...d, branch }));
              setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <OnboardingStep2Domains
            selected={data.domains || []}
            onNext={(domains) => {
              setData((d) => ({ ...d, domains }));
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <OnboardingStep3Interests
            interests={data.interests || []}
            availability={data.weeklyAvailability || '1-3'}
            onFinish={(interests, weeklyAvailability) => {
              const finalData: OnboardingData = {
                branch: data.branch || '',
                domains: data.domains || [],
                interests,
                weeklyAvailability,
              };
              handleFinish(finalData);
            }}
            onBack={() => setStep(2)}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
