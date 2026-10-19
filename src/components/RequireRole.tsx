'use client';

import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can, Role, Permission } from '@/lib/permissions';
import { redirect } from 'next/navigation';

interface RequireRoleProps {
  permission: Permission;
  targetScope?: 'self' | 'team' | 'domain' | 'branch' | 'org';
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({
  permission,
  targetScope = 'self',
  children,
  fallback,
}: RequireRoleProps) {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return fallback ?? null;
  }

  const allowed = can(
    user.roles as Role[],
    permission,
    targetScope,
    user.scopes as ('self' | 'team' | 'domain' | 'branch' | 'org')[]
  );

  if (!allowed) {
    return (
      fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-rose-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="font-heading font-bold text-ink mb-2">Access Restricted</h3>
          <p className="text-mute">You don&apos;t have permission to view this page.</p>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Server-side redirect helper for route guards.
 * Use this in server components or getServerSideProps equivalents.
 */
export function requireRoleOrRedirect(
  userRoles: string[],
  userScopes: ('self' | 'team' | 'domain' | 'branch' | 'org')[],
  permission: Permission,
  targetScope: 'self' | 'team' | 'domain' | 'branch' | 'org' = 'self'
): void {
  if (!can(userRoles as Role[], permission, targetScope, userScopes)) {
    redirect('/');
  }
}
