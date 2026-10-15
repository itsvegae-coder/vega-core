export interface Topic {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string; // e.g. 'blue' | 'sage' | 'peach' | 'lav' or hex code
  colorHex?: string; // Direct hex color for consistent charting and badges (#039be5, #10b981, etc.)
  topics: Topic[];
}

export interface MistakeEntry {
  id: string;
  mistake: string; // What exactly did I get wrong?
  reason: string; // Why did I make this mistake? (conceptual, formula slip, misread, etc.)
  solution: string; // Corrective action / solution to prevent recurrence
  subjectId?: string;
  topicId?: string;
  errorId?: string; // Connected to Error Intelligence loop
}

export interface StudyLog {
  id: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  topicId?: string;
  subtopic?: string;
  mode: string;
  minutes: number;
  tests?: number;
  correct: number;
  wrong: number;
  unanswered: number;
  source?: string;
  mistakes?: string;
  mistakeReasons?: string;
  nextAction?: string;
  notes?: string;
  errorIds?: string[];
  mistakesList?: MistakeEntry[]; // Multi-mistake structured analysis
  taskId?: string; // Linked PlannedTask
}

export interface Assessment {
  id: string;
  name: string;
  date: string;
  subjectId: string;
  topicId?: string;
  type?: string;
  minutes?: number;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  scoringMethod?: 'settings' | 'raw' | 'negative';
  penaltyDivisor?: number;
  score?: number;
  notes?: string;
  taskId?: string;
}

export interface ErrorItem {
  id: string;
  title: string;
  subjectId: string;
  topicId?: string;
  subtopic?: string;
  type?: string;
  date: string;
  due?: string;
  cause?: string;
  action?: string;
  status: 'open' | 'resolved';
  repeat?: boolean;
  logId?: string | null;
  taskId?: string | null;
  assessmentId?: string | null;
  notes?: string;
  resolvedAt?: string | null;
}

export interface ActionItem {
  id: string;
  title: string;
  subjectId?: string;
  topicId?: string;
  due?: string;
  done: boolean;
  notes?: string;
  errorId?: string;
  googleEventId?: string;
}

export interface PlannedTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  duration: number; // minutes
  priority: 'low' | 'normal' | 'high' | 'urgent';
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  subjectId?: string;
  topicId?: string;
  tests?: number; // Planned tests or question sets count
  notes?: string;
  color?: string; // Google Calendar color or hex
  googleColorId?: string;
  isAllDay?: boolean;
  done: boolean;
  createdAt?: string;
  updatedAt?: string;
  mistakesList?: MistakeEntry[]; // Dedicated multi-mistake analysis area
  googleEventId?: string;
  googleCalendarId?: string;
  googleUpdated?: string;
  syncedToGoogleAt?: string;
}

export interface Project {
  id: string;
  name: string;
  start?: string;
  end?: string;
  status: 'not-started' | 'active' | 'on-hold' | 'completed';
  priority: 'low' | 'normal' | 'high';
  progress: number; // 0 - 100
  milestones: string[];
  notes?: string;
  custom?: Record<string, string>;
  updatedAt?: string;
}

export interface Goal {
  id: string;
  name: string;
  metric: 'hours' | 'questions' | 'accuracy';
  target: number;
  period: 'week' | 'month';
  subjectId?: string;
  notes?: string;
  createdAt?: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  type: string;
  subjectId?: string;
  url?: string;
  topic?: string;
  notes?: string;
  createdAt?: string;
}

export interface TopicReview {
  id: string;
  subjectId: string;
  topic: string;
  lastDate?: string;
  due: string;
  confidence: number; // 1 - 5
  notes?: string;
}

export interface CustomField {
  id: string;
  name: string;
}

export interface WeeklySnapshot {
  id: string;
  start: string;
  end: string;
  hours: number;
  qs: number;
  avg: number | null;
  prevHours: number;
  prevAvg: number | null;
  logs: number;
  assessments: number;
  createdAt: string;
}

export type PercentageMethod = 'attempt_accuracy' | 'correct_answer_rate' | 'negative_marking';

export interface VegaState {
  version: number;
  subjects: Subject[];
  modes: string[];
  logs: StudyLog[];
  assessments: Assessment[];
  errors: ErrorItem[];
  actions: ActionItem[];
  notes: string;
  scoring: {
    method: 'raw' | 'negative';
    divisor: number;
  };
  reviews: WeeklySnapshot[];
  projects: Project[];
  goals: Goal[];
  tasks: PlannedTask[];
  resources: ResourceItem[];
  topicReviews: TopicReview[];
  customProjectFields: CustomField[];
  changeLog: { time: string; type: string }[];
  preferences: {
    notifications: boolean;
    reminderLeadMinutes: number;
    dashboardCards: string[];
    googleAutoSync?: boolean;
    theme?: 'blue' | 'sage' | 'lav' | 'peach';
    calendarSystem?: 'gregorian' | 'jalali';
    weekStart?: number; // 1 = Mon, 0 = Sun, 6 = Sat
    language?: 'en' | 'fa';
    percentageMethod?: PercentageMethod; // Configured percentage calculation formula
  };
  google?: {
    clientId: string;
    connected: boolean;
    lastSync: string;
    calendarId: string;
  };
  cloud?: {
    url: string;
    key: string;
    email: string;
  };
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  colorId?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
}
