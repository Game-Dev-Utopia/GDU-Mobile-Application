import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton-pulse rounded-md ${className}`} />;
}

export function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero card skeleton */}
      <Skeleton className="h-48 w-full rounded-2xl" />
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`skel-stat-${i}`} className="h-28 rounded-2xl" />
        ))}
      </div>
      {/* Chart + feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 lg:col-span-2 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      {/* Activity spotlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`skel-act-${i}`} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function ActivitiesPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={`skel-actcard-${i}`} className="h-52 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function ClaimsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-12 w-96 rounded-xl" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={`skel-claim-${i}`} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
