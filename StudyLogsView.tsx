import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Filter, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { VegaState, StudyLog, ErrorItem } from '../types';
import {
  todayIso,
  dateLabel,
  addDays,
  fmt,
  uid,
  logHours,
  totalQs,
  attemptedQs,
  attemptAccuracy,
  completionRate,
} from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface StudyLogsViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const StudyLogsView: React.FC<StudyLogsViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [filterSubject, setFilterSubject] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | '7' | '30'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<StudyLog | null>(null);

  // Form states
  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id || '');
  const [topicId, setTopicId] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [mode, setMode] = useState(state.modes[0] || 'Practice');
  const [date, setDate] = useState(todayIso());
  const [minutes, setMinutes] = useState(60);
  const [tests, setTests] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [unanswered, setUnanswered] = useState(0);
  const [source, setSource] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [mistakeReasons, setMistakeReasons] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedErrorIds, setSelectedErrorIds] = useState<string[]>([]);

  // Inline error creation
  const [showNewErrorForm, setShowNewErrorForm] = useState(false);
  const [newErrorTitle, setNewErrorTitle] = useState('');
  const [newErrorDue, setNewErrorDue] = useState('');
  const [newErrorCause, setNewErrorCause] = useState('');
  const [newErrorAction, setNewErrorAction] = useState('');
  const [newErrorRepeat, setNewErrorRepeat] = useState(false);

  const [confirmDeleteLog, setConfirmDeleteLog] = useState<StudyLog | null>(null);

  const getSubjectName = (id: string) => state.subjects.find((s) => s.id === id)?.name || 'Unknown';
  const getTopicName = (sid: string, tid?: string) =>
    state.subjects.find((s) => s.id === sid)?.topics.find((t) => t.id === tid)?.name ||
    'General / not specified';

  const cutoffDate =
    filterPeriod === '7'
      ? addDays(todayIso(), -7)
      : filterPeriod === '30'
      ? addDays(todayIso(), -30)
      : null;

  const filteredLogs = state.logs
    .filter(
      (l) =>
        (!filterSubject || l.subjectId === filterSubject) &&
        (!filterMode || l.mode === filterMode) &&
        (!cutoffDate || l.date >= cutoffDate)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const openLogModal = (log?: StudyLog) => {
    if (log) {
      setEditingLog(log);
      setSubjectId(log.subjectId);
      setTopicId(log.topicId || '');
      setSubtopic(log.subtopic || '');
      setMode(log.mode);
      setDate(log.date);
      setMinutes(log.minutes);
      setTests(log.tests ?? 1);
      setCorrect(log.correct);
      setWrong(log.wrong);
      setUnanswered(log.unanswered);
      setSource(log.source || '');
      setMistakes(log.mistakes || '');
      setMistakeReasons(log.mistakeReasons || '');
      setNextAction(log.nextAction || '');
      setNotes(log.notes || '');
      setSelectedErrorIds(
        log.errorIds ||
          state.errors.filter((e) => e.logId === log.id && e.status !== 'resolved').map((e) => e.id)
      );
    } else {
      setEditingLog(null);
      const initialSubj = state.subjects[0]?.id || '';
      setSubjectId(initialSubj);
      setTopicId('');
      setSubtopic('');
      setMode(state.modes[0] || 'Practice');
      setDate(todayIso());
      setMinutes(60);
      setTests(1);
      setCorrect(15);
      setWrong(3);
      setUnanswered(0);
      setSource('');
      setMistakes('');
      setMistakeReasons('');
      setNextAction('');
      setNotes('');
      setSelectedErrorIds([]);
    }
    setShowNewErrorForm(false);
    setNewErrorTitle('');
    setNewErrorDue('');
    setNewErrorCause('');
    setNewErrorAction('');
    setNewErrorRepeat(false);
    setIsModalOpen(true);
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      onShowToast('Please select or add a subject.', 'error');
      return;
    }

    if (
      Number(minutes) < 0 ||
      Number(correct) < 0 ||
      Number(wrong) < 0 ||
      Number(unanswered) < 0 ||
      Number(tests) < 0
    ) {
      onShowToast('Values cannot be negative.', 'error');
      return;
    }

    const logId = editingLog?.id || uid();
    const logObj: StudyLog = {
      id: logId,
      date,
      subjectId,
      topicId: topicId || undefined,
      subtopic: subtopic.trim() || undefined,
      mode,
      minutes: Number(minutes) || 0,
      tests: Number(tests) || 0,
      correct: Number(correct) || 0,
      wrong: Number(wrong) || 0,
      unanswered: Number(unanswered) || 0,
      source: source.trim() || undefined,
      mistakes: mistakes.trim() || undefined,
      mistakeReasons: mistakeReasons.trim() || undefined,
      nextAction: nextAction.trim() || undefined,
      notes: notes.trim() || undefined,
      errorIds: selectedErrorIds,
      taskId: editingLog?.taskId,
    };

    let updatedLogs = editingLog
      ? state.logs.map((l) => (l.id === editingLog.id ? logObj : l))
      : [logObj, ...state.logs];

    let updatedErrors = [...state.errors];

    // Link/unlink selected errors
    updatedErrors = updatedErrors.map((err) => {
      if (selectedErrorIds.includes(err.id)) {
        return { ...err, logId, subjectId, topicId: topicId || err.topicId };
      }
      if (err.logId === logId && !selectedErrorIds.includes(err.id)) {
        return { ...err, logId: null };
      }
      return err;
    });

    // Check if user also created a new error inline
    if (newErrorTitle.trim()) {
      const newErr: ErrorItem = {
        id: uid(),
        title: newErrorTitle.trim(),
        subjectId,
        topicId: topicId || undefined,
        type: 'From daily log',
        date,
        due: newErrorDue || undefined,
        cause: newErrorCause.trim() || 'Cause not identified',
        action: newErrorAction.trim() || 'No action defined yet',
        status: 'open',
        repeat: newErrorRepeat,
        logId,
      };
      updatedErrors.push(newErr);
      logObj.errorIds = [...(logObj.errorIds || []), newErr.id];
    }

    onUpdateState({
      ...state,
      logs: updatedLogs,
      errors: updatedErrors,
    });

    onShowToast(editingLog ? 'Study log updated.' : 'Study log recorded!', 'success');
    setIsModalOpen(false);
  };

  const currentTopics = state.subjects.find((s) => s.id === subjectId)?.topics || [];
  const openErrorsForSubject = state.errors.filter(
    (e) => e.status !== 'resolved' && e.subjectId === subjectId
  );

  // Live calculation metrics
  const totalQuestions = Number(correct) + Number(wrong) + Number(unanswered);
  const attemptedQuestions = Number(correct) + Number(wrong);
  const liveAttemptAccuracy =
    attemptedQuestions > 0 ? Math.round((Number(correct) / attemptedQuestions) * 100) : null;
  const liveCompletionRate =
    totalQuestions > 0 ? Math.round((Number(correct) / totalQuestions) * 100) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Daily study logs</h3>
          <p className="text-xs text-zinc-400">Capture the work. Let the patterns emerge.</p>
        </div>
        <button
          onClick={() => openLogModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New study log</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Filter className="w-3.5 h-3.5 text-sky-300" />
          <span>Filter:</span>
        </div>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="glass-input text-xs py-1"
        >
          <option value="">All subjects</option>
          {state.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="glass-input text-xs py-1"
        >
          <option value="">All study modes</option>
          {state.modes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value as any)}
          className="glass-input text-xs py-1"
        >
          <option value="all">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      {/* Table view */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-white/5 border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Subject / Topic</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Questions</th>
                <th className="py-3 px-4">Attempt Acc</th>
                <th className="py-3 px-4">Follow-up</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    <strong className="block text-zinc-200 mb-1">No study logs match this view.</strong>
                    Add a session to start building your academic history.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const qCount = totalQs(log);
                  const attAcc = attemptAccuracy(log);
                  const openCount = state.errors.filter(
                    (e) => e.logId === log.id && e.status !== 'resolved'
                  ).length;

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-400">
                        {dateLabel(log.date)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{getSubjectName(log.subjectId)}</div>
                        <div className="text-[11px] text-zinc-400">
                          {getTopicName(log.subjectId, log.topicId)}
                          {log.subtopic ? ` · ${log.subtopic}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-200 border border-sky-400/20">
                          {log.mode}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-300 font-medium">
                        {fmt(logHours(log))}h
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {qCount > 0 ? (
                          <span>
                            <strong>{log.correct}</strong> / {qCount}{' '}
                            <span className="text-[10px] text-zinc-500">
                              ({log.wrong}w, {log.unanswered}u)
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-sky-300">
                        {attAcc !== null ? `${fmt(attAcc)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {openCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {openCount} open
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Clear
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openLogModal(log)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteLog(log)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Log Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-xl p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white tracking-tight mb-1">
              {editingLog ? 'Edit Study Log' : 'New Study Log'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              Record what happened, analyze friction points, and link open mistakes for review.
            </p>

            <form onSubmit={handleSaveLog} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-zinc-300">Subject *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const name = prompt('Name of new subject:');
                        if (!name?.trim()) return;
                        const newSubj = { id: uid(), name: name.trim(), color: 'blue' as const, topics: [] };
                        onUpdateState({ ...state, subjects: [...state.subjects, newSubj] });
                        setSubjectId(newSubj.id);
                        onShowToast('Subject added.', 'success');
                      }}
                      className="text-[10px] text-sky-300 hover:text-white"
                    >
                      ＋ Quick add
                    </button>
                  </div>
                  <select
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value);
                      setTopicId('');
                    }}
                    className="w-full glass-input text-xs"
                    required
                  >
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-zinc-300">Topic</label>
                    <button
                      type="button"
                      onClick={() => {
                        const name = prompt('Name of new topic:');
                        if (!name?.trim()) return;
                        const sub = state.subjects.find((s) => s.id === subjectId);
                        if (!sub) return;
                        const newTop = { id: uid(), name: name.trim() };
                        const updated = state.subjects.map((s) =>
                          s.id === sub.id ? { ...s, topics: [...s.topics, newTop] } : s
                        );
                        onUpdateState({ ...state, subjects: updated });
                        setTopicId(newTop.id);
                        onShowToast('Topic added.', 'success');
                      }}
                      className="text-[10px] text-sky-300 hover:text-white"
                    >
                      ＋ Quick add
                    </button>
                  </div>
                  <select
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="">General / not specified</option>
                    {currentTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Subtopic / Specific Area (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Meiosis I vs Meiosis II, Projectile range formula"
                  value={subtopic}
                  onChange={(e) => setSubtopic(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-zinc-300">Mode</label>
                    <button
                      type="button"
                      onClick={() => {
                        const m = prompt('Name of new study mode:');
                        if (!m?.trim()) return;
                        if (state.modes.some((x) => x.toLowerCase() === m.trim().toLowerCase())) {
                          onShowToast('Mode already exists.', 'info');
                          return;
                        }
                        onUpdateState({ ...state, modes: [...state.modes, m.trim()] });
                        setMode(m.trim());
                        onShowToast('Custom mode added.', 'success');
                      }}
                      className="text-[10px] text-sky-300 hover:text-white"
                    >
                      ＋ New
                    </button>
                  </div>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    required
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Tests / Sets</label>
                  <input
                    type="number"
                    min="0"
                    value={tests}
                    onChange={(e) => setTests(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              {/* Questions count fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Correct</label>
                  <input
                    type="number"
                    min="0"
                    value={correct}
                    onChange={(e) => setCorrect(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Wrong</label>
                  <input
                    type="number"
                    min="0"
                    value={wrong}
                    onChange={(e) => setWrong(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Unanswered</label>
                  <input
                    type="number"
                    min="0"
                    value={unanswered}
                    onChange={(e) => setUnanswered(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              {/* Live Accuracy vs Completion rate breakdown */}
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-300">
                <div>
                  Total: <strong className="text-white">{totalQuestions}</strong>
                </div>
                <div>
                  Attempted: <strong className="text-white">{attemptedQuestions}</strong>
                </div>
                <div>
                  Attempt accuracy:{' '}
                  <strong className="text-sky-300">
                    {liveAttemptAccuracy !== null ? `${liveAttemptAccuracy}%` : '—'}
                  </strong>
                </div>
                <div>
                  Completion rate:{' '}
                  <strong className="text-emerald-300">
                    {liveCompletionRate !== null ? `${liveCompletionRate}%` : '—'}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Source / Session Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 Practice Set or Past Paper 2024"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              {/* Mistake analysis fields (Section 4.1 Requirements) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Mistake Details</label>
                  <textarea
                    rows={2}
                    placeholder="Which questions or problem types caused friction?"
                    value={mistakes}
                    onChange={(e) => setMistakes(e.target.value)}
                    className="w-full glass-input text-xs resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Why did mistakes happen?</label>
                  <textarea
                    rows={2}
                    placeholder="Reasoning gap, misread prompt, formula slip, etc."
                    value={mistakeReasons}
                    onChange={(e) => setMistakeReasons(e.target.value)}
                    className="w-full glass-input text-xs resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Next Steps / Corrective Action</label>
                <input
                  type="text"
                  placeholder="What will you do to address these gaps?"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Session Notes</label>
                <textarea
                  rows={2}
                  placeholder="General observations, study environment, pacing"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full glass-input text-xs resize-none"
                />
              </div>

              {/* Error Linking Section (Section 4.4 Requirements) */}
              <div className="pt-3 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">
                    Errors addressed during this session
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewErrorForm(!showNewErrorForm)}
                    className="text-[10px] text-sky-300 hover:text-white"
                  >
                    {showNewErrorForm ? 'Hide new error form' : '＋ Log a new error here'}
                  </button>
                </div>

                {openErrorsForSubject.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1 mb-2 pr-1">
                    {openErrorsForSubject.map((err) => (
                      <label
                        key={err.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedErrorIds.includes(err.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedErrorIds([...selectedErrorIds, err.id]);
                            } else {
                              setSelectedErrorIds(selectedErrorIds.filter((id) => id !== err.id));
                            }
                          }}
                          className="rounded border-white/20 text-sky-500 focus:ring-0"
                        />
                        <span className="truncate">{err.title}</span>
                      </label>
                    ))}
                  </div>
                )}

                {showNewErrorForm && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 mt-2">
                    <span className="text-[11px] font-semibold text-rose-300 block">
                      New Error Loop
                    </span>
                    <input
                      type="text"
                      placeholder="Error title (e.g. Inverted sign on torque calculation)"
                      value={newErrorTitle}
                      onChange={(e) => setNewErrorTitle(e.target.value)}
                      className="w-full glass-input text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={newErrorDue}
                        onChange={(e) => setNewErrorDue(e.target.value)}
                        className="w-full glass-input text-xs"
                        placeholder="Review due date"
                      />
                      <input
                        type="text"
                        placeholder="Why did it happen?"
                        value={newErrorCause}
                        onChange={(e) => setNewErrorCause(e.target.value)}
                        className="w-full glass-input text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Corrective action plan"
                      value={newErrorAction}
                      onChange={(e) => setNewErrorAction(e.target.value)}
                      className="w-full glass-input text-xs"
                    />
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={newErrorRepeat}
                        onChange={(e) => setNewErrorRepeat(e.target.checked)}
                        className="rounded border-white/20 text-sky-500"
                      />
                      <span>Mark as recurring / pattern seen before</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-500/80 hover:bg-sky-500 text-white shadow"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Log Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDeleteLog}
        title="Delete Study Log?"
        message="Are you sure you want to delete this study session record? This action cannot be undone."
        onConfirm={() => {
          if (confirmDeleteLog) {
            onUpdateState({
              ...state,
              logs: state.logs.filter((l) => l.id !== confirmDeleteLog.id),
            });
            setConfirmDeleteLog(null);
            onShowToast('Study log deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDeleteLog(null)}
      />
    </div>
  );
};
