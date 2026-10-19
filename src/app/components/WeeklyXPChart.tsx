'use client';
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { WeeklyXPPoint } from '@/lib/api';

interface WeeklyXPChartProps {
  data: WeeklyXPPoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="card-base px-3 py-2.5 shadow-card text-sm">
      <p className="font-heading font-semibold text-foreground mb-1">{label}</p>
      <p className="text-xp-lime font-bold">+{payload[0]?.value} XP</p>
      {payload[1] && (
        <p className="text-muted-foreground text-[11px]">{payload[1].value} activities</p>
      )}
    </div>
  );
}

export default function WeeklyXPChart({ data }: WeeklyXPChartProps) {
  return (
    <div className="card-base p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground">Weekly XP</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 7 days activity</p>
        </div>
        <span className="badge-xp text-[11px] px-2 py-1">
          +{data.reduce((s, d) => s + d.xp, 0)} total
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--xp-lime)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--xp-lime)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="xp"
            stroke="var(--xp-lime)"
            strokeWidth={2}
            fill="url(#xpGrad)"
            dot={{ fill: 'var(--xp-lime)', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: 'var(--xp-lime)' }}
          />
          <Area
            type="monotone"
            dataKey="activities"
            stroke="var(--primary)"
            strokeWidth={1.5}
            fill="url(#actGrad)"
            strokeDasharray="4 2"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
