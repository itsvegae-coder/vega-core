import React, { useState } from 'react';
import { Plus, Award, Edit2, Trash2, BookOpen, Clock } from 'lucide-react';
import { VegaState, Assessment } from '../types';
import { todayIso, dateLabel, addDays, fmt, uid, calculatePct } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface AssessmentsViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AssessmentsView: React.FC<AssessmentsViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id || '');
  const [topicId, setTopicId] = useState('');
  const [type, setType] = useState('Weekly comprehensive');
  const [minutes, setMinutes] = useState(45);
  const [total, setTotal] = useState(30);
  const [correct, setCorrect] = useState(25);
  const [wrong, setWrong] = useState(5);
  const [unanswered, setUnanswered] = useState(0);
  const [notes, setNotes] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<Assessment | null>(null);

  const getSubjectName = (id: string) => state.subjects.find((s) => s.id === id)?.name || 'Unknown';
  const getTopicName = (sid: string, tid?: string) =>
    state.subjects.find((s) => s.id === sid)?.topics.find((t) => t.id === tid)?.name ||
    'General / not specified';

  // Stats
  const assessed = state.assessments.filter((a) => Number(a.total) > 0);
  const avgScore = assessed.length
    ? assessed.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / assessed.length
    : null;
  const totalQuestions = assessed.reduce((acc, a) => acc + Number(a.total || 0), 0);
  const recentCount = assessed.filter((a) => a.date >= addDays(todayIso(), -30)).length;

  const openAssessmentModal = (item?: Assessment) => {
    if (item) {
      setEditingAssessment(item);
      setName(item.name);
      setDate(item.date);
      setSubjectId(item.subjectId);
      setTopicId(item.topicId || '');
      setType(item.type || 'Weekly comprehensive');
      setMinutes(item.minutes || 45);
      setTotal(item.total);
      setCorrect(item.correct);
      setWrong(item.wrong);
      setUnanswered(item.unanswered || 0);
      setNotes(item.notes || '');
    } else {
      setEditingAssessment(null);
      setName('');
      setDate(todayIso());
      setSubjectId(state.subjects[0]?.id || '');
      setTopicId('');
      setType('Weekly comprehensive');
      setMinutes(45);
      setTotal(30);
      setCorrect(25);
      setWrong(5);
      setUnanswered(0);
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subjectId) return;

    if (Number(correct) + Number(wrong) + Number(unanswered) !== Number(total)) {
      onShowToast('Correct + Wrong + Unanswered must equal Total questions.', 'error');
      return;
    }

    const calculatedScore = calculatePct(
      Number(correct),
      Number(total),
      Number(wrong),
      state.scoring.method,
      state.scoring.divisor
    );

    const obj: Assessment = {
      id: editingAssessment?.id || uid(),
      name: name.trim(),
      date,
      subjectId,
      topicId: topicId || undefined,
      type,
      minutes: Number(minutes) || 0,
      total: Number(total),
      correct: Number(correct),
      wrong: Number(wrong),
      unanswered: Number(unanswered),
      score: calculatedScore !== null ? Number(calculatedScore.toFixed(1)) : undefined,
      notes: notes.trim() || undefined,
    };

    const updated = editingAssessment
      ? state.assessments.map((a) => (a.id === editingAssessment.id ? obj : a))
      : [obj, ...state.assessments];

    onUpdateState({ ...state, assessments: updated });
    setIsModalOpen(false);
    onShowToast(editingAssessment ? 'Assessment updated.' : 'Assessment recorded.', 'success');
  };

  const currentTopics = state.subjects.find((s) => s.id === subjectId)?.topics || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Assessments</h3>
          <p className="text-xs text-zinc-400">Keep exam results separate from everyday practice.</p>
        </div>
        <button
          onClick={() => openAssessmentModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add assessment</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Assessments recorded</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {state.assessments.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">All recorded exam types</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Average score</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {avgScore !== null ? `${fmt(avgScore)}%` : '—'}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Simple mean of recorded scores</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Total questions</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {fmt(totalQuestions, 0)}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Across all assessments</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Recent entries</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {recentCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">In the last 30 days</span>
        </div>
      </div>

      {/* Table view */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-white/5 border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Assessment</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Scope / Topic</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Questions</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {state.assessments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    No assessments recorded yet. Weekly tests and mock exams belong here.
                  </td>
                </tr>
              ) : (
                state.assessments
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((ass) => (
                    <tr key={ass.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-200">
                        {dateLabel(ass.date)}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-white block font-semibold">{ass.name}</strong>
                        <span className="text-[10px] text-zinc-400">{ass.type || 'Assessment'}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-white">
                        {getSubjectName(ass.subjectId)}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">
                        {getTopicName(ass.subjectId, ass.topicId)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-sky-200">
                          {ass.score !== undefined ? `${fmt(ass.score)}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {ass.correct} / {ass.total}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {ass.minutes ? `${ass.minutes}m` : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openAssessmentModal(ass)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(ass)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Assessment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white tracking-tight mb-1">
              {editingAssessment ? 'Edit Assessment' : 'Add Assessment'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              Record exam outcomes with enough context to compare fairly.
            </p>

            <form onSubmit={handleSaveAssessment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Assessment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Comprehensive Exam 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="Weekly comprehensive">Weekly comprehensive</option>
                    <option value="Topic test">Topic test</option>
                    <option value="Mock exam">Mock exam</option>
                    <option value="Timed practice">Timed practice</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
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
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Scope / Topic
                  </label>
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

              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Total Qs *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={total}
                    onChange={(e) => setTotal(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Correct *</label>
                  <input
                    type="number"
                    min="0"
                    required
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

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Duration (min)</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Exam Notes</label>
                <textarea
                  rows={2}
                  placeholder="Exam conditions, difficulty, or reflections"
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
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Assessment?"
        message={`Delete "${confirmDelete?.name}"? This will remove its score and questions from your overall records.`}
        onConfirm={() => {
          if (confirmDelete) {
            onUpdateState({
              ...state,
              assessments: state.assessments.filter((a) => a.id !== confirmDelete.id),
            });
            setConfirmDelete(null);
            onShowToast('Assessment deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
