'use client';
import React, { useState } from 'react';
import { Eye, ChevronUp, ChevronDown, Check } from 'lucide-react';
import type { ViewAsRole } from '@/lib/api';

const ROLES: { value: ViewAsRole; label: string; color: string }[] = [
  { value: 'member', label: 'Member', color: 'text-foreground' },
  { value: 'domain_head', label: 'Domain Head', color: 'text-cyan-accent' },
  { value: 'branch_president', label: 'Branch President', color: 'text-violet-accent' },
  { value: 'board', label: 'Board', color: 'text-xp-lime' },
  { value: 'faculty', label: 'Faculty', color: 'text-amber-accent' },
  { value: 'admin', label: 'Admin', color: 'text-rose-accent' },
];

export default function ViewAsMenu() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ViewAsRole>('member');

  const current = ROLES.find((r) => r.value === selected)!;

  return (
    <div className="fixed bottom-24 right-4 lg:bottom-6 z-50">
      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-52 card-base shadow-card animate-fade-scale overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Dev — View As
            </p>
          </div>
          {ROLES.map((role) => (
            <button
              key={`role-${role.value}`}
              onClick={() => { setSelected(role.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors duration-100 text-left"
            >
              <span className={`text-sm font-medium ${role.color}`}>{role.label}</span>
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
        <span className={`text-xs font-medium ${current.color}`}>{current.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
    </div>
  );
}