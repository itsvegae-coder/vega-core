import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Edit2,
  CalendarCheck,
  CalendarDays,
  Grid3X3,
  List,
  FileText,
  AlertCircle,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { VegaState, PlannedTask, GoogleCalendarEvent, StudyLog, MistakeEntry, ErrorItem } from '../types';
import {
  todayIso,
  dateLabel,
  dateObj,
  addDays,
  fmt,
  uid,
  generateIcs,
  downloadFile,
  weekStart,
  getSubjectColor,
  PRESET_SUBJECT_COLORS,
} from '../lib/storage';
import {
  listGoogleCalendarEvents,
  syncTaskToGoogle,
  deleteGoogleCalendarEvent,
} from '../lib/googleCalendar';
import { ConfirmModal } from '../components/ConfirmModal';

export type CalendarDisplayMode = 'month' | 'week' | 'day' | 'agenda' | 'year' | 'analysis';

// Google Calendar standard color palette
export const GOOGLE_CALENDAR_COLORS = [
  { id: 'peacock', name: 'Peacock (Sky Blue)', hex: '#039be5' },
  { id: 'blueberry', name: 'Blueberry (Indigo)', hex: '#3f51b5' },
  { id: 'sage', name: 'Sage (Soft Green)', hex: '#7cb342' },
  { id: 'basil', name: 'Basil (Forest Green)', hex: '#0b8043' },
  { id: 'flamingo', name: 'Flamingo (Coral Pink)', hex: '#e67c73' },
  { id: 'tomato', name: 'Tomato (Red)', hex: '#d50000' },
  { id: 'tangerine', name: 'Tangerine (Orange)', hex: '#f4511e' },
  { id: 'banana', name: 'Banana (Yellow)', hex: '#f6bf26' },
  { id: 'lavender', name: 'Lavender (Purple)', hex: '#7986cb' },
  { id: 'grape', name: 'Grape (Deep Violet)', hex: '#8e24aa' },
  { id: 'graphite', name: 'Graphite (Slate Grey)', hex: '#616161' },
];

