// Backend integration point — Supabase-powered API calls

import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export type Branch = 'GDU PICT' | 'GDU IIITK';

export type LeagueTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Emerald' | 'Diamond';

export type ActivityDomain =
  | 'Game Dev (Coding)'
  | 'Web & DevOps'
  | 'AI & ML'
  | 'Marketing'
  | 'Eternal Affairs'
  | 'Design & Digital Arts'
  | 'Research & Development (R&D)';

export type ActivityDifficulty = 1 | 2 | 3 | 4 | 5;

export type ActivityStatus = 'open' | 'claimed' | 'closed' | 'upcoming';

export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'awaiting_confirmation';

export type ViewAsRole =
  | 'member'
  | 'domain_head'
  | 'branch_president'
  | 'board'
  | 'faculty'
  | 'admin';

export type ExpCategory = 'technical' | 'social' | 'soft' | 'management';

export interface Member {
  id: string;
  name: string;
  username: string;
  avatar: string;
  branch: Branch;
  domain: ActivityDomain;
  totalXP: number;
  level: number;
  levelName: string;
  xpInLevel: number;
  xpToNextLevel: number;
  streak: number;
  leagueTier: LeagueTier;
  leagueRank: number;
  branchRank: number;
  globalRank: number;
  pendingClaims: number;
  joinedAt: string;
  role: ViewAsRole;
  roles: string[];
  scopes: string[];
  isAlumni: boolean;
  alumniBadge?: string | null;
}

export interface WeeklyXPPoint {
  day: string;
  xp: number;
  activities: number;
}

export interface XPTransaction {
  id: string;
  activityId: string;
  activityName: string;
  domain: ActivityDomain;
  xpEarned: number;
  timestamp: string;
  claimId: string;
}

export interface ActivityType {
  id: string;
  name: string;
  category: ExpCategory;
  subcategoryId: string | null;
  kind: string;
  domain: ActivityDomain;
  expMin: number;
  expMax: number;
  seasonCap: number | null;
  difficulty: ActivityDifficulty;
  evidenceRequired: boolean;
  approversNeeded: number;
  isActive: boolean;
}

export interface ActivitySubcategory {
  id: string;
  category: ExpCategory;
  name: string;
  displayName: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: ExpCategory;
  subcategoryId: string | null;
  domain: ActivityDomain;
  difficulty: ActivityDifficulty;
  xpReward: number;
  expMin: number;
  expMax: number;
  bonusXP?: number;
  status: ActivityStatus;
  deadline: string;
  submissionFormat: string;
  requirements: string[];
  tags: string[];
  claimedCount: number;
  maxClaims?: number;
  branch: Branch | 'all';
  postedBy: string;
  postedAt: string;
}

export interface Claim {
  id: string;
  activityId: string;
  activityTitle: string;
  activityDomain: ActivityDomain;
  xpReward: number;
  submittedAt: string;
  status: ClaimStatus;
  proofUrl: string;
  proofFiles: ProofFile[];
  notes: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  feedback?: string;
  xpCredited?: number;
  submittedOnBehalfOf?: string;
  submittedBy?: string;
  submittedByName?: string;
  confirmationRequired: boolean;
  confirmationResponded: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  name: string;
  username: string;
  avatar: string;
  totalXP: number;
  level: number;
  leagueTier: LeagueTier;
  streak: number;
  branch: Branch;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'event' | 'warning' | 'reward';
  createdAt: string;
}

export interface OnboardingPayload {
  branch: string;
  domains: string[];
  interests: string[];
  weeklyAvailability: '1-3' | '3-6' | '6+';
}

// ─── Helper: map DB profile to Member type ──────────────────────────────

