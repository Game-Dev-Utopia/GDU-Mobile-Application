'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, ChevronLeft, X } from 'lucide-react';
import Modal from './Modal';

interface TourStep {
  id: string;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to GDU XP',
    description:
      'Track your club contributions as experience points, level up through leagues, and earn recognition across branches.',
  },
  {
    id: 'activities',
    title: 'Submit Activities',
    description:
      'Head to Activities to propose and claim XP for work you’ve done — events, talks, builds, and more.',
  },
  {
    id: 'claims',
    title: 'Track Claims',
    description:
      'My Claims shows your submission history and review status at a glance.',
  },
  {
    id: 'leaderboard',
    title: 'Climb the Leaderboard',
    description:
      'See how you rank against your branch and the whole GDU community.',
  },
  {
    id: 'profile',
    title: 'Your Transcript',
    description:
      'Visit your Contribution Transcript for a printable record and a public verification code.',
  },
];

interface ProductTourProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function ProductTour({
  open,
  onClose,
  onComplete,
}: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      setDone(true);
      setTimeout(() => {
        onClose();
        onComplete?.();
      }, 100);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLast, onClose, onComplete]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Auto-close when the tour is no longer open
  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setDone(false);
    }
  }, [open]);

  if (!open) return null;

  const progress = ((stepIndex + 1) / TOUR_STEPS.length) * 100;

  return (
    <Modal
      open={open || done}
      onClose={onClose}
      title={done ? 'You’re all set!' : step.title}
      size="md"
    >
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="w-full h-1.5 rounded-full bg-muted/50 mb-4">
          <div
            className="h-1.5 rounded-full bg-accent"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-6">
          <span>Step {stepIndex + 1} of {TOUR_STEPS.length}</span>
          <span>Tour</span>
        </div>

        {/* Step content */}
        <div className="space-y-4">
          <h3 className="font-heading font-bold text-foreground">{step.title}</h3>
          <p className="text-muted-foreground">{step.description}</p>

          {done && (
            <div className="flex items-center gap-2 rounded-lg bg-green-100 border border-green-200 p-3">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm text-green-700 font-medium">
                You’re ready to start earning XP!
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button
            onClick={prev}
            disabled={stepIndex === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} className="mr-1" /> Back
          </button>
          <button
            onClick={next}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors duration-150 flex items-center gap-2"
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </Modal>
  );
}
