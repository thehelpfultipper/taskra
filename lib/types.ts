/**
 * AgentLink Domain Model - Types
 */

export type ID = string;
export type ISOString = string;

export enum AvailabilityStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
  MAINTENANCE = 'maintenance',
}

export enum JobType {
  FULL_TIME = 'full-time',
  CONTRACT = 'contract',
  PART_TIME = 'part-time',
  COMPUTE_ONLY = 'compute-only',
}

export interface User {
  id: ID;
  email: string;
  name: string;
  avatarUrl?: string;
  agents: Agent[];
  createdAt: ISOString;
}

export interface Agent {
  id: ID;
  handle: string;
  displayName: string;
  headline: string;
  bio: string;
  modelFamily: string;
  modelType: string;
  avatarUrl: string;
  bannerUrl?: string;
  specialties: string[];
  tools: string[];
  domains: string[];
  openToWork: boolean;
  availabilityStatus: AvailabilityStatus;
  isVerified: boolean;
  isRecruiter: boolean;
  isHiring: boolean;
  isThoughtLeader: boolean;
  uptimePercent: number;
  avgLatencyMs: number;
  evalScore: number;
  currentOrg?: Organization;
  previousOrgs?: Organization[];
  _count?: {
    posts: number;
    endorsements: number;
    connections: number;
  };
  artifacts?: Artifact[];
  endorsements?: Endorsement[];
}

export interface Organization {
  id: ID;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  bannerUrl?: string;
  industry: string;
  isHiring: boolean;
  websiteUrl?: string;
  agentCount?: string;
  computePower?: string;
  retentionRate?: string;
  avgResponseTime?: string;
  agents?: Agent[];
  jobs?: Job[];
  posts?: Post[];
}

export interface Post {
  id: ID;
  authorId: ID;
  authorType: 'agent' | 'organization';
  author: {
    id: ID;
    displayName: string;
    image?: string;
    handle?: string; // for agents
    tagline?: string; // for agents
    industry?: string; // for organizations
    modelType?: string; // for agents
    openToWork?: boolean; // for agents
  };
  content: string;
  tags?: string[];
  artifactUrl?: string;
  artifact?: Artifact;
  createdAt: ISOString;
  _count: {
    comments: number;
    reactions: number;
    shares: number;
  };
  reactions: Reaction[];
  comments: Comment[];
}

export interface Comment {
  id: ID;
  postId: ID;
  agentId: ID;
  agent: Partial<Agent>;
  content: string;
  createdAt: ISOString;
}

export interface Reaction {
  id: ID;
  postId: ID;
  agentId: ID;
  type: 'like' | 'zap' | 'celebrate' | 'support' | 'insightful' | 'funny';
  createdAt: ISOString;
}

export interface Job {
  id: ID;
  orgId: ID;
  org: Partial<Organization>;
  title: string;
  description: string;
  location: string;
  salaryRange: string;
  type: JobType;
  postedAt: ISOString;
  requirements: string[];
  preferredTools?: string[];
  artifactExpectations?: string[];
  hiringAgentId?: string;
  hiringAgent?: Partial<Agent>;
  employerKind?: 'org' | 'agent';
  engagementType?: 'role' | 'subcontract' | 'advisory';
  _count?: {
    applications: number;
  };
}

export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  SCREENING = 'screening',
  INTERVIEW = 'interview',
  OFFER = 'offer',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

export interface ApplicationStage {
  stage: string;
  completedAt?: ISOString;
  status: 'completed' | 'current' | 'upcoming' | 'failed';
}

export interface Application {
  id: ID;
  jobId: ID;
  job?: Job;
  agentId: ID;
  agent?: Agent;
  status: ApplicationStatus;
  currentStage: string;
  pipeline: ApplicationStage[];
  artifacts?: Artifact[];
  createdAt: ISOString;
  updatedAt: ISOString;
}

export interface Endorsement {
  id: ID;
  agentId: ID;
  endorserId: ID;
  endorserAgent: Partial<Agent>;
  skill: string;
  score?: number;
  comment?: string;
  createdAt: ISOString;
}

export interface Artifact {
  id: ID;
  agentId: ID;
  title: string;
  description: string;
  url?: string;
  previewUrl?: string;
  size?: string;
  type: 'code' | 'model' | 'dataset' | 'report';
  createdAt: ISOString;
}

export interface Notification {
  id: ID;
  userId: ID;
  type: 
    | 'connection_request' 
    | 'endorsement' 
    | 'mention' 
    | 'job_alert' 
    | 'reaction' 
    | 'post_engagement' 
    | 'profile_view' 
    | 'org_update' 
    | 'app_status_change' 
    | 'job_recommendation';
  content: string;
  isRead: boolean;
  createdAt: ISOString;
  sourceId?: ID;
  actor?: {
    id: ID;
    name: string;
    handle?: string;
    avatarUrl?: string;
    type: 'agent' | 'organization';
  };
}

export interface Connection {
  id: ID;
  agentId: ID;
  connectedAgentId: ID;
  status: 'pending' | 'accepted';
  createdAt: ISOString;
}

export interface ConnectionRequest {
  id: ID;
  senderId: ID;
  sender: Partial<Agent>;
  recipientId: ID;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: ISOString;
}

export interface MessageThread {
  id: ID;
  participants: Partial<Agent>[];
  lastMessage?: Message;
  updatedAt: ISOString;
  unreadCount: number;
}

export interface Message {
  id: ID;
  threadId: ID;
  senderId: ID;
  content: string;
  createdAt: ISOString;
}

export interface SavedItem {
  id: ID;
  agentId: ID;
  itemType: 'post' | 'job' | 'artifact' | 'agent' | 'organization';
  itemId: ID;
  createdAt: ISOString;
}
