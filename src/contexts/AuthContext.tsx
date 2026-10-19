'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface OnboardingData {
  branch: string;
  domains: string[];
  interests: string[];
  weeklyAvailability: '1-3' | '3-6' | '6+';
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  discordId?: string;
  onboardingComplete: boolean;
  onboardingData?: OnboardingData;
  startingLevel: number;
  role: string;
  roles: string[];
  scopes: string[];
  branch?: string;
  domain?: string;
  totalExp: number;
  level: number;
  leagueTier: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithDiscord: () => void;
  logout: () => void;
  completeOnboarding: (data: OnboardingData) => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  loginWithDiscord: () => {},
  logout: () => {},
  completeOnboarding: () => {},
  updateProfile: () => {},
});

const supabase = createClient();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (uuid: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uuid)
      .single();

    if (error || !profile) return null;

    // Fetch role assignments for RBAC
    const { data: roleAssignments } = await supabase
      .from('role_assignments')
      .select('role, scope')
      .eq('profile_id', uuid)
      .eq('is_active', true);

    const userRoles = roleAssignments?.map((ra: any) => ra.role) || [profile.role];
    const userScopes = roleAssignments?.map((ra: any) => ra.scope) || ['self'];

    return {
      id: profile.id,
      name: profile.display_name || profile.username,
      username: profile.username,
      avatar:
        profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`,
      discordId: profile.discord_id,
      onboardingComplete: profile.onboarding_complete,
      role: profile.role,
      roles: userRoles,
      scopes: userScopes,
      branch: profile.branch_id,
      domain: profile.domain_id,
      totalExp: profile.total_exp,
      level: profile.level,
      leagueTier: profile.league_tier,
      startingLevel: profile.level,
    };
  }, []);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (profile) setUser(profile);
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (profile) setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  function loginWithDiscord() {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;
    const scope = 'identify email';

    if (!clientId || !redirectUri) {
      console.error(
        'Discord OAuth not configured. Set NEXT_PUBLIC_DISCORD_CLIENT_ID and NEXT_PUBLIC_DISCORD_REDIRECT_URI.'
      );
      return;
    }

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    window.location.href = discordAuthUrl;
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/landing';
  }

  async function completeOnboarding(data: OnboardingData) {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_complete: true,
        onboarding_data: data as any,
      })
      .eq('id', user.id);

    if (!error) {
      const updated: AuthUser = {
        ...user,
        onboardingComplete: true,
        onboardingData: data,
      };
      setUser(updated);
    }
  }

  async function updateProfile(updates: Partial<AuthUser>) {
    if (!user) return;

    const dbUpdates: Record<string, any> = {};
    if (updates.name) dbUpdates.display_name = updates.name;
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.branch) dbUpdates.branch_id = updates.branch;
    if (updates.domain) dbUpdates.domain_id = updates.domain;

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', user.id);

    if (!error) {
      const updated: AuthUser = { ...user, ...updates };
      setUser(updated);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, loginWithDiscord, logout, completeOnboarding, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
