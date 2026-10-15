import React, { useState } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Bell,
  Trash2,
  Calendar,
  Palette,
  Cloud,
  Edit2,
  Check,
  Percent,
  Calculator,
  BookOpen,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { VegaState, PercentageMethod } from '../types';
import {
  todayIso,
  downloadFile,
  defaultState,
  totalQs,
  accuracy,
  fmt,
  computePercentage,
} from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface SettingsViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  user: User | null;
  hasCalendarToken: boolean;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateState,
  user,
  hasCalendarToken,
  onSignInWithGoogle,
  onSignOut,
  onShowToast,
}) => {
  const [newModeInput, setNewModeInput] = useState('');
  const [editingMode, setEditingMode] = useState<{ original: string; text: string } | null>(null);

  // Percentage Calculation Settings (Requirement 5)
  const [percentageMethod, setPercentageMethod] = useState<PercentageMethod>(
    state.preferences?.percentageMethod || 'attempt_accuracy'
  );
  const [penaltyDivisor, setPenaltyDivisor] = useState(state.scoring.divisor || 3);

  // Appearance & Calendar Preferences
  const [themePref, setThemePref] = useState<'blue' | 'sage' | 'lav' | 'peach'>(
    state.preferences.theme || 'blue'
  );
  const [calendarSystemPref, setCalendarSystemPref] = useState<'gregorian' | 'jalali'>(
    state.preferences.calendarSystem || 'gregorian'
  );
  const [weekStartPref, setWeekStartPref] = useState<number>(state.preferences.weekStart ?? 1);
  const [languagePref, setLanguagePref] = useState<'en' | 'fa'>(
    state.preferences.language || 'en'
  );

  // Google OAuth Settings
  const [googleClientId, setGoogleClientId] = useState(state.google?.clientId || '');
  const [googleCalendarId, setGoogleCalendarId] = useState(state.google?.calendarId || 'primary');

  // Cloud Sync Settings
  const [cloudUrl, setCloudUrl] = useState(state.cloud?.url || '');
  const [cloudKey, setCloudKey] = useState(state.cloud?.key || '');
  const [cloudEmail, setCloudEmail] = useState(state.cloud?.email || '');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudStatus, setCloudStatus] = useState<string>('Ready.');

  // Dashboard customization
  const [dashCards, setDashCards] = useState<string[]>(
    state.preferences.dashboardCards || ['hours', 'questions', 'average', 'errors']
  );

  // Reminders
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    !!state.preferences.notifications
  );
  const [reminderLead, setReminderLead] = useState(state.preferences.reminderLeadMinutes || 30);

  const [confirmReset, setConfirmReset] = useState(false);

  // Appearance Save
  const handleSaveAppearance = () => {
    onUpdateState({
      ...state,
      preferences: {
        ...state.preferences,
        theme: themePref,
        calendarSystem: calendarSystemPref,
        weekStart: Number(weekStartPref),
        language: languagePref,
      },
    });
    onShowToast('Appearance and calendar preferences saved.', 'success');
  };

  // Google settings save
  const handleSaveGoogleConfig = () => {
    onUpdateState({
      ...state,
      google: {
        clientId: googleClientId.trim(),
        connected: state.google?.connected || false,
        lastSync: state.google?.lastSync || '',
        calendarId: googleCalendarId,
      },
    });
    onShowToast('Google Calendar settings saved.', 'success');
  };

  // Study modes
  const handleAddMode = () => {
    const val = newModeInput.trim();
    if (!val) return;
    if (state.modes.some((m) => m.toLowerCase() === val.toLowerCase())) {
      onShowToast('This study mode already exists.', 'error');
      return;
    }
    onUpdateState({ ...state, modes: [...state.modes, val] });
    setNewModeInput('');
    onShowToast('Study mode added.', 'success');
  };

  const handleRemoveMode = (mode: string) => {
    if (state.modes.length <= 1) {
      onShowToast('You must keep at least one study mode.', 'error');
      return;
    }
    onUpdateState({ ...state, modes: state.modes.filter((m) => m !== mode) });
    onShowToast('Study mode removed from options (existing logs keep their label).', 'info');
  };

  const handleSaveRenameMode = (original: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === original) {
      setEditingMode(null);
      return;
    }
    if (state.modes.some((m) => m.toLowerCase() === clean.toLowerCase() && m !== original)) {
      onShowToast('A study mode with this name already exists.', 'error');
      return;
    }
    const updatedModes = state.modes.map((m) => (m === original ? clean : m));
    const updatedLogs = state.logs.map((l) => (l.mode === original ? { ...l, mode: clean } : l));
    onUpdateState({
      ...state,
      modes: updatedModes,
      logs: updatedLogs,
    });
    setEditingMode(null);
    onShowToast(`Renamed study mode to "${clean}". Updated existing logs.`, 'success');
  };

  // Percentage Calculation Settings (Requirement 5)
  const handleSavePercentageSettings = (method: PercentageMethod, div?: number) => {
    const divisor = div !== undefined ? div : Number(penaltyDivisor) || 3;
    setPercentageMethod(method);
    setPenaltyDivisor(divisor);
    onUpdateState({
      ...state,
      preferences: {
        ...state.preferences,
        percentageMethod: method,
      },
      scoring: {
        method: method === 'negative_marking' ? 'negative' : 'raw',
        divisor,
      },
    });
    onShowToast(
      `Percentage calculation method saved: ${
        method === 'attempt_accuracy'
          ? 'Attempt Accuracy'
          : method === 'correct_answer_rate'
          ? 'Correct Answer Rate'
          : 'Negative Marking'
      }. Affects all analytical displays immediately.`,
      'success'
    );
  };

  // Dashboard layout
  const handleToggleCard = (cardKey: string) => {
    const next = dashCards.includes(cardKey)
      ? dashCards.filter((k) => k !== cardKey)
      : [...dashCards, cardKey];
    setDashCards(next);
    onUpdateState({
      ...state,
      preferences: { ...state.preferences, dashboardCards: next },
    });
    onShowToast('Dashboard layout updated.', 'success');
  };

  // Backups and exports
  const handleExportJson = () => {
    downloadFile(
      `vega-core-backup-${todayIso()}.json`,
      JSON.stringify(state, null, 2),
      'application/json'
    );
    onShowToast('Exported full JSON backup.', 'success');
  };

  const handleExportLogsCsv = () => {
    const getSubj = (id: string) => state.subjects.find((s) => s.id === id)?.name || id;
    const getTop = (sid: string, tid?: string) =>
      state.subjects.find((s) => s.id === sid)?.topics.find((t) => t.id === tid)?.name || '';

    const headers = [
      'date',
      'subject',
      'topic',
      'mode',
      'minutes',
      'correct',
      'wrong',
      'unanswered',
      'total_questions',
      'accuracy_percent',
      'source',
      'notes',
    ];
    const rows = state.logs.map((l) => [
      l.date,
      getSubj(l.subjectId),
      getTop(l.subjectId, l.topicId),
      l.mode,
      l.minutes,
      l.correct,
      l.wrong,
      l.unanswered,
      totalQs(l),
      accuracy(l) ?? '',
      l.source || '',
      l.notes || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    downloadFile(`vega-core-study-logs-${todayIso()}.csv`, csv, 'text/csv;charset=utf-8');
    onShowToast('Exported study logs CSV.', 'success');
  };

  const handleExportAllReport = () => {
    const getSubj = (id: string) => state.subjects.find((s) => s.id === id)?.name || id;
    const rows = [['record_type', 'id', 'date', 'title', 'subject', 'details']];

    state.logs.forEach((x) =>
      rows.push([
        'study_log',
        x.id,
        x.date,
        x.source || 'Study session',
        getSubj(x.subjectId),
        `minutes=${x.minutes};correct=${x.correct};wrong=${x.wrong};unanswered=${x.unanswered};notes=${x.notes || ''}`,
      ])
    );

    state.assessments.forEach((x) =>
      rows.push([
        'assessment',
        x.id,
        x.date,
        x.name,
        getSubj(x.subjectId),
        `score=${x.score ?? ''};total=${x.total};correct=${x.correct};wrong=${x.wrong};notes=${x.notes || ''}`,
      ])
    );

    state.errors.forEach((x) =>
      rows.push([
        'error',
        x.id,
        x.date,
        x.title,
        getSubj(x.subjectId),
        `status=${x.status};cause=${x.cause || ''};action=${x.action || ''};due=${x.due || ''}`,
      ])
    );

    state.tasks.forEach((x) =>
      rows.push([
        'planned_task',
        x.id,
        x.date,
        x.title,
        getSubj(x.subjectId || ''),
        `time=${x.time || ''};duration=${x.duration};done=${x.done};priority=${x.priority}`,
      ])
    );

    const csv = rows
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    downloadFile(`vega-core-full-report-${todayIso()}.csv`, csv, 'text/csv;charset=utf-8');
    onShowToast('Exported complete all-records report CSV.', 'success');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.logs)) {
        throw new Error('Invalid schema');
      }

      const confirmed = window.confirm(
        'Importing this backup will replace your current workspace. Proceed?'
      );
      if (!confirmed) return;

      onUpdateState({
        ...defaultState(),
        ...parsed,
      });
      onShowToast('Backup imported successfully!', 'success');
    } catch (err) {
      onShowToast('Could not parse this JSON backup file.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Snapshots
  const snaps: { time: number; data: string }[] = JSON.parse(
    localStorage.getItem('vegaCoreSnapshots') || '[]'
  );

  const handleRestoreLatestSnapshot = () => {
    if (!snaps.length) {
      onShowToast('No local snapshots available.', 'info');
      return;
    }
    const confirmed = window.confirm(
      'Restore the latest automatic snapshot? Current workspace will be replaced.'
    );
    if (!confirmed) return;

    try {
      const restored = JSON.parse(snaps[0].data);
      onUpdateState(restored);
      onShowToast('Restored latest snapshot.', 'success');
    } catch (e) {
      onShowToast('Failed restoring snapshot.', 'error');
    }
  };

  const handleDownloadSnapshotHistory = () => {
    downloadFile(
      `vega-core-snapshots-${todayIso()}.json`,
      JSON.stringify(snaps, null, 2),
      'application/json'
    );
    onShowToast('Downloaded snapshot history.', 'success');
  };

  // Reminders
  const handleEnableReminders = async () => {
    if (!('Notification' in window)) {
      onShowToast('This browser does not support web notifications.', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    const isGranted = perm === 'granted';
    setNotificationsEnabled(isGranted);
    onUpdateState({
      ...state,
      preferences: {
        ...state.preferences,
        notifications: isGranted,
        reminderLeadMinutes: Number(reminderLead) || 30,
      },
    });
    onShowToast(
      isGranted ? 'Reminders enabled for active sessions.' : 'Notification permission was denied.',
      isGranted ? 'success' : 'info'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">Settings & data</h3>
        <p className="text-xs text-zinc-400">
          Personalize study configurations, sync with Google Calendar, and manage backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance & Calendar Preferences */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-sky-300" />
              <h4 className="text-sm font-bold text-white tracking-tight">
                Appearance & calendar
              </h4>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              Personalize interface accent colors, choose how dates are formatted, and specify your preferred calendar system.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Accent theme</label>
                <select
                  value={themePref}
                  onChange={(e) => setThemePref(e.target.value as any)}
                  className="w-full glass-input text-xs"
                >
                  <option value="blue">Mist blue</option>
                  <option value="sage">Soft sage</option>
                  <option value="lav">Muted lilac</option>
                  <option value="peach">Warm sand</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Default calendar</label>
                <select
                  value={calendarSystemPref}
                  onChange={(e) => setCalendarSystemPref(e.target.value as any)}
                  className="w-full glass-input text-xs"
                >
                  <option value="gregorian">Gregorian</option>
                  <option value="jalali">Persian (Jalali)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Week starts on</label>
                <select
                  value={weekStartPref}
                  onChange={(e) => setWeekStartPref(Number(e.target.value))}
                  className="w-full glass-input text-xs"
                >
                  <option value="1">Monday</option>
                  <option value="0">Sunday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Interface language</label>
                <select
                  value={languagePref}
                  onChange={(e) => setLanguagePref(e.target.value as any)}
                  className="w-full glass-input text-xs"
                >
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
            <button
              onClick={handleSaveAppearance}
              className="px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100"
            >
              Save appearance & calendar
            </button>
          </div>
        </div>

        {/* Google Calendar & Multi-Device Sync Card */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-sky-300" />
              <h4 className="text-sm font-bold text-white tracking-tight">
                Google Calendar & Multi-Device Sync
              </h4>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Vega Core syncs study sessions, project milestones, and exam reviews directly to your Google Calendar. Because Google Calendar runs natively on your <strong>phone</strong> (Android/iOS) and <strong>computer</strong>, your schedule stays in sync everywhere.
            </p>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Connection Status:</span>
                {hasCalendarToken && user ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected ({user.email})
                  </span>
                ) : (
                  <span className="font-semibold text-amber-300">Not connected</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Target Calendar:</span>
                <span className="text-zinc-200 font-medium">Primary Google Calendar</span>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Custom Google OAuth Client ID (optional)
              </label>
              <input
                type="text"
                placeholder="your-client-id.apps.googleusercontent.com"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                className="w-full glass-input text-xs"
              />
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
            <button
              onClick={handleSaveGoogleConfig}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-200"
            >
              Save Google settings
            </button>

            {hasCalendarToken && user ? (
              <div className="flex items-center gap-2">
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open calendar</span>
                </a>
                <button
                  onClick={onSignOut}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-medium"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={onSignInWithGoogle}
                className="gsi-material-button text-xs !h-9 shadow"
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
                  <span className="gsi-material-button-contents">Sign in with Google</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Percentage Calculation Settings Section (Requirement 5) */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between border border-sky-400/20">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-sky-400" />
              <h4 className="text-sm font-bold text-white tracking-tight">
                Percentage Calculation Settings
              </h4>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              Configure how practice accuracy and test percentages are calculated across charts, reports, and analytics. Distinguish between attempted items and overall question sets.
            </p>

            {/* Methods Selection */}
            <div className="space-y-3">
              {/* Option 1: Attempt Accuracy */}
              <div
                onClick={() => handleSavePercentageSettings('attempt_accuracy')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  percentageMethod === 'attempt_accuracy'
                    ? 'bg-sky-500/15 border-sky-400/40 shadow-sm'
                    : 'bg-white/5 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="percentageMethod"
                      checked={percentageMethod === 'attempt_accuracy'}
                      onChange={() => handleSavePercentageSettings('attempt_accuracy')}
                      className="text-sky-500 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-white">Attempt Accuracy</span>
                  </div>
                  {percentageMethod === 'attempt_accuracy' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 font-semibold">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-sky-300 bg-black/30 p-2 rounded-lg my-1.5 border border-white/5">
                  Accuracy = Correct ÷ (Correct + Incorrect) × 100
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Evaluates performance only on questions you chose to attempt. Skipped or unanswered questions are omitted from the denominator.
                </p>
              </div>

              {/* Option 2: Correct Answer Rate */}
              <div
                onClick={() => handleSavePercentageSettings('correct_answer_rate')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  percentageMethod === 'correct_answer_rate'
                    ? 'bg-sky-500/15 border-sky-400/40 shadow-sm'
                    : 'bg-white/5 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="percentageMethod"
                      checked={percentageMethod === 'correct_answer_rate'}
                      onChange={() => handleSavePercentageSettings('correct_answer_rate')}
                      className="text-sky-500 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-white">Correct Answer Rate</span>
                  </div>
                  {percentageMethod === 'correct_answer_rate' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 font-semibold">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-emerald-300 bg-black/30 p-2 rounded-lg my-1.5 border border-white/5">
                  Answer Rate = Correct ÷ Total Questions × 100
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Total Questions = Correct + Incorrect + Unanswered. Evaluates curriculum mastery; unattempted questions count as zero credit.
                </p>
              </div>

              {/* Option 3: Negative Marking */}
              <div
                onClick={() => handleSavePercentageSettings('negative_marking')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  percentageMethod === 'negative_marking'
                    ? 'bg-sky-500/15 border-sky-400/40 shadow-sm'
                    : 'bg-white/5 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="percentageMethod"
                      checked={percentageMethod === 'negative_marking'}
                      onChange={() => handleSavePercentageSettings('negative_marking')}
                      className="text-sky-500 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-white">Negative Marking (Exam Simulation)</span>
                  </div>
                  {percentageMethod === 'negative_marking' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 font-semibold">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-amber-300 bg-black/30 p-2 rounded-lg my-1.5 border border-white/5">
                  Score = [Correct − (Incorrect ÷ {penaltyDivisor})] ÷ Total Questions × 100
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-[11px] text-zinc-400">Penalty divisor:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={penaltyDivisor}
                    onChange={(e) => {
                      const div = Number(e.target.value);
                      setPenaltyDivisor(div);
                      if (percentageMethod === 'negative_marking') {
                        handleSavePercentageSettings('negative_marking', div);
                      }
                    }}
                    className="w-16 glass-input text-xs py-1 text-center"
                  />
                  <span className="text-[10px] text-zinc-500">e.g. 3 for -1/3 penalty per wrong answer</span>
                </div>
              </div>
            </div>

            {/* Live Example Demonstration Box */}
            <div className="mt-4 p-3.5 rounded-xl bg-black/25 border border-white/10 text-xs">
              <span className="font-semibold text-zinc-300 block mb-1">Live Comparison for 20 Correct, 5 Wrong, 5 Unanswered:</span>
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div className="p-2 rounded-lg bg-white/5">
                  <span className="text-[9px] text-zinc-400 block">Attempt Accuracy</span>
                  <strong className="text-sm text-sky-300 mt-0.5 block">80.0%</strong>
                  <span className="text-[9px] text-zinc-500">20 / 25</span>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <span className="text-[9px] text-zinc-400 block">Correct Answer Rate</span>
                  <strong className="text-sm text-emerald-300 mt-0.5 block">66.7%</strong>
                  <span className="text-[9px] text-zinc-500">20 / 30</span>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <span className="text-[9px] text-zinc-400 block">Negative Marking (÷3)</span>
                  <strong className="text-sm text-amber-300 mt-0.5 block">61.1%</strong>
                  <span className="text-[9px] text-zinc-500">(20 - 1.67) / 30</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Historical counts preserved; percentages update dynamically.</span>
            <span className="font-semibold text-sky-300">Auto-saved</span>
          </div>
        </div>

        {/* Custom Study Modes Section (Requirement 4) */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <h4 className="text-sm font-bold text-white tracking-tight">Custom Study Modes</h4>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              Add custom modes to categorize your study activity. Renaming a mode automatically updates matching historical study logs.
            </p>

            {/* Add new mode input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="e.g. Flashcards, Active Recall, Lab Work"
                value={newModeInput}
                onChange={(e) => setNewModeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMode();
                  }
                }}
                className="flex-1 glass-input text-xs"
              />
              <button
                onClick={handleAddMode}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-semibold text-white shadow transition-all"
              >
                Add mode
              </button>
            </div>

            {/* Dynamic list with rename & logs count */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 block">
                Available Modes ({state.modes.length}):
              </span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {state.modes.map((mode) => {
                  const usageCount = state.logs.filter((l) => l.mode === mode).length;
                  const isEditingThis = editingMode?.original === mode;

                  return (
                    <div
                      key={mode}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-200"
                    >
                      {isEditingThis ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            value={editingMode.text}
                            onChange={(e) =>
                              setEditingMode({ ...editingMode, text: e.target.value })
                            }
                            className="flex-1 glass-input text-xs py-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveRenameMode(editingMode.original, editingMode.text);
                              } else if (e.key === 'Escape') {
                                setEditingMode(null);
                              }
                            }}
                          />
                          <button
                            onClick={() =>
                              handleSaveRenameMode(editingMode.original, editingMode.text)
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingMode(null)}
                            className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-white truncate">{mode}</span>
                            <span className="text-[10px] text-zinc-500">
                              ({usageCount} log{usageCount !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingMode({ original: mode, text: mode })}
                              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                              title="Rename mode (updates past records)"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleRemoveMode(mode)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                              title="Delete mode"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Modes are immediately selectable across Study Logs & Calendar.</span>
            <span className="font-semibold text-emerald-400">Persistent</span>
          </div>
        </div>

        {/* Dashboard Customization */}
        <div className="glass-card p-6 rounded-2xl">
          <h4 className="text-sm font-bold text-white tracking-tight mb-1">
            Dashboard customization
          </h4>
          <p className="text-[11px] text-zinc-400 mb-4">
            Choose which summary cards appear on Overview.
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-200">
            {[
              { id: 'hours', label: 'Study time logged' },
              { id: 'questions', label: 'Questions attempted' },
              { id: 'average', label: 'Assessment average' },
              { id: 'errors', label: 'Open error loops' },
            ].map((card) => (
              <label
                key={card.id}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={dashCards.includes(card.id)}
                  onChange={() => handleToggleCard(card.id)}
                  className="rounded border-white/20 text-sky-500 focus:ring-0"
                />
                <span>{card.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Browser Reminders */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-purple-300" />
              <h4 className="text-sm font-bold text-white tracking-tight">Browser reminders</h4>
            </div>
            <p className="text-[11px] text-zinc-400 mb-4">
              Receive notifications in this browser before scheduled study blocks.
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => {
                    if (e.target.checked) handleEnableReminders();
                    else {
                      setNotificationsEnabled(false);
                      onUpdateState({
                        ...state,
                        preferences: { ...state.preferences, notifications: false },
                      });
                    }
                  }}
                  className="rounded border-white/20 text-sky-500 focus:ring-0"
                />
                <span>Enable notifications while Vega Core is open</span>
              </label>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Reminder lead time (minutes before session)
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={reminderLead}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setReminderLead(v);
                    onUpdateState({
                      ...state,
                      preferences: { ...state.preferences, reminderLeadMinutes: v },
                    });
                  }}
                  className="w-32 glass-input text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 text-[11px] text-zinc-400">
            Google Calendar integration also provides native mobile notifications.
          </div>
        </div>

        {/* Data Portability & Backups */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight mb-1">Data portability</h4>
            <p className="text-[11px] text-zinc-400 mb-3">
              Export backups or download CSV reports anytime. Your data belongs to you.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/25 text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export full JSON backup</span>
              </button>
              <button
                onClick={handleExportLogsCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export logs CSV</span>
              </button>
              <button
                onClick={handleExportAllReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export all-records report</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Restore workspace from JSON backup
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportJson}
                className="w-full glass-input text-xs"
              />
            </div>
          </div>

          {/* Snapshots */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-semibold text-white block">Automatic local snapshots</span>
              <span className="text-[10px] text-zinc-400">
                {snaps.length} snapshot(s) stored locally in this browser.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestoreLatestSnapshot}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 hover:text-white"
              >
                Restore latest
              </button>
              <button
                onClick={handleDownloadSnapshotHistory}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 hover:text-white"
              >
                Export snapshots
              </button>
            </div>
          </div>
        </div>

        {/* Reset Workspace */}
        <div className="glass-card p-6 rounded-2xl border-rose-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 text-rose-300">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="text-sm font-bold tracking-tight">Reset workspace</h4>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              Permanently clears locally stored Vega Core data from this browser and resets to default sample curriculum. Be sure to export a JSON backup first if needed.
            </p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset all data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmReset}
        title="Reset All Workspace Data?"
        message="This will permanently erase all your logs, scheduled calendar tasks, custom subjects, and error loops in this browser. Export a JSON backup before proceeding."
        confirmLabel="Erase and Reset"
        onConfirm={() => {
          onUpdateState(defaultState());
          setConfirmReset(false);
          onShowToast('Workspace reset to defaults.', 'info');
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};