function mapProfileToMember(
  profile: any,
  userRoles: string[] = [],
  userScopes: string[] = []
): Member {
  return {
    id: profile.id,
    name: profile.display_name || profile.username,
    username: profile.username,
    avatar:
      profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`,
    branch: (profile.branch_name as Branch) || 'GDU PICT',
    domain: (profile.domain_name as ActivityDomain) || 'Game Dev (Coding)',
    totalXP: profile.total_exp ?? 0,
    level: profile.level ?? 1,
    levelName: `Level ${profile.level ?? 1}`,
    xpInLevel: 0,
    xpToNextLevel: 0,
    streak: 0,
    leagueTier: (profile.league_tier as LeagueTier) || 'Bronze',
    leagueRank: 0,
    branchRank: 0,
    globalRank: 0,
    pendingClaims: 0,
    joinedAt: profile.created_at,
    role: (profile.role as ViewAsRole) || 'member',
    roles: userRoles,
    scopes: userScopes,
    isAlumni: profile.is_alumni ?? false,
    alumniBadge: profile.alumni_badge ?? null,
  };
}

// ─── API Functions ─────────────────────────────────────────────────────

export async function getCurrentMember(): Promise<Member> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      `
      *,
      branches ( name ),
      domains ( name )
    `
    )
    .eq('id', user.id)
    .single();

  if (error || !profile) throw new Error('Profile not found');

  // Fetch role assignments for RBAC
  const { data: roleAssignments } = await supabase
    .from('role_assignments')
    .select('role, scope')
    .eq('profile_id', user.id)
    .eq('is_active', true);

  const userRoles = roleAssignments?.map((ra: any) => ra.role) || [
    (profile.role as ViewAsRole) || 'member',
  ];
  const userScopes = roleAssignments?.map((ra: any) => ra.scope) || ['self'];

  // Attach branch_name and domain_name from joins
  const profileWithNames = {
    ...profile,
    branch_name: profile.branches?.name,
    domain_name: profile.domains?.name,
  };

  const levelInfo = xpToLevel(profile.total_exp ?? 0);

  return {
    ...mapProfileToMember(profileWithNames, userRoles, userScopes),
    level: levelInfo.level,
    xpInLevel: levelInfo.xpInLevel,
    xpToNextLevel: levelInfo.xpToNextLevel,
  };
}

// ─── Level Calculation (Quadratic Curve) ─────────────────────────────────
// Cumulative EXP for level L = 50 × L × (L-1)
// Level 1: 0, Level 2: 100, Level 5: 1,000, Level 10: 4,500,
// Level 20: 19,000, Level 50: 122,500
// Early levels are fast (motivation), later levels get harder (retention)

export interface LevelInfo {
  level: number;
  xpInLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
}

export function xpToLevel(totalXP: number): LevelInfo {
  // Solve 50 * L * (L-1) <= totalXP for L
  // L = floor((1 + sqrt(1 + 8 * totalXP / 100)) / 2)
  const discriminant = 1 + (8 * totalXP) / 100;
  const level = Math.floor((1 + Math.sqrt(Math.max(0, discriminant))) / 2);
  const cumulativeAtLevel = 50 * level * (level - 1);
  const cumulativeAtNextLevel = 50 * (level + 1) * level;
  const xpInLevel = totalXP - cumulativeAtLevel;
  const xpToNextLevel = cumulativeAtNextLevel - cumulativeAtLevel;
  const progressPercent =
    xpToNextLevel > 0 ? Math.min(100, Math.max(0, (xpInLevel / xpToNextLevel) * 100)) : 100;
  return { level, xpInLevel, xpToNextLevel, progressPercent };
}

export function levelToXP(level: number): number {
  return 50 * level * (level - 1);
}

// ─── Seed Data: Activity Type EXP Ranges ─────────────────────────────────
// Based on analysis of student community activity patterns:
// - Active student: 2-5 activities/week, ~30-75/semester
// - Average EXP per activity: ~75 (midpoint of 25-150 rubric)
// - Level 10 reachable in ~1-2 active semesters (~4,500 EXP)
// - Season caps prevent spam; low-effort activities have higher caps

export const SEED_ACTIVITY_TYPES: Array<{
  name: string;
  category: ExpCategory;
  domain: ActivityDomain;
  expMin: number;
  expMax: number;
  seasonCap: number | null;
  difficulty: ActivityDifficulty;
  evidenceRequired: boolean;
  approversNeeded: number;
  description: string;
  submissionFormat: string;
  requirements: string[];
  tags: string[];
  postedBy: string;
}> = [
  // TECHNOLOGY, INNOVATION & WISDOM
  {
    name: 'Game Jam Participation',
    category: 'technical',
    domain: 'Game Dev (Coding)',
    expMin: 100,
    expMax: 500,
    seasonCap: 3,
    difficulty: 5,
    evidenceRequired: true,
    approversNeeded: 2,
    description: 'Participate in a game jam (48-72 hours). Submit a playable build with devlog.',
    submissionFormat: 'itch.io link + devlog PDF',
    requirements: ['Playable web build', 'Devlog min 500 words', 'Team of 1-5 members'],
    tags: ['jam', 'game-dev', 'team'],
    postedBy: 'Board',
  },
  {
    name: 'Project Development',
    category: 'technical',
    domain: 'Game Dev (Coding)',
    expMin: 50,
    expMax: 200,
    seasonCap: 4,
    difficulty: 4,
    evidenceRequired: true,
    approversNeeded: 2,
    description: 'Develop a game or software project. Scope determines EXP within range.',
    submissionFormat: 'GitHub repo link + demo video',
    requirements: ['Public GitHub repo', 'Working demo', 'README with instructions'],
    tags: ['project', 'development', 'coding'],
    postedBy: 'Board',
  },
  {
    name: 'Bug Fix / QA',
    category: 'technical',
    domain: 'Web & DevOps',
    expMin: 25,
    expMax: 100,
    seasonCap: 10,
    difficulty: 3,
    evidenceRequired: true,
    approversNeeded: 1,
    description: 'Fix a bug or perform QA testing on a community project.',
    submissionFormat: 'PR link + before/after screenshots',
    requirements: ['Merged PR or documented fix', 'Test coverage'],
    tags: ['bug-fix', 'qa', 'testing'],
    postedBy: 'Domain Head',
  },
  {
    name: 'AI/ML Prototype',
    category: 'technical',
    domain: 'AI & ML',
    expMin: 75,
    expMax: 250,
    seasonCap: 3,
    difficulty: 5,
    evidenceRequired: true,
    approversNeeded: 2,
    description: 'Build an AI/ML prototype or experiment. Novelty and technical depth matter.',
    submissionFormat: 'Notebook/repo + results summary',
    requirements: ['Working prototype', 'Results documentation'],
    tags: ['ai', 'ml', 'prototype', 'research'],
    postedBy: 'Board',
  },
  {
    name: 'Open Source PR',
    category: 'technical',
    domain: 'Web & DevOps',
    expMin: 50,
    expMax: 150,
    seasonCap: 6,
    difficulty: 4,
    evidenceRequired: true,
    approversNeeded: 1,
    description: 'Contribute a PR to an open source project. Impact and complexity determine EXP.',
    submissionFormat: 'PR link + maintainer feedback',
    requirements: ['Merged PR', 'Issue reference'],
    tags: ['open-source', 'pr', 'contribution'],
    postedBy: 'Board',
  },

  // MOTIVATION, INITIATIVE & LEARNING MINDSET
  {
    name: 'Blog Post / Technical Writing',
    category: 'social',
    domain: 'Design & Digital Arts',
    expMin: 30,
    expMax: 100,
    seasonCap: 6,
    difficulty: 3,
    evidenceRequired: true,
    approversNeeded: 1,
    description: 'Write a technical blog post or article. Word count and depth affect EXP.',
    submissionFormat: 'Public article link (Medium, Dev.to, personal blog)',
    requirements: ['Min 800 words', 'Publicly accessible', 'Technical content'],
    tags: ['writing', 'blog', 'tutorial'],
    postedBy: 'Board',
  },
  {
    name: 'SIG Session Conducted',
    category: 'social',
    domain: 'Eternal Affairs',
    expMin: 40,
    expMax: 120,
    seasonCap: 6,
    difficulty: 4,
    evidenceRequired: true,
    approversNeeded: 1,
    description: 'Host a Special Interest Group session. Prep, delivery, and attendance matter.',
    submissionFormat: 'Slides link + attendance sheet',
    requirements: ['Min 15 slides', 'Min 10 attendees', 'Q&A session'],
    tags: ['workshop', 'teaching', 'sig', 'presentation'],
    postedBy: 'Domain Head',
  },
  {
    name: 'Session Attendance',
    category: 'social',
    domain: 'Eternal Affairs',
    expMin: 5,
    expMax: 25,
    seasonCap: 20,
    difficulty: 1,
    evidenceRequired: false,
    approversNeeded: 1,
    description: 'Attend a community session or event. Diminishing returns apply.',
    submissionFormat: 'Check-in code or RSVP confirmation',
    requirements: ['Valid check-in code', 'On-time arrival'],
    tags: ['attendance', 'event', 'community'],
    postedBy: 'System',
  },
  {
    name: 'Tutorial Created',
    category: 'social',
    domain: 'Design & Digital Arts',
    expMin: 60,
    expMax: 150,
    seasonCap: 4,
    difficulty: 4,
    evidenceRequired: true,
    approversNeeded: 2,
    description: 'Create a step-by-step tutorial for the community. Clarity and usefulness matter.',
    submissionFormat: 'Tutorial link + example project',
    requirements: ['Step-by-step guide', 'Working example', 'Min 500 words'],
    tags: ['tutorial', 'guide', 'education'],
    postedBy: 'Board',
  },

  // SOCIAL & SOFT SKILLS
  {
    name: 'Mentoring',
    category: 'soft',
    domain: 'Eternal Affairs',
    expMin: 20,
    expMax: 80,
    seasonCap: 8,
    difficulty: 3,
    evidenceRequired: true,
    approversNeeded: 1,
    description: 'Mentor a newcomer or peer. Mentee feedback determines EXP within range.',
    submissionFormat: 'Mentee testimonial + session log',
    requirements: ['Min 3 sessions', 'Mentee confirmation'],
    tags: ['mentoring', 'peer-support', 'guidance'],
    postedBy: 'Domain Head',
  },
  {
    name: 'Community Discord Moderation',
    category: 'soft',
    domain: 'Eternal Affairs',
    expMin: 30,
    expMax: 100,
    seasonCap: 6,
    difficulty: 3,
    evidenceRequired: false,
    approversNeeded: 1,
    description: 'Moderate the community Discord server. Consistency and fairness matter.',
    submissionFormat: 'Moderation log + time period',
    requirements: ['Min 2 weeks active', 'No policy violations'],
    tags: ['moderation', 'discord', 'community-management'],
    postedBy: 'Board',
  },
  {
    name: 'Social Media Post',
    category: 'soft',
    domain: 'Marketing',
    expMin: 10,
    expMax: 40,
    seasonCap: 12,
    difficulty: 1,
    evidenceRequired: true,
    approversNeeded: 1,
    description: 'Post about GDU on social media. Reach and engagement affect EXP.',
    submissionFormat: 'Screenshot of post + engagement metrics',
    requirements: ['Public post', 'GDU tag/mention', 'Min 50 impressions'],
    tags: ['social-media', 'marketing', 'promotion'],
    postedBy: 'Marketing',
  },
  {
    name: 'Referral',
    category: 'soft',
    domain: 'Eternal Affairs',
    expMin: 0,
    expMax: 50,
    seasonCap: 5,
    difficulty: 2,
    evidenceRequired: false,
    approversNeeded: 2,
    description: 'Refer a new member. EXP vests after 60-90 days of referee activity.',
    submissionFormat: 'Referral link/code used by new member',
    requirements: ['New member joins using referral', 'Referee active for 60+ days'],
    tags: ['referral', 'growth', 'recruitment'],
    postedBy: 'Board',
  },

  // LEADERSHIP & MANAGEMENT
  {
    name: 'Event Hosting',
    category: 'management',
    domain: 'Eternal Affairs',
    expMin: 25,
    expMax: 150,
    seasonCap: 5,
    difficulty: 4,
    evidenceRequired: true,
    approversNeeded: 2,
    description: 'Host a community event (workshop, jam, meetup). Planning and execution matter.',
    submissionFormat: 'Event page + photos + attendance',
    requirements: ['Min 15 attendees', 'Event page published', 'Post-event summary'],
    tags: ['event', 'hosting', 'leadership', 'organization'],
    postedBy: 'Board',
  },
  {
    name: 'Project Lead',
    category: 'management',
    domain: 'Game Dev (Coding)',
    expMin: 100,
    expMax: 300,
    seasonCap: 2,
    difficulty: 5,
    evidenceRequired: true,
    approversNeeded: 2,
    description:
      'Lead a project team. Responsibility, delivery, and team satisfaction determine EXP.',
    submissionFormat: 'Project link + team feedback',
    requirements: ['Min 3 team members', 'Shipped milestone', 'Team retrospective'],
    tags: ['leadership', 'project-management', 'team-lead'],
    postedBy: 'Board',
  },
  {
    name: 'Sponsorship Brought',
    category: 'management',
    domain: 'Marketing',
    expMin: 100,
    expMax: 300,
    seasonCap: 2,
    difficulty: 5,
    evidenceRequired: true,
    approversNeeded: 3,
    description: 'Bring a sponsor or partner to GDU. Value and terms determine EXP.',
    submissionFormat: 'Signed MoU + sponsor confirmation',
    requirements: ['Signed agreement', 'Min value threshold', 'No conflict of interest'],
    tags: ['sponsorship', 'partnership', 'fundraising'],
    postedBy: 'Board',
  },
  {
    name: 'Interview Panel',
    category: 'management',
    domain: 'Research & Development (R&D)',
    expMin: 30,
    expMax: 100,
    seasonCap: 6,
    difficulty: 3,
    evidenceRequired: true,
    approversNeeded: 1,
    description:
      'Serve on an interview panel for new members or positions. Fairness and thoroughness matter.',
    submissionFormat: 'Interview feedback form + panel confirmation',
    requirements: ['Min 2 interviews', 'Completed feedback forms'],
    tags: ['interview', 'evaluation', 'panel'],
    postedBy: 'Board',
  },
];

// ─── API Functions ─────────────────────────────────────────────────────

export async function getActivities(filters?: {
  domain?: ActivityDomain;
  status?: ActivityStatus;
  difficulty?: ActivityDifficulty;
  branch?: Branch | 'all';
  search?: string;
}): Promise<Activity[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get activity types from Supabase with real EXP ranges and season caps
  const { data: activityTypes, error } = await supabase
    .from('activity_types')
    .select(
      `
      *,
      domains ( name )
    `
    )
    .eq('is_active', true);

  if (error || !activityTypes) {
    // Fallback to mock seed data if DB not yet seeded
    return seedActivitiesToActivity(filters);
  }

  // Get current season window (rolling 90 days, matching Standing window)
  const seasonStart = new Date();
  seasonStart.setDate(seasonStart.getDate() - 90);

  // Count user's approved/submitted claims per activity type in current season
  const claimsCount: Record<string, number> = {};
  if (user) {
    const { data: claims } = await supabase
      .from('claims')
      .select('activity_type_id, status')
      .eq('claimant_id', user.id)
      .gte('created_at', seasonStart.toISOString());

    if (claims) {
      for (const claim of claims) {
        if (claim.status === 'approved' || claim.status === 'submitted') {
          claimsCount[claim.activity_type_id] = (claimsCount[claim.activity_type_id] || 0) + 1;
        }
      }
    }
  }

  const activities: Activity[] = activityTypes.map((at: any) => {
    const used = claimsCount[at.id] || 0;
    const remainingCap = at.season_cap ? Math.max(0, at.season_cap - used) : null;
    const xpReward = Math.floor((at.exp_min + at.exp_max) / 2); // midpoint as suggested XP

    return {
      id: at.id,
      title: at.name,
      description: at.description || `${at.category} activity`,
      domain: (at.domains as any)?.name as ActivityDomain,
      difficulty: at.difficulty,
      xpReward,
      status: remainingCap === 0 ? 'closed' : 'open',
      deadline: '',
      submissionFormat: at.submission_format || 'Evidence link required',
      requirements: at.requirements || [],
      tags: at.tags || [at.category],
      claimedCount: used,
      maxClaims: at.season_cap,
      branch: 'all',
      postedBy: at.posted_by || 'System',
      postedAt: at.created_at,
    };
  });

  // Apply filters
  let results = activities;
  if (filters?.domain) results = results.filter((a) => a.domain === filters.domain);
  if (filters?.status) results = results.filter((a) => a.status === filters.status);
  if (filters?.difficulty) results = results.filter((a) => a.difficulty === filters.difficulty);
  if (filters?.branch && filters.branch !== 'all')
    results = results.filter((a) => a.branch === filters.branch || a.branch === 'all');
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
    );
  }
  return results;
}

function seedActivitiesToActivity(filters?: {
  domain?: ActivityDomain;
  status?: ActivityStatus;
  difficulty?: ActivityDifficulty;
  branch?: Branch | 'all';
  search?: string;
}): Promise<Activity[]> {
  const MOCK_ACTIVITIES: Activity[] = [
    {
      id: 'act-001',
      title: 'Global Game Jam 2026 — Team Lead',
      description:
        'Lead a team of 3–5 members through the 48-hour Global Game Jam. Submit a playable build with a devlog.',
      domain: 'Game Dev (Coding)',
      difficulty: 5,
      xpReward: 500,
      bonusXP: 100,
      status: 'open',
      deadline: '2026-10-15T23:59:00Z',
      submissionFormat: 'itch.io link + devlog PDF',
      requirements: [
        'Minimum team of 3 members',
        'All members must be GDU registered',
        'Playable web build required',
        'Devlog min 500 words',
      ],
      tags: ['jam', 'team-lead', 'high-xp'],
      claimedCount: 7,
      maxClaims: 10,
      branch: 'all',
      postedBy: 'Board',
      postedAt: '2026-09-28T08:00:00Z',
    },
    {
      id: 'act-002',
      title: 'Pixel Art Character Sheet',
      description:
        'Create a character sheet with idle, walk, and attack animations. Min 32×32px sprite, 4-directional.',
      domain: 'Design & Digital Arts',
      difficulty: 3,
      xpReward: 200,
      status: 'open',
      deadline: '2026-10-10T23:59:00Z',
      submissionFormat: 'PNG sprite sheet + GIF preview',
      requirements: [
        'Min 32×32px per frame',
        '4-directional movement',
        'At least 3 animation states',
      ],
      tags: ['pixel-art', 'animation', 'character'],
      claimedCount: 14,
      branch: 'all',
      postedBy: 'Kavya Sharma',
      postedAt: '2026-09-25T10:00:00Z',
    },
    {
      id: 'act-003',
      title: 'Unity Shader Workshop Recap',
      description:
        'Write a structured recap of the Unity Shader workshop including code snippets, screenshots, and key takeaways.',
      domain: 'Web & DevOps',
      difficulty: 2,
      xpReward: 150,
      status: 'open',
      deadline: '2026-10-07T23:59:00Z',
      submissionFormat: 'Google Doc link (public view)',
      requirements: ['Min 800 words', 'At least 3 code snippets', '2+ screenshots from workshop'],
      tags: ['workshop', 'unity', 'writing'],
      claimedCount: 5,
      maxClaims: 8,
      branch: 'GDU PICT',
      postedBy: 'Rahul Desai',
      postedAt: '2026-09-27T09:00:00Z',
    },
    {
      id: 'act-004',
      title: 'Game Audio SFX Pack — Horror Theme',
      description:
        'Produce a minimum of 10 original SFX for a horror-themed game. Must be royalty-free and CC0 licensed.',
      domain: 'Design & Digital Arts',
      difficulty: 4,
      xpReward: 300,
      bonusXP: 50,
      status: 'open',
      deadline: '2026-10-12T23:59:00Z',
      submissionFormat: 'ZIP file via Google Drive',
      requirements: [
        'Min 10 SFX files',
        'WAV or OGG format',
        'CC0 license declaration',
        'Naming convention: sfx_[name]_v1',
      ],
      tags: ['audio', 'sfx', 'horror', 'cc0'],
      claimedCount: 3,
      branch: 'all',
      postedBy: 'Priya Nair',
      postedAt: '2026-09-26T11:00:00Z',
    },
    {
      id: 'act-005',
      title: 'Social Media Campaign — GDU Monthly Digest',
      description:
        'Design and post 4 Instagram stories + 1 carousel post for the GDU Monthly Digest. Use provided brand kit.',
      domain: 'Marketing',
      difficulty: 2,
      xpReward: 120,
      status: 'open',
      deadline: '2026-10-05T23:59:00Z',
      submissionFormat: 'Screenshot of live posts + Canva file link',
      requirements: [
        '4 Instagram stories',
        '1 carousel post (min 5 slides)',
        'Use GDU brand kit',
        'Tag @gamedevutopia',
      ],
      tags: ['social-media', 'design', 'marketing'],
      claimedCount: 2,
      maxClaims: 3,
      branch: 'GDU IIITK',
      postedBy: 'Sneha Kulkarni',
      postedAt: '2026-09-29T14:00:00Z',
    },
  ];

  let results = [...MOCK_ACTIVITIES];
  if (filters?.domain) results = results.filter((a) => a.domain === filters.domain);
  if (filters?.status) results = results.filter((a) => a.status === filters.status);
  if (filters?.difficulty) results = results.filter((a) => a.difficulty === filters.difficulty);
  if (filters?.branch && filters.branch !== 'all')
    results = results.filter((a) => a.branch === filters.branch || a.branch === 'all');
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
    );
  }
  return Promise.resolve(results);
}

export async function getWeeklyXP(): Promise<WeeklyXPPoint[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: WeeklyXPPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const start = d.toISOString();
    d.setDate(d.getDate() + 1);
    const end = d.toISOString();

    const { data: entries } = await supabase
      .from('ledger_entries')
      .select('amount, created_at')
      .eq('member_id', user.id)
      .gte('created_at', start)
      .lt('created_at', end)
      .eq('source', 'claim');

    const xp = entries?.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0) || 0;
    const activities = entries?.length || 0;

    result.push({
      day: days[d.getDay()],
      xp,
      activities,
    });
  }

  return result;
}

export async function getRecentTransactions(limit = 5): Promise<XPTransaction[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: entries, error } = await supabase
    .from('ledger_entries')
    .select(
      `
      *,
      claims (
        id,
        title,
        activity_type_id,
        activity_types ( name, domain_id )
      )
    `
    )
    .eq('member_id', user.id)
    .eq('source', 'claim')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !entries) return [];

  return entries.map((e: any) => ({
    id: e.id,
    activityId: e.claims?.id || 'unknown',
    activityName: e.claims?.title || 'Unknown Activity',
    domain: 'Game Dev (Coding)',
    xpEarned: e.amount > 0 ? e.amount : 0,
    timestamp: e.created_at,
    claimId: e.claim_id || '',
  }));
}

export async function getActivityTypes(): Promise<ActivityType[]> {
  const { data, error } = await supabase.from('activity_types').select('*').eq('is_active', true);

  if (error || !data) return [];

  return data.map((a: any) => ({
    id: a.id,
    name: a.name,
    category: a.category as ExpCategory,
    subcategoryId: a.subcategory_id || null,
    kind: a.kind,
    domain: a.domain_id as ActivityDomain,
    expMin: a.exp_min,
    expMax: a.exp_max,
    seasonCap: a.season_cap,
    difficulty: a.difficulty,
    evidenceRequired: a.evidence_required,
    approversNeeded: a.approvers_needed,
    isActive: a.is_active,
  }));
}

export async function getActivityById(id: string): Promise<ActivityType | null> {
  const { data, error } = await supabase.from('activity_types').select('*').eq('id', id).single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    category: data.category as ExpCategory,
    subcategoryId: data.subcategory_id || null,
    kind: data.kind,
    domain: data.domain_id as ActivityDomain,
    expMin: data.exp_min,
    expMax: data.exp_max,
    seasonCap: data.season_cap,
    difficulty: data.difficulty,
    evidenceRequired: data.evidence_required,
    approversNeeded: data.approvers_needed,
    isActive: data.is_active,
  };
}

export async function getActivitySubcategories(): Promise<ActivitySubcategory[]> {
  const { data, error } = await supabase
    .from('activity_subcategories')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error || !data) return [];

  return data.map((a: any) => ({
    id: a.id,
    category: a.category,
    name: a.name,
    displayName: a.display_name,
    description: a.description,
    sortOrder: a.sort_order,
    isActive: a.is_active,
  }));
}

export async function getActivitiesByCategory(): Promise<
  Record<ExpCategory, { subcategory: ActivitySubcategory; activities: ActivityType[] }[]>
> {
  const [subcategories, activityTypes] = await Promise.all([
    getActivitySubcategories(),
    getActivityTypes(),
  ]);

  const result: Record<
    ExpCategory,
    { subcategory: ActivitySubcategory; activities: ActivityType[] }[]
  > = {
    technical: [],
    social: [],
    soft: [],
    management: [],
  };

  // Group subcategories by category
  const subcatsByCategory: Record<string, ActivitySubcategory[]> = {};
  for (const sc of subcategories) {
    if (!subcatsByCategory[sc.category]) subcatsByCategory[sc.category] = [];
    subcatsByCategory[sc.category].push(sc);
  }

  // Group activities by subcategory
  const actsBySubcat: Record<string, ActivityType[]> = {};
  for (const at of activityTypes) {
    if (!actsBySubcat[at.id]) actsBySubcat[at.id] = [];
    // activity_types now references subcategory_id; if not set, skip grouping by subcat
    actsBySubcat[at.id].push(at);
  }

  // Build result
  for (const category of Object.keys(result) as ExpCategory[]) {
    const subcats = subcatsByCategory[category] || [];
    result[category] = subcats.map((sc) => ({
      subcategory: sc,
      activities: activityTypes.filter((at) => at.domain === sc.name), // approximate mapping
    }));
  }

  return result;
}

export async function getMyClaims(): Promise<Claim[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: claims, error } = await supabase
    .from('claims')
    .select(
      `
      *,
      activity_types ( name, domain_id ),
      profiles!claims_reviewer_id_fkey ( display_name )
    `
    )
    .eq('claimant_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !claims) return [];

  return claims.map((c: any) => ({
    id: c.id,
    activityId: c.activity_type_id,
    activityTitle: c.title,
    activityDomain: (c.activity_types?.domain_id as ActivityDomain) || 'Game Dev',
    xpReward: c.suggested_exp,
    submittedAt: c.created_at,
    status: c.status as ClaimStatus,
    proofUrl: c.evidence_links?.[0] || '',
    notes: c.analysis_pointers,
    reviewerId: c.reviewer_id,
    reviewerName: c.profiles?.display_name,
    reviewedAt: c.reviewed_at,
    feedback: c.review_reason,
    xpCredited: c.reviewed_score,
  }));
}

export async function submitClaim(data: {
  activityTypeId: string;
  title: string;
  description: string;
  activityDate: string;
  evidenceLinks: string[];
  suggestedExp: number;
  analysisPointers: string;
  contributors: { memberId: string; sharePercent: number }[];
  submittedOnBehalfOf?: string;
}): Promise<{ claimId: string; status: ClaimStatus }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const contributorsJson = data.contributors.map((c) => ({
    member_id: c.memberId,
    share_percent: c.sharePercent,
  }));

  const { data: claimId, error } = await supabase.rpc('submit_claim', {
    p_activity_type_id: data.activityTypeId,
    p_title: data.title,
    p_description: data.description,
    p_activity_date: data.activityDate,
    p_evidence_links: data.evidenceLinks,
    p_suggested_exp: data.suggestedExp,
    p_analysis_pointers: data.analysisPointers,
    p_contributors: contributorsJson,
    p_submitted_on_behalf_of: data.submittedOnBehalfOf ?? null,
  });

  if (error) throw new Error(error.message);

  const status = data.submittedOnBehalfOf ? 'awaiting_confirmation' : 'submitted';
  return { claimId: claimId as string, status: status as ClaimStatus };
}

export async function reviewClaim(claimId: string, score: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('review_claim', {
    p_claim_id: claimId,
    p_score: score,
    p_reason: reason,
  });

  if (error) throw new Error(error.message);
}

export async function getReviewQueue(): Promise<Claim[]> {
  const { data: claims, error } = await supabase.rpc('list_my_review_queue');

  if (error || !claims) return [];

  return claims.map((c: any) => ({
    id: c.id,
    activityId: c.activity_type_id,
    activityTitle: c.title,
    activityDomain: 'Game Dev',
    xpReward: c.suggested_exp,
    submittedAt: c.created_at,
    status: c.status as ClaimStatus,
    proofUrl: c.evidence_links?.[0] || '',
    notes: c.analysis_pointers,
    reviewerId: c.reviewer_id,
    reviewerName: '',
    reviewedAt: c.reviewed_at,
    feedback: c.review_reason,
    xpCredited: c.reviewed_score,
  }));
}

export async function finalizeClaim(claimId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_claim', { p_claim_id: claimId });
  if (error) throw new Error(error.message);
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((a: any) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    type: a.type as Announcement['type'],
    createdAt: a.created_at,
  }));
}

export type LeaderboardGroup = 'all' | 'my_team' | 'my_level' | 'my_branch';
export type LeaderboardPeriod = 'biweekly' | 'monthly' | 'quarterly' | 'halfyearly' | 'yearly';
export type LeaderboardMetric = 'season' | 'lifetime';

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  name: string;
  username: string;
  avatar: string;
  totalXP: number;
  level: number;
  leagueTier: LeagueTier;
  streak: number;
  branch: Branch;
  percentile?: number; // percentile band for cross-branch views
}

export async function getLeaderboard({
  branch,
  group = 'all',
  period = 'biweekly',
  metric = 'season',
  currentMemberId,
}: {
  branch?: Branch;
  group?: LeaderboardGroup;
  period?: LeaderboardPeriod;
  metric?: LeaderboardMetric;
  currentMemberId?: string;
}): Promise<LeaderboardEntry[]> {
  // Determine the time window based on period
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case 'biweekly':
      startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'quarterly':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'halfyearly':
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'yearly':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
  }

  // For lifetime metric, no date filter
  const useDateFilter = metric === 'season';

  let query = supabase.from('profiles').select(`
      id,
      display_name,
      username,
      avatar_url,
      branches ( name ),
      league_tier,
      total_exp,
      level
    `);

  if (branch) {
    query = query.eq('branches.name', branch);
  }

  const { data: profiles, error } = await query;

  if (error || !profiles) return [];

  // Compute EXP per member based on metric
  const memberExpMap: Record<string, number> = {};

  if (useDateFilter) {
    // Get ledger entries within the period
    const { data: entries } = await supabase
      .from('ledger_entries')
      .select('member_id, amount')
      .eq('source', 'claim')
      .gte('activity_date', startDate.toISOString().split('T')[0]);

    if (entries) {
      for (const e of entries) {
        memberExpMap[e.member_id] = (memberExpMap[e.member_id] || 0) + Math.max(0, e.amount);
      }
    }
  } else {
    // Lifetime EXP from profiles
    for (const p of profiles) {
      memberExpMap[p.id] = p.total_exp ?? 0;
    }
  }

  // Build entries
  const entries: LeaderboardEntry[] = profiles.map((p: any, idx: number) => {
    const exp = memberExpMap[p.id] ?? 0;
    const levelInfo = xpToLevel(exp);

    return {
      rank: idx + 1,
      memberId: p.id,
      name: p.display_name,
      username: p.username,
      avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`,
      totalXP: exp,
      level: levelInfo.level,
      leagueTier: (p.league_tier as LeagueTier) || 'Bronze',
      streak: 0,
      branch: ((p.branches as any)?.name as Branch) || 'GDU PICT',
    };
  });

  // Sort by EXP descending
  entries.sort((a, b) => b.totalXP - a.totalXP);

  // Re-assign ranks after sorting
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  // For cross-branch views, compute percentile bands instead of raw ranks
  if (group === 'all' && branch === undefined) {
    const total = entries.length;
    entries.forEach((e) => {
      e.percentile = Math.ceil((e.rank / total) * 100);
    });
  }

  // Filter by group
  if (group === 'my_branch' && currentMemberId) {
    const currentMember = profiles.find((p: any) => p.id === currentMemberId);
    if (currentMember) {
      return entries.filter((e) => e.branch === (currentMember.branches as any)?.name);
    }
  }

  if (group === 'my_level' && currentMemberId) {
    const currentMember = profiles.find((p: any) => p.id === currentMemberId);
    if (currentMember) {
      const currentLevel = xpToLevel(currentMember.total_exp ?? 0).level;
      return entries.filter((e) => e.level === currentLevel);
    }
  }

  return entries;
}

