// Backend integration point — replace all mock returns with real API calls

export type Branch = 'PICT' | 'IIITK';

export type LeagueTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export type ActivityDomain =
  | 'Programming' |'Art' |'Design' |'Audio' |'Writing' |'Marketing' |'Management';

export type ActivityDifficulty = 1 | 2 | 3 | 4 | 5;

export type ActivityStatus = 'open' | 'claimed' | 'closed' | 'upcoming';

export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export type ViewAsRole =
  | 'member' |'domain_head' |'branch_president' |'board' |'faculty' |'admin';

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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_MEMBER: Member = {
  id: 'member-001',
  name: 'Aryan Mehta',
  username: 'aryan.mehta',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aryan',
  branch: 'PICT',
  domain: 'Programming',
  totalXP: 4820,
  level: 8,
  levelName: 'Pixel Knight',
  xpInLevel: 320,
  xpToNextLevel: 600,
  streak: 12,
  leagueTier: 'Gold',
  leagueRank: 4,
  branchRank: 11,
  globalRank: 34,
  pendingClaims: 3,
  joinedAt: '2026-01-15',
  role: 'member',
};

const MOCK_WEEKLY_XP: WeeklyXPPoint[] = [
  { day: 'Mon', xp: 0, activities: 0 },
  { day: 'Tue', xp: 150, activities: 2 },
  { day: 'Wed', xp: 80, activities: 1 },
  { day: 'Thu', xp: 220, activities: 3 },
  { day: 'Fri', xp: 60, activities: 1 },
  { day: 'Sat', xp: 310, activities: 4 },
  { day: 'Sun', xp: 180, activities: 2 },
];

