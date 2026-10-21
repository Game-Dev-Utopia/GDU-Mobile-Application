'use client';

import React from 'react';
import Icon from './AppIcon';

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className ?? ''}`} role="region" aria-label={title}>
      {Icon && <Icon className="empty-state-icon" size={48} strokeWidth={1.5} />}
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-description">{description}</p>}
      {action && (
        <div className="mt-4">
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors duration-150">
            {action}
          </button>
        </div>
      )}
    </div>
  );
}