export async function getSpotlightActivities(): Promise<Activity[]> {
  return getActivities();
}

export async function saveOnboarding(data: OnboardingPayload): Promise<{ success: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_complete: true,
      onboarding_data: data,
      branch_id: data.branch,
    })
    .eq('id', user.id);

  return { success: !error };
}

export async function getLandingStats(): Promise<{
  totalMembers: number;
  xpAwardedThisSeason: number;
  activeBranches: number;
}> {
  const { data: profiles } = await supabase.from('profiles').select('id');
  const { data: entries } = await supabase
    .from('ledger_entries')
    .select('amount')
    .eq('source', 'claim');

  const totalMembers = profiles?.length || 0;
  const xpAwardedThisSeason =
    entries?.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0) || 0;

  return {
    totalMembers,
    xpAwardedThisSeason,
    activeBranches: 2,
  };
}

export interface LeagueTierInfo {
  name: string;
  displayName: string;
  minExp: number;
  maxExp: number | null;
  color: string;
  sortOrder: number;
  isLocked: boolean;
}

export interface LeagueProgress {
  currentTier: LeagueTierInfo;
  nextTier: LeagueTierInfo | null;
  progressPercent: number;
  expToNext: number;
}

export async function getLeagueTiers(): Promise<LeagueTierInfo[]> {
  const { data, error } = await supabase
    .from('league_tiers')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !data) return [];

  return data.map((t: any) => ({
    name: t.name,
    displayName: t.display_name,
    minExp: t.min_exp,
    maxExp: t.max_exp,
    color: t.color,
    sortOrder: t.sort_order,
    isLocked: t.is_locked,
  }));
}

export async function getLeagueProgress(totalExp: number): Promise<LeagueProgress> {
  const tiers = await getLeagueTiers();

  // Find current tier
  const currentTier =
    tiers
      .filter((t) => !t.isLocked)
      .find((t) => totalExp >= t.minExp && (t.maxExp === null || totalExp <= t.maxExp)) ?? tiers[0];

  // Find next tier
  const currentIndex = tiers.findIndex((t) => t.name === currentTier.name);
  const nextTier =
    currentIndex >= 0 && currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;

  // Calculate progress
  let progressPercent = 0;
  let expToNext = 0;

  if (nextTier) {
    const range = nextTier.minExp - currentTier.minExp;
    const progressInRange = totalExp - currentTier.minExp;
    progressPercent = range > 0 ? Math.min(100, Math.max(0, (progressInRange / range) * 100)) : 100;
    expToNext = Math.max(0, nextTier.minExp - totalExp);
  } else {
    progressPercent = 100;
    expToNext = 0;
  }

  return { currentTier, nextTier, progressPercent, expToNext };
}

export async function assignLeagueTier(profileId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_league_tier', { p_profile_id: profileId });
  if (error) throw new Error(error.message);
}

export interface ProofFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  url: string;
  uploadedAt: string;
}

