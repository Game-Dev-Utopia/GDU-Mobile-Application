'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export default function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  return (
    <div className={`error-state ${className ?? ''}`} role="alert" aria-label={title}>
      <RefreshCw className="error-state-icon" size={40} strokeWidth={1.5} />
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-description">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-lg bg-card border border-border text-foreground font-medium hover:bg-muted/40 transition-colors duration-150"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
