'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LandingHero from './components/LandingHero';
import HowItWorks from './components/HowItWorks';
import StatsStrip from './components/StatsStrip';

export default function LandingPage() {
  const { user, isLoading, loginWithDiscord } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      setRedirecting(true);
      if (!user?.onboardingComplete) {
        router?.push('/onboarding');
      } else {
        router?.push('/');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-400/5 blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-lime-400/3 blur-[80px]" />
      </div>

      <div className="relative z-10">
        <LandingHero onLogin={loginWithDiscord} />
        <HowItWorks />
        <StatsStrip />

        {/* Bottom CTA */}
        <section className="py-20 px-4 text-center">
          <p className="text-muted-foreground text-sm mb-4 font-sans">
            Join 340+ game dev students already levelling up
          </p>
          <button
            onClick={loginWithDiscord}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-heading font-semibold text-lg text-white transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #5865F2 0%, #7C5CFF 100%)',
              boxShadow: '0 0 32px rgba(88,101,242,0.35)',
            }}
          >
            <DiscordIcon />
            Continue with Discord
          </button>
        </section>
      </div>
    </main>
  );
}

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}