export async function uploadProof(claimId: string, files: File[]): Promise<ProofFile[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const uploaded: ProofFile[] = [];

  for (const file of files) {
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error(`File ${file.name} exceeds 2MB limit`);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} not supported`);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `claims/${claimId}/${fileName}`;

    const { data, error } = await supabase.storage.from('claim_proofs').upload(storagePath, file);

    if (error) throw new Error(error.message);

    const { data: urlData } = await supabase.storage.from('claim_proofs').getPublicUrl(storagePath);

    const { data: proofRecord, error: dbError } = await supabase
      .from('proof_files')
      .insert({
        claim_id: claimId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        url: urlData.publicUrl,
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    uploaded.push({
      id: proofRecord.id,
      fileName: proofRecord.file_name,
      fileSize: proofRecord.file_size,
      fileType: proofRecord.file_type,
      storagePath: proofRecord.storage_path,
      url: proofRecord.url,
      uploadedAt: proofRecord.uploaded_at,
    });
  }

  return uploaded;
}

export async function getProofFiles(claimId: string): Promise<ProofFile[]> {
  const { data, error } = await supabase
    .from('proof_files')
    .select('*')
    .eq('claim_id', claimId)
    .order('uploaded_at', { ascending: false });

  if (error || !data) return [];

  return data.map((p: any) => ({
    id: p.id,
    fileName: p.file_name,
    fileSize: p.file_size,
    fileType: p.file_type,
    storagePath: p.storage_path,
    url: p.url,
    uploadedAt: p.uploaded_at,
  }));
}

export async function confirmClaim(claimId: string, confirm: boolean): Promise<void> {
  const { error } = await supabase.rpc('confirm_claim', {
    p_claim_id: claimId,
    p_confirm: confirm,
  });
  if (error) throw new Error(error.message);
}

// ─── Patch D: Activity Proposals & Approvals Inbox ───────────────────────

export interface ActivityProposal {
  id: string;
  proposedBy: string;
  name: string;
  category: ExpCategory;
  subcategoryId: string | null;
  domainId: string | null;
  expMin: number;
  expMax: number;
  seasonCap: number | null;
  difficulty: ActivityDifficulty;
  evidenceRequired: boolean;
  approversNeeded: number;
  description: string | null;
  justification: string;
  status: 'proposed' | 'senior_approved' | 'admin_approved' | 'live' | 'rejected';
  seniorApprovedBy: string | null;
  seniorApprovedAt: string | null;
  adminApprovedBy: string | null;
  adminApprovedAt: string | null;
  activityTypeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalItem {
  id: string;
  itemType: string;
  itemId: string;
  title: string;
  description: string | null;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  approvedBy: string | null;
  approvedAt: string | null;
  reviewReason: string | null;
  scope: string;
  createdAt: string;
}

export async function proposeActivity(data: {
  name: string;
  category: ExpCategory;
  subcategoryId: string | null;
  domainId: string | null;
  expMin: number;
  expMax: number;
  seasonCap: number | null;
  difficulty: ActivityDifficulty;
  evidenceRequired: boolean;
  approversNeeded: number;
  description: string;
  justification: string;
}): Promise<{ proposalId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: proposalId, error } = await supabase.rpc('propose_activity', {
    p_name: data.name,
    p_category: data.category,
    p_subcategory_id: data.subcategoryId,
    p_domain_id: data.domainId,
    p_exp_min: data.expMin,
    p_exp_max: data.expMax,
    p_season_cap: data.seasonCap,
    p_difficulty: data.difficulty,
    p_evidence_required: data.evidenceRequired,
    p_approvers_needed: data.approversNeeded,
    p_description: data.description,
    p_justification: data.justification,
  });

  if (error) throw new Error(error.message);

  return { proposalId: proposalId as string };
}

export async function listActivityProposals(): Promise<ActivityProposal[]> {
  const { data, error } = await supabase.rpc('list_activity_proposals');

  if (error || !data) return [];

  return data.map((p: any) => ({
    id: p.id,
    proposedBy: p.proposed_by,
    name: p.name,
    category: p.category,
    subcategoryId: p.subcategory_id,
    domainId: p.domain_id,
    expMin: p.exp_min,
    expMax: p.exp_max,
    seasonCap: p.season_cap,
    difficulty: p.difficulty,
    evidenceRequired: p.evidence_required,
    approversNeeded: p.approvers_needed,
    description: p.description,
    justification: p.justification,
    status: p.status,
    seniorApprovedBy: p.senior_approved_by,
    seniorApprovedAt: p.senior_approved_at,
    adminApprovedBy: p.admin_approved_by,
    adminApprovedAt: p.admin_approved_at,
    activityTypeId: p.activity_type_id,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

export async function approveActivityProposal(
  proposalId: string,
  approve: boolean,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('approve_activity_proposal', {
    p_proposal_id: proposalId,
    p_approve: approve,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function getApprovalItems(): Promise<ApprovalItem[]> {
  const { data, error } = await supabase
    .from('approval_items')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((a: any) => ({
    id: a.id,
    itemType: a.item_type,
    itemId: a.item_id,
    title: a.title,
    description: a.description,
    requestedBy: a.requested_by,
    requestedAt: a.requested_at,
    status: a.status,
    approvedBy: a.approved_by,
    approvedAt: a.approved_at,
    reviewReason: a.review_reason,
    scope: a.scope,
    createdAt: a.created_at,
  }));
}

// ─── Phase 2: Badges System ──────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  slug: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string;
  color: string;
  xpReward: number;
  criteria: any;
  isActive: boolean;
  createdAt: string;
}

export interface MemberBadge {
  id: string;
  memberId: string;
  badgeId: string;
  badge: Badge;
  earnedAt: string;
}

export interface BadgeRarityConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const BADGE_RARITY_CONFIG: Record<Badge['rarity'], BadgeRarityConfig> = {
  common: {
    label: 'Common',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
  uncommon: {
    label: 'Uncommon',
    color: 'text-green-600',
    bg: 'bg-green-100',
    border: 'border-green-200',
  },
  rare: { label: 'Rare', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  epic: {
    label: 'Epic',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    border: 'border-purple-200',
  },
  legendary: {
    label: 'Legendary',
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    border: 'border-amber-200',
  },
};

export async function getBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('isActive', true)
    .order('createdAt', { ascending: true });

  if (error || !data) return [];

  return data.map((b: any) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    rarity: b.rarity,
    icon: b.icon,
    color: b.color,
    xpReward: b.xpReward,
    criteria: b.criteria,
    isActive: b.isActive,
    createdAt: b.createdAt,
  }));
}

export async function getMemberBadges(memberId?: string): Promise<MemberBadge[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const targetMemberId = memberId ?? user?.id;
  if (!targetMemberId) return [];

  const { data, error } = await supabase
    .from('member_badges')
    .select(
      `
      *,
      badges (*)
    `
    )
    .eq('memberId', targetMemberId)
    .order('earnedAt', { ascending: false });

  if (error || !data) return [];

  return data.map((mb: any) => ({
    id: mb.id,
    memberId: mb.memberId,
    badgeId: mb.badgeId,
    badge: {
      id: mb.badges.id,
      name: mb.badges.name,
      slug: mb.badges.slug,
      description: mb.badges.description,
      rarity: mb.badges.rarity,
      icon: mb.badges.icon,
      color: mb.badges.color,
      xpReward: mb.badges.xpReward,
      criteria: mb.badges.criteria,
      isActive: mb.badges.isActive,
      createdAt: mb.badges.createdAt,
    },
    earnedAt: mb.earnedAt,
  }));
}

export async function awardBadge(memberId: string, badgeId: string): Promise<void> {
  const { error } = await supabase.rpc('award_badge', {
    p_member_id: memberId,
    p_badge_id: badgeId,
  });
  if (error) throw new Error(error.message);
}

export async function checkAndAwardBadges(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('check_and_award_badges', {
    p_member_id: memberId,
  });
  if (error) throw new Error(error.message);
}

// ─── Phase 2: Quests System ──────────────────────────────────────────────

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'weekly' | 'seasonal' | 'team' | 'one_time';
  xpReward: number;
  coinReward: number;
  criteria: any;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  maxParticipants: number | null;
  createdAt: string;
}

export interface MemberQuest {
  id: string;
  memberId: string;
  questId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  startedAt: string;
  completedAt: string | null;
  claimedAt: string | null;
  quest: Quest;
}

export async function getQuests(): Promise<Quest[]> {
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('isActive', true)
    .order('type', { ascending: true })
    .order('xpReward', { ascending: false });

  if (error || !data) return [];

  return data.map((q: any) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    type: q.type,
    xpReward: q.xpReward,
    coinReward: q.coinReward,
    criteria: q.criteria,
    startsAt: q.startsAt,
    endsAt: q.endsAt,
    isActive: q.isActive,
    maxParticipants: q.maxParticipants,
    createdAt: q.createdAt,
  }));
}

export async function getMemberQuests(): Promise<MemberQuest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('member_quests')
    .select(
      `
      *,
      quests (*)
    `
    )
    .eq('memberId', user.id)
    .order('startedAt', { ascending: false });

  if (error || !data) return [];

  return data.map((mq: any) => ({
    id: mq.id,
    memberId: mq.memberId,
    questId: mq.questId,
    progress: mq.progress,
    completed: mq.completed,
    claimed: mq.claimed,
    startedAt: mq.startedAt,
    completedAt: mq.completedAt,
    claimedAt: mq.claimedAt,
    quest: {
      id: mq.quests.id,
      title: mq.quests.title,
      description: mq.quests.description,
      type: mq.quests.type,
      xpReward: mq.quests.xpReward,
      coinReward: mq.quests.coinReward,
      criteria: mq.quests.criteria,
      startsAt: mq.quests.startsAt,
      endsAt: mq.quests.endsAt,
      isActive: mq.quests.isActive,
      maxParticipants: mq.quests.maxParticipants,
      createdAt: mq.quests.createdAt,
    },
  }));
}

export async function claimQuestReward(memberQuestId: string): Promise<number> {
  const { data: xpReward, error } = await supabase.rpc('claim_quest_reward', {
    p_member_quest_id: memberQuestId,
  });
  if (error) throw new Error(error.message);
  return xpReward as number;
}

export async function getOrCreateMemberQuest(questId: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: mqId, error } = await supabase.rpc('get_or_create_member_quest', {
    p_member_id: user.id,
    p_quest_id: questId,
  });
  if (error) throw new Error(error.message);
  return mqId as string;
}

// ─── Phase 6.1: Motions + Voting ────────────────────────────────────────

export interface Motion {
  id: string;
  title: string;
  text: string;
  tier: 'ordinary' | 'serious' | 'constitutional' | 'recall';
  jurisdiction: 'org' | 'branch' | 'concurrent';
  status: 'draft' | 'open' | 'voting' | 'result' | 'closed';
  createdBy: string;
  proposerName: string;
  createdAt: string;
  openedAt: string | null;
  closedAt: string | null;
  result: string | null;
  resultDetails: any;
  attachmentUrls: string[];
  voteCount: number;
  objectionWindowDeadline: string | null;
}

export interface Ballot {
  id: string;
  motionId: string;
  voterId: string;
  vote: 'yes' | 'no' | 'abstain';
  chamber: 'board' | 'council' | 'members';
  weight: number;
  createdAt: string;
}

export interface MotionConfig {
  boardWeight: number;
  councilWeight: number;
  memberWeight: number;
  boardQuorum: number;
  councilQuorumPercent: number;
  ordinaryThreshold: number;
  seriousThreshold: number;
  constitutionalThreshold: number;
  recallThreshold: number;
  recallBoardConcurrence: number;
  shadowMode: boolean;
}

export interface MotionDiscussion {
  id: string;
  motionId: string;
  authorId: string;
  authorName: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getMotions(): Promise<Motion[]> {
  const { data, error } = await supabase
    .from('motion_summary_view')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((m: any) => ({
    id: m.id,
    title: m.title,
    text: m.text,
    tier: m.tier,
    jurisdiction: m.jurisdiction,
    status: m.status,
    createdBy: m.created_by,
    proposerName: m.proposer_name,
    createdAt: m.created_at,
    openedAt: m.opened_at,
    closedAt: m.closed_at,
    result: m.result,
    resultDetails: m.result_details,
    attachmentUrls: m.attachment_urls,
    voteCount: m.vote_count,
    objectionWindowDeadline: m.objection_window_deadline,
  }));
}

export async function getMotionById(motionId: string): Promise<Motion | null> {
  const { data, error } = await supabase
    .from('motion_summary_view')
    .select('*')
    .eq('id', motionId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    text: data.text,
    tier: data.tier,
    jurisdiction: data.jurisdiction,
    status: data.status,
    createdBy: data.created_by,
    proposerName: data.proposer_name,
    createdAt: data.created_at,
    openedAt: data.opened_at,
    closedAt: data.closed_at,
    result: data.result,
    resultDetails: data.result_details,
    attachmentUrls: data.attachment_urls,
    voteCount: data.vote_count,
    objectionWindowDeadline: data.objection_window_deadline,
  };
}

export async function createMotion(data: {
  title: string;
  text: string;
  tier: Motion['tier'];
  jurisdiction: Motion['jurisdiction'];
  attachmentUrls?: string[];
}): Promise<{ motionId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: motionId, error } = await supabase
    .from('motions')
    .insert({
      title: data.title,
      text: data.text,
      tier: data.tier,
      jurisdiction: data.jurisdiction,
      attachment_urls: data.attachmentUrls ?? [],
      created_by: user.id,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !motionId) throw new Error(error?.message || 'Failed to create motion');

  return { motionId: motionId.id };
}

export async function openMotion(motionId: string): Promise<void> {
  const { error } = await supabase
    .from('motions')
    .update({ status: 'open', opened_at: new Date().toISOString() })
    .eq('id', motionId);

  if (error) throw new Error(error.message);
}

export async function castBallot(
  motionId: string,
  vote: 'yes' | 'no' | 'abstain',
  chamber: 'board' | 'council' | 'members',
  weight: number = 1
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('ballots').insert({
    motion_id: motionId,
    voter_id: user.id,
    vote,
    chamber,
    weight,
  });

  if (error) throw new Error(error.message);
}

export async function computeMotionResult(motionId: string): Promise<any> {
  const { data: result, error } = await supabase.rpc('compute_motion_result', {
    p_motion_id: motionId,
  });
  if (error) throw new Error(error.message);
  return result;
}

export async function getMotionConfig(): Promise<MotionConfig | null> {
  const { data, error } = await supabase
    .from('motion_config')
    .select('*')
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    boardWeight: data.board_weight,
    councilWeight: data.council_weight,
    memberWeight: data.member_weight,
    boardQuorum: data.board_quorum,
    councilQuorumPercent: data.council_quorum_percent,
    ordinaryThreshold: data.ordinary_threshold,
    seriousThreshold: data.serious_threshold,
    constitutionalThreshold: data.constitutional_threshold,
    recallThreshold: data.recall_threshold,
    recallBoardConcurrence: data.recall_board_concurrence,
    shadowMode: data.shadow_mode,
  };
}

// ─── Phase 6.2: Ballots ───────────────────────────────────────

export async function getBallots(motionId: string): Promise<Ballot[]> {
  const { data, error } = await supabase
    .from('ballots')
    .select('*')
    .eq('motion_id', motionId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((b: any) => ({
    id: b.id,
    motionId: b.motion_id,
    voterId: b.voter_id,
    vote: b.vote,
    chamber: b.chamber,
    weight: b.weight,
    createdAt: b.created_at,
  }));
}

export async function getMyBallot(motionId: string): Promise<Ballot | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('ballots')
    .select('*')
    .eq('motion_id', motionId)
    .eq('voter_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    motionId: data.motion_id,
    voterId: data.voter_id,
    vote: data.vote,
    chamber: data.chamber,
    weight: data.weight,
    createdAt: data.created_at,
  };
}

// ─── Phase 6.1: Motion discussions ───────────────────────────────────────

export async function getMotionDiscussions(motionId: string): Promise<MotionDiscussion[]> {
  const { data, error } = await supabase
    .from('motion_discussions')
    .select(
      `
      *,
      profiles ( display_name as author_name )
    `
    )
    .eq('motion_id', motionId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    motionId: d.motion_id,
    authorId: d.author_id,
    authorName: d.profiles?.author_name || 'Unknown',
    body: d.body,
    parentId: d.parent_id,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export async function addMotionDiscussion(data: {
  motionId: string;
  body: string;
  parentId?: string | null;
}): Promise<{ discussionId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: discussionId, error } = await supabase
    .from('motion_discussions')
    .insert({
      motion_id: data.motionId,
      author_id: user.id,
      body: data.body,
      parent_id: data.parentId ?? null,
    })
    .select('id')
    .single();

  if (error || !discussionId) throw new Error(error?.message || 'Failed to post discussion');

  return { discussionId: discussionId.id };
}

export async function getListSchedule(): Promise<any[]> {
  const { data, error } = await supabase
    .from('list_schedule')
    .select('*')
    .eq('is_active', true)
    .order('list_name', { ascending: true });

  if (error || !data) return [];

  return data;
}

// ─── Phase 6.3: Recall and Mediation ───────────────────────────────────────

export interface RecallPetition {
  id: string;
  motionId: string;
  requiredSignatures: number;
  currentSignatures: number;
  thresholdReachedAt: string | null;
  createdAt: string;
}

export interface RecallSignature {
  id: string;
  petitionId: string;
  signerId: string;
  signedAt: string;
}

export interface RightOfReply {
  id: string;
  motionId: string;
  respondentId: string;
  replyText: string;
  submittedAt: string;
}

export interface MediationCase {
  id: string;
  motionId: string | null;
  disputedJurisdiction: string | null;
  classifiedBy: string | null;
  classification: string | null;
  deadline: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function getRecallPetition(motionId: string): Promise<RecallPetition | null> {
  const { data, error } = await supabase
    .from('recall_petitions')
    .select('*')
    .eq('motion_id', motionId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    motionId: data.motion_id,
    requiredSignatures: data.required_signatures,
    currentSignatures: data.current_signatures,
    thresholdReachedAt: data.threshold_reached_at,
    createdAt: data.created_at,
  };
}

export async function signRecallPetition(petitionId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('sign_recall_petition', {
    p_petition_id: petitionId,
    p_signer_id: user.id,
  });

  if (error) throw new Error(error.message);
}

export async function createRecallPetition(
  motionId: string,
  requiredSignatures: number
): Promise<{ petitionId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('recall_petitions')
    .insert({
      motion_id: motionId,
      required_signatures: requiredSignatures,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create petition');

  return { petitionId: data.id };
}

export async function getRightOfReply(motionId: string): Promise<RightOfReply | null> {
  const { data, error } = await supabase
    .from('right_of_reply')
    .select('*')
    .eq('motion_id', motionId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    motionId: data.motion_id,
    respondentId: data.respondent_id,
    replyText: data.reply_text,
    submittedAt: data.submitted_at,
  };
}

export async function submitRightOfReply(motionId: string, replyText: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('submit_right_of_reply', {
    p_motion_id: motionId,
    p_respondent_id: user.id,
    p_reply_text: replyText,
  });

  if (error) throw new Error(error.message);
}

export async function getMediationCases(): Promise<MediationCase[]> {
  const { data, error } = await supabase
    .from('mediation_cases')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    motionId: d.motion_id,
    disputedJurisdiction: d.disputed_jurisdiction,
    classifiedBy: d.classified_by,
    classification: d.classification,
    deadline: d.deadline,
    status: d.status,
    resolution: d.resolution,
    createdAt: d.created_at,
    resolvedAt: d.resolved_at,
  }));
}

export async function classifyJurisdiction(caseId: string, classification: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('classify_jurisdiction', {
    p_case_id: caseId,
    p_classifier_id: user.id,
    p_classification: classification,
  });

  if (error) throw new Error(error.message);
}

export async function mediateDeadlock(caseId: string, resolution: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.rpc('mediate_deadlock', {
    p_case_id: caseId,
    p_mediator_id: user.id,
    p_resolution: resolution,
  });

  if (error) throw new Error(error.message);
}

export async function createMediationCase(
  motionId: string,
  disputedJurisdiction: string
): Promise<{ caseId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 72);

  const { data, error } = await supabase
    .from('mediation_cases')
    .insert({
      motion_id: motionId,
      disputed_jurisdiction: disputedJurisdiction,
      deadline: deadline.toISOString(),
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create mediation case');

  return { caseId: data.id };
}

// ─── Phase 7.1: Branch Health ───────────────────────────────────────

export interface BranchHealthSnapshot {
  id: string;
  branchId: string;
  branchName: string;
  quarterStart: string;
  quarterEnd: string;
  activeMemberShare: number | null;
  eventsHeld: number;
  shippedOutput: number;
  retentionRate: number | null;
  expPerActiveMember: number | null;
  facultyCoordinationScore: number | null;
  healthScore: number;
  stage: 'Healthy' | 'Watch' | 'Recovery plan' | 'Board review' | 'Decision';
  shadowMode: boolean;
}

export interface BranchHealthConfig {
  id: string;
  versionLabel: string;
  effectiveFrom: string;
  floorScore: number;
  weightActiveMembers: number;
  weightEventsHeld: number;
  weightShippedOutput: number;
  weightRetention: number;
  weightExpPerMember: number;
  weightFacultyCoordination: number;
  shadowMode: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface BranchHealthHistoryPoint {
  quarterStart: string;
  quarterEnd: string;
  healthScore: number;
  stage: string;
}

export interface BranchOverrideCase {
  id: string;
  branchId: string;
  branchName: string;
  stage: 'Watch' | 'Recovery plan' | 'Board review' | 'Decision';
  triggeredAt: string;
  boardDecision: string | null;
  boardDecisionReason: string | null;
  boardDecisionAt: string | null;
  boardYesVotes: number | null;
  boardTotalVotes: number | null;
  rightOfReplyDeadline: string | null;
  appealDeadline: string | null;
  shadowMode: boolean;
  createdAt: string;
}

export interface BranchOverrideRightOfReply {
  id: string;
  overrideCaseId: string;
  respondentRole: 'branch_council' | 'faculty_coordinator' | 'college_student_council';
  respondentId: string;
  respondentName: string;
  replyText: string;
  submittedAt: string;
}

export interface BranchOverrideAppeal {
  id: string;
  overrideCaseId: string;
  appellantId: string;
  appellantName: string;
  appealReason: string;
  status: 'pending' | 'upheld' | 'overturned';
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
}

export interface BranchHealthHistoryPoint {
  quarterStart: string;
  quarterEnd: string;
  healthScore: number;
  stage: string;
}

export async function getCurrentBranchHealth(): Promise<BranchHealthSnapshot[]> {
  const { data, error } = await supabase
    .from('current_branch_health_view')
    .select('*')
    .order('branch_name', { ascending: true });

  if (error || !data) return [];

  return data.map((b: any) => ({
    id: b.id,
    branchId: b.branch_id,
    branchName: b.branch_name,
    quarterStart: b.quarter_start,
    quarterEnd: b.quarter_end,
    activeMemberShare: b.active_member_share,
    eventsHeld: b.events_held,
    shippedOutput: b.shipped_output,
    retentionRate: b.retention_rate,
    expPerActiveMember: b.exp_per_active_member,
    facultyCoordinationScore: b.faculty_coordination_score,
    healthScore: b.health_score,
    stage: b.stage,
    shadowMode: b.shadow_mode,
  }));
}

export async function getBranchHealthConfig(): Promise<BranchHealthConfig | null> {
  const { data, error } = await supabase
    .from('branch_health_config')
    .select('*')
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    versionLabel: data.version_label,
    effectiveFrom: data.effective_from,
    floorScore: data.floor_score,
    weightActiveMembers: data.weight_active_members,
    weightEventsHeld: data.weight_events_held,
    weightShippedOutput: data.weight_shipped_output,
    weightRetention: data.weight_retention,
    weightExpPerMember: data.weight_exp_per_member,
    weightFacultyCoordination: data.weight_faculty_coordination,
    shadowMode: data.shadow_mode,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function getBranchHealthHistory(
  branchId: string
): Promise<BranchHealthHistoryPoint[]> {
  const { data, error } = await supabase
    .from('branch_health_snapshots')
    .select('quarter_start, quarter_end, health_score, stage')
    .eq('branch_id', branchId)
    .order('quarter_start', { ascending: true });

  if (error || !data) return [];

  return data.map((d: any) => ({
    quarterStart: d.quarter_start,
    quarterEnd: d.quarter_end,
    healthScore: d.health_score,
    stage: d.stage,
  }));
}

export async function getBranchOverrideCases(): Promise<BranchOverrideCase[]> {
  const { data, error } = await supabase
    .from('branch_override_cases')
    .select(
      `
      *,
      branches ( display_name )
    `
    )
    .order('triggered_at', { ascending: false });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    branchId: d.branch_id,
    branchName: d.branches?.display_name || 'Unknown Branch',
    stage: d.stage,
    triggeredAt: d.triggered_at,
    boardDecision: d.board_decision,
    boardDecisionReason: d.board_decision_reason,
    boardDecisionAt: d.board_decision_at,
    boardYesVotes: d.board_yes_votes,
    boardTotalVotes: d.board_total_votes,
    rightOfReplyDeadline: d.right_of_reply_deadline,
    appealDeadline: d.appeal_deadline,
    shadowMode: d.shadow_mode,
    createdAt: d.created_at,
  }));
}

export async function getBranchOverrideRightOfReplies(
  overrideCaseId: string
): Promise<BranchOverrideRightOfReply[]> {
  const { data, error } = await supabase
    .from('branch_override_right_of_reply')
    .select(
      `
      *,
      profiles ( display_name )
    `
    )
    .eq('override_case_id', overrideCaseId)
    .order('submitted_at', { ascending: true });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    overrideCaseId: d.override_case_id,
    respondentRole: d.respondent_role,
    respondentId: d.respondent_id,
    respondentName: d.profiles?.display_name || 'Unknown',
    replyText: d.reply_text,
    submittedAt: d.submitted_at,
  }));
}

export async function submitBranchOverrideRightOfReply(
  overrideCaseId: string,
  respondentRole: 'branch_council' | 'faculty_coordinator' | 'college_student_council',
  respondentId: string,
  replyText: string
): Promise<void> {
  const { error } = await supabase.rpc('submit_branch_override_right_of_reply', {
    p_override_case_id: overrideCaseId,
    p_respondent_role: respondentRole,
    p_respondent_id: respondentId,
    p_reply_text: replyText,
  });
  if (error) throw new Error(error.message);
}

export async function fileBranchOverrideAppeal(
  overrideCaseId: string,
  appellantId: string,
  appealReason: string
): Promise<void> {
  const { error } = await supabase.rpc('file_branch_override_appeal', {
    p_override_case_id: overrideCaseId,
    p_appellant_id: appellantId,
    p_appeal_reason: appealReason,
  });
  if (error) throw new Error(error.message);
}

export async function decideBranchOverride(
  overrideCaseId: string,
  deciderId: string,
  decision: 'extend' | 'supervised_admin' | 'merge_dormant' | 'wind_down',
  decisionReason: string,
  boardYesVotes: number,
  boardTotalVotes: number
): Promise<void> {
  const { error } = await supabase.rpc('decide_branch_override', {
    p_override_case_id: overrideCaseId,
    p_decider_id: deciderId,
    p_decision: decision,
    p_decision_reason: decisionReason,
    p_board_yes_votes: boardYesVotes,
    p_board_total_votes: boardTotalVotes,
  });
  if (error) throw new Error(error.message);
}

export async function decideBranchOverrideAppeal(
  appealId: string,
  deciderId: string,
  status: 'upheld' | 'overturned',
  decisionReason: string
): Promise<void> {
  const { error } = await supabase.rpc('decide_branch_override_appeal', {
    p_appeal_id: appealId,
    p_decider_id: deciderId,
    p_status: status,
    p_decision_reason: decisionReason,
  });
  if (error) throw new Error(error.message);
}

// ─── Phase 7.2: Conduct & Probation ───────────────────────────────────────

export interface ConductCase {
  id: string;
  memberId: string;
  memberName: string;
  reasonCode: string;
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  evidenceLinks: string[];
  filedBy: string;
  filedAt: string;
  status:
    | 'notice'
    | 'response'
    | 'panel_review'
    | 'decision'
    | 'board_ratification'
    | 'appeal'
    | 'resolved';
  noticeSentAt: string | null;
  responseDeadline: string | null;
  responseSubmittedAt: string | null;
  responseText: string | null;
  panelReviewedAt: string | null;
  panelReviewedBy: string | null;
  panelDecision: string | null;
  boardRatifiedAt: string | null;
  boardRatifiedBy: string | null;
  appealDeadline: string | null;
  appealSubmittedAt: string | null;
  appealDecision: string | null;
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConductPanelMember {
  id: string;
  profileId: string;
  profileName: string;
  isRecused: boolean;
  recusedAt: string | null;
  recusalReason: string | null;
  appointedAt: string;
  createdAt: string;
}

export interface ConductCaseAppeal {
  id: string;
  conductCaseId: string;
  appellantId: string;
  appellantName: string;
  appealReason: string;
  status: 'pending' | 'upheld' | 'overturned';
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
}

export interface ProbationRecord {
  id: string;
  memberId: string;
  memberName: string;
  stage: 'healthy' | 'at_risk' | 'probation' | 'hearing' | 'decision' | 'resolved';
  reason: string | null;
  supportPlan: string | null;
  startedAt: string;
  endedAt: string | null;
  reviewedAt: string | null;
  positionStartedAt: string | null;
  gracePeriodDays: number | null;
  graceExpiresAt: string | null;
  createdAt: string;
}

export interface LeaveOfAbsence {
  id: string;
  memberId: string;
  memberName: string;
  reason: 'exams' | 'internship' | 'personal' | 'medical';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'active' | 'ended';
  approvedBy: string | null;
  isFreezeRequest: boolean;
  freezeReason: string | null;
  frozenAt: string | null;
  createdAt: string;
}

export async function getConductCases(): Promise<ConductCase[]> {
  const { data, error } = await supabase
    .from('conduct_cases')
    .select(
      `
      *,
      member:profiles!conduct_cases_member_id_fkey ( display_name ),
      filer:profiles!conduct_cases_filed_by_fkey ( display_name )
    `
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((c: any) => ({
    id: c.id,
    memberId: c.member_id,
    memberName: c.member?.display_name || 'Unknown',
    reasonCode: c.reason_code,
    severity: c.severity,
    description: c.description,
    evidenceLinks: c.evidence_links || [],
    filedBy: c.filed_by,
    filedAt: c.filed_at,
    status: c.status,
    noticeSentAt: c.notice_sent_at,
    responseDeadline: c.response_deadline,
    responseSubmittedAt: c.response_submitted_at,
    responseText: c.response_text,
    panelReviewedAt: c.panel_reviewed_at,
    panelReviewedBy: c.panel_reviewed_by,
    panelDecision: c.panel_decision,
    boardRatifiedAt: c.board_ratified_at,
    boardRatifiedBy: c.board_ratified_by,
    appealDeadline: c.appeal_deadline,
    appealSubmittedAt: c.appeal_submitted_at,
    appealDecision: c.appeal_decision,
    sensitive: c.sensitive,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

export async function fileConductCase(data: {
  memberId: string;
  reasonCode: string;
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  evidenceLinks: string[];
}): Promise<{ caseId: string }> {
  const { data: caseId, error } = await supabase.rpc('file_conduct_case', {
    p_member_id: data.memberId,
    p_reason_code: data.reasonCode,
    p_severity: data.severity,
    p_description: data.description,
    p_evidence_links: data.evidenceLinks,
  });
  if (error) throw new Error(error.message);
  return { caseId: caseId as string };
}

export async function respondToConductCase(caseId: string, responseText: string): Promise<void> {
  const { error } = await supabase.rpc('respond_to_conduct_case', {
    p_case_id: caseId,
    p_response_text: responseText,
  });
  if (error) throw new Error(error.message);
}

export async function panelReviewConductCase(
  caseId: string,
  decision: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('panel_review_conduct_case', {
    p_case_id: caseId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function boardRatifyConductCase(
  caseId: string,
  ratified: boolean,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('board_ratify_conduct_case', {
    p_case_id: caseId,
    p_ratified: ratified,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function getConductPanelMembers(): Promise<ConductPanelMember[]> {
  const { data, error } = await supabase
    .from('conduct_panel_members')
    .select(
      `
      *,
      profiles ( display_name )
    `
    )
    .order('appointed_at', { ascending: true });

  if (error || !data) return [];

  return data.map((m: any) => ({
    id: m.id,
    profileId: m.profile_id,
    profileName: m.profiles?.display_name || 'Unknown',
    isRecused: m.is_recused,
    recusedAt: m.recused_at,
    recusalReason: m.recusal_reason,
    appointedAt: m.appointed_at,
    createdAt: m.created_at,
  }));
}

export async function appointConductPanelMember(profileId: string): Promise<void> {
  const { error } = await supabase.rpc('appoint_conduct_panel_member', {
    p_profile_id: profileId,
  });
  if (error) throw new Error(error.message);
}

export async function recusePanelMember(caseId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('recuse_panel_member', {
    p_case_id: caseId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function fileConductCaseAppeal(
  conductCaseId: string,
  appellantId: string,
  appealReason: string
): Promise<void> {
  const { error } = await supabase.rpc('file_conduct_case_appeal', {
    p_conduct_case_id: conductCaseId,
    p_appellant_id: appellantId,
    p_appeal_reason: appealReason,
  });
  if (error) throw new Error(error.message);
}

export async function decideConductCaseAppeal(
  appealId: string,
  deciderId: string,
  status: 'upheld' | 'overturned',
  decisionReason: string
): Promise<void> {
  const { error } = await supabase.rpc('decide_conduct_case_appeal', {
    p_appeal_id: appealId,
    p_decider_id: deciderId,
    p_status: status,
    p_decision_reason: decisionReason,
  });
  if (error) throw new Error(error.message);
}

export async function getConductCaseAppeals(conductCaseId: string): Promise<ConductCaseAppeal[]> {
  const { data, error } = await supabase
    .from('conduct_case_appeals')
    .select(
      `
      *,
      appellant:profiles ( display_name )
    `
    )
    .eq('conduct_case_id', conductCaseId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((a: any) => ({
    id: a.id,
    conductCaseId: a.conduct_case_id,
    appellantId: a.appellant_id,
    appellantName: a.appellant?.display_name || 'Unknown',
    appealReason: a.appeal_reason,
    status: a.status,
    decidedBy: a.decided_by,
    decidedAt: a.decided_at,
    decisionReason: a.decision_reason,
    createdAt: a.created_at,
  }));
}

export async function getProbationRecords(): Promise<ProbationRecord[]> {
  const { data, error } = await supabase
    .from('probation_records')
    .select(
      `
      *,
      member:profiles!probation_records_member_id_fkey ( display_name )
    `
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((p: any) => ({
    id: p.id,
    memberId: p.member_id,
    memberName: p.member?.display_name || 'Unknown',
    stage: p.stage,
    reason: p.reason,
    supportPlan: p.support_plan,
    startedAt: p.started_at,
    endedAt: p.ended_at,
    reviewedAt: p.reviewed_at,
    positionStartedAt: p.position_started_at,
    gracePeriodDays: p.grace_period_days,
    graceExpiresAt: p.grace_expires_at,
    createdAt: p.created_at,
  }));
}

export async function getLeaveOfAbsence(): Promise<LeaveOfAbsence[]> {
  const { data, error } = await supabase
    .from('leave_of_absence')
    .select(
      `
      *,
      member:profiles!leave_of_absence_member_id_fkey ( display_name )
    `
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((l: any) => ({
    id: l.id,
    memberId: l.member_id,
    memberName: l.member?.display_name || 'Unknown',
    reason: l.reason,
    startDate: l.start_date,
    endDate: l.end_date,
    status: l.status,
    approvedBy: l.approved_by,
    isFreezeRequest: l.is_freeze_request,
    freezeReason: l.freeze_reason,
    frozenAt: l.frozen_at,
    createdAt: l.created_at,
  }));
}

export async function requestLeaveOfAbsenceFreeze(
  memberId: string,
  reason: 'exams' | 'internship' | 'personal' | 'medical',
  startDate: string,
  endDate: string,
  freezeReason: string
): Promise<void> {
  const { error } = await supabase.rpc('request_leave_of_absence_freeze', {
    p_member_id: memberId,
    p_reason: reason,
    p_start_date: startDate,
    p_end_date: endDate,
    p_freeze_reason: freezeReason,
  });
  if (error) throw new Error(error.message);
}

// ─── Phase 7.3: Feedback 360 ───────────────────────────────────────

export interface Feedback360Cycle {
  id: string;
  quarterLabel: string;
  quarterStart: string;
  quarterEnd: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface Feedback360Response {
  id: string;
  cycleId: string;
  targetId: string;
  targetName: string;
  communication: number;
  reliability: number;
  fairness: number;
  leadership: number;
  comment: string | null;
  createdAt: string;
}

export interface Feedback360Summary {
  cycleId: string;
  targetId: string;
  targetName: string;
  respondentCount: number;
  avgCommunication: number;
  avgReliability: number;
  avgFairness: number;
  avgLeadership: number;
  avgOverall: number;
  comments: string[];
}

export async function getFeedback360Cycles(): Promise<Feedback360Cycle[]> {
  const { data, error } = await supabase
    .from('feedback_360_cycles')
    .select('*')
    .order('quarter_start', { ascending: false });

  if (error || !data) return [];

  return data.map((c: any) => ({
    id: c.id,
    quarterLabel: c.quarter_label,
    quarterStart: c.quarter_start,
    quarterEnd: c.quarter_end,
    status: c.status,
    createdAt: c.created_at,
  }));
}

export async function getFeedback360Responses(cycleId: string): Promise<Feedback360Response[]> {
  const { data, error } = await supabase
    .from('feedback_360_responses')
    .select(
      `
      *,
      target:profiles!feedback_360_responses_target_id_fkey ( display_name )
    `
    )
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    cycleId: r.cycle_id,
    targetId: r.target_id,
    targetName: r.target?.display_name || 'Unknown',
    communication: r.communication,
    reliability: r.reliability,
    fairness: r.fairness,
    leadership: r.leadership,
    comment: r.comment,
    createdAt: r.created_at,
  }));
}

export async function getFeedback360Summary(cycleId: string): Promise<Feedback360Summary[]> {
  const { data, error } = await supabase
    .from('feedback_360_summary')
    .select(
      `
      *,
      target:profiles ( display_name )
    `
    )
    .eq('cycle_id', cycleId);

  if (error || !data) return [];

  return data.map((s: any) => ({
    cycleId: s.cycle_id,
    targetId: s.target_id,
    targetName: s.target?.display_name || 'Unknown',
    respondentCount: s.respondent_count,
    avgCommunication: s.avg_communication,
    avgReliability: s.avg_reliability,
    avgFairness: s.avg_fairness,
    avgLeadership: s.avg_leadership,
    avgOverall: s.avg_overall,
    comments: s.comments || [],
  }));
}

export async function submitFeedback360Response(data: {
  cycleId: string;
  targetId: string;
  communication: number;
  reliability: number;
  fairness: number;
  leadership: number;
  comment: string;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_feedback_360_response', {
    p_cycle_id: data.cycleId,
    p_target_id: data.targetId,
    p_communication: data.communication,
    p_reliability: data.reliability,
    p_fairness: data.fairness,
    p_leadership: data.leadership,
    p_comment: data.comment,
  });
  if (error) throw new Error(error.message);
}

export async function closeFeedback360Cycle(cycleId: string): Promise<void> {
  const { error } = await supabase.rpc('close_feedback_360_cycle', {
    p_cycle_id: cycleId,
  });
  if (error) throw new Error(error.message);
}

export async function getPositionHolders(): Promise<
  { id: string; displayName: string; role: string }[]
> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .in('role', ['board_member', 'council_member', 'domain_head', 'faculty', 'admin']);

  if (error || !data) return [];

  return data.map((p: any) => ({
    id: p.id,
    displayName: p.display_name,
    role: p.role,
  }));
}

// ─── Phase 8.1: Coins & Rewards ───────────────────────────────────────

export interface CoinTransaction {
  id: string;
  memberId: string;
  amount: number;
  source: 'exp_award' | 'spot_award' | 'kudos' | 'redemption' | 'adjustment';
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface RewardCatalog {
  id: string;
  name: string;
  description: string | null;
  costCoins: number;
  stock: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Redemption {
  id: string;
  memberId: string;
  rewardId: string;
  rewardName: string;
  costCoins: number;
  status: 'requested' | 'approved' | 'shipped' | 'collected' | 'rejected';
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  trackingInfo: string | null;
  createdAt: string;
}

export async function getCoinBalance(memberId: string): Promise<number> {
  const { data: balance, error } = await supabase.rpc('get_coin_balance', {
    p_member_id: memberId,
  });
  if (error) throw new Error(error.message);
  return (balance as number) ?? 0;
}

export async function getCoinTransactions(memberId: string): Promise<CoinTransaction[]> {
  const { data, error } = await supabase
    .from('coin_transactions')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((t: any) => ({
    id: t.id,
    memberId: t.member_id,
    amount: t.amount,
    source: t.source,
    referenceId: t.reference_id,
    description: t.description,
    createdAt: t.created_at,
  }));
}

export async function getRewardCatalog(): Promise<RewardCatalog[]> {
  const { data, error } = await supabase
    .from('reward_catalog')
    .select('*')
    .order('cost_coins', { ascending: true });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    costCoins: r.cost_coins,
    stock: r.stock,
    rarity: r.rarity,
    imageUrl: r.image_url,
    isActive: r.is_active,
    createdAt: r.created_at,
  }));
}

export async function getRedemptions(): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from('redemptions')
    .select(
      `
      *,
      reward:reward_catalog ( name )
    `
    )
    .order('requested_at', { ascending: false });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    memberId: r.member_id,
    rewardId: r.reward_id,
    rewardName: r.reward?.name || 'Unknown Reward',
    costCoins: r.cost_coins,
    status: r.status,
    requestedAt: r.requested_at,
    processedAt: r.processed_at,
    processedBy: r.processed_by,
    trackingInfo: r.tracking_info,
    createdAt: r.created_at,
  }));
}

export async function requestRedemption(rewardId: string): Promise<{ redemptionId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: redemptionId, error } = await supabase.rpc('request_redemption', {
    p_member_id: user.id,
    p_reward_id: rewardId,
  });
  if (error) throw new Error(error.message);
  return { redemptionId: redemptionId as string };
}

export async function processRedemption(
  redemptionId: string,
  approve: boolean,
  trackingInfo: string
): Promise<void> {
  const { error } = await supabase.rpc('process_redemption', {
    p_redemption_id: redemptionId,
    p_approve: approve,
    p_tracking_info: trackingInfo,
  });
  if (error) throw new Error(error.message);
}

export async function createReward(data: {
  name: string;
  description: string;
  costCoins: number;
  stock: number;
  rarity: RewardCatalog['rarity'];
  imageUrl: string | null;
}): Promise<{ rewardId: string }> {
  const { data: rewardId, error } = await supabase
    .from('reward_catalog')
    .insert({
      name: data.name,
      description: data.description,
      cost_coins: data.costCoins,
      stock: data.stock,
      rarity: data.rarity,
      image_url: data.imageUrl,
      is_active: true,
    })
    .select('id')
    .single();
  if (error || !rewardId) throw new Error(error?.message || 'Failed to create reward');
  return { rewardId: rewardId.id };
}

export async function updateReward(
  rewardId: string,
  data: Partial<{
    name: string;
    description: string;
    costCoins: number;
    stock: number;
    rarity: RewardCatalog['rarity'];
    imageUrl: string | null;
    isActive: boolean;
  }>
): Promise<void> {
  const update: Record<string, any> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (data.costCoins !== undefined) update.cost_coins = data.costCoins;
  if (data.stock !== undefined) update.stock = data.stock;
  if (data.rarity !== undefined) update.rarity = data.rarity;
  if (data.imageUrl !== undefined) update.image_url = data.imageUrl;
  if (data.isActive !== undefined) update.is_active = data.isActive;

  const { error } = await supabase.from('reward_catalog').update(update).eq('id', rewardId);
  if (error) throw new Error(error.message);
}

export async function deleteReward(rewardId: string): Promise<void> {
  const { error } = await supabase.from('reward_catalog').delete().eq('id', rewardId);
  if (error) throw new Error(error.message);
}

// ─── Feature Flags ───────────────────────────────────────

export const FEATURE_FLAGS = {
  cashTab: false,
};

// ─── Phase 8.3: Admin Console ───────────────────────────────

export interface AuditLogEntry {
  id: string;
  actorId?: string;
  actorName?: string;
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  createdAt?: string | null;
}

export type FeatureFlagMode = 'shadow' | 'live';

export interface FeatureFlag {
  key: string;
  mode: FeatureFlagMode;
  description?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface AdminConfigPayload {
  weights: {
    board: number;
    council: number;
    member: number;
    branch_health: Record<string, number>;
  };
  caps: Record<string, number>;
  thresholds: Record<string, number>;
  class_shares: Record<string, number>;
  quorum: Record<string, number>;
  league_sizes: Array<{
    name: string;
    displayName?: string | null;
    minExp?: number;
    maxExp?: number | null;
    color?: string | null;
    sortOrder?: number;
    isLocked?: boolean;
  }>;
}

export interface AdminConfigVersion {
  id: string;
  versionLabel: string;
  effectiveFrom: string;
  config: AdminConfigPayload | null;
  notes?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt?: string | null;
  isEffective?: boolean;
  isScheduled?: boolean;
}

export interface RoleAssignmentHistoryEntry {
  id: string;
  profileId?: string;
  profileName?: string;
  role?: string | null;
  scope?: string | null;
  scopeEntityId?: string | null;
  action?: string | null;
  reason?: string | null;
  changedBy?: string | null;
  changedAt?: string | null;
  expiresAt?: string | null;
}

export interface RoleAssignmentInfo {
  id: string;
  profileId: string;
  profileName?: string;
  role: string;
  scope: string;
  scopeEntityId?: string | null;
  isActive?: boolean;
  grantedBy?: string | null;
  grantedAt?: string | null;
  expiresAt?: string | null;
}

export async function getAuditLogs(filters?: {
  actorId?: string;
  action?: string;
  tableName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  let query = supabase
    .from('audit_log')
    .select(`*, profiles ( username, display_name )`)
    .order('created_at', { ascending: false });

  if (filters?.actorId) query = query.eq('actor_id', filters.actorId);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.tableName) query = query.eq('table_name', filters.tableName);
  if (filters?.startDate) query = query.gte('created_at', filters.startDate);
  if (filters?.endDate) query = query.lte('created_at', filters.endDate);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    actorId: row.actor_id ?? null,
    actorName: row.profiles?.display_name || row.profiles?.username || 'Unknown',
    action: row.action,
    tableName: row.table_name ?? null,
    recordId: row.record_id ?? null,
    oldValues: row.old_values ?? null,
    newValues: row.new_values ?? null,
    createdAt: row.created_at ?? null,
  }));
}

export async function getAdminConfigVersions(): Promise<AdminConfigVersion[]> {
  const { data, error } = await supabase
    .from('config_versions')
    .select(`*, profiles ( display_name )`)
    .not('config', 'is', null)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const now = new Date();
  return data.map((row) => ({
    id: row.id,
    versionLabel: row.version_label,
    effectiveFrom: row.effective_from,
    config: row.config,
    notes: row.notes ?? null,
    createdBy: row.created_by ?? null,
    createdByName: row.profiles?.display_name ?? null,
    createdAt: row.created_at ?? null,
    isEffective: new Date(row.effective_from) <= now,
    isScheduled: new Date(row.effective_from) > now,
  }));
}

export async function publishAdminConfigVersion(input: {
  versionLabel: string;
  effectiveFrom: string;
  config: AdminConfigPayload;
  notes?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('publish_admin_config_version', {
    p_version_label: input.versionLabel,
    p_effective_from: input.effectiveFrom,
    p_config: input.config as unknown as Record<string, unknown>,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('key', { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    key: row.key,
    mode: row.mode,
    description: row.description ?? null,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at ?? null,
  }));
}

export async function setFeatureFlag(input: {
  key: string;
  mode: FeatureFlagMode;
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('set_feature_flag', {
    p_key: input.key,
    p_mode: input.mode,
    p_reason: input.reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getFeatureFlagMode(key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('feature_flag_mode', { p_key: key });
  if (error || !data) return null;
  return String(data);
}

export async function getRoleAssignmentHistory(filters?: {
  profileId?: string;
  action?: string;
  limit?: number;
}): Promise<RoleAssignmentHistoryEntry[]> {
  let query = supabase
    .from('role_assignment_history')
    .select(`*, profiles ( username, display_name )`)
    .order('changed_at', { ascending: false });

  if (filters?.profileId) query = query.eq('profile_id', filters.profileId);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profiles?.display_name || row.profiles?.username || 'Unknown',
    role: row.role ?? null,
    scope: row.scope ?? null,
    scopeEntityId: row.scope_entity_id ?? null,
    action: row.action ?? null,
    reason: row.reason ?? null,
    changedBy: row.changed_by ?? null,
    changedAt: row.changed_at ?? null,
    expiresAt: row.expires_at ?? null,
  }));
}

export async function getActiveRoleAssignments(): Promise<RoleAssignmentInfo[]> {
  const { data, error } = await supabase
    .from('role_assignments')
    .select(`*, profiles ( username, display_name )`)
    .eq('is_active', true)
    .order('granted_at', { ascending: false });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profiles?.display_name || row.profiles?.username || 'Unknown',
    role: row.role,
    scope: row.scope,
    scopeEntityId: row.scope_entity_id ?? null,
    isActive: row.is_active,
    grantedBy: row.granted_by ?? null,
    grantedAt: row.granted_at ?? null,
    expiresAt: row.expires_at ?? null,
  }));
}

export async function grantRole(input: {
  profileId: string;
  role: string;
  scope: string;
  scopeEntityId?: string | null;
  expiresAt?: string | null;
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('grant_role', {
    p_profile_id: input.profileId,
    p_role: input.role,
    p_scope: input.scope,
    p_scope_entity_id: input.scopeEntityId ?? null,
    p_expires_at: input.expiresAt ?? null,
    p_reason: input.reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function revokeRole(input: {
  roleAssignmentId: string;
  reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('revoke_role', {
    p_role_assignment_id: input.roleAssignmentId,
    p_reason: input.reason ?? null,
  });
  if (error) throw new Error(error.message);
}

// ─── Phase 8.2: Finance & Compliance ───────────────────────

export interface ArticlesVersion {
  id: string;
  versionLabel: string;
  documentUrl: string;
  effectiveFrom: string;
  clause: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface MouRegister {
  id: string;
  partnerName: string;
  partnerType: 'friend' | 'partner' | 'strategic';
  mouDocumentUrl: string | null;
  startDate: string;
  endDate: string;
  expiryReminderSent: boolean;
  status: 'active' | 'expired' | 'terminated';
  createdBy: string | null;
  createdAt: string;
}

export interface FilingCalendar {
  id: string;
  filingName: string;
  filingType: string;
  dueDate: string;
  status: 'pending' | 'filed' | 'overdue' | 'waived';
  filedAt: string | null;
  filedBy: string | null;
  documentUrl: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CashRelease {
  id: string;
  preparedBy: string;
  preparedByName: string;
  approvedBy: string | null;
  recipientId: string;
  recipientName: string;
  amountCents: number;
  currency: string;
  purpose: string;
  justification: string | null;
  ledgerEntryIds: string[];
  authority: string;
  status: 'prepared' | 'approved' | 'released' | 'rejected';
  preparedAt: string;
  approvedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
}

export interface PermissionBundleHolder {
  id: string;
  bundleName: string;
  holderType: 'group' | 'person' | 'committee';
  holderId: string | null;
  holderName: string | null;
  holderGroup: string | null;
  assignedBy: string | null;
  assignedAt: string;
  effectiveFrom: string;
  motionId: string | null;
}

export async function getArticlesVersions(): Promise<ArticlesVersion[]> {
  const { data, error } = await supabase
    .from('articles_versions')
    .select('*')
    .order('effective_from', { ascending: false });

  if (error || !data) return [];

  return data.map((a: any) => ({
    id: a.id,
    versionLabel: a.version_label,
    documentUrl: a.document_url,
    effectiveFrom: a.effective_from,
    clause: a.clause,
    approvedBy: a.approved_by,
    approvedAt: a.approved_at,
    createdAt: a.created_at,
  }));
}

export async function getMouRegister(): Promise<MouRegister[]> {
  const { data, error } = await supabase
    .from('mou_register')
    .select('*')
    .order('end_date', { ascending: true });

  if (error || !data) return [];

  return data.map((m: any) => ({
    id: m.id,
    partnerName: m.partner_name,
    partnerType: m.partner_type,
    mouDocumentUrl: m.mou_document_url,
    startDate: m.start_date,
    endDate: m.end_date,
    expiryReminderSent: m.expiry_reminder_sent,
    status: m.status,
    createdBy: m.created_by,
    createdAt: m.created_at,
  }));
}

export async function getFilingCalendar(): Promise<FilingCalendar[]> {
  const { data, error } = await supabase
    .from('filing_calendar')
    .select('*')
    .order('due_date', { ascending: true });

  if (error || !data) return [];

  return data.map((f: any) => ({
    id: f.id,
    filingName: f.filing_name,
    filingType: f.filing_type,
    dueDate: f.due_date,
    status: f.status,
    filedAt: f.filed_at,
    filedBy: f.filed_by,
    documentUrl: f.document_url,
    notes: f.notes,
    createdBy: f.created_by,
    createdAt: f.created_at,
  }));
}

export async function getCashReleases(): Promise<CashRelease[]> {
  const { data, error } = await supabase
    .from('cash_releases')
    .select(
      `
      *,
      preparer:profiles!cash_releases_prepared_by_fkey ( display_name ),
      approver:profiles!cash_releases_approved_by_fkey ( display_name ),
      recipient:profiles!cash_releases_recipient_id_fkey ( display_name )
    `
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((c: any) => ({
    id: c.id,
    preparedBy: c.prepared_by,
    preparedByName: c.preparer?.display_name || 'Unknown',
    approvedBy: c.approved_by,
    recipientId: c.recipient_id,
    recipientName: c.recipient?.display_name || 'Unknown',
    amountCents: c.amount_cents,
    currency: c.currency,
    purpose: c.purpose,
    justification: c.justification,
    ledgerEntryIds: c.ledger_entry_ids || [],
    authority: c.authority,
    status: c.status,
    preparedAt: c.prepared_at,
    approvedAt: c.approved_at,
    releasedAt: c.released_at,
    createdAt: c.created_at,
  }));
}

export async function prepareCashRelease(data: {
  recipientId: string;
  amountCents: number;
  currency: string;
  purpose: string;
  justification: string;
  ledgerEntryIds: string[];
  authority: string;
}): Promise<{ releaseId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: releaseId, error } = await supabase.rpc('prepare_cash_release', {
    p_recipient_id: data.recipientId,
    p_amount_cents: data.amountCents,
    p_currency: data.currency,
    p_purpose: data.purpose,
    p_justification: data.justification,
    p_ledger_entry_ids: data.ledgerEntryIds,
    p_authority: data.authority,
  });
  if (error) throw new Error(error.message);
  return { releaseId: releaseId as string };
}

export async function approveCashRelease(releaseId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('approve_cash_release', {
    p_release_id: releaseId,
    p_approve: approve,
  });
  if (error) throw new Error(error.message);
}

export async function releaseCash(releaseId: string): Promise<void> {
  const { error } = await supabase.rpc('release_cash', {
    p_release_id: releaseId,
  });
  if (error) throw new Error(error.message);
}

export async function getPermissionBundleHolders(): Promise<PermissionBundleHolder[]> {
  const { data, error } = await supabase
    .from('permission_bundle_holders')
    .select(
      `
      *,
      holder:profiles!permission_bundle_holders_holder_id_fkey ( display_name ),
      assigner:profiles!permission_bundle_holders_assigned_by_fkey ( display_name )
    `
    )
    .order('bundle_name', { ascending: true });

  if (error || !data) return [];

  return data.map((b: any) => ({
    id: b.id,
    bundleName: b.bundle_name,
    holderType: b.holder_type,
    holderId: b.holder_id,
    holderName: b.holder?.display_name || null,
    holderGroup: b.holder_group,
    assignedBy: b.assigned_by,
    assignedAt: b.assigned_at,
    effectiveFrom: b.effective_from,
    motionId: b.motion_id,
  }));
}

export async function assignPermissionBundleHolder(data: {
  bundleName: string;
  holderType: 'group' | 'person' | 'committee';
  holderId: string | null;
  holderGroup: string | null;
  motionId: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('assign_permission_bundle_holder', {
    p_bundle_name: data.bundleName,
    p_holder_type: data.holderType,
    p_holder_id: data.holderId,
    p_holder_group: data.holderGroup,
    p_motion_id: data.motionId,
  });
  if (error) throw new Error(error.message);
}

export async function markRedemptionShipped(
  redemptionId: string,
  trackingInfo: string
): Promise<void> {
  const { error } = await supabase.rpc('update_redemption_status', {
    p_redemption_id: redemptionId,
    p_new_status: 'shipped',
    p_tracking_info: trackingInfo,
  });
  if (error) throw new Error(error.message);
}

export async function markRedemptionCollected(redemptionId: string): Promise<void> {
  const { error } = await supabase.rpc('update_redemption_status', {
    p_redemption_id: redemptionId,
    p_new_status: 'collected',
    p_tracking_info: '',
  });
  if (error) throw new Error(error.message);
}

// ─── Phase 9.2: Integrations and Import ───────────────────────

export type IntegrationProvider = 'github' | 'discord' | 'social';

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  connected: boolean;
  connectedAt?: string | null;
  connectedBy?: string | null;
  config: Record<string, unknown>;
  lastSyncAt?: string | null;
  ingestedSummary?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ImportJob {
  id: string;
  fileName: string;
  status: 'pending' | 'completed' | 'failed';
  rowCount: number;
  importedCount: number;
  errorCount: number;
  createdBy?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
}

export interface ImportRow {
  member: string;
  activity: string;
  date: string;
  exp: number;
}

export interface ImportResult {
  imported: number;
  errors: string[];
}

export interface MemberOption {
  id: string;
  username: string;
  displayName: string;
}

export async function getIntegrations(): Promise<Integration[]> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .order('provider', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    provider: row.provider,
    connected: row.connected,
    connectedAt: row.connected_at ?? null,
    connectedBy: row.connected_by ?? null,
    config: row.config ?? {},
    lastSyncAt: row.last_sync_at ?? null,
    ingestedSummary: row.ingested_summary ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }));
}

export async function toggleIntegration(
  provider: IntegrationProvider,
  connected: boolean
): Promise<void> {
  const { error } = await supabase.rpc('toggle_integration', {
    p_provider: provider,
    p_connected: connected,
  });
  if (error) throw new Error(error.message);
}

export async function getImportJobs(): Promise<ImportJob[]> {
  const { data, error } = await supabase
    .from('import_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    status: row.status,
    rowCount: row.row_count,
    importedCount: row.imported_count,
    errorCount: row.error_count,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    completedAt: row.completed_at ?? null,
  }));
}

export async function createImportJob(fileName: string): Promise<string> {
  const { data, error } = await supabase
    .from('import_jobs')
    .insert({ file_name: fileName, status: 'pending', row_count: 0 })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return String(data?.id);
}

export async function confirmImport(jobId: string, rows: ImportRow[]): Promise<ImportResult> {
  const { data, error } = await supabase.rpc('import_csv_claims', {
    p_job_id: jobId,
    p_claims: rows,
  });
  if (error) throw new Error(error.message);
  return {
    imported: Number((data as any)?.imported ?? 0),
    errors: Array.isArray((data as any)?.errors) ? (data as any).errors : [],
  };
}

export async function getMembers(): Promise<MemberOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .order('display_name', { ascending: true });

  if (error || !data) return [];

  return data.map((m) => ({
    id: m.id,
    username: m.username,
    displayName: m.display_name,
  }));
}

// ─── Phase 9.1: Partners ───────────────────────────────────────

export type PartnerTier = 'friend' | 'partner' | 'strategic';
export type PartnerStatus = 'active' | 'inactive' | 'prospect';

export interface Partner {
  id: string;
  name: string;
  tier: PartnerTier;
  description?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  logoUrl?: string | null;
  status: PartnerStatus;
  joinedAt?: string | null;
  createdAt?: string | null;
}

export interface PartnerScorecard {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  collaborations: number;
  jamsCohosted: number;
  projectsDelivered: number;
  memberFeedbackScore?: number | null;
  feedbackCount: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  updatedAt?: string | null;
}

export interface PartnerRep {
  id: string;
  profileId: string;
  profileName?: string | null;
  partnerId: string;
  partnerName?: string | null;
  role: string;
  isPrimary: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
}

export interface PartnerEvent {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  title: string;
  eventType: 'event' | 'jam';
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  isVirtual: boolean;
  status: string;
  createdAt?: string | null;
}

export interface PartnerOpportunity {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  title: string;
  opType: 'opportunity' | 'jam';
  description?: string | null;
  link?: string | null;
  status: string;
  expiresAt?: string | null;
  createdAt?: string | null;
}

export interface PartnerProject {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  title: string;
  description?: string | null;
  status: string;
  createdAt?: string | null;
}

export interface PartnerSplit {
  id: string;
  sourceType: 'claim' | 'project';
  sourceId: string;
  partnerSharePercent: number;
  memberSharePercent: number;
  status: string;
  coSignedBy?: string | null;
  coSignedAt?: string | null;
  createdAt?: string | null;
}

export interface GuestPass {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  issuedBy?: string | null;
  guestEmail: string;
  guestName: string;
  purpose?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status: string;
  usedAt?: string | null;
}

export async function getPartners(filters?: {
  tier?: PartnerTier;
  status?: PartnerStatus;
  search?: string;
}): Promise<Partner[]> {
  let query = supabase.from('partners').select('*').order('name', { ascending: true });

  if (filters?.tier) query = query.eq('tier', filters.tier);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    description: p.description ?? null,
    website: p.website ?? null,
    contactEmail: p.contact_email ?? null,
    contactName: p.contact_name ?? null,
    logoUrl: p.logo_url ?? null,
    status: p.status,
    joinedAt: p.joined_at ?? null,
    createdAt: p.created_at ?? null,
  }));
}

export async function createPartner(data: {
  name: string;
  tier: PartnerTier;
  description?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  logoUrl?: string | null;
  status?: PartnerStatus;
}): Promise<void> {
  const { error } = await supabase.from('partners').insert({
    name: data.name,
    tier: data.tier,
    description: data.description ?? null,
    website: data.website ?? null,
    contact_email: data.contactEmail ?? null,
    contact_name: data.contactName ?? null,
    logo_url: data.logoUrl ?? null,
    status: data.status ?? 'active',
  });
  if (error) throw new Error(error.message);
}

export async function getPartnerScorecards(): Promise<PartnerScorecard[]> {
  const { data, error } = await supabase
    .from('partner_scorecard')
    .select(
      `
      *,
      partners ( name )
    `
    )
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    partnerId: row.partner_id,
    partnerName: row.partners?.name ?? null,
    collaborations: row.collaborations,
    jamsCohosted: row.jams_cohosted,
    projectsDelivered: row.projects_delivered,
    memberFeedbackScore: row.member_feedback_score ?? null,
    feedbackCount: row.feedback_count,
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    updatedAt: row.updated_at ?? null,
  }));
}

export async function upsertPartnerScorecard(data: {
  partnerId: string;
  collaborations: number;
  jamsCohosted: number;
  projectsDelivered: number;
  memberFeedbackScore?: number | null;
  feedbackCount: number;
  periodStart: string;
  periodEnd: string;
}): Promise<void> {
  const { error } = await supabase.from('partner_scorecard').upsert(
    {
      partner_id: data.partnerId,
      collaborations: data.collaborations,
      jams_cohosted: data.jamsCohosted,
      projects_delivered: data.projectsDelivered,
      member_feedback_score: data.memberFeedbackScore ?? null,
      feedback_count: data.feedbackCount,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'partner_id, period_start, period_end' }
  );
  if (error) throw new Error(error.message);
}

export async function getPartnerReps(): Promise<PartnerRep[]> {
  const { data, error } = await supabase
    .from('partner_reps')
    .select(
      `*,
      profiles ( display_name ),
      partners ( name )`
    )
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profiles?.display_name ?? null,
    partnerId: row.partner_id,
    partnerName: row.partners?.name ?? null,
    role: row.role,
    isPrimary: row.is_primary,
    activeFrom: row.active_from ?? null,
    activeTo: row.active_to ?? null,
  }));
}

export async function getPartnerEvents(filters?: {
  partnerId?: string;
  status?: string;
  eventType?: 'event' | 'jam';
}): Promise<PartnerEvent[]> {
  let query = supabase
    .from('partner_events')
    .select(
      `
      *,
      partners ( name )
    `
    )
    .order('starts_at', { ascending: true });

  if (filters?.partnerId) query = query.eq('partner_id', filters.partnerId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.eventType) query = query.eq('event_type', filters.eventType);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    partnerId: row.partner_id,
    partnerName: row.partners?.name ?? null,
    title: row.title,
    eventType: row.event_type,
    description: row.description ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    location: row.location ?? null,
    isVirtual: row.is_virtual,
    status: row.status,
    createdAt: row.created_at ?? null,
  }));
}

export async function createPartnerEvent(data: {
  partnerId: string;
  title: string;
  eventType: 'event' | 'jam';
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  isVirtual?: boolean;
}): Promise<void> {
  const { error } = await supabase.from('partner_events').insert({
    partner_id: data.partnerId,
    title: data.title,
    event_type: data.eventType,
    description: data.description ?? null,
    starts_at: data.startsAt ?? null,
    ends_at: data.endsAt ?? null,
    location: data.location ?? null,
    is_virtual: data.isVirtual ?? true,
    status: 'draft',
  });
  if (error) throw new Error(error.message);
}

export async function getPartnerOpportunities(filters?: {
  partnerId?: string;
  status?: string;
}): Promise<PartnerOpportunity[]> {
  let query = supabase
    .from('partner_opportunities')
    .select(
      `
      *,
      partners ( name )
    `
    )
    .order('created_at', { ascending: false });

  if (filters?.partnerId) query = query.eq('partner_id', filters.partnerId);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    partnerId: row.partner_id,
    partnerName: row.partners?.name ?? null,
    title: row.title,
    opType: row.op_type,
    description: row.description ?? null,
    link: row.link ?? null,
    status: row.status,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
  }));
}

export async function postPartnerOpportunity(data: {
  partnerId: string;
  title: string;
  opType: 'opportunity' | 'jam';
  description?: string | null;
  link?: string | null;
  expiresAt?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('partner_opportunities').insert({
    partner_id: data.partnerId,
    title: data.title,
    op_type: data.opType,
    description: data.description ?? null,
    link: data.link ?? null,
    status: 'open',
    expires_at: data.expiresAt ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getPartnerProjects(filters?: {
  partnerId?: string;
  status?: string;
}): Promise<PartnerProject[]> {
  let query = supabase
    .from('partner_projects')
    .select(
      `
      *,
      partners ( name )
    `
    )
    .order('created_at', { ascending: false });

  if (filters?.partnerId) query = query.eq('partner_id', filters.partnerId);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    partnerId: row.partner_id,
    partnerName: row.partners?.name ?? null,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    createdAt: row.created_at ?? null,
  }));
}

export async function proposePartnerProject(data: {
  partnerId: string;
  title: string;
  description?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('partner_projects').insert({
    partner_id: data.partnerId,
    title: data.title,
    description: data.description ?? null,
    status: 'proposed',
  });
  if (error) throw new Error(error.message);
}

export async function getPartnerSplits(filters?: {
  sourceType?: 'claim' | 'project';
  sourceId?: string;
  status?: string;
}): Promise<PartnerSplit[]> {
  let query = supabase.from('partner_splits').select('*').order('created_at', { ascending: false });

  if (filters?.sourceType) query = query.eq('source_type', filters.sourceType);
  if (filters?.sourceId) query = query.eq('source_id', filters.sourceId);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    partnerSharePercent: row.partner_share_percent,
    memberSharePercent: row.member_share_percent,
    status: row.status,
    coSignedBy: row.co_signed_by ?? null,
    coSignedAt: row.co_signed_at ?? null,
    createdAt: row.created_at ?? null,
  }));
}

export async function coSignSplit(data: {
  sourceType: 'claim' | 'project';
  sourceId: string;
  partnerSharePercent: number;
  memberSharePercent: number;
}): Promise<void> {
  const { error } = await supabase.from('partner_splits').insert({
    source_type: data.sourceType,
    source_id: data.sourceId,
    partner_share_percent: data.partnerSharePercent,
    member_share_percent: data.memberSharePercent,
    status: 'co_signed',
    co_signed_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getGuestPasses(filters?: {
  partnerId?: string;
  status?: string;
}): Promise<GuestPass[]> {
  let query = supabase
    .from('guest_passes')
    .select(
      `
      *,
      partners ( name )
    `
    )
    .order('created_at', { ascending: false });

  if (filters?.partnerId) query = query.eq('partner_id', filters.partnerId);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    partnerId: row.partner_id,
    partnerName: row.partners?.name ?? null,
    issuedBy: row.issued_by ?? null,
    guestEmail: row.guest_email,
    guestName: row.guest_name,
    purpose: row.purpose ?? null,
    issuedAt: row.issued_at ?? null,
    expiresAt: row.expires_at ?? null,
    status: row.status,
    usedAt: row.used_at ?? null,
  }));
}

export async function issueGuestPass(data: {
  partnerId: string;
  guestEmail: string;
  guestName: string;
  purpose?: string | null;
  expiresAt: string;
}): Promise<void> {
  const { error } = await supabase.from('guest_passes').insert({
    partner_id: data.partnerId,
    guest_email: data.guestEmail,
    guest_name: data.guestName,
    purpose: data.purpose ?? null,
    expires_at: data.expiresAt,
    status: 'active',
  });
  if (error) throw new Error(error.message);
}

// ─── Phase 9.3: Transcript and alumni ───────────────────────

export type ExpCategoryLabel = Record<string, string>;

export const EXP_CATEGORY_LABELS: ExpCategoryLabel = {
  technology_innovation_wisdom: 'Technology & Innovation',
  motivation_initiative_learning_mindset: 'Motivation & Learning',
  social_soft_skills: 'Social & Soft Skills',
  leadership_management: 'Leadership & Management',
};

export const EXP_CATEGORY_ORDER: string[] = [
  'technology_innovation_wisdom',
  'motivation_initiative_learning_mindset',
  'social_soft_skills',
  'leadership_management',
];

export function transcriptPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: 0=Jan
  // Academic year: July-June. If month >= July (6), academic year starts this July.
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${endYear} Academic Year`;
}

