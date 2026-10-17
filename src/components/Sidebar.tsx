'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import {
  Home,
  Zap,
  FileCheck,
  Trophy,
  Shield,
  User,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Settings,
  Bell,
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';


interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Activities', href: '/activities', icon: Zap, badge: 3 },
  { label: 'My Claims', href: '/my-claims', icon: FileCheck, badge: 2 },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { label: 'Leagues', href: '/leagues', icon: Shield },
  { label: 'Profile', href: '/profile', icon: User },
];

const APPROVER_ITEMS: NavItem[] = [
  { label: 'Review Queue', href: '/review', icon: ClipboardList, badge: 8 },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Admin', href: '/admin', icon: Settings },
];

interface SidebarProps {
  activePath: string;
}

export default function Sidebar({ activePath }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, isLoading } = useAuth();

  const showApprover = user?.role === 'domain_head' || user?.role === 'team_lead' || user?.role === 'board' || user?.role === 'admin';
  const showAdmin = user?.role === 'board' || user?.role === 'admin';

  function isActive(href: string) {
    if (href === '/') return activePath === '/';
    return activePath.startsWith(href);
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group
          ${active ? 'nav-item-active' : 'nav-item-inactive'}
        `}
      >
        <span className="relative flex-shrink-0">
          <Icon size={20} strokeWidth={active ? 2.5 : 2} />
          {item.badge && item.badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="text-sm font-medium font-sans truncate">{item.label}</span>
        )}
        {collapsed && (
          <span className="absolute left-full ml-3 px-2 py-1 bg-card border border-border rounded-md text-xs font-medium text-foreground whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-card">
            {item.label}
            {item.badge ? ` (${item.badge})` : ''}
          </span>
        )}
      </Link>
    );
  }

  if (isLoading || !user) {
    return null;
  }

  return (
    <aside
      className={`
        hidden lg:flex flex-col fixed top-0 left-0 h-full z-30
        bg-card border-r border-border
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
        <AppLogo size={32} />
        {!collapsed && (
          <span className="font-heading font-bold text-lg text-foreground tracking-tight">
            GDU <span className="text-xp-lime">XP</span>
          </span>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4 space-y-1">
        {!collapsed && (
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-3 mb-2">
            Main
          </p>
        )}
        {NAV_ITEMS.map((item) => (
          <NavLink key={`nav-${item.href}`} item={item} />
        ))}

        <div className="my-3 border-t border-border" />

        {showApprover && (
          <>
            {!collapsed && (
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-3 mb-2">
                Approver
              </p>
            )}
            {APPROVER_ITEMS.map((item) => (
              <NavLink key={`nav-approver-${item.href}`} item={item} />
            ))}
          </>
        )}

        <div className="my-3 border-t border-border" />

        {showAdmin && (
          <>
            {!collapsed && (
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-3 mb-2">
                Admin
              </p>
            )}
            {ADMIN_ITEMS.map((item) => (
              <NavLink key={`nav-admin-${item.href}`} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-4 border-t border-border space-y-1">
        <Link
          href="/notifications"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg nav-item-inactive transition-all duration-150 group relative"
        >
          <span className="relative flex-shrink-0">
            <Bell size={20} strokeWidth={2} />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-ambercustom rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              3
            </span>
          </span>
          {!collapsed && <span className="text-sm font-medium">Notifications</span>}
        </Link>

        <Link
          href="/profile"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg nav-item-inactive transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
        >
          <img
            src={user.avatar}
            alt={`${user.name} avatar`}
            className="w-7 h-7 rounded-full border border-border flex-shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {user.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                Lvl {user.level} · {user.leagueTier}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-150 shadow-card"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
