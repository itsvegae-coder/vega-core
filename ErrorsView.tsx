import React, { useState } from 'react';
import { Plus, AlertTriangle, CheckCircle2, RotateCcw, Edit2, Trash2, Filter } from 'lucide-react';
import { VegaState, ErrorItem } from '../types';
import { todayIso, dateLabel, fmt, uid } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface ErrorsViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ErrorsView: React.FC<ErrorsViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [filterStatus, setFilterStatus] = useState<'open' | 'all' | 'resolved' | 'overdue'>('open');
  const [filterSubject, setFilterSubject] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingError, setEditingError] = useState<ErrorItem | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id || '');
  const [topicId, setTopicId] = useState('');
  const [type, setType] = useState('Conceptual');
  const [date, setDate] = useState(todayIso());
  const [due, setDue] = useState('');
  const [cause, setCause] = useState('');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [repeat, setRepeat] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<ErrorItem | null>(null);

  const getSubjectName = (id: string) => state.subjects.find((s) => s.id === id)?.name || 'Unknown';
  const getTopicName = (sid: string, tid?: string) =>
    state.subjects.find((s) => s.id === sid)?.topics.find((t) => t.id === tid)?.name ||
    'General / not specified';

  const openErrors = state.errors.filter((e) => e.status !== 'resolved');
  const resolvedErrors = state.errors.filter((e) => e.status === 'resolved');
  const overdueErrors = openErrors.filter((e) => e.due && e.due < todayIso());
  const repeatCount = state.errors.filter((e) => e.repeat).length;

  const filteredErrors = state.errors
    .filter((e) => {
      if (filterStatus === 'open' && e.status === 'resolved') return false;
      if (filterStatus === 'resolved' && e.status !== 'resolved') return false;
      if (filterStatus === 'overdue' && (e.status === 'resolved' || !e.due || e.due >= todayIso()))
        return false;
      if (filterSubject && e.subjectId !== filterSubject) return false;
      return true;
    })
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));

  const openErrorModal = (err?: ErrorItem) => {
    if (err) {
      setEditingError(err);
      setTitle(err.title);
      setSubjectId(err.subjectId);
      setTopicId(err.topicId || '');
      setType(err.type || 'Conceptual');
      setDate(err.date);
      setDue(err.due || '');
      setCause(err.cause || '');
      setAction(err.action || '');
      setStatus(err.status);
      setRepeat(!!err.repeat);
    } else {
      setEditingError(null);
      setTitle('');
      setSubjectId(state.subjects[0]?.id || '');
      setTopicId('');
      setType('Conceptual');
      setDate(todayIso());
      setDue('');
      setCause('');
      setAction('');
      setStatus('open');
      setRepeat(false);
    }
    setIsModalOpen(true);
  };

  const handleSaveError = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;

    const obj: ErrorItem = {
      id: editingError?.id || uid(),
      title: title.trim(),
      subjectId,
      topicId: topicId || undefined,
      type,
      date,
      due: due || undefined,
      cause: cause.trim() || undefined,
      action: action.trim() || undefined,
      status,
      repeat,
      logId: editingError?.logId || null,
      resolvedAt: status === 'resolved' ? editingError?.resolvedAt || todayIso() : null,
    };

    const updated = editingError
      ? state.errors.map((item) => (item.id === editingError.id ? obj : item))
      : [obj, ...state.errors];

    onUpdateState({ ...state, errors: updated });
    setIsModalOpen(false);
    onShowToast(editingError ? 'Error record updated.' : 'Error logged.', 'success');
  };

  const toggleStatus = (item: ErrorItem) => {
    const isNowResolved = item.status !== 'resolved';
    const updated = state.errors.map((e) =>
      e.id === item.id
        ? {
            ...e,
            status: (isNowResolved ? 'resolved' : 'open') as 'resolved' | 'open',
            resolvedAt: isNowResolved ? todayIso() : null,
          }
        : e
    );
    onUpdateState({ ...state, errors: updated });
    onShowToast(isNowResolved ? 'Marked error as resolved.' : 'Reopened error loop.', 'info');
  };

  const currentTopics = state.subjects.find((s) => s.id === subjectId)?.topics || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Error intelligence</h3>
          <p className="text-xs text-zinc-400">
            Every mistake becomes a plan, then a verified check — not a forgotten note.
          </p>
        </div>
        <button
          onClick={() => openErrorModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log an error</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Open errors</span>
          <div
            className={`text-2xl md:text-3xl font-extrabold mt-1 ${
              openErrors.length ? 'text-rose-300' : 'text-emerald-300'
            }`}
          >
            {openErrors.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Needs corrective review</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Resolved</span>
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-300 mt-1">
            {resolvedErrors.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Verified & completed</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Overdue</span>
          <div
            className={`text-2xl md:text-3xl font-extrabold mt-1 ${
              overdueErrors.length ? 'text-rose-400' : 'text-zinc-200'
            }`}
          >
            {overdueErrors.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Past scheduled due date</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Repeat flags</span>
          <div className="text-2xl md:text-3xl font-extrabold text-purple-300 mt-1">
            {repeatCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Flagged as recurring</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Filter className="w-3.5 h-3.5 text-sky-300" />
          <span>Filter:</span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="glass-input text-xs py-1"
        >
          <option value="open">Open errors</option>
          <option value="all">All errors</option>
          <option value="resolved">Resolved</option>
          <option value="overdue">Overdue</option>
        </select>
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
      </div>

      {/* Error Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredErrors.length === 0 ? (
          <div className="md:col-span-2 p-10 text-center glass-card rounded-2xl border border-dashed border-white/10 text-xs text-zinc-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <strong className="block text-zinc-200 text-sm">No errors in this view.</strong>
            Keep working diligently and log errors as they occur during drills or assessments.
          </div>
        ) : (
          filteredErrors.map((err) => {
            const isOverdue = err.status !== 'resolved' && err.due && err.due < todayIso();
            return (
              <div
                key={err.id}
                className="glass-card p-5 rounded-2xl flex flex-col justify-between border transition-all hover:border-white/20"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          err.status === 'resolved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isOverdue
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {err.status === 'resolved' ? 'Resolved' : isOverdue ? 'Overdue' : 'Open'}
                      </span>
                      {err.repeat && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-200 border border-purple-500/30">
                          Recurring
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400">{err.type || 'Conceptual'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openErrorModal(err)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(err)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white tracking-tight mt-1">{err.title}</h4>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {getSubjectName(err.subjectId)} · {getTopicName(err.subjectId, err.topicId)}
                  </div>

                  {/* Why it happened */}
                  <div className="mt-3.5 p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-300">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                      Why it happened
                    </span>
                    <p className="leading-relaxed">{err.cause || 'No root cause noted.'}</p>
                  </div>

                  {/* Corrective action */}
                  <div className="mt-2.5 p-3 rounded-xl bg-sky-500/10 border border-sky-400/20 text-xs text-sky-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block mb-1">
                      Corrective action
                    </span>
                    <p className="leading-relaxed">{err.action || 'No action defined yet.'}</p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    Logged {dateLabel(err.date)}
                    {err.due ? ` · Due ${dateLabel(err.due)}` : ''}
                  </span>
                  <button
                    onClick={() => toggleStatus(err)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      err.status === 'resolved'
                        ? 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/30'
                    }`}
                  >
                    {err.status === 'resolved' ? 'Reopen loop' : 'Mark resolved'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white tracking-tight mb-1">
              {editingError ? 'Edit Error Record' : 'Log an Error'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              Track the correction and verify the learning — not just the checkbox.
            </p>

            <form onSubmit={handleSaveError} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Error Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sign error in acceleration vector"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Subject *</label>
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Topic</label>
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Error Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="Conceptual">Conceptual</option>
                    <option value="Calculation">Calculation</option>
                    <option value="Careless mistake">Careless mistake</option>
                    <option value="Misread question">Misread question</option>
                    <option value="Time management">Time management</option>
                    <option value="Formula recall">Formula recall</option>
                    <option value="Strategy">Strategy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date Logged</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Review Due Date
                  </label>
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Why did it happen?
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the cause, not just the symptom."
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  className="w-full glass-input text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Corrective Action
                </label>
                <textarea
                  rows={2}
                  placeholder="What specific drills or verification rules will you use?"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full glass-input text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Recurring Pattern?
                  </label>
                  <select
                    value={String(repeat)}
                    onChange={(e) => setRepeat(e.target.value === 'true')}
                    className="w-full glass-input text-xs"
                  >
                    <option value="false">Not flagged</option>
                    <option value="true">Recurring / seen before</option>
                  </select>
                </div>
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
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Error Record?"
        message={`Are you sure you want to delete "${confirmDelete?.title}"? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) {
            onUpdateState({
              ...state,
              errors: state.errors.filter((e) => e.id !== confirmDelete.id),
            });
            setConfirmDelete(null);
            onShowToast('Error record deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
