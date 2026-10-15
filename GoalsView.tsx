import React, { useState } from 'react';
import { Plus, Target, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { VegaState, Goal } from '../types';
import { todayIso, weekStart, fmt, uid, logHours, totalQs } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface GoalsViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [name, setName] = useState('');
  const [metric, setMetric] = useState<'hours' | 'questions' | 'accuracy'>('hours');
  const [target, setTarget] = useState(10);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [subjectId, setSubjectId] = useState('');
  const [notes, setNotes] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);

  const getSubjectName = (id?: string) =>
    state.subjects.find((s) => s.id === id)?.name || 'All subjects';

  // Calculate actual progress for goal
  const calculateGoalActual = (g: Goal) => {
    const now = todayIso();
    const startDate = g.period === 'month' ? now.slice(0, 7) + '-01' : weekStart(now);

    if (g.metric === 'hours') {
      return state.logs
        .filter((l) => l.date >= startDate && l.date <= now && (!g.subjectId || l.subjectId === g.subjectId))
        .reduce((acc, l) => acc + logHours(l), 0);
    }
    if (g.metric === 'questions') {
      return state.logs
        .filter((l) => l.date >= startDate && l.date <= now && (!g.subjectId || l.subjectId === g.subjectId))
        .reduce((acc, l) => acc + totalQs(l), 0);
    }
    const a = state.assessments.filter(
      (x) =>
        x.date >= startDate &&
        x.date <= now &&
        (!g.subjectId || x.subjectId === g.subjectId) &&
        Number(x.total) > 0
    );
    return a.length ? a.reduce((sum, x) => sum + Number(x.score ?? 0), 0) / a.length : 0;
  };

  const openGoalModal = (g?: Goal) => {
    if (g) {
      setEditingGoal(g);
      setName(g.name);
      setMetric(g.metric);
      setTarget(g.target);
      setPeriod(g.period);
      setSubjectId(g.subjectId || '');
      setNotes(g.notes || '');
    } else {
      setEditingGoal(null);
      setName('');
      setMetric('hours');
      setTarget(10);
      setPeriod('week');
      setSubjectId('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || target <= 0) return;

    const obj: Goal = {
      id: editingGoal?.id || uid(),
      name: name.trim(),
      metric,
      target: Number(target),
      period,
      subjectId: subjectId || undefined,
      notes: notes.trim() || undefined,
      createdAt: editingGoal?.createdAt || new Date().toISOString(),
    };

    const updated = editingGoal
      ? state.goals.map((g) => (g.id === editingGoal.id ? obj : g))
      : [...state.goals, obj];

    onUpdateState({ ...state, goals: updated });
    setIsModalOpen(false);
    onShowToast(editingGoal ? 'Goal updated.' : 'Goal created.', 'success');
  };

  const onTrackCount = state.goals.filter((g) => calculateGoalActual(g) >= g.target).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Goals & targets</h3>
          <p className="text-xs text-zinc-400">
            Compare planned study targets with actual recorded completion.
          </p>
        </div>
        <button
          onClick={() => openGoalModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add goal</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Total goals</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {state.goals.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Defined targets</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">On track</span>
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-300 mt-1">
            {onTrackCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Target reached</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">In progress</span>
          <div className="text-2xl md:text-3xl font-extrabold text-sky-300 mt-1">
            {state.goals.length - onTrackCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Currently advancing</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Average completion</span>
          <div className="text-2xl md:text-3xl font-extrabold text-purple-300 mt-1">
            {state.goals.length
              ? `${fmt(
                  state.goals.reduce(
                    (acc, g) => acc + Math.min(100, (calculateGoalActual(g) / g.target) * 100),
                    0
                  ) / state.goals.length
                )}%`
              : '—'}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Across all goals</span>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {state.goals.length === 0 ? (
          <div className="md:col-span-2 p-10 text-center glass-card rounded-2xl border border-dashed border-white/10 text-xs text-zinc-400">
            <Target className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
            <strong className="block text-zinc-200 text-sm">No goals set yet.</strong>
            Set a weekly or monthly target for study hours, practice questions, or exam average.
          </div>
        ) : (
          state.goals.map((g) => {
            const actual = calculateGoalActual(g);
            const pctDone = Math.min(100, (actual / (g.target || 1)) * 100);
            const unit = g.metric === 'hours' ? ' h' : g.metric === 'accuracy' ? '%' : ' questions';

            return (
              <div
                key={g.id}
                className="glass-card p-5 rounded-2xl flex flex-col justify-between border hover:border-white/20 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-sky-500/20 text-sky-200 border border-sky-400/30">
                        {g.period} target
                      </span>
                      <span className="text-[11px] text-zinc-400 ml-2">
                        {getSubjectName(g.subjectId)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openGoalModal(g)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(g)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white tracking-tight mt-1">{g.name}</h4>

                  <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Actual this {g.period}</span>
                      <strong className="text-base text-white mt-0.5 block">
                        {fmt(actual)}
                        {unit}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Target</span>
                      <strong className="text-base text-sky-300 mt-0.5 block">
                        {fmt(g.target)}
                        {unit}
                      </strong>
                    </div>
                  </div>

                  <div className="my-3">
                    <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                      <span>Achievement</span>
                      <span className="font-semibold text-white">
                        {fmt(pctDone)}% {pctDone >= 100 ? '· Reached!' : ''}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pctDone >= 100 ? 'bg-emerald-400' : 'bg-sky-400'
                        }`}
                        style={{ width: `${pctDone}%` }}
                      />
                    </div>
                  </div>

                  {g.notes && <p className="text-[11px] text-zinc-400 mt-2">{g.notes}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white tracking-tight mb-4">
              {editingGoal ? 'Edit Goal' : 'Create Goal'}
            </h3>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Goal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15 Study Hours / Week"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Metric</label>
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="hours">Study hours</option>
                    <option value="questions">Questions attempted</option>
                    <option value="accuracy">Assessment average (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Target Value *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Period</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="">All subjects</option>
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Why this goal matters"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full glass-input text-xs resize-none"
                />
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
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Goal?"
        message={`Delete goal "${confirmDelete?.name}"? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) {
            onUpdateState({
              ...state,
              goals: state.goals.filter((g) => g.id !== confirmDelete.id),
            });
            setConfirmDelete(null);
            onShowToast('Goal deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
