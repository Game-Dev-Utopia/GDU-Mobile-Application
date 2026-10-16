'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

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
  discordId: string;
  onboardingComplete: boolean;
  onboardingData?: OnboardingData;
  startingLevel: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithDiscord: () => void;
  logout: () => void;
  completeOnboarding: (data: OnboardingData) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  loginWithDiscord: () => {},
  logout: () => {},
  completeOnboarding: () => {},
});

const MOCK_USER: AuthUser = {
  id: 'user-001',
  name: 'Aryan Mehta',
  username: 'aryan.mehta',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aryan',
  discordId: '123456789',
  onboardingComplete: false,
  startingLevel: 1,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for persisted auth state
    try {
      const stored = localStorage.getItem('gdu_auth');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  function loginWithDiscord() {
    // Mock Discord OAuth — replace with Supabase Auth later
    const newUser = { ...MOCK_USER, onboardingComplete: false };
    setUser(newUser);
    try {
      localStorage.setItem('gdu_auth', JSON.stringify(newUser));
    } catch {
      // ignore
    }
  }

  function logout() {
    setUser(null);
    try {
      localStorage.removeItem('gdu_auth');
    } catch {
      // ignore
    }
  }

  function completeOnboarding(data: OnboardingData) {
    if (!user) return;
    const updated: AuthUser = {
      ...user,
      onboardingComplete: true,
      onboardingData: data,
      startingLevel: 1,
    };
    setUser(updated);
    try {
      localStorage.setItem('gdu_auth', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithDiscord, logout, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