export interface TranscriptCategoryTotal {
  category: string;
  label: string;
  totalXP: number;
  count: number;
}

export interface TranscriptContribution {
  id: string;
  activityTitle: string;
  activityDomain: ActivityDomain;
  category: string;
  xpCredited: number;
  submittedAt: string;
  status: ClaimStatus;
}

export interface TranscriptData {
  member: Member & {
    isAlumni: boolean;
    alumniBadge?: string | null;
    transcriptCode?: string | null;
    transcriptGeneratedAt?: string | null;
  };
  period: string;
  totalXP: number;
  categoryTotals: TranscriptCategoryTotal[];
  keyContributions: TranscriptContribution[];
  verificationCode?: string | null;
}

export interface TranscriptVerification {
  valid: boolean;
  memberId?: string;
  name?: string;
  username?: string;
  branch?: string;
  domain?: string;
  totalExp?: number;
  level?: number;
  leagueTier?: string;
  alumniBadge?: string | null;
  transcriptGeneratedAt?: string | null;
  error?: string;
}

export async function toggleAlumniMode(): Promise<string> {
  const { data, error } = await supabase.rpc('toggle_alumni_mode');
  if (error) throw new Error(error.message);
  return String(data);
}

export async function getTranscript(): Promise<TranscriptData> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  // Member profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      `
      *,
      branches ( name ),
      domains ( name )
    `
    )
    .eq('id', user.id)
    .single();
  if (profileError || !profile) throw new Error('Profile not found');

  const levelInfo = xpToLevel(profile.total_exp ?? 0);

  // Category totals from ledger entries (approved claims)
  const { data: ledgerRows, error: ledgerError } = await supabase
    .from('ledger_entries')
    .select('category, amount')
    .eq('member_id', user.id)
    .eq('source', 'claim');
  if (ledgerError) throw new Error(ledgerError.message);

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const row of ledgerRows ?? []) {
    const cat = row.category as string;
    const cur = categoryMap.get(cat) || { total: 0, count: 0 };
    categoryMap.set(cat, { total: cur.total + (row.amount ?? 0), count: cur.count + 1 });
  }
  const categoryTotals: TranscriptCategoryTotal[] = EXP_CATEGORY_ORDER.map((cat) => {
    const cur = categoryMap.get(cat);
    return {
      category: cat,
      label: EXP_CATEGORY_LABELS[cat],
      totalXP: cur ? cur.total : 0,
      count: cur ? cur.count : 0,
    };
  });

  // Key contributions: top approved claims
  const { data: claimRows, error: claimError } = await supabase
    .from('claims')
    .select(
      `
      id, title, activity_domain, xp_credited, suggested_exp, submitted_at, status,
      activity_types ( name, category )
    `
    )
    .eq('claimant_id', user.id)
    .eq('status', 'approved')
    .order('reviewed_score', { ascending: false })
    .limit(10);
  if (claimError) throw new Error(claimError.message);

  const keyContributions: TranscriptContribution[] = (claimRows ?? []).map((c: any) => ({
    id: c.id,
    activityTitle: c.title,
    activityDomain: c.activity_domain,
    category: c.activity_types?.category ?? 'technical_innovation_wisdom',
    xpCredited: c.xp_credited ?? c.suggested_exp,
    submittedAt: c.submitted_at,
    status: c.status,
  }));

  const totalXP = categoryTotals.reduce((s, c) => s + c.totalXP, 0);

  return {
    member: {
      ...profile,
      isAlumni: profile.is_alumni ?? false,
      alumniBadge: profile.alumni_badge ?? null,
      transcriptCode: profile.transcript_code ?? null,
      transcriptGeneratedAt: profile.transcript_generated_at ?? null,
    } as Member & {
      isAlumni: boolean;
      alumniBadge?: string | null;
      transcriptCode?: string | null;
      transcriptGeneratedAt?: string | null;
    },
    period: transcriptPeriod(),
    totalXP,
    categoryTotals,
    keyContributions,
    verificationCode: profile.transcript_code ?? null,
  };
}

export async function verifyTranscript(code: string): Promise<TranscriptVerification> {
  const { data, error } = await supabase.rpc('verify_transcript', { p_code: code });
  if (error) throw new Error(error.message);
  return data as TranscriptVerification;
}