const MOCK_TRANSACTIONS: XPTransaction[] = [
  {
    id: 'txn-001',
    activityId: 'act-003',
    activityName: 'Unity Shader Workshop Recap',
    domain: 'Programming',
    xpEarned: 150,
    timestamp: '2026-10-03T10:22:00Z',
    claimId: 'claim-009',
  },
  {
    id: 'txn-002',
    activityId: 'act-007',
    activityName: 'Concept Art Submission — Sci-Fi City',
    domain: 'Art',
    xpEarned: 200,
    timestamp: '2026-10-02T16:45:00Z',
    claimId: 'claim-010',
  },
  {
    id: 'txn-003',
    activityId: 'act-011',
    activityName: 'Blog Post: Pathfinding Algorithms',
    domain: 'Writing',
    xpEarned: 100,
    timestamp: '2026-10-01T09:10:00Z',
    claimId: 'claim-011',
  },
  {
    id: 'txn-004',
    activityId: 'act-002',
    activityName: 'Community Discord Moderation',
    domain: 'Management',
    xpEarned: 80,
    timestamp: '2026-09-30T14:30:00Z',
    claimId: 'claim-012',
  },
  {
    id: 'txn-005',
    activityId: 'act-015',
    activityName: 'UI Sound Design Pack',
    domain: 'Audio',
    xpEarned: 250,
    timestamp: '2026-09-29T11:55:00Z',
    claimId: 'claim-013',
  },
];

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'act-001',
    title: 'Global Game Jam 2026 — Team Lead',
    description:
      'Lead a team of 3–5 members through the 48-hour Global Game Jam. Submit a playable build with a devlog.',
    domain: 'Management',
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
    domain: 'Art',
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
    domain: 'Writing',
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
    description:
      'Produce a minimum of 10 original SFX for a horror-themed game. Must be royalty-free and CC0 licensed.',
    domain: 'Audio',
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
    branch: 'IIITK',
    postedBy: 'Sneha Kulkarni',
    postedAt: '2026-09-29T14:00:00Z',
  },
  {
    id: 'act-006',
    title: 'Procedural Level Generation — Code Challenge',
    description:
      'Implement a procedural dungeon generator in Unity or Godot. Submit source code + a demo GIF.',
    domain: 'Programming',
    difficulty: 4,
    xpReward: 350,
    bonusXP: 75,
    status: 'open',
    deadline: '2026-10-18T23:59:00Z',
    submissionFormat: 'GitHub repo link + GIF demo',
    requirements: [
      'Working generator (room + corridor)',
      'Seed-based reproducibility',
      'Min 10×10 dungeon size',
      'GitHub repo public',
    ],
    tags: ['programming', 'procedural', 'unity', 'godot'],
    claimedCount: 9,
    branch: 'all',
    postedBy: 'Aditya Joshi',
    postedAt: '2026-09-24T08:30:00Z',
  },
  {
    id: 'act-007',
    title: 'UI/UX Design — Game HUD Concept',
    description:
      'Design a complete HUD for a sci-fi RPG including health, minimap, inventory, and dialogue system.',
    domain: 'Design',
    difficulty: 3,
    xpReward: 220,
    status: 'claimed',
    deadline: '2026-10-09T23:59:00Z',
    submissionFormat: 'Figma file (view access) + PDF export',
    requirements: [
      'Health + stamina bars',
      'Minimap component',
      'Inventory grid',
      'Dialogue box with portrait',
    ],
    tags: ['ui-ux', 'hud', 'figma', 'sci-fi'],
    claimedCount: 11,
    branch: 'all',
    postedBy: 'Kavya Sharma',
    postedAt: '2026-09-22T10:00:00Z',
  },
  {
    id: 'act-008',
    title: 'Intro to Godot Workshop — Volunteer Facilitator',
    description:
      'Facilitate the Intro to Godot workshop for new members. Prepare slides, demo project, and Q&A guide.',
    domain: 'Management',
    difficulty: 3,
    xpReward: 280,
    status: 'open',
    deadline: '2026-10-20T23:59:00Z',
    submissionFormat: 'Slides link + attendance sheet',
    requirements: [
      'Slide deck (min 15 slides)',
      'Working Godot demo project',
      'Attendance of min 10 members',
    ],
    tags: ['workshop', 'godot', 'teaching'],
    claimedCount: 1,
    maxClaims: 2,
    branch: 'IIITK',
    postedBy: 'Rahul Desai',
    postedAt: '2026-09-30T09:00:00Z',
  },
  {
    id: 'act-009',
    title: 'Environment Concept Art — Fantasy Biome',
    description:
      'Create a full-spread environment concept for a fantasy biome of your choice. Painted or digital medium.',
    domain: 'Art',
    difficulty: 4,
    xpReward: 280,
    bonusXP: 60,
    status: 'open',
    deadline: '2026-10-14T23:59:00Z',
    submissionFormat: 'High-res PNG (min 1920×1080) via Google Drive',
    requirements: [
      'Original artwork only',
      'Min 1920×1080 resolution',
      'Include brief artist statement',
    ],
    tags: ['concept-art', 'environment', 'fantasy'],
    claimedCount: 6,
    branch: 'all',
    postedBy: 'Meera Pillai',
    postedAt: '2026-09-23T12:00:00Z',
  },
  {
    id: 'act-010',
    title: 'Multiplayer Netcode Writeup',
    description:
      'Write a technical article comparing rollback vs lockstep netcode for fighting games. Include code examples.',
    domain: 'Writing',
    difficulty: 3,
    xpReward: 180,
    status: 'closed',
    deadline: '2026-09-30T23:59:00Z',
    submissionFormat: 'Medium/Dev.to article link',
    requirements: ['Min 1200 words', 'Code examples in at least one language', 'Citations required'],
    tags: ['writing', 'networking', 'technical'],
    claimedCount: 4,
    branch: 'PICT',
    postedBy: 'Aditya Joshi',
    postedAt: '2026-09-15T08:00:00Z',
  },
  {
    id: 'act-011',
    title: 'Game Jam Sponsor Outreach',
    description:
      'Contact 5 potential sponsors for the upcoming GDU Game Jam. Prepare pitch deck and follow-up emails.',
    domain: 'Marketing',
    difficulty: 3,
    xpReward: 200,
    status: 'upcoming',
    deadline: '2026-10-25T23:59:00Z',
    submissionFormat: 'Pitch deck + email thread screenshots',
    requirements: [
      'Min 5 sponsors contacted',
      'Pitch deck (min 8 slides)',
      'Follow-up within 48 hours',
    ],
    tags: ['sponsorship', 'marketing', 'outreach'],
    claimedCount: 0,
    maxClaims: 4,
    branch: 'all',
    postedBy: 'Board',
    postedAt: '2026-10-01T10:00:00Z',
  },
  {
    id: 'act-012',
    title: 'Ambient Music Track — Dungeon Theme',
    description:
      'Compose a 2–4 minute ambient loop suitable for a dungeon/cave game level. Must seamlessly loop.',
    domain: 'Audio',
    difficulty: 3,
    xpReward: 240,
    status: 'open',
    deadline: '2026-10-11T23:59:00Z',
    submissionFormat: 'MP3 + WAV files via Google Drive',
    requirements: ['2–4 minute track', 'Seamless loop', 'CC0 or CC-BY license', 'Mix notes PDF'],
    tags: ['music', 'ambient', 'dungeon', 'loop'],
    claimedCount: 2,
    branch: 'all',
    postedBy: 'Priya Nair',
    postedAt: '2026-09-28T15:00:00Z',
  },
];

