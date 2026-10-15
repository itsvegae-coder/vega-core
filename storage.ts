import { VegaState, PlannedTask, StudyLog, Subject, PercentageMethod } from '../types';

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const dateObj = (d?: string) => new Date((d || todayIso()) + 'T12:00:00');

export const dateLabel = (d?: string, calendarSystem: 'gregorian' | 'jalali' = 'gregorian') => {
  return dateObj(d).toLocaleDateString(
    calendarSystem === 'jalali' ? 'fa-IR-u-ca-persian' : undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
};

export const weekStart = (d?: string, startDay = 1) => {
  const x = dateObj(d);
  // default startDay = 1 (Monday). 0 = Sunday, 6 = Saturday
  const currentDay = x.getDay();
  const diff = (currentDay - startDay + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x.toISOString().slice(0, 10);
};

export const addDays = (d: string, n: number) => {
  const x = dateObj(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export const logHours = (l: StudyLog) => Number(l.minutes || 0) / 60;

// Total questions = Correct + Incorrect + Unanswered
export const totalQs = (l: StudyLog) =>
  Number(l.correct || 0) + Number(l.wrong || 0) + Number(l.unanswered || 0);

// Attempted questions = Correct + Incorrect
export const attemptedQs = (l: StudyLog) =>
  Number(l.correct || 0) + Number(l.wrong || 0);

// Attempt accuracy = Correct / (Correct + Incorrect) * 100
export const attemptAccuracy = (l: StudyLog) => {
  const attempted = attemptedQs(l);
  if (!attempted || attempted <= 0) return null;
  return Math.max(0, Math.min(100, (Number(l.correct || 0) / attempted) * 100));
};

// Overall completion or correct-answer rate = Correct / Total * 100
export const completionRate = (l: StudyLog) => {
  const total = totalQs(l);
  if (!total || total <= 0) return null;
  return Math.max(0, Math.min(100, (Number(l.correct || 0) / total) * 100));
};

export const calculatePct = (
  correct: number,
  total: number,
  wrong = 0,
  method: 'raw' | 'negative' = 'raw',
  divisor = 3
) => {
  if (!total || total <= 0) return null;
  if (method === 'negative') {
    const raw = (correct - wrong / (Number(divisor) || 3)) / total;
    return Math.max(0, Math.min(100, raw * 100));
  }
  return Math.max(0, Math.min(100, (correct / total) * 100));
};

// Configurable percentage calculation based on user settings
export const computePercentage = (
  correct: number,
  wrong: number,
  unanswered: number,
  method: PercentageMethod = 'attempt_accuracy',
  negativeDivisor = 3
): number | null => {
  const attempted = correct + wrong;
  const total = correct + wrong + unanswered;

  if (method === 'attempt_accuracy') {
    if (attempted <= 0) return null;
    return Math.max(0, Math.min(100, (correct / attempted) * 100));
  }

  if (method === 'correct_answer_rate') {
    if (total <= 0) return null;
    return Math.max(0, Math.min(100, (correct / total) * 100));
  }

  if (method === 'negative_marking') {
    if (total <= 0) return null;
    const penalty = wrong / (Number(negativeDivisor) || 3);
    const raw = (correct - penalty) / total;
    return Math.max(0, Math.min(100, raw * 100));
  }

  return attempted > 0 ? (correct / attempted) * 100 : null;
};

export const accuracy = (
  l: StudyLog,
  method: PercentageMethod | 'raw' | 'negative' = 'attempt_accuracy',
  divisor = 3
) => {
  const c = Number(l.correct || 0);
  const w = Number(l.wrong || 0);
  const u = Number(l.unanswered || 0);

  if (method === 'raw') {
    return computePercentage(c, w, u, 'correct_answer_rate');
  }
  if (method === 'negative') {
    return computePercentage(c, w, u, 'negative_marking', divisor);
  }
  return computePercentage(c, w, u, method as PercentageMethod, divisor);
};

export const fmt = (n?: number | null, decimals = 1) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
};

// Preset Subject Colors for consistent cross-app visualization
export const PRESET_SUBJECT_COLORS = [
  { id: 'blue', name: 'Mist Blue', hex: '#8dc7f2' },
  { id: 'sage', name: 'Soft Sage', hex: '#a3c2b0' },
  { id: 'peach', name: 'Warm Sand', hex: '#e2bc9d' },
  { id: 'lav', name: 'Muted Lilac', hex: '#c4b5e0' },
  { id: 'emerald', name: 'Emerald', hex: '#10b981' },
  { id: 'amber', name: 'Amber', hex: '#f59e0b' },
  { id: 'rose', name: 'Rose', hex: '#f43f5e' },
  { id: 'indigo', name: 'Indigo', hex: '#6366f1' },
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4' },
  { id: 'teal', name: 'Teal', hex: '#14b8a6' },
  { id: 'purple', name: 'Purple', hex: '#a855f7' },
  { id: 'slate', name: 'Slate', hex: '#94a3b8' },
];

export const getSubjectColor = (
  subject?: { color?: string; colorHex?: string } | null,
  fallback = '#8dc7f2'
): string => {
  if (!subject) return fallback;
  if (subject.colorHex && subject.colorHex.startsWith('#')) return subject.colorHex;
  const found = PRESET_SUBJECT_COLORS.find((c) => c.id === subject.color);
  if (found) return found.hex;
  if (subject.color && subject.color.startsWith('#')) return subject.color;
  return fallback;
};

// Date range evaluation
export type DateRangePreset = 'today' | 'week' | 'month' | 'custom' | 'all';

export const isDateInRange = (
  dateStr: string,
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  weekStartDay = 1
): boolean => {
  const today = todayIso();
  if (preset === 'today') return dateStr === today;
  if (preset === 'week') {
    const wStart = weekStart(today, weekStartDay);
    const wEnd = addDays(wStart, 6);
    return dateStr >= wStart && dateStr <= wEnd;
  }
  if (preset === 'month') {
    return dateStr.startsWith(today.slice(0, 7));
  }
  if (preset === 'custom') {
    if (customStart && dateStr < customStart) return false;
    if (customEnd && dateStr > customEnd) return false;
    return true;
  }
  return true; // 'all'
};

export const defaultState = (): VegaState => ({
  version: 2,
  subjects: [
    {
      id: 'biology',
      name: 'Biology',
      color: 'sage',
      colorHex: '#a3c2b0',
      topics: [
        { id: 'bio0', name: 'Cell Biology' },
        { id: 'bio1', name: 'Genetics' },
        { id: 'bio2', name: 'Human Physiology' },
      ],
    },
    {
      id: 'physics',
      name: 'Physics',
      color: 'blue',
      colorHex: '#8dc7f2',
      topics: [
        { id: 'phy0', name: 'Kinematics' },
        { id: 'phy1', name: 'Dynamics' },
        { id: 'phy2', name: 'Work & Energy' },
      ],
    },
    {
      id: 'chemistry',
      name: 'Chemistry',
      color: 'peach',
      colorHex: '#e2bc9d',
      topics: [
        { id: 'che0', name: 'Atomic Structure' },
        { id: 'che1', name: 'Chemical Bonding' },
        { id: 'che2', name: 'Equilibrium' },
      ],
    },
    {
      id: 'mathematics',
      name: 'Mathematics',
      color: 'lav',
      colorHex: '#c4b5e0',
      topics: [
        { id: 'mat0', name: 'Functions' },
        { id: 'mat1', name: 'Trigonometry' },
        { id: 'mat2', name: 'Calculus' },
      ],
    },
    {
      id: 'geography',
      name: 'Geography',
      color: 'emerald',
      colorHex: '#10b981',
      topics: [
        { id: 'geo0', name: 'Physical Geography' },
        { id: 'geo1', name: 'Human Geography' },
      ],
    },
  ],
  modes: [
    'Learning',
    'Practice',
    'Timed Practice',
    'Review',
    'Routine Testing',
    'Comprehensive Test',
    'Error Correction',
  ],
  logs: [
    {
      id: 'init-log-1',
      date: todayIso(),
      subjectId: 'biology',
      topicId: 'bio0',
      mode: 'Practice',
      minutes: 60,
      tests: 1,
      correct: 24,
      wrong: 4,
      unanswered: 2,
      source: 'Cell cycle question bank',
      mistakes: 'Regulation checkpoints (G1/S cyclin threshold)',
      mistakeReasons: 'Did not review phosphorylation cascade activation kinetics',
      nextAction: 'Re-read cell cycle kinase regulatory pathways',
      mistakesList: [
        {
          id: 'm1',
          mistake: 'Confused cyclin B with cyclin D activation timing in G1 phase checkpoint',
          reason: 'Conceptual slip between mitotic cyclins and G1 progression complexes',
          solution: 'Draw out cyclin-CDK timeline diagram and re-test kinase pairs',
          subjectId: 'biology',
          topicId: 'bio0',
        },
      ],
      notes: 'Reviewed mitosis regulation and checkpoint signals.',
    },
    {
      id: 'init-log-2',
      date: addDays(todayIso(), -1),
      subjectId: 'physics',
      topicId: 'phy0',
      mode: 'Timed Practice',
      minutes: 45,
      tests: 2,
      correct: 18,
      wrong: 5,
      unanswered: 0,
      source: 'Kinematics drill set',
      mistakes: 'Sign convention mistake in 2D projectile displacement',
      mistakeReasons: 'Assumed downward displacement was positive without setting origin',
      nextAction: 'Always state origin and reference frame before writing equations',
      mistakesList: [
        {
          id: 'm2',
          mistake: 'Negative sign omitted for vertical gravitational acceleration in projectile trajectory',
          reason: 'Rushed through equation setup without drawing coordinate axes',
          solution: 'Establish reference vector (+y upward) explicitly at step 1',
          subjectId: 'physics',
          topicId: 'phy0',
        },
      ],
      notes: 'Focus on 2D projectile trajectory equations.',
    },
  ],
  assessments: [
    {
      id: 'init-ass-1',
      name: 'Biology Mid-Term Check',
      date: addDays(todayIso(), -3),
      subjectId: 'biology',
      topicId: 'bio0',
      type: 'Topic test',
      minutes: 40,
      total: 30,
      correct: 26,
      wrong: 4,
      unanswered: 0,
      score: 86.7,
      notes: 'Strong in organelle structure, need review on ATP synthase pump.',
    },
  ],
  errors: [
    {
      id: 'init-err-1',
      title: 'Sign convention mistake in projectile displacement',
      subjectId: 'physics',
      topicId: 'phy0',
      type: 'Careless mistake',
      date: addDays(todayIso(), -1),
      due: addDays(todayIso(), 2),
      cause: 'Assumed downward motion was positive without setting reference frame.',
      action: 'Always draw coordinate axes first before writing kinematic equations.',
      status: 'open',
      repeat: false,
      logId: 'init-log-2',
    },
  ],
  actions: [
    {
      id: 'init-act-1',
      title: 'Re-test kinematics projectile errors and solve 5 new variations',
      subjectId: 'physics',
      due: addDays(todayIso(), 2),
      done: false,
      notes: 'Created from error loop follow-up.',
    },
  ],
  notes: 'Focus for this week: Strengthen kinematics problem formulation and complete cellular biology flashcard review.',
  scoring: {
    method: 'raw',
    divisor: 3,
  },
  reviews: [],
  projects: [
    {
      id: 'init-proj-1',
      name: 'Semester Exam Readiness Plan',
      start: addDays(todayIso(), -7),
      end: addDays(todayIso(), 21),
      status: 'active',
      priority: 'high',
      progress: 35,
      milestones: [
        'Complete Biology core modules',
        'Physics problem bank mastery',
        '3 Full-length mock examinations',
      ],
      notes: 'Weekly review checkpoint every Sunday evening.',
    },
  ],
  goals: [
    {
      id: 'init-goal-1',
      name: 'Weekly Study Target',
      metric: 'hours',
      target: 12,
      period: 'week',
      notes: 'Consistency across all weekdays.',
    },
  ],
  tasks: [
    {
      id: 'init-task-1',
      title: 'Deep Work: Cell Biology Checkpoints',
      date: todayIso(),
      time: '14:00',
      duration: 60,
      priority: 'high',
      repeat: 'none',
      subjectId: 'biology',
      color: '#039be5',
      mistakesList: [
        {
          id: 'tm1',
          mistake: 'Missed cyclin E peak regulation question',
          reason: 'Conflated S-phase cyclins with M-phase cyclins',
          solution: 'Memorize order: Cyclin D (G1) -> E (G1/S) -> A (S) -> B (M)',
          subjectId: 'biology',
          topicId: 'bio0',
        },
      ],
      notes: 'Review cyclin-dependent kinase pathway notes.',
      done: false,
    },
    {
      id: 'init-task-2',
      title: 'Physics Problem Set Practice',
      date: addDays(todayIso(), 1),
      time: '16:30',
      duration: 45,
      priority: 'normal',
      repeat: 'weekly',
      subjectId: 'physics',
      color: '#7cb342',
      notes: 'Focus on error loop follow-ups.',
      done: false,
    },
  ],
  resources: [
    {
      id: 'init-res-1',
      title: 'Campbell Biology 12th Edition',
      type: 'Book',
      subjectId: 'biology',
      topic: 'Cell Biology',
      notes: 'Chapters 6–12 are key for physiology foundations.',
    },
  ],
  topicReviews: [
    {
      id: 'init-rev-1',
      subjectId: 'physics',
      topic: 'Kinematics Equations',
      lastDate: addDays(todayIso(), -2),
      due: addDays(todayIso(), 1),
      confidence: 3,
      notes: 'Reinforce vertical vs horizontal vector decoupling.',
    },
  ],
  customProjectFields: [
    { id: 'f-course', name: 'Course Code' },
    { id: 'f-lead', name: 'Study Group Lead' },
  ],
  changeLog: [{ time: new Date().toISOString(), type: 'Workspace initialized' }],
  preferences: {
    notifications: false,
    reminderLeadMinutes: 30,
    dashboardCards: ['hours', 'questions', 'average', 'errors'],
    googleAutoSync: true,
    theme: 'blue',
    calendarSystem: 'gregorian',
    weekStart: 1,
    language: 'en',
    percentageMethod: 'attempt_accuracy',
  },
  google: {
    clientId: '',
    connected: false,
    lastSync: '',
    calendarId: 'primary',
  },
  cloud: {
    url: '',
    key: '',
    email: '',
  },
});

export const loadState = (): VegaState => {
  try {
    const raw = localStorage.getItem('vegaCoreData');
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const def = defaultState();
    return {
      ...def,
      ...parsed,
      subjects: parsed.subjects?.length
        ? parsed.subjects.map((s: Subject) => ({
            ...s,
            colorHex: s.colorHex || getSubjectColor(s),
          }))
        : def.subjects,
      modes: parsed.modes?.length ? parsed.modes : def.modes,
      scoring: { ...def.scoring, ...(parsed.scoring || {}) },
      preferences: {
        ...def.preferences,
        percentageMethod: 'attempt_accuracy',
        ...(parsed.preferences || {}),
      },
      google: { ...def.google, ...(parsed.google || {}) },
      cloud: { ...def.cloud, ...(parsed.cloud || {}) },
    };
  } catch (e) {
    console.error('Failed to parse saved state:', e);
    return defaultState();
  }
};

export const saveState = (state: VegaState) => {
  try {
    const prior = localStorage.getItem('vegaCoreData');
    const now = Date.now();
    if (prior && prior !== JSON.stringify(state)) {
      let snaps: { time: number; data: string }[] = [];
      try {
        snaps = JSON.parse(localStorage.getItem('vegaCoreSnapshots') || '[]');
      } catch (e) {}
      const last = snaps[0]?.time || 0;
      if (now - last > 5 * 60 * 1000) {
        snaps.unshift({ time: now, data: prior });
        localStorage.setItem('vegaCoreSnapshots', JSON.stringify(snaps.slice(0, 12)));
      }
    }
    localStorage.setItem('vegaCoreData', JSON.stringify(state));
  } catch (e) {
    console.warn('Vega Core could not save to localStorage:', e);
  }
};

export const downloadFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export const generateIcs = (tasks: PlannedTask[], getSubjectName: (id?: string) => string) => {
  const escIcs = (v: any) =>
    String(v || '')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const stamp = (d: string) => d.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const events = tasks.map((t) => {
    let start: string;
    let end: string;
    if (t.time) {
      start = stamp(t.date + 'T' + t.time + ':00');
      const d = new Date(t.date + 'T' + t.time + ':00');
      d.setMinutes(d.getMinutes() + (t.duration || 30));
      end = stamp(
        d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0') +
          'T' +
          String(d.getHours()).padStart(2, '0') +
          ':' +
          String(d.getMinutes()).padStart(2, '0') +
          ':00'
      );
    } else {
      start = t.date.replace(/-/g, '');
      end = addDays(t.date, 1).replace(/-/g, '');
    }

    return [
      'BEGIN:VEVENT',
      'UID:' + t.id + '@vegacore',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
      t.time ? 'DTSTART:' + start : 'DTSTART;VALUE=DATE:' + start,
      t.time ? 'DTEND:' + end : 'DTEND;VALUE=DATE:' + end,
      'SUMMARY:' + escIcs(t.title),
      'DESCRIPTION:' +
        escIcs((t.notes || '') + (t.subjectId ? '\nSubject: ' + getSubjectName(t.subjectId) : '')),
      'STATUS:' + (t.done ? 'COMPLETED' : 'CONFIRMED'),
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vega Core//Study Planner//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
};