interface CalendarViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  user: User | null;
  hasCalendarToken: boolean;
  accessToken: string | null;
  onSignInWithGoogle: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  state,
  onUpdateState,
  user,
  hasCalendarToken,
  accessToken,
  onSignInWithGoogle,
  onShowToast,
}) => {
  const [viewMode, setViewMode] = useState<CalendarDisplayMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [currentDateFocus, setCurrentDateFocus] = useState<Date>(new Date(todayIso() + 'T12:00:00'));
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'date' | 'today' | 'week' | 'overdue'>('today');

  // Google Calendar Integration states
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);

  // Task Modal states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannedTask | null>(null);

  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(todayIso());
  const [taskStartTime, setTaskStartTime] = useState('09:00');
  const [taskEndTime, setTaskEndTime] = useState('10:00');
  const [taskIsAllDay, setTaskIsAllDay] = useState(false);
  const [taskColor, setTaskColor] = useState(GOOGLE_CALENDAR_COLORS[0].hex);
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [taskRepeat, setTaskRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskTopicId, setTaskTopicId] = useState('');
  const [taskTests, setTaskTests] = useState(1);
  const [taskNotes, setTaskNotes] = useState('');
  const [syncWithGoogleImmediately, setSyncWithGoogleImmediately] = useState(true);

  // Multi-Mistake Analysis Area for Planned Task (Requirement 1)
  const [taskMistakes, setTaskMistakes] = useState<MistakeEntry[]>([]);

  // Study Report Modal State (Connecting planning with actual study, tests, topics, accuracy)
  const [loggingTask, setLoggingTask] = useState<PlannedTask | null>(null);
  const [logSubjectId, setLogSubjectId] = useState('');
  const [logTopicId, setLogTopicId] = useState('');
  const [logSubtopic, setLogSubtopic] = useState('');
  const [logMinutes, setLogMinutes] = useState(60);
  const [logTests, setLogTests] = useState(1);
  const [logCorrect, setLogCorrect] = useState(15);
  const [logWrong, setLogWrong] = useState(3);
  const [logUnanswered, setLogUnanswered] = useState(0);
  const [logMode, setLogMode] = useState(state.modes[0] || 'Practice');
  const [logSource, setLogSource] = useState('');
  const [logNextAction, setLogNextAction] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [reportMistakes, setReportMistakes] = useState<MistakeEntry[]>([]);
  const [syncToErrorIntelligence, setSyncToErrorIntelligence] = useState(true);

  // Confirmation modal
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const getSubjectName = (id?: string) =>
    state.subjects.find((s) => s.id === id)?.name || 'General';

  const getTaskDisplayColor = (t: PlannedTask) => {
    if (t.color && t.color.startsWith('#')) return t.color;
    if (t.subjectId) {
      const s = state.subjects.find((subj) => subj.id === t.subjectId);
      if (s) return getSubjectColor(s);
    }
    return t.color || GOOGLE_CALENDAR_COLORS[0].hex;
  };

  // Fetch Google Calendar Events
  const handleFetchGoogleEvents = async (silent = false) => {
    if (!accessToken) {
      if (!silent) onShowToast('Please sign in with Google to fetch calendar events.', 'info');
      return;
    }
    try {
      setIsSyncing(true);
      const events = await listGoogleCalendarEvents(accessToken);
      setGoogleEvents(events);
      if (!silent) {
        onShowToast(`Synced ${events.length} event(s) from Google Calendar.`, 'success');
      }
    } catch (err: any) {
      console.error('Error fetching calendar events:', err);
      if (!silent) onShowToast(err.message || 'Failed to fetch Google Calendar events.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (hasCalendarToken && accessToken) {
      handleFetchGoogleEvents(true);
    }
  }, [hasCalendarToken, accessToken]);

  // Sync a single task
  const handleSyncTask = async (task: PlannedTask) => {
    if (!accessToken) {
      onShowToast('Please connect Google Calendar first.', 'info');
      return;
    }
    try {
      setIsSyncing(true);
      const res = await syncTaskToGoogle(accessToken, task, getSubjectName(task.subjectId));
      const updatedTasks = state.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              googleEventId: res.eventId,
              syncedToGoogleAt: new Date().toISOString(),
            }
          : t
      );
      onUpdateState({ ...state, tasks: updatedTasks });
      onShowToast(`"${task.title}" synced to your Google Calendar!`, 'success');
      handleFetchGoogleEvents(true);
    } catch (err: any) {
      console.error('Failed to sync task:', err);
      onShowToast(err.message || 'Could not sync task to Google Calendar.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync all tasks
  const handleSyncAllTasks = async () => {
    if (!accessToken) {
      onShowToast('Please connect Google Calendar first.', 'info');
      return;
    }
    const openTasks = state.tasks.filter((t) => !t.done);
    if (openTasks.length === 0) {
      onShowToast('No pending tasks to sync.', 'info');
      return;
    }

    try {
      setIsSyncing(true);
      let syncedCount = 0;
      const updatedTasks = [...state.tasks];

      for (const task of openTasks) {
        try {
          const res = await syncTaskToGoogle(accessToken, task, getSubjectName(task.subjectId));
          const idx = updatedTasks.findIndex((t) => t.id === task.id);
          if (idx !== -1) {
            updatedTasks[idx] = {
              ...task,
              googleEventId: res.eventId,
              syncedToGoogleAt: new Date().toISOString(),
            };
            syncedCount++;
          }
        } catch (e) {
          console.warn('Failed task sync:', task.title, e);
        }
      }

      onUpdateState({ ...state, tasks: updatedTasks });
      onShowToast(`Successfully synced ${syncedCount} task(s) to Google Calendar!`, 'success');
      handleFetchGoogleEvents(true);
    } catch (err: any) {
      onShowToast(err.message || 'Failed syncing tasks.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete task
  const requestDeleteTask = (task: PlannedTask) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Planned Task?',
      message: task.googleEventId
        ? `"${task.title}" is synced with Google Calendar. Deleting it will also remove it from your Google Calendar.`
        : `Are you sure you want to delete "${task.title}"? This cannot be undone.`,
      onConfirm: async () => {
        if (task.googleEventId && accessToken) {
          try {
            await deleteGoogleCalendarEvent(accessToken, task.googleEventId);
          } catch (e) {
            console.warn('Could not delete calendar event:', e);
          }
        }
        const updated = state.tasks.filter((t) => t.id !== task.id);
        onUpdateState({ ...state, tasks: updated });
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        onShowToast('Task deleted.', 'info');
      },
    });
  };

  // Toggle task completion
  const handleToggleTask = (task: PlannedTask) => {
    const wasDone = task.done;
    const isNowDone = !wasDone;

    let updatedTasks = state.tasks.map((t) => (t.id === task.id ? { ...t, done: isNowDone } : t));

    if (!wasDone && isNowDone && task.repeat && task.repeat !== 'none') {
      let nextDate = task.date;
      if (task.repeat === 'daily') nextDate = addDays(task.date, 1);
      if (task.repeat === 'weekly') nextDate = addDays(task.date, 7);
      if (task.repeat === 'monthly') {
        const d = dateObj(task.date);
        d.setMonth(d.getMonth() + 1);
        nextDate = d.toISOString().slice(0, 10);
      }
      updatedTasks.push({
        ...task,
        id: uid(),
        date: nextDate,
        done: false,
        googleEventId: undefined,
        syncedToGoogleAt: undefined,
        createdAt: new Date().toISOString(),
      });
      onShowToast(`Task completed! Next repeat scheduled for ${dateLabel(nextDate)}.`, 'success');
    }

    onUpdateState({ ...state, tasks: updatedTasks });
  };

  // Open modal for task
  const openTaskModal = (task?: PlannedTask, presetDate?: string, presetStartTime?: string) => {
    if (task) {
      setEditingTask(task);
      setTaskTitle(task.title);
      setTaskDate(task.date);
      setTaskStartTime(task.time || '09:00');
      if (task.time && task.duration) {
        const [h, m] = task.time.split(':').map(Number);
        const endTotal = h * 60 + m + task.duration;
        const endH = Math.floor(endTotal / 60) % 24;
        const endM = endTotal % 60;
        setTaskEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
      } else {
        setTaskEndTime('10:00');
      }
      setTaskIsAllDay(!!task.isAllDay);
      setTaskColor(task.color || (task.subjectId ? getSubjectColor(state.subjects.find((s) => s.id === task.subjectId)) : GOOGLE_CALENDAR_COLORS[0].hex));
      setTaskPriority(task.priority || 'normal');
      setTaskRepeat(task.repeat || 'none');
      setTaskSubjectId(task.subjectId || '');
      setTaskTopicId(task.topicId || '');
      setTaskTests(task.tests || 1);
      setTaskNotes(task.notes || '');
      setTaskMistakes(task.mistakesList || []);
    } else {
      setEditingTask(null);
      setTaskTitle('');
      setTaskDate(presetDate || selectedDate || todayIso());
      const st = presetStartTime || '09:00';
      setTaskStartTime(st);
      const [h, m] = st.split(':').map(Number);
      const endH = (h + 1) % 24;
      setTaskEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      setTaskIsAllDay(false);
      const defaultSubj = state.subjects[0]?.id || '';
      setTaskSubjectId(defaultSubj);
      setTaskTopicId('');
      setTaskTests(1);
      setTaskColor(defaultSubj ? getSubjectColor(state.subjects[0]) : GOOGLE_CALENDAR_COLORS[0].hex);
      setTaskPriority('normal');
      setTaskRepeat('none');
      setTaskNotes('');
      setTaskMistakes([]);
    }
    setIsTaskModalOpen(true);
  };

  // Mistake Management within Task Modal
  const handleAddMistakeToTask = () => {
    setTaskMistakes((prev) => [
      ...prev,
      {
        id: uid(),
        mistake: '',
        reason: '',
        solution: '',
        subjectId: taskSubjectId || undefined,
      },
    ]);
  };

  const handleUpdateTaskMistake = (
    id: string,
    field: 'mistake' | 'reason' | 'solution' | 'topicId',
    val: string
  ) => {
    setTaskMistakes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  const handleRemoveTaskMistake = (id: string) => {
    setTaskMistakes((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDate) {
      onShowToast('Please provide a title and date for the task.', 'error');
      return;
    }

    let duration = 60;
    if (!taskIsAllDay && taskStartTime && taskEndTime) {
      const [sh, sm] = taskStartTime.split(':').map(Number);
      const [eh, em] = taskEndTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (endMin <= startMin) {
        onShowToast('End time must be after start time.', 'error');
        return;
      }
      duration = endMin - startMin;
    }

    // Filter out completely empty mistake rows
    const cleanedMistakes = taskMistakes.filter(
      (m) => m.mistake.trim() || m.reason.trim() || m.solution.trim()
    );

    const taskObj: PlannedTask = {
      id: editingTask?.id || uid(),
      title: taskTitle.trim(),
      date: taskDate,
      time: taskIsAllDay ? undefined : taskStartTime,
      duration: taskIsAllDay ? 0 : duration,
      isAllDay: taskIsAllDay,
      color: taskColor,
      priority: taskPriority,
      repeat: taskRepeat,
      subjectId: taskSubjectId || undefined,
      topicId: taskTopicId || undefined,
      tests: Number(taskTests) || 1,
      notes: taskNotes.trim() || undefined,
      mistakesList: cleanedMistakes,
      done: editingTask ? editingTask.done : false,
      createdAt: editingTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      googleEventId: editingTask?.googleEventId,
    };

    let updatedTasks = editingTask
      ? state.tasks.map((t) => (t.id === editingTask.id ? taskObj : t))
      : [...state.tasks, taskObj];

    // Optionally mirror valid mistakes to Error Intelligence
    let updatedErrors = [...state.errors];
    cleanedMistakes.forEach((m) => {
      if (m.mistake.trim()) {
        const existingErr = updatedErrors.find((err) => err.id === m.errorId);
        if (!existingErr) {
          const newErr: ErrorItem = {
            id: m.errorId || uid(),
            title: m.mistake.trim(),
            subjectId: taskSubjectId || state.subjects[0]?.id || '',
            topicId: m.topicId,
            type: 'From planned task report',
            date: taskDate,
            cause: m.reason.trim() || 'Cause not identified',
            action: m.solution.trim() || 'No action defined yet',
            status: 'open',
            taskId: taskObj.id,
          };
          m.errorId = newErr.id;
          updatedErrors.push(newErr);
        } else {
          existingErr.cause = m.reason.trim() || existingErr.cause;
          existingErr.action = m.solution.trim() || existingErr.action;
        }
      }
    });

    if (hasCalendarToken && accessToken && syncWithGoogleImmediately) {
      try {
        const syncRes = await syncTaskToGoogle(
          accessToken,
          taskObj,
          getSubjectName(taskObj.subjectId)
        );
        const idx = updatedTasks.findIndex((t) => t.id === taskObj.id);
        if (idx !== -1) {
          updatedTasks[idx] = {
            ...taskObj,
            googleEventId: syncRes.eventId,
            syncedToGoogleAt: new Date().toISOString(),
          };
        }
        onShowToast(`Task saved & synced to Google Calendar!`, 'success');
      } catch (err: any) {
        console.warn('Sync failed on save:', err);
        onShowToast('Saved locally (Google Calendar notice: ' + err.message + ')', 'info');
      }
    } else {
      onShowToast(editingTask ? 'Task updated.' : 'Task scheduled.', 'success');
    }

    onUpdateState({ ...state, tasks: updatedTasks, errors: updatedErrors });
    setIsTaskModalOpen(false);
  };

  // Convert Google Calendar event to study task
  const handleConvertGoogleEvent = (gEvent: GoogleCalendarEvent) => {
    const startIso = gEvent.start.dateTime || gEvent.start.date || todayIso();
    const eventDate = startIso.slice(0, 10);
    const eventTime = gEvent.start.dateTime ? startIso.slice(11, 16) : undefined;

    const newTask: PlannedTask = {
      id: uid(),
      title: gEvent.summary,
      date: eventDate,
      time: eventTime,
      duration: 60,
      color: '#039be5',
      priority: 'normal',
      repeat: 'none',
      notes: gEvent.description || 'Imported from Google Calendar',
      done: false,
      googleEventId: gEvent.id,
      syncedToGoogleAt: new Date().toISOString(),
    };

    onUpdateState({
      ...state,
      tasks: [...state.tasks, newTask],
    });
    onShowToast(`Converted "${gEvent.summary}" to study task!`, 'success');
  };

  // "＋ Study report" action linking planned task to actual completed study log
  const handleOpenStudyReport = (task: PlannedTask) => {
    setLoggingTask(task);
    setLogMinutes(task.duration || 45);
    setLogCorrect(12);
    setLogWrong(2);
    setLogUnanswered(0);
    setLogMode(state.modes[0] || 'Practice');
    setLogNotes(task.notes || '');

    // Carry over task mistakes or create a clean starter entry
    const existing = task.mistakesList && task.mistakesList.length > 0 ? task.mistakesList : [];
    setReportMistakes(existing);
  };

  const handleAddMistakeToReport = () => {
    setReportMistakes((prev) => [
      ...prev,
      {
        id: uid(),
        mistake: '',
        reason: '',
        solution: '',
        subjectId: loggingTask?.subjectId,
      },
    ]);
  };

  const handleUpdateReportMistake = (
    id: string,
    field: 'mistake' | 'reason' | 'solution' | 'topicId',
    val: string
  ) => {
    setReportMistakes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  const handleRemoveReportMistake = (id: string) => {
    setReportMistakes((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSaveStudyReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingTask) return;

    const logId = uid();
    const cleanedMistakes = reportMistakes.filter(
      (m) => m.mistake.trim() || m.reason.trim() || m.solution.trim()
    );

    const newLog: StudyLog = {
      id: logId,
      date: loggingTask.date,
      subjectId: loggingTask.subjectId || state.subjects[0]?.id || '',
      mode: logMode,
      minutes: Number(logMinutes) || 0,
      tests: 1,
      correct: Number(logCorrect) || 0,
      wrong: Number(logWrong) || 0,
      unanswered: Number(logUnanswered) || 0,
      source: `Planned: ${loggingTask.title}`,
      notes: logNotes.trim() || undefined,
      mistakesList: cleanedMistakes,
      taskId: loggingTask.id,
    };

    // Mark planned task as completed and persist mistakes
    const updatedTasks = state.tasks.map((t) =>
      t.id === loggingTask.id
        ? {
            ...t,
            done: true,
            mistakesList: cleanedMistakes,
            updatedAt: new Date().toISOString(),
          }
        : t
    );

    // Sync with Error Intelligence if enabled
    let updatedErrors = [...state.errors];
    if (syncToErrorIntelligence && cleanedMistakes.length > 0) {
      cleanedMistakes.forEach((m) => {
        if (m.mistake.trim()) {
          const newErr: ErrorItem = {
            id: m.errorId || uid(),
            title: m.mistake.trim(),
            subjectId: loggingTask.subjectId || state.subjects[0]?.id || '',
            topicId: m.topicId,
            type: 'From study report',
            date: loggingTask.date,
            cause: m.reason.trim() || 'Cause not identified',
            action: m.solution.trim() || 'No action defined yet',
            status: 'open',
            logId,
            taskId: loggingTask.id,
          };
          m.errorId = newErr.id;
          updatedErrors.push(newErr);
        }
      });
    }

    onUpdateState({
      ...state,
      logs: [newLog, ...state.logs],
      tasks: updatedTasks,
      errors: updatedErrors,
    });

    setLoggingTask(null);
    onShowToast(`Completed study session logged with ${cleanedMistakes.length} mistake analyses!`, 'success');
  };

  // Export .ics calendar file
  const handleExportIcs = () => {
    const icsContent = generateIcs(state.tasks, getSubjectName);
    downloadFile(`vega-core-calendar-${todayIso()}.ics`, icsContent, 'text/calendar;charset=utf-8');
    onShowToast('Calendar exported as .ics file.', 'success');
  };

  // Navigation shifts
  const shiftPeriod = (delta: number) => {
    const d = new Date(currentDateFocus);
    if (viewMode === 'day') {
      d.setDate(d.getDate() + delta);
      setSelectedDate(d.toISOString().slice(0, 10));
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + delta * 7);
    } else if (viewMode === 'month') {
      d.setMonth(d.getMonth() + delta);
    } else if (viewMode === 'year') {
      d.setFullYear(d.getFullYear() + delta);
    } else {
      d.setDate(d.getDate() + delta);
    }
    setCurrentDateFocus(d);
  };

  const jumpToToday = () => {
    const d = new Date(todayIso() + 'T12:00:00');
    setCurrentDateFocus(d);
    setSelectedDate(todayIso());
  };

  // Weekly View Calculations
  const weekStartDay = state.preferences.weekStart ?? 1;
  const currentWeekStart = weekStart(currentDateFocus.toISOString().slice(0, 10), weekStartDay);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(currentWeekStart, i);
    const dayObj = dateObj(iso);
    return {
      iso,
      name: dayObj.toLocaleDateString(undefined, { weekday: 'short' }),
      num: dayObj.getDate(),
      isToday: iso === todayIso(),
      isSelected: iso === selectedDate,
    };
  });

  // 24-hour timeline slots
  const hoursTimeline = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

  // Month View Calculations (42 days)
  const monthStart = new Date(currentDateFocus.getFullYear(), currentDateFocus.getMonth(), 1, 12);
  const firstOffset = (monthStart.getDay() - weekStartDay + 7) % 7;
  const monthGridStart = new Date(monthStart);
  monthGridStart.setDate(1 - firstOffset);

  const monthDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(monthGridStart);
    d.setDate(monthGridStart.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayTasks = state.tasks.filter((t) => t.date === iso);
    const dayGEvents = googleEvents.filter((e) => (e.start.dateTime || e.start.date || '').slice(0, 10) === iso);

    return {
      iso,
      dayNum: d.getDate(),
      isCurrentMonth: d.getMonth() === currentDateFocus.getMonth(),
      isToday: iso === todayIso(),
      isSelected: iso === selectedDate,
      tasks: dayTasks,
      googleEvents: dayGEvents,
    };
  });

  // Yearly View Calculations (12 months overview)
  const currentYear = currentDateFocus.getFullYear();
  const yearMonths = Array.from({ length: 12 }, (_, m) => {
    const mDate = new Date(currentYear, m, 1, 12);
    const mName = mDate.toLocaleDateString(undefined, { month: 'short' });
    const mDaysCount = new Date(currentYear, m + 1, 0).getDate();
    const tasksInMonth = state.tasks.filter((t) => t.date.startsWith(`${currentYear}-${String(m + 1).padStart(2, '0')}`));
    return {
      monthIdx: m,
      name: mName,
      daysCount: mDaysCount,
      tasksCount: tasksInMonth.length,
      completedCount: tasksInMonth.filter((t) => t.done).length,
    };
  });

  const availableTopics = (subjId?: string) =>
    state.subjects.find((s) => s.id === subjId)?.topics || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Google Multi-Device Synchronization Banner */}
      <div className="glass-card p-5 rounded-3xl border border-sky-400/30 bg-gradient-to-r from-sky-950/30 via-slate-900/40 to-slate-900/60 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-sky-500/20 text-sky-200 border border-sky-400/30 shadow-inner">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Google Calendar & Time-Planning Workspace
                </h3>
                {hasCalendarToken && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                Full-featured Google Calendar experience with dedicated mistake analysis. Record what went wrong, why it happened, and corrective solutions directly with your scheduled tasks.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportIcs}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 transition-colors"
              title="Download iCalendar file (.ics)"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Export .ics</span>
            </button>

            {hasCalendarToken ? (
              <>
                <button
                  onClick={handleSyncAllTasks}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync all tasks</span>
                </button>
                <button
                  onClick={() => handleFetchGoogleEvents()}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Pull Google events</span>
                </button>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-300" />
                  <span>Google Calendar</span>
                </a>
              </>
            ) : (
              <button
                onClick={onSignInWithGoogle}
                className="gsi-material-button text-xs !h-9 shadow-md"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Connect with Google</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View Switcher Bar & Main Google Calendar Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftPeriod(-1)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={jumpToToday}
              className="px-3 py-1.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 font-semibold"
            >
              Today
            </button>
            <button
              onClick={() => shiftPeriod(1)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base font-bold text-white tracking-tight">
            {viewMode === 'year'
              ? currentYear
              : viewMode === 'month'
              ? currentDateFocus.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
              : viewMode === 'week'
              ? `Week of ${dateLabel(currentWeekStart)}`
              : dateLabel(selectedDate)}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle pills */}
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/10">
            {[
              { id: 'month' as const, label: 'Month', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
              { id: 'week' as const, label: 'Week', icon: <CalendarDays className="w-3.5 h-3.5" /> },
              { id: 'day' as const, label: 'Day', icon: <Clock className="w-3.5 h-3.5" /> },
              { id: 'agenda' as const, label: 'Schedule', icon: <List className="w-3.5 h-3.5" /> },
              { id: 'year' as const, label: 'Year', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === v.id
                    ? 'bg-sky-500/30 text-white border border-sky-400/30 shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {v.icon}
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => openTaskModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/80 hover:bg-sky-500 text-xs font-semibold text-white shadow-lg shadow-sky-950/40 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create event</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: GOOGLE CALENDAR WEEKLY VIEW */}
      {viewMode === 'week' && (
        <div className="glass-card rounded-3xl overflow-hidden border border-white/10">
          {/* Weekday columns header */}
          <div className="grid grid-cols-8 border-b border-white/10 bg-white/5 text-center text-xs font-bold text-zinc-300">
            <div className="p-3 text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-center">
              Time
            </div>
            {weekDays.map((wd) => (
              <div
                key={wd.iso}
                onClick={() => {
                  setSelectedDate(wd.iso);
                  setCurrentDateFocus(new Date(wd.iso + 'T12:00:00'));
                }}
                className={`p-3 cursor-pointer transition-colors border-l border-white/5 ${
                  wd.isToday ? 'bg-sky-500/20 text-sky-200' : 'hover:bg-white/5'
                }`}
              >
                <div className="text-[10px] uppercase font-semibold text-zinc-400">{wd.name}</div>
                <div
                  className={`text-base font-extrabold mt-0.5 ${
                    wd.isToday ? 'text-sky-300' : 'text-white'
                  }`}
                >
                  {wd.num}
                </div>
              </div>
            ))}
          </div>

          {/* All-Day Events row */}
          <div className="grid grid-cols-8 border-b border-white/10 bg-white/[0.02] text-xs min-h-[38px]">
            <div className="p-2 text-right pr-3 text-[10px] font-semibold text-zinc-400 select-none flex items-center justify-end">
              All-day
            </div>
            {weekDays.map((wd) => {
              const allDayTasks = state.tasks.filter((t) => t.date === wd.iso && t.isAllDay);
              return (
                <div key={wd.iso} className="border-l border-white/5 p-1 space-y-1">
                  {allDayTasks.map((t) => {
                    const color = getTaskDisplayColor(t);
                    return (
                      <div
                        key={t.id}
                        onClick={() => openTaskModal(t)}
                        style={{ borderLeftColor: color }}
                        className="p-1 rounded text-[10px] font-semibold bg-white/10 border-l-2 text-white truncate cursor-pointer hover:bg-white/20 transition-colors flex items-center justify-between gap-1"
                        title={t.title}
                      >
                        <span className="truncate">{t.title}</span>
                        {t.mistakesList && t.mistakesList.length > 0 && (
                          <span className="text-[8px] px-1 rounded bg-rose-500/30 text-rose-200 shrink-0">
                            {t.mistakesList.length} m
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Time grid table */}
          <div className="max-h-[640px] overflow-y-auto divide-y divide-white/5">
            {hoursTimeline.map((hour) => (
              <div key={hour} className="grid grid-cols-8 min-h-[58px]">
                {/* Time column */}
                <div className="p-2 text-right pr-3 text-[10px] font-semibold text-zinc-500 select-none">
                  {hour}
                </div>

                {/* 7 Day slots */}
                {weekDays.map((wd) => {
                  const dayHourTasks = state.tasks.filter((t) => {
                    if (t.date !== wd.iso || t.isAllDay) return false;
                    if (!t.time) return hour === '09:00';
                    return t.time.slice(0, 2) === hour.slice(0, 2);
                  });

                  const dayHourGEvents = googleEvents.filter((ge) => {
                    const eStart = ge.start.dateTime || ge.start.date || '';
                    if (!eStart.startsWith(wd.iso)) return false;
                    if (!ge.start.dateTime) return false;
                    return eStart.slice(11, 13) === hour.slice(0, 2);
                  });

                  return (
                    <div
                      key={wd.iso}
                      onClick={() => openTaskModal(undefined, wd.iso, hour)}
                      className="border-l border-white/5 p-1 hover:bg-white/[0.04] transition-colors relative cursor-pointer group"
                    >
                      <div className="space-y-1">
                        {dayHourTasks.map((t) => {
                          const color = getTaskDisplayColor(t);
                          return (
                            <div
                              key={t.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openTaskModal(t);
                              }}
                              style={{
                                backgroundColor: t.done
                                  ? 'rgba(255, 255, 255, 0.05)'
                                  : `${color}25`,
                                borderLeftColor: color,
                              }}
                              className={`p-1.5 rounded-lg text-[10px] font-medium leading-tight border-l-3 border border-white/10 transition-all ${
                                t.done ? 'line-through opacity-50' : 'text-white shadow hover:scale-[1.02]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold truncate">{t.title}</span>
                                {t.mistakesList && t.mistakesList.length > 0 && (
                                  <span className="text-[8px] px-1 rounded bg-rose-500/30 text-rose-200 font-bold shrink-0">
                                    {t.mistakesList.length} mistake{t.mistakesList.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-zinc-300 truncate mt-0.5">
                                {t.time || 'All day'} · {t.duration}m · {getSubjectName(t.subjectId)}
                              </div>
                            </div>
                          );
                        })}

                        {dayHourGEvents.map((ge) => (
                          <div
                            key={ge.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConvertGoogleEvent(ge);
                            }}
                            className="p-1.5 rounded-lg text-[10px] font-medium leading-tight bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 shadow truncate"
                            title="Google Calendar Event - Click to convert to study task"
                          >
                            <span className="font-semibold">{ge.summary}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: GOOGLE CALENDAR MONTHLY VIEW */}
      {viewMode === 'month' && (
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider py-1 border-b border-white/10">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
            <div>Sun</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((day, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDate(day.iso);
                }}
                className={`min-h-[105px] p-2 rounded-2xl flex flex-col justify-between border transition-all cursor-pointer ${
                  day.isSelected
                    ? 'bg-sky-500/20 border-sky-400/50 shadow-md ring-1 ring-sky-400/40'
                    : day.isToday
                    ? 'bg-white/10 border-sky-400/30'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5'
                } ${!day.isCurrentMonth ? 'opacity-30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      day.isToday ? 'text-sky-300' : 'text-zinc-200'
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  <div className="flex items-center gap-1">
                    {day.tasks.length > 0 && (
                      <span className="text-[9px] px-1 rounded-full bg-white/10 text-zinc-300 font-semibold">
                        {day.tasks.length}
                      </span>
                    )}
                    {day.isToday && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  </div>
                </div>

                <div className="space-y-1 mt-1 overflow-hidden">
                  {day.tasks.slice(0, 3).map((t) => {
                    const color = getTaskDisplayColor(t);
                    return (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskModal(t);
                        }}
                        style={{
                          backgroundColor: t.done ? 'rgba(255,255,255,0.05)' : `${color}25`,
                          borderLeftColor: color,
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded truncate font-medium border-l-2 flex items-center justify-between gap-1 ${
                          t.done ? 'text-zinc-400 line-through' : 'text-white'
                        }`}
                      >
                        <span className="truncate">
                          {t.time ? `${t.time} ` : ''}
                          {t.title}
                        </span>
                        {t.mistakesList && t.mistakesList.length > 0 && (
                          <span className="text-[8px] text-rose-300 font-bold shrink-0">
                            ● {t.mistakesList.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {day.tasks.length > 3 && (
                    <div className="text-[9px] text-zinc-400 font-semibold px-1">
                      +{day.tasks.length - 3} more
                    </div>
                  )}
                  {day.googleEvents.length > 0 && (
                    <div className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 truncate">
                      {day.googleEvents[0].summary}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: DAY VIEW */}
      {viewMode === 'day' && (
        <div className="glass-card p-6 rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Day Schedule: {dateLabel(selectedDate)}
              </h4>
              <p className="text-xs text-zinc-400">
                Detailed hourly timeline with mistake analysis. Click any time slot to schedule a task or log study reports.
              </p>
            </div>
            <button
              onClick={() => openTaskModal(undefined, selectedDate, '09:00')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 text-xs font-semibold text-sky-100 border border-sky-400/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add task for this day</span>
            </button>
          </div>

          <div className="max-h-[640px] overflow-y-auto divide-y divide-white/5">
            {hoursTimeline.map((hour) => {
              const dayTasks = state.tasks.filter((t) => {
                if (t.date !== selectedDate) return false;
                if (t.isAllDay) return false;
                if (!t.time) return hour === '09:00';
                return t.time.slice(0, 2) === hour.slice(0, 2);
              });

              return (
                <div
                  key={hour}
                  onClick={() => openTaskModal(undefined, selectedDate, hour)}
                  className="flex items-start gap-4 p-2.5 min-h-[58px] hover:bg-white/[0.03] transition-colors rounded-xl cursor-pointer group"
                >
                  <div className="w-14 text-right text-xs font-semibold text-zinc-400 shrink-0 pt-0.5 select-none">
                    {hour}
                  </div>
                  <div className="flex-1 space-y-2">
                    {dayTasks.map((t) => {
                      const color = getTaskDisplayColor(t);
                      return (
                        <div
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskModal(t);
                          }}
                          style={{
                            backgroundColor: `${color}25`,
                            borderLeftColor: color,
                          }}
                          className="p-3 rounded-xl border-l-4 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${t.done ? 'line-through text-zinc-400' : 'text-white'}`}>
                                {t.title}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-sky-200">
                                {getSubjectName(t.subjectId)}
                              </span>
                              {t.mistakesList && t.mistakesList.length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                                  {t.mistakesList.length} mistake analysis recorded
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-300 mt-1">
                              {t.time || 'Timed'} · {t.duration} minutes {t.notes ? `· ${t.notes}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStudyReport(t);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-xs font-semibold"
                              title="Log study results and analyze mistakes for this task"
                            >
                              <FileText className="w-3 h-3" />
                              <span>＋ Study report</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTask(t);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium"
                            >
                              {t.done ? 'Mark incomplete' : 'Mark done'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteTask(t);
                              }}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 4: FULL AGENDA / SCHEDULE VIEW */}
      {viewMode === 'agenda' && (
        <div className="glass-card p-6 rounded-3xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-bold text-white tracking-tight">Full Agenda & Schedule</h4>
              <p className="text-xs text-zinc-400">Chronological schedule of tasks and Google Calendar events</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'today' as const, label: 'Today' },
                { id: 'date' as const, label: 'Selected date' },
                { id: 'week' as const, label: 'Next 7 days' },
                { id: 'overdue' as const, label: 'Overdue' },
                { id: 'all' as const, label: 'All' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAgendaFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    agendaFilter === f.id
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30 font-semibold'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {state.tasks.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 text-xs text-zinc-400">
                No tasks found. Click "Create event" above to start your agenda.
              </div>
            ) : (
              state.tasks
                .filter((t) => {
                  if (agendaFilter === 'today') return t.date === todayIso();
                  if (agendaFilter === 'date') return t.date === selectedDate;
                  if (agendaFilter === 'week')
                    return t.date >= todayIso() && t.date <= addDays(todayIso(), 7);
                  if (agendaFilter === 'overdue') return !t.done && t.date < todayIso();
                  return true;
                })
                .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
                .map((t) => {
                  const color = getTaskDisplayColor(t);
                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        t.done ? 'bg-white/[0.02] border-white/5 opacity-60' : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => handleToggleTask(t)}
                          className="rounded border-white/20 text-sky-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className={`text-xs font-semibold ${t.done ? 'line-through text-zinc-400' : 'text-white'}`}>
                              {t.title}
                            </span>
                            {t.mistakesList && t.mistakesList.length > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {t.mistakesList.length} mistake(s)
                              </span>
                            )}
                            {t.googleEventId && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                                Google Synced
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {dateLabel(t.date)} {t.time ? `· ${t.time}` : '· All day'} · {t.duration}m · {getSubjectName(t.subjectId)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenStudyReport(t)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold border border-emerald-400/30"
                          title="Log study session and analyze mistakes"
                        >
                          <FileText className="w-3 h-3" />
                          <span>＋ Study report</span>
                        </button>

                        {hasCalendarToken && !t.googleEventId && (
                          <button
                            onClick={() => handleSyncTask(t)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-200 text-xs font-medium border border-sky-400/30"
                          >
                            Sync
                          </button>
                        )}
                        <button
                          onClick={() => openTaskModal(t)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => requestDeleteTask(t)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* VIEW 5: YEARLY OVERVIEW & ROADMAP */}
      {viewMode === 'year' && (
        <div className="glass-card p-6 md:p-8 rounded-3xl space-y-6">
          <div>
            <h4 className="text-base font-bold text-white tracking-tight">
              {currentYear} Academic Year Roadmap
            </h4>
            <p className="text-xs text-zinc-400">
              Annual bird's-eye view of your study distribution, task completion, and milestones.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {yearMonths.map((ym) => (
              <div
                key={ym.monthIdx}
                onClick={() => {
                  const d = new Date(currentYear, ym.monthIdx, 1, 12);
                  setCurrentDateFocus(d);
                  setViewMode('month');
                }}
                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-sky-400/30 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm text-white">{ym.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-zinc-300">
                    {ym.daysCount} days
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-300">
                    <span>Scheduled tasks:</span>
                    <strong className="text-white">{ym.tasksCount}</strong>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>Completed:</span>
                    <strong className="text-emerald-300">{ym.completedCount}</strong>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-sky-300 font-semibold flex items-center justify-between">
                  <span>View month</span>
                  <span>↗</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Add / Edit Modal with DEDICATED MISTAKE-ANALYSIS AREA (Requirement 1) */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white tracking-tight mb-1">
              {editingTask ? 'Edit Event' : 'Create Event'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              Plan your study blocks, exams, and routines. Track multiple mistakes with causes and solutions directly with this task.
            </p>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deep Work: Cell Biology Flashcards"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Subject</label>
                  <select
                    value={taskSubjectId}
                    onChange={(e) => {
                      const sid = e.target.value;
                      setTaskSubjectId(sid);
                      const s = state.subjects.find((subj) => subj.id === sid);
                      if (s) setTaskColor(getSubjectColor(s));
                    }}
                    className="w-full glass-input text-xs"
                  >
                    <option value="">General / None</option>
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time fields with All-day toggle */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-200">All-day event</label>
                  <input
                    type="checkbox"
                    checked={taskIsAllDay}
                    onChange={(e) => setTaskIsAllDay(e.target.checked)}
                    className="rounded border-white/20 text-sky-500 cursor-pointer"
                  />
                </div>

                {!taskIsAllDay && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={taskStartTime}
                        onChange={(e) => setTaskStartTime(e.target.value)}
                        className="w-full glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">End Time</label>
                      <input
                        type="time"
                        value={taskEndTime}
                        onChange={(e) => setTaskEndTime(e.target.value)}
                        className="w-full glass-input text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Subject Color & Google Calendar Colors */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Event / Subject Color</label>
                <div className="flex flex-wrap gap-2">
                  {GOOGLE_CALENDAR_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTaskColor(c.hex)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        taskColor === c.hex ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Repeat Routine</label>
                  <select
                    value={taskRepeat}
                    onChange={(e) => setTaskRepeat(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Goals, question sets, or materials for this session"
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  className="w-full glass-input text-xs resize-none"
                />
              </div>

              {/* DEDICATED MISTAKE-ANALYSIS AREA (Requirement 1) */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-300" />
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-tight">
                        Dedicated Mistake Analysis Area
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        Record multiple mistakes with causes and corrective solutions.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMistakeToTask}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add mistake</span>
                  </button>
                </div>

                {taskMistakes.length === 0 ? (
                  <div className="p-3 text-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-400">
                    No mistakes logged yet. Click "Add mistake" to record what went wrong and how to fix it.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {taskMistakes.map((mItem, idx) => (
                      <div
                        key={mItem.id}
                        className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                            Mistake #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTaskMistake(mItem.id)}
                            className="text-zinc-400 hover:text-rose-300 text-xs font-bold px-1.5"
                            title="Remove mistake"
                          >
                            × Remove
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">
                            Mistake: What exactly did I get wrong? *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Inverted sign on vertical velocity component"
                            value={mItem.mistake}
                            onChange={(e) =>
                              handleUpdateTaskMistake(mItem.id, 'mistake', e.target.value)
                            }
                            className="w-full glass-input text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">
                              Reason: Why did I make this mistake?
                            </label>
                            <textarea
                              rows={2}
                              placeholder="e.g. Conceptual gap, formula recall slip, misread question"
                              value={mItem.reason}
                              onChange={(e) =>
                                handleUpdateTaskMistake(mItem.id, 'reason', e.target.value)
                              }
                              className="w-full glass-input text-xs resize-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">
                              Corrective Action / Solution: How to prevent recurrence?
                            </label>
                            <textarea
                              rows={2}
                              placeholder="e.g. Always sketch coordinate axis (+y up) before equations"
                              value={mItem.solution}
                              onChange={(e) =>
                                handleUpdateTaskMistake(mItem.id, 'solution', e.target.value)
                              }
                              className="w-full glass-input text-xs resize-none"
                            />
                          </div>
                        </div>

                        {availableTopics(taskSubjectId).length > 0 && (
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">
                              Topic Connection
                            </label>
                            <select
                              value={mItem.topicId || ''}
                              onChange={(e) =>
                                handleUpdateTaskMistake(mItem.id, 'topicId', e.target.value)
                              }
                              className="w-full glass-input text-xs py-1"
                            >
                              <option value="">General for subject</option>
                              {availableTopics(taskSubjectId).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {hasCalendarToken && (
                <div className="flex items-center gap-2 pt-1 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    id="syncImmediate"
                    checked={syncWithGoogleImmediately}
                    onChange={(e) => setSyncWithGoogleImmediately(e.target.checked)}
                    className="rounded border-white/20 text-sky-500"
                  />
                  <label htmlFor="syncImmediate" className="cursor-pointer">
                    Sync immediately to Google Calendar on phone & PC
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-500/80 hover:bg-sky-500 text-white shadow"
                >
                  {editingTask ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: "＋ Study report" from Planned Task with DEDICATED MISTAKE-ANALYSIS AREA (Requirement 1) */}
      {loggingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white tracking-tight mb-1">
              Log Study Report for: {loggingTask.title}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Turn your planned session into an official study log with question accuracy and multi-mistake analysis.
            </p>

            <form onSubmit={handleSaveStudyReport} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Subject</label>
                  <input
                    type="text"
                    disabled
                    value={getSubjectName(loggingTask.subjectId)}
                    className="w-full glass-input text-xs opacity-75"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                  <input
                    type="date"
                    disabled
                    value={loggingTask.date}
                    className="w-full glass-input text-xs opacity-75"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Study Mode</label>
                  <select
                    value={logMode}
                    onChange={(e) => setLogMode(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    {state.modes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Actual Duration (minutes) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Correct</label>
                  <input
                    type="number"
                    min="0"
                    value={logCorrect}
                    onChange={(e) => setLogCorrect(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Wrong</label>
                  <input
                    type="number"
                    min="0"
                    value={logWrong}
                    onChange={(e) => setLogWrong(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Unanswered</label>
                  <input
                    type="number"
                    min="0"
                    value={logUnanswered}
                    onChange={(e) => setLogUnanswered(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Session Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key takeaways or observations"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full glass-input text-xs resize-none"
                />
              </div>

              {/* DEDICATED MISTAKE-ANALYSIS AREA IN STUDY REPORT (Requirement 1) */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-300" />
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-tight">
                        Dedicated Mistake Analysis Area
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        Record each mistake with exact reasons and corrective actions.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMistakeToReport}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add mistake</span>
                  </button>
                </div>

                {reportMistakes.length === 0 ? (
                  <div className="p-3 text-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-400">
                    No mistakes logged for this report. Click "Add mistake" if you encountered any errors.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportMistakes.map((mItem, idx) => (
                      <div
                        key={mItem.id}
                        className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                            Mistake #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveReportMistake(mItem.id)}
                            className="text-zinc-400 hover:text-rose-300 text-xs font-bold px-1.5"
                          >
                            × Remove
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">
                            Mistake: What exactly did I get wrong? *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Forgot factor of 1/2 in kinetic energy formula"
                            value={mItem.mistake}
                            onChange={(e) =>
                              handleUpdateReportMistake(mItem.id, 'mistake', e.target.value)
                            }
                            className="w-full glass-input text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">
                              Reason: Why did I make this mistake?
                            </label>
                            <textarea
                              rows={2}
                              placeholder="e.g. Rushed under time pressure, forgot to write baseline equation"
                              value={mItem.reason}
                              onChange={(e) =>
                                handleUpdateReportMistake(mItem.id, 'reason', e.target.value)
                              }
                              className="w-full glass-input text-xs resize-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-zinc-400 mb-0.5">
                              Corrective Action / Solution: How to prevent recurrence?
                            </label>
                            <textarea
                              rows={2}
                              placeholder="e.g. Always write full algebraic form before substituting numerical values"
                              value={mItem.solution}
                              onChange={(e) =>
                                handleUpdateReportMistake(mItem.id, 'solution', e.target.value)
                              }
                              className="w-full glass-input text-xs resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    id="syncErrors"
                    checked={syncToErrorIntelligence}
                    onChange={(e) => setSyncToErrorIntelligence(e.target.checked)}
                    className="rounded border-white/20 text-rose-500"
                  />
                  <label htmlFor="syncErrors" className="cursor-pointer">
                    Also track these mistakes in Error Intelligence queue
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setLoggingTask(null)}
                  className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white shadow"
                >
                  Submit Study Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
