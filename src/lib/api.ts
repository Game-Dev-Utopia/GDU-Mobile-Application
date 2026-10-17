// Backend integration point — Supabase-powered API calls

import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export type Branch = 'PICT' | 'IIITK'

export type LeagueTier = 'Obsidian' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'

export type ActivityDomain =
  | 'Game Dev' | 'Design' | 'Content' | 'AI' | 'Web/DevOps' | 'R&D' | 'Marketing' | 'Ops'

export type ActivityDifficulty = 1 | 2 | 3 | 4 | 5

export type ActivityStatus = 'open' | 'claimed' | 'closed' | 'upcoming'

export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected'

export type ViewAsRole =
  | 'member' | 'domain_head' | 'branch_president' | 'board' | 'faculty' | 'admin'

export type ExpCategory =
  | 'technology_innovation_wisdom'
  | 'motivation_initiative_learning_mindset'
  | 'social_soft_skills'
  | 'leadership_management'

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
  domain: ActivityDomain;
  expMin: number;
  expMax: number;
  seasonCap: number | null;
  difficulty: ActivityDifficulty;
  evidenceRequired: boolean;
  approversNeeded: number;
  isActive: boolean;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  domain: ActivityDomain;
  difficulty: ActivityDifficulty;
  xpReward: number;
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
  notes: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  feedback?: string;
  xpCredited?: number;
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