const MOCK_CLAIMS: Claim[] = [
  {
    id: 'claim-001',
    activityId: 'act-006',
    activityTitle: 'Procedural Level Generation — Code Challenge',
    activityDomain: 'Programming',
    xpReward: 350,
    submittedAt: '2026-10-01T14:22:00Z',
    status: 'under_review',
    proofUrl: 'https://github.com/aryan-mehta/procedural-dungeon',
    notes: 'Implemented BSP tree algorithm for room generation with Dijkstra-based corridor routing.',
    reviewerId: 'reviewer-002',
    reviewerName: 'Aditya Joshi',
  },
  {
    id: 'claim-002',
    activityId: 'act-003',
    activityTitle: 'Unity Shader Workshop Recap',
    activityDomain: 'Writing',
    xpReward: 150,
    submittedAt: '2026-09-30T10:15:00Z',
    status: 'approved',
    proofUrl: 'https://docs.google.com/document/d/xyz',
    notes: 'Covered surface shaders, vertex displacement, and custom lighting.',
    reviewerId: 'reviewer-001',
    reviewerName: 'Rahul Desai',
    reviewedAt: '2026-10-01T09:30:00Z',
    feedback: 'Excellent detail on vertex displacement. Great screenshots.',
    xpCredited: 150,
  },
  {
    id: 'claim-003',
    activityId: 'act-010',
    activityTitle: 'Multiplayer Netcode Writeup',
    activityDomain: 'Writing',
    xpReward: 180,
    submittedAt: '2026-09-28T16:40:00Z',
    status: 'rejected',
    proofUrl: 'https://dev.to/aryan-mehta/netcode-comparison',
    notes: 'Compared rollback and lockstep with Godot implementation examples.',
    reviewerId: 'reviewer-001',
    reviewerName: 'Aditya Joshi',
    reviewedAt: '2026-09-29T11:00:00Z',
    feedback:
      'Good effort, but missing citations and the code examples lack comments. Please resubmit with at least 3 citations and commented code blocks.',
  },
  {
    id: 'claim-004',
    activityId: 'act-002',
    activityTitle: 'Pixel Art Character Sheet',
    activityDomain: 'Art',
    xpReward: 200,
    submittedAt: '2026-09-27T12:30:00Z',
    status: 'submitted',
    proofUrl: 'https://drive.google.com/file/d/abc',
    notes: 'Created a warrior character with idle, walk (4-dir), and sword attack animations.',
  },
  {
    id: 'claim-005',
    activityId: 'act-009',
    activityTitle: 'Environment Concept Art — Fantasy Biome',
    activityDomain: 'Art',
    xpReward: 280,
    submittedAt: '2026-10-02T19:10:00Z',
    status: 'under_review',
    proofUrl: 'https://drive.google.com/file/d/def',
    notes: 'Painted a bioluminescent mushroom forest with a ruined temple in the background.',
    reviewerId: 'reviewer-003',
    reviewerName: 'Meera Pillai',
  },
  {
    id: 'claim-006',
    activityId: 'act-005',
    activityTitle: 'Social Media Campaign — GDU Monthly Digest',
    activityDomain: 'Marketing',
    xpReward: 120,
    submittedAt: '2026-09-26T09:00:00Z',
    status: 'approved',
    proofUrl: 'https://instagram.com/gamedevutopia',
    notes: 'Posted all 4 stories and the carousel. Reached 340 impressions.',
    reviewerId: 'reviewer-004',
    reviewerName: 'Sneha Kulkarni',
    reviewedAt: '2026-09-27T14:00:00Z',
    feedback: 'Clean visuals and on-brand. Carousel engagement was great!',
    xpCredited: 120,
  },
  {
    id: 'claim-007',
    activityId: 'act-007',
    activityTitle: 'UI/UX Design — Game HUD Concept',
    activityDomain: 'Design',
    xpReward: 220,
    submittedAt: '2026-10-03T08:45:00Z',
    status: 'submitted',
    proofUrl: 'https://figma.com/file/xyz',
    notes: 'Designed a dark sci-fi HUD with animated health bar mockup in Figma.',
  },
];

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-001',
    title: 'Global Game Jam 2026 Registration Open!',
    body: 'Team registrations are now open. Form your squads and submit by Oct 10.',
    type: 'event',
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'ann-002',
    title: 'Double XP Weekend — Oct 4–5',
    body: 'All approved claims submitted this weekend earn 2× XP. Get cracking!',
    type: 'reward',
    createdAt: '2026-10-02T12:00:00Z',
  },
  {
    id: 'ann-003',
    title: 'Review Queue Backlog — Expect Delays',
    body: 'Domain heads are catching up. Claims submitted before Sep 28 will be reviewed by Oct 5.',
    type: 'warning',
    createdAt: '2026-10-03T09:00:00Z',
  },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    memberId: 'member-002',
    name: 'Kavya Sharma',
    username: 'kavya.sharma',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kavya',
    totalXP: 7840,
    level: 12,
    leagueTier: 'Diamond',
    streak: 28,
    branch: 'PICT',
  },
  {
    rank: 2,
    memberId: 'member-003',
    name: 'Rohan Verma',
    username: 'rohan.verma',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rohan',
    totalXP: 6920,
    level: 11,
    leagueTier: 'Diamond',
    streak: 19,
    branch: 'IIITK',
  },
  {
    rank: 3,
    memberId: 'member-004',
    name: 'Priya Nair',
    username: 'priya.nair',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
    totalXP: 6100,
    level: 10,
    leagueTier: 'Platinum',
    streak: 15,
    branch: 'PICT',
  },
  {
    rank: 4,
    memberId: 'member-001',
    name: 'Aryan Mehta',
    username: 'aryan.mehta',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aryan',
    totalXP: 4820,
    level: 8,
    leagueTier: 'Gold',
    streak: 12,
    branch: 'PICT',
  },
];

