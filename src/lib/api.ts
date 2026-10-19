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