function mapProfileToMember(profile: any): Member {
  return {
    id: profile.id,
    name: profile.display_name || profile.username,
    username: profile.username,
    avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`,
    branch: (profile.branch_id as Branch) || 'PICT',
    domain: (profile.domain_id as ActivityDomain) || 'Game Dev',
    totalXP: profile.total_exp ?? 0,
    level: profile.level ?? 1,
    levelName: `Level ${profile.level ?? 1}`,
    xpInLevel: 0,
    xpToNextLevel: 0,
    streak: 0,
    leagueTier: (profile.league_tier as LeagueTier) || 'Obsidian',
    leagueRank: 0,
    branchRank: 0,
    globalRank: 0,
    pendingClaims: 0,
    joinedAt: profile.created_at,
    role: (profile.role as ViewAsRole) || 'member',
  }
}

// ─── API Functions ─────────────────────────────────────────────────────

export async function getCurrentMember(): Promise<Member> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) throw new Error('Profile not found')

  const levelInfo = xpToLevel(profile.total_exp ?? 0)

  return {
    ...mapProfileToMember(profile),
    level: levelInfo.level,
    xpInLevel: levelInfo.xpInLevel,
    xpToNextLevel: levelInfo.xpToNextLevel,
  }
}

// ─── Level Calculation (Quadratic Curve) ─────────────────────────────────
// Cumulative EXP for level L = 50 × L × (L-1)
// Level 1: 0, Level 2: 100, Level 5: 1,000, Level 10: 4,500,
// Level 20: 19,000, Level 50: 122,500
// Early levels are fast (motivation), later levels get harder (retention)

export interface LevelInfo {
  level: number
  xpInLevel: number
  xpToNextLevel: number
  progressPercent: number
}

export function xpToLevel(totalXP: number): LevelInfo {
  // Solve 50 * L * (L-1) <= totalXP for L
  // L = floor((1 + sqrt(1 + 8 * totalXP / 100)) / 2)
  const discriminant = 1 + 8 * totalXP / 100
  const level = Math.floor((1 + Math.sqrt(Math.max(0, discriminant))) / 2)
  const cumulativeAtLevel = 50 * level * (level - 1)
  const cumulativeAtNextLevel = 50 * (level + 1) * level
  const xpInLevel = totalXP - cumulativeAtLevel
  const xpToNextLevel = cumulativeAtNextLevel - cumulativeAtLevel
  const progressPercent =
    xpToNextLevel > 0 ? Math.min(100, Math.max(0, (xpInLevel / xpToNextLevel) * 100)) : 100
  return { level, xpInLevel, xpToNextLevel, progressPercent }
}

export function levelToXP(level: number): number {
  return 50 * level * (level - 1)
}

// ─── Seed Data: Activity Type EXP Ranges ─────────────────────────────────
// Based on analysis of student community activity patterns:
// - Active student: 2-5 activities/week, ~30-75/semester
// - Average EXP per activity: ~75 (midpoint of 25-150 rubric)
// - Level 10 reachable in ~1-2 active semesters (~4,500 EXP)
// - Season caps prevent spam; low-effort activities have higher caps

export const SEED_ACTIVITY_TYPES: Array<{
  name: string
  category: ExpCategory
  domain: ActivityDomain
  expMin: number
  expMax: number
  seasonCap: number | null
  difficulty: ActivityDifficulty
  evidenceRequired: boolean
  approversNeeded: number
  description: string
  submissionFormat: string
  requirements: string[]
  tags: string[]
  postedBy: string
}> = [
  // TECHNOLOGY, INNOVATION & WISDOM
  {
    name: 'Game Jam Participation',
    category: 'technology_innovation_wisdom',
    domain: 'Game Dev',
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
    category: 'technology_innovation_wisdom',
    domain: 'Game Dev',
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
    category: 'technology_innovation_wisdom',
    domain: 'Web/DevOps',
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
    category: 'technology_innovation_wisdom',
    domain: 'AI',
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
    category: 'technology_innovation_wisdom',
    domain: 'Web/DevOps',
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
    category: 'motivation_initiative_learning_mindset',
    domain: 'Content',
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
    category: 'motivation_initiative_learning_mindset',
    domain: 'Ops',
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
    category: 'motivation_initiative_learning_mindset',
    domain: 'Ops',
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
    category: 'motivation_initiative_learning_mindset',
    domain: 'Content',
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
    category: 'social_soft_skills',
    domain: 'Ops',
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
    category: 'social_soft_skills',
    domain: 'Ops',
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
    category: 'social_soft_skills',
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
    category: 'social_soft_skills',
    domain: 'Ops',
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
    category: 'leadership_management',
    domain: 'Ops',
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
    category: 'leadership_management',
    domain: 'Game Dev',
    expMin: 100,
    expMax: 300,
    seasonCap: 2,
    difficulty: 5,
    evidenceRequired: true,
    approversNeeded: 2,
    description: 'Lead a project team. Responsibility, delivery, and team satisfaction determine EXP.',
    submissionFormat: 'Project link + team feedback',
    requirements: ['Min 3 team members', 'Shipped milestone', 'Team retrospective'],
    tags: ['leadership', 'project-management', 'team-lead'],
    postedBy: 'Board',
  },
  {
    name: 'Sponsorship Brought',
    category: 'leadership_management',
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
    category: 'leadership_management',
    domain: 'R&D',
    expMin: 30,
    expMax: 100,
    seasonCap: 6,
    difficulty: 3,
    evidenceRequired: true,
    approversNeeded: 1,
    description: 'Serve on an interview panel for new members or positions. Fairness and thoroughness matter.',
    submissionFormat: 'Interview feedback form + panel confirmation',
    requirements: ['Min 2 interviews', 'Completed feedback forms'],
    tags: ['interview', 'evaluation', 'panel'],
    postedBy: 'Board',
  },
]

// ─── API Functions ─────────────────────────────────────────────────────

export async function getActivities(filters?: {
  domain?: ActivityDomain;
  status?: ActivityStatus;
  difficulty?: ActivityDifficulty;
  branch?: Branch | 'all';
  search?: string;
}): Promise<Activity[]> {
  const { data: { user } } = await supabase.auth.getUser()

  // Get activity types from Supabase with real EXP ranges and season caps
  const { data: activityTypes, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('is_active', true)

  if (error || !activityTypes) {
    // Fallback to mock seed data if DB not yet seeded
    return seedActivitiesToActivity(filters)
  }

  // Get current season window (rolling 90 days, matching Standing window)
  const seasonStart = new Date()
  seasonStart.setDate(seasonStart.getDate() - 90)

  // Count user's approved/submitted claims per activity type in current season
  let claimsCount: Record<string, number> = {}
  if (user) {
    const { data: claims } = await supabase
      .from('claims')
      .select('activity_type_id, status')
      .eq('claimant_id', user.id)
      .gte('created_at', seasonStart.toISOString())

    if (claims) {
      for (const claim of claims) {
        if (claim.status === 'approved' || claim.status === 'submitted') {
          claimsCount[claim.activity_type_id] = (claimsCount[claim.activity_type_id] || 0) + 1
        }
      }
    }
  }

  const activities: Activity[] = activityTypes.map((at: any) => {
    const used = claimsCount[at.id] || 0
    const remainingCap = at.season_cap ? Math.max(0, at.season_cap - used) : null
    const xpReward = Math.floor((at.exp_min + at.exp_max) / 2) // midpoint as suggested XP

    return {
      id: at.id,
      title: at.name,
      description: at.description || `${at.category} activity`,
      domain: at.domain_id as ActivityDomain,
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
    }
  })

  // Apply filters
  let results = activities
  if (filters?.domain) results = results.filter((a) => a.domain === filters.domain)
  if (filters?.status) results = results.filter((a) => a.status === filters.status)
  if (filters?.difficulty) results = results.filter((a) => a.difficulty === filters.difficulty)
  if (filters?.branch && filters.branch !== 'all')
    results = results.filter((a) => a.branch === filters.branch || a.branch === 'all')
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    results = results.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
    )
  }
  return results
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
      description: 'Lead a team of 3–5 members through the 48-hour Global Game Jam. Submit a playable build with a devlog.',
      domain: 'Game Dev',
      difficulty: 5,
      xpReward: 500,
      bonusXP: 100,
      status: 'open',
      deadline: '2026-10-15T23:59:00Z',
      submissionFormat: 'itch.io link + devlog PDF',
      requirements: ['Minimum team of 3 members', 'All members must be GDU registered', 'Playable web build required', 'Devlog min 500 words'],
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
      description: 'Create a character sheet with idle, walk, and attack animations. Min 32×32px sprite, 4-directional.',
      domain: 'Design',
      difficulty: 3,
      xpReward: 200,
      status: 'open',
      deadline: '2026-10-10T23:59:00Z',
      submissionFormat: 'PNG sprite sheet + GIF preview',
      requirements: ['Min 32×32px per frame', '4-directional movement', 'At least 3 animation states'],
      tags: ['pixel-art', 'animation', 'character'],
      claimedCount: 14,
      branch: 'all',
      postedBy: 'Kavya Sharma',
      postedAt: '2026-09-25T10:00:00Z',
    },
    {
      id: 'act-003',
      title: 'Unity Shader Workshop Recap',
      description: 'Write a structured recap of the Unity Shader workshop including code snippets, screenshots, and key takeaways.',
      domain: 'Content',
      difficulty: 2,
      xpReward: 150,
      status: 'open',
      deadline: '2026-10-07T23:59:00Z',
      submissionFormat: 'Google Doc link (public view)',
      requirements: ['Min 800 words', 'At least 3 code snippets', '2+ screenshots from workshop'],
      tags: ['workshop', 'unity', 'writing'],
      claimedCount: 5,
      maxClaims: 8,
      branch: 'PICT',
      postedBy: 'Rahul Desai',
      postedAt: '2026-09-27T09:00:00Z',
    },
    {
      id: 'act-004',
      title: 'Game Audio SFX Pack — Horror Theme',
      description: 'Produce a minimum of 10 original SFX for a horror-themed game. Must be royalty-free and CC0 licensed.',
      domain: 'Design',
      difficulty: 4,
      xpReward: 300,
      bonusXP: 50,
      status: 'open',
      deadline: '2026-10-12T23:59:00Z',
      submissionFormat: 'ZIP file via Google Drive',
      requirements: ['Min 10 SFX files', 'WAV or OGG format', 'CC0 license declaration', 'Naming convention: sfx_[name]_v1'],
      tags: ['audio', 'sfx', 'horror', 'cc0'],
      claimedCount: 3,
      branch: 'all',
      postedBy: 'Priya Nair',
      postedAt: '2026-09-26T11:00:00Z',
    },
    {
      id: 'act-005',
      title: 'Social Media Campaign — GDU Monthly Digest',
      description: 'Design and post 4 Instagram stories + 1 carousel post for the GDU Monthly Digest. Use provided brand kit.',
      domain: 'Marketing',
      difficulty: 2,
      xpReward: 120,
      status: 'open',
      deadline: '2026-10-05T23:59:00Z',
      submissionFormat: 'Screenshot of live posts + Canva file link',
      requirements: ['4 Instagram stories', '1 carousel post (min 5 slides)', 'Use GDU brand kit', 'Tag @gamedevutopia'],
      tags: ['social-media', 'design', 'marketing'],
      claimedCount: 2,
      maxClaims: 3,
      branch: 'IIITK',
      postedBy: 'Sneha Kulkarni',
      postedAt: '2026-09-29T14:00:00Z',
    },
  ];

  let results = [...MOCK_ACTIVITIES]
  if (filters?.domain) results = results.filter((a) => a.domain === filters.domain)
  if (filters?.status) results = results.filter((a) => a.status === filters.status)
  if (filters?.difficulty) results = results.filter((a) => a.difficulty === filters.difficulty)
  if (filters?.branch && filters.branch !== 'all')
    results = results.filter((a) => a.branch === filters.branch || a.branch === 'all')
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    results = results.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
    )
  }
  return Promise.resolve(results)
}

export async function getWeeklyXP(): Promise<WeeklyXPPoint[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const now = new Date()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const result: WeeklyXPPoint[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const start = d.toISOString()
    d.setDate(d.getDate() + 1)
    const end = d.toISOString()

    const { data: entries } = await supabase
      .from('ledger_entries')
      .select('amount, created_at')
      .eq('member_id', user.id)
      .gte('created_at', start)
      .lt('created_at', end)
      .eq('source', 'claim')

    const xp = entries?.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0) || 0
    const activities = entries?.length || 0

    result.push({
      day: days[d.getDay()],
      xp,
      activities,
    })
  }

  return result
}

export async function getRecentTransactions(limit = 5): Promise<XPTransaction[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: entries, error } = await supabase
    .from('ledger_entries')
    .select(`
      *,
      claims (
        id,
        title,
        activity_type_id,
        activity_types ( name, domain_id )
      )
    `)
    .eq('member_id', user.id)
    .eq('source', 'claim')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !entries) return []

  return entries.map((e: any) => ({
    id: e.id,
    activityId: e.claims?.id || 'unknown',
    activityName: e.claims?.title || 'Unknown Activity',
    domain: 'Game Dev',
    xpEarned: e.amount > 0 ? e.amount : 0,
    timestamp: e.created_at,
    claimId: e.claim_id || '',
  }))
}

export async function getActivityTypes(): Promise<ActivityType[]> {
  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('is_active', true)

  if (error || !data) return []

  return data.map((a: any) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    domain: a.domain_id as ActivityDomain,
    expMin: a.exp_min,
    expMax: a.exp_max,
    seasonCap: a.season_cap,
    difficulty: a.difficulty,
    evidenceRequired: a.evidence_required,
    approversNeeded: a.approvers_needed,
    isActive: a.is_active,
  }))
}

export async function getActivityById(id: string): Promise<ActivityType | null> {
  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    domain: data.domain_id as ActivityDomain,
    expMin: data.exp_min,
    expMax: data.exp_max,
    seasonCap: data.season_cap,
    difficulty: data.difficulty,
    evidenceRequired: data.evidence_required,
    approversNeeded: data.approvers_needed,
    isActive: data.is_active,
  }
}

export async function getMyClaims(): Promise<Claim[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: claims, error } = await supabase
    .from('claims')
    .select(`
      *,
      activity_types ( name, domain_id ),
      profiles!claims_reviewer_id_fkey ( display_name )
    `)
    .eq('claimant_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !claims) return []

  return claims.map((c: any) => ({
    id: c.id,
    activityId: c.activity_type_id,
    activityTitle: c.title,
    activityDomain: c.activity_types?.domain_id as ActivityDomain || 'Game Dev',
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
  }))
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
}): Promise<{ claimId: string; status: ClaimStatus }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const contributorsJson = data.contributors.map(c => ({
    member_id: c.memberId,
    share_percent: c.sharePercent,
  }))

  const { data: claimId, error } = await supabase.rpc('submit_claim', {
    p_activity_type_id: data.activityTypeId,
    p_title: data.title,
    p_description: data.description,
    p_activity_date: data.activityDate,
    p_evidence_links: data.evidenceLinks,
    p_suggested_exp: data.suggestedExp,
    p_analysis_pointers: data.analysisPointers,
    p_contributors: contributorsJson,
  })

  if (error) throw new Error(error.message)

  return { claimId: claimId as string, status: 'submitted' }
}

export async function reviewClaim(claimId: string, score: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('review_claim', {
    p_claim_id: claimId,
    p_score: score,
    p_reason: reason,
  })

  if (error) throw new Error(error.message)
}

export async function getReviewQueue(): Promise<Claim[]> {
  const { data: claims, error } = await supabase.rpc('list_my_review_queue')

  if (error || !claims) return []

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
  }))
}

export async function finalizeClaim(claimId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_claim', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((a: any) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    type: a.type as Announcement['type'],
    createdAt: a.created_at,
  }))
}

export async function getLeaderboard(branch?: Branch): Promise<LeaderboardEntry[]> {
  let query = supabase
    .from('season_leaderboard_view')
    .select('*')

  if (branch) {
    query = query.eq('branch_id', branch)
  }

  const { data, error } = await query.order('season_exp', { ascending: false })

  if (error || !data) return []

  return data.map((entry: any, idx: number) => ({
    rank: idx + 1,
    memberId: entry.member_id,
    name: entry.display_name,
    username: entry.username,
    avatar: entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`,
    totalXP: entry.season_exp ?? 0,
    level: 1,
    leagueTier: (entry.league_tier as LeagueTier) || 'Obsidian',
    streak: 0,
    branch: (entry.branch_id as Branch) || 'PICT',
  }))
}

export async function getSpotlightActivities(): Promise<Activity[]> {
  return getActivities()
}

export async function saveOnboarding(data: OnboardingPayload): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_complete: true,
      onboarding_data: data,
      branch_id: data.branch,
    })
    .eq('id', user.id)

  return { success: !error }
}

export async function getLandingStats(): Promise<{
  totalMembers: number;
  xpAwardedThisSeason: number;
  activeBranches: number;
}> {
  const { data: profiles } = await supabase.from('profiles').select('id')
  const { data: entries } = await supabase
    .from('ledger_entries')
    .select('amount')
    .eq('source', 'claim')

  const totalMembers = profiles?.length || 0
  const xpAwardedThisSeason = entries?.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0) || 0

  return {
    totalMembers,
    xpAwardedThisSeason,
    activeBranches: 2,
  }
}
