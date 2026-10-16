'use client';
import React from 'react';
import Link from 'next/link';
import { Home, Zap, FileCheck, Trophy, User } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const TABS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Activities', href: '/activities', icon: Zap },
  { label: 'Claims', href: '/my-claims', icon: FileCheck },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { label: 'Profile', href: '/profile', icon: User },
];

interface BottomTabBarProps {
  activePath: string;
}

export default function BottomTabBar({ activePath }: BottomTabBarProps) {
  function isActive(href: string) {
    if (href === '/') return activePath === '/';
    return activePath.startsWith(href);
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
      <div className="flex items-center justify-around px-2 py-2 safe-bottom">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={`tab-${tab.href}`}
              href={tab.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-150 ${
                active ? 'bottom-tab-active' : 'bottom-tab-inactive'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 2}
                className={active ? 'text-violetcustom' : 'text-muted-foreground'}
              />
              <span className={`text-[10px] font-medium ${active ? 'text-violetcustom' : 'text-muted-foreground'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}