// ─── API Functions ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCurrentMember(): Promise<Member> {
  // TODO: GET /api/members/me
  await delay(400);
  return MOCK_MEMBER;
}

export async function getWeeklyXP(): Promise<WeeklyXPPoint[]> {
  // TODO: GET /api/members/me/xp/weekly
  await delay(300);
  return MOCK_WEEKLY_XP;
}

export async function getRecentTransactions(limit = 5): Promise<XPTransaction[]> {
  // TODO: GET /api/members/me/transactions?limit=n
  await delay(350);
  return MOCK_TRANSACTIONS.slice(0, limit);
}

export async function getActivities(filters?: {
  domain?: ActivityDomain;
  status?: ActivityStatus;
  difficulty?: ActivityDifficulty;
  branch?: Branch | 'all';
  search?: string;
}): Promise<Activity[]> {
  // TODO: GET /api/activities with query params
  await delay(500);
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
  return results;
}

export async function getActivityById(id: string): Promise<Activity | null> {
  // TODO: GET /api/activities/:id
  await delay(200);
  return MOCK_ACTIVITIES.find((a) => a.id === id) ?? null;
}

export async function getMyClaims(): Promise<Claim[]> {
  // TODO: GET /api/members/me/claims
  await delay(450);
  return MOCK_CLAIMS;
}

export async function submitClaim(data: {
  activityId: string;
  proofUrl: string;
  notes: string;
}): Promise<{ claimId: string; status: ClaimStatus }> {
  // TODO: POST /api/claims
  await delay(800);
  return { claimId: `claim-${Date.now()}`, status: 'submitted' };
}

export async function getAnnouncements(): Promise<Announcement[]> {
  // TODO: GET /api/announcements
  await delay(250);
  return MOCK_ANNOUNCEMENTS;
}

export async function getLeaderboard(branch?: Branch): Promise<LeaderboardEntry[]> {
  // TODO: GET /api/leaderboard?branch=PICT
  await delay(400);
  if (branch) return MOCK_LEADERBOARD.filter((e) => e.branch === branch);
  return MOCK_LEADERBOARD;
}

export async function getSpotlightActivities(): Promise<Activity[]> {
  // TODO: GET /api/activities/spotlight
  await delay(300);
  return MOCK_ACTIVITIES.filter((a) => a.status === 'open')
    .sort((a, b) => b.xpReward - a.xpReward)
    .slice(0, 3);
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export interface OnboardingPayload {
  branch: string;
  domains: string[];
  interests: string[];
  weeklyAvailability: '1-3' | '3-6' | '6+';
}

export async function saveOnboarding(data: OnboardingPayload): Promise<{ success: boolean }> {
  // Mock: replace with Supabase upsert when auth is live
  await new Promise((resolve) => setTimeout(resolve, 600));
  console.log('[GDU XP] Onboarding saved:', data);
  return { success: true };
}

// ─── Landing Stats ────────────────────────────────────────────────────────────

export interface LandingStats {
  totalMembers: number;
  xpAwardedThisSeason: number;
  activeBranches: number;
}

export async function getLandingStats(): Promise<LandingStats> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    totalMembers: 340,
    xpAwardedThisSeason: 128400,
    activeBranches: 2,
  };
}