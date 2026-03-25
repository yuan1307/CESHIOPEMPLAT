
export type UserRole = 'student' | 'admin' | 'secondary_admin' | 'teacher';
export type Language = 'en' | 'zh' | 'zh-TW' | 'es' | 'hi';
export type AIModel = 'fast' | 'thinking' | 'pro';

export interface Warning {
  id: string;
  message: string;
  date: string;
  acknowledged: boolean;
  acknowledgedDate?: string;
}

export interface Broadcast {
  id: string;
  teacherName: string;
  title: string;
  message: string;
  date: string;
  acknowledged: boolean;
  acknowledgedDate?: string;
}

export type MoodType = 'Happy' | 'Neutral' | 'Stressed' | 'Tired';

export interface MoodEntry {
  date: string; // ISO Date string
  mood: MoodType;
  note?: string;
}

export interface User {
  id: string;
  password?: string; // stored in LS
  role: UserRole;
  name?: string;
  email?: string; // For teachers
  isBanned?: boolean; // System wide ban (login)
  isCommunicationBanned?: boolean; // Ban from community/student board
  isApproved?: boolean; // For teachers requiring admin approval
  hasSuperAdminPrivilege?: boolean; // Can access Super Admin Mode (Super Admin 14548 can grant this)
  warnings?: Warning[];
  broadcasts?: Broadcast[];
  moodLogs?: MoodEntry[];
  lastSeen?: number; // Timestamp of last activity
}

export enum Importance {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export enum Urgency {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export type TaskCategory = 'Test' | 'Quiz' | 'Project' | 'Homework' | 'Presentation' | 'Personal' | 'Others';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  importance: Importance;
  urgency: Urgency;
  dueDate?: string;
  completed: boolean;
  source?: 'student' | 'teacher';
  subject?: string; // Optional context for the task
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  email: string;
}

export interface ClassPeriod {
  id: string; // Format: "Day-PeriodIndex" e.g., "Mon-0", "Tue-3"
  subject: string;
  teacherId?: string;
  teacherName?: string; // Allow custom name
  tasks: Task[];
  room?: string;
}

export type ScheduleMap = Record<string, ClassPeriod>;

export interface GradeCourse {
  id: string;
  name: string;
  gradePercent: number;
}

export type CommunityCategory = 'Announcement' | 'Club/ASA' | 'Others' | 'Resource Sharing'; 
export type PostStatus = 'pending' | 'approved' | 'rejected';

export interface Attachment {
  name: string;
  type: string;
  data: string; // Base64
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  timestamp: number;
  replies: Comment[];
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: UserRole;
  title: string;
  subject: string;
  category: CommunityCategory;
  description?: string;
  gradeLevels: string[];
  date?: string; // Relevant Date
  timestamp: number; // Posted Date
  likes: number;
  likedBy?: string[]; // Track who liked to prevent double likes
  status: PostStatus;
  rejectionReason?: string;
  attachments?: Attachment[];
  comments?: Comment[];
  pinned?: boolean;
}

export interface AssessmentEvent {
  id: string;
  title: string;
  subject: string;
  teacherName: string;
  gradeLevels: string[]; // G5-G12
  date: string; // YYYY-MM-DD
  creatorId: string;
  creatorName: string;
  status?: 'pending' | 'approved' | 'rejected';
  eventType?: 'academic' | 'personal' | 'school'; // 'academic' maps to Assessment, 'school' maps to School Event
  category?: 'Test' | 'Quiz' | 'Performance' | 'Event' | 'Other'; 
  description?: string; 
}

export interface FeatureFlags {
  enableCommunity: boolean;
  enableGPA: boolean;
  enableCalendar: boolean;
  autoApprovePosts: boolean;
  autoApproveRequests: boolean;
  enableAIImport: boolean;
  enableAIContentCheck: boolean;
  enableTeacherAI: boolean;
  enableAITutor: boolean;
  enableBriefing: boolean;
  enableTickets: boolean;
  isSystemLockdown: boolean;
}

export type ActionType = 
  | 'APPROVE_POST' 
  | 'BAN_USER' 
  | 'BROADCAST_TASK' 
  | 'CHANGE_PASSWORD' 
  | 'CHANGE_ROLE' 
  | 'COMMUNITY_EDIT'
  | 'CREATE_POST' 
  | 'CREATE_TEACHER_ACC'
  | 'DATABASE_EDIT'
  | 'DELETE_USER'
  | 'EDIT_ASSESSMENT_CALENDAR'
  | 'EDIT_EVENT_CALENDAR'
  | 'EDIT_SUBJECT_DATABASE' 
  | 'EDIT_TEACHER_DATABASE' 
  | 'FEATURE_TOGGLE'
  | 'LOGIN' 
  | 'REJECT_POST' 
  | 'SEND_WARNING' 
  | 'UNBAN_USER' 
  | 'UPDATE_USER_NAME'
  | 'TICKET_REPLY'
  | 'TICKET_CREATE'
  | 'TICKET_DELETE'
  | 'WARNING'
  | 'CHANNEL_EDIT'
  | 'ANNOUNCEMENT_CREATE'
  | 'ANNOUNCEMENT_DELETE'
  | 'SYSTEM_LOCKDOWN'
  | 'SYSTEM_RESTORE';

export interface SystemRecord {
  id: string;
  timestamp: number;
  date: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: ActionType;
  targetId?: string;
  targetName?: string;
  details?: string;
}

export interface AppState {
  user: User | null;
  schedule: ScheduleMap;
  grades: GradeCourse[];
  view: 'student' | 'admin' | 'spectate' | 'todo' | 'community' | 'gpa' | 'teacher_dashboard' | 'contact_us' | 'privacy' | 'terms';
  spectatingUserId?: string;
  impersonatedUser?: User; // Stores the admin user when impersonating someone else
  isPendingApproval?: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string; // The correct option string
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  file?: {
    name?: string;
    mimeType: string;
    data: string;
  };
}

export type TicketStatus = 'open' | 'resolved';
export interface SupportTicket {
  id: string;
  userId: string;
  userRole?: UserRole;
  userName: string;
  title: string;
  message: string;
  status: TicketStatus;
  timestamp: number;
  attachments?: Attachment[];
  replies: {
    authorName: string;
    text: string;
    timestamp: number;
    role: UserRole;
    attachments?: Attachment[];
  }[];
}

export interface OfficialChannel {
  id: string;
  platform: string;
  label: string;
  value: string;
  type: 'email' | 'link' | 'text';
}

export interface SystemAnnouncement {
    id: string;
    message: string;
    timestamp: number;
    creatorName: string;
}
