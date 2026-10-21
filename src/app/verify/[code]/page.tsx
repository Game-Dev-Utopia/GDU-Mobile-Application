'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyTranscript, type TranscriptVerification } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const [verification, setVerification] = useState<TranscriptVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('No verification code provided.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    verifyTranscript(code)
      .then((v) => {
        setVerification(v);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Verification failed.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <AppLayout activePath="/verify">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!verification?.valid) {
    return (
      <AppLayout activePath="/verify">
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="rounded-xl p-8 bg-card border border-line text-center max-w-md w-full">
            <AlertCircle size={48} className="mx-auto mb-4 text-rose-500" />
            <h2 className="font-heading font-bold text-ink mb-2">Verification Failed</h2>
            <p className="text-mute mb-6">
              {error || verification?.error || 'This verification code is invalid or inactive.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePath="/verify">
      <div className="max-w-md mx-auto">
        <div className="rounded-xl p-8 bg-card border border-line text-center">
          <div className="flex items-center justify-center mb-6">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <h2 className="font-heading font-bold text-ink mb-2">Transcript Verified</h2>
          <p className="text-mute mb-6">
            This contribution transcript is genuine and issued by GDU XP.
          </p>

          <div className="space-y-4 text-left">
            <div className="flex justify-between">
              <span className="text-mute text-sm">Name</span>
              <span className="font-medium text-ink">{verification.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute text-sm">Username</span>
              <span className="font-mono text-sm text-ink">@{verification.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute text-sm">Branch</span>
              <span className="font-medium text-ink">{verification.branch}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute text-sm">Domain</span>
              <span className="font-medium text-ink">{verification.domain}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute text-sm">Total EXP</span>
              <span className="font-mono text-ink">
                {verification.totalExp?.toLocaleString() ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute text-sm">Level</span>
              <span className="font-medium text-ink">{verification.level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute text-sm">League Tier</span>
              <span className="font-medium text-ink">{verification.leagueTier}</span>
            </div>
            {verification.alumniBadge && (
              <div className="flex justify-between">
                <span className="text-mute text-sm">Alumni Badge</span>
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-medium border border-green-200">
                  {verification.alumniBadge}
                </span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-line">
            <p className="text-xs text-mute mb-2">Verification code</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs text-ink select-all">{code}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(code).then(() => {
                    alert('Verification code copied to clipboard.');
                  });
                }}
                className="px-2 py-1 rounded bg-accent-soft text-accent text-xs font-medium border border-accent/20 hover:bg-accent/30 transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-[10px] text-mute mt-2">
              Verified on {new Date().toLocaleDateString()}
              {verification.transcriptGeneratedAt
                ? ` · Issued ${new Date(verification.transcriptGeneratedAt).toLocaleDateString()}`
                : ''}
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={() => router.push('/')}
              className="w-full px-4 py-2 rounded-lg border border-line bg-card text-ink hover:bg-accent-soft transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
