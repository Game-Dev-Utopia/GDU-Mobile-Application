'use client';
import React, { useState } from 'react';
import { Eye, ChevronUp, ChevronDown, Check } from 'lucide-react';
import type { ViewAsRole } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';

const ALL_ROLES: { value: string; label: string; color: string }[] = [
  { value: 'member', label: 'Member', color: 'text-foreground' },
  { value: 'senior_member', label: 'Senior Member', color: 'text-cyan-accent' },
  { value: 'team_lead', label: 'Team Lead', color: 'text-cyan-accent' },
  { value: 'domain_head', label: 'Domain Head', color: 'text-cyan-accent' },
  { value: 'council_member', label: 'Council Member', color: 'text-violet-accent' },
  { value: 'board_member', label: 'Board Member', color: 'text-xp-lime' },
  { value: 'faculty', label: 'Faculty', color: 'text-amber-accent' },
  {
    value: 'independent_contributor',
    label: 'Independent Contributor',
    color: 'text-amber-accent',
  },
  { value: 'admin', label: 'Admin', color: 'text-rose-accent' },
  { value: 'finance_compliance_officer', label: 'Finance & Compliance', color: 'text-rose-accent' },
  { value: 'conduct_panel_member', label: 'Conduct Panel', color: 'text-rose-accent' },
  { value: 'auditor', label: 'Auditor', color: 'text-rose-accent' },
  { value: 'partner_rep', label: 'Partner Rep', color: 'text-muted-foreground' },
];

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  senior_member: 'Senior Member',
  team_lead: 'Team Lead',
  domain_head: 'Domain Head',
  council_member: 'Council Member',
  board_member: 'Board Member',
  faculty: 'Faculty',
  independent_contributor: 'Independent Contributor',
  admin: 'Admin',
  finance_compliance_officer: 'Finance & Compliance Officer',
  conduct_panel_member: 'Conduct Panel Member',
  auditor: 'Auditor',
  partner_rep: 'Partner Rep',
};

export default function ViewAsMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>('member');

  const current = ALL_ROLES.find((r) => r.value === selected)!;

  const userRoles = user?.roles || (user?.role ? [user.role] : []);

  function canViewRole(role: string): boolean {
    // Dev menu: allow viewing any role, but show a warning if current user can't actually hold it
    return true;
  }

  return (
    <div className="fixed bottom-24 right-4 lg:bottom-6 z-50">
      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-64 card-base shadow-card animate-fade-scale overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Dev — View As ({userRoles.join(', ') || user?.role || 'member'})
            </p>
          </div>
          {ALL_ROLES.map((role) => (
            <button
              key={`role-${role.value}`}
              onClick={() => {
                setSelected(role.value);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors duration-100 text-left"
            >
              <span className={`text-sm font-medium ${role.color}`}>{ROLE_LABELS[role.value]}</span>
              {selected === role.value && <Check size={14} className="text-xp-lime" />}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl shadow-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-150"
      >
        <Eye size={14} />
        <span className={`text-xs font-medium ${current.color}`}>{ROLE_LABELS[current.value]}</span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
    </div>
  );
}
