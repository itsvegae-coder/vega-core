import React, { useState } from 'react';
import { Plus, CalendarClock, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { VegaState, TopicReview } from '../types';
import { todayIso, dateLabel, addDays, uid } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface ReviewSchedulerViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReviewSchedulerView: React.FC<ReviewSchedulerViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<TopicReview | null>(null);

  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [lastDate, setLastDate] = useState(todayIso());
  const [due, setDue] = useState(addDays(todayIso(), 2));
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<TopicReview | null>(null);

  const getSubjectName = (id: string) => state.subjects.find((s) => s.id === id)?.name || 'Unknown';

  const reviews = state.topicReviews
    .slice()
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''));

  const dueNowCount = reviews.filter((r) => r.due <= todayIso()).length;
  const overdueCount = reviews.filter((r) => r.due < todayIso()).length;
  const highConfidenceCount = reviews.filter((r) => r.confidence >= 4).length;

  const openReviewModal = (r?: TopicReview) => {
    if (r) {
      setEditingReview(r);
      setSubjectId(r.subjectId);
      setTopic(r.topic);
      setLastDate(r.lastDate || todayIso());
      setDue(r.due);
      setConfidence(r.confidence);
      setNotes(r.notes || '');
    } else {
      setEditingReview(null);
      setSubjectId(state.subjects[0]?.id || '');
      setTopic('');
      setLastDate(todayIso());
      setDue(addDays(todayIso(), 2));
      setConfidence(3);
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !subjectId || !due) return;

    const obj: TopicReview = {
      id: editingReview?.id || uid(),
      subjectId,
      topic: topic.trim(),
      lastDate: lastDate || undefined,
      due,
      confidence: Number(confidence),
      notes: notes.trim() || undefined,
    };

    const updated = editingReview
      ? state.topicReviews.map((r) => (r.id === editingReview.id ? obj : r))
      : [...state.topicReviews, obj];

    onUpdateState({ ...state, topicReviews: updated });
    setIsModalOpen(false);
    onShowToast(editingReview ? 'Scheduled review updated.' : 'Review scheduled.', 'success');
  };

  const handleMarkReviewedToday = (r: TopicReview) => {
    // Spaced repetition interval based on confidence (1: 1 day, 2: 2 days, 3: 4 days, 4: 7 days, 5: 14 days)
    const intervalMap: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };
    const nextInterval = intervalMap[r.confidence] || 3;
    const nextDue = addDays(todayIso(), nextInterval);

    const updated = state.topicReviews.map((item) =>
      item.id === r.id ? { ...item, lastDate: todayIso(), due: nextDue } : item
    );

    onUpdateState({ ...state, topicReviews: updated });
    onShowToast(
      `Reviewed today! Next review scheduled in ${nextInterval} days (${dateLabel(nextDue)}).`,
      'success'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Smart review</h3>
          <p className="text-xs text-zinc-400">
            Schedule spaced repetitions by topic, confidence rating, and last reviewed date.
          </p>
        </div>
        <button
          onClick={() => openReviewModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule review</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Scheduled topics</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {reviews.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">In your review queue</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Due now</span>
          <div
            className={`text-2xl md:text-3xl font-extrabold mt-1 ${
              dueNowCount ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {dueNowCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Today or earlier</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Overdue</span>
          <div
            className={`text-2xl md:text-3xl font-extrabold mt-1 ${
              overdueCount ? 'text-rose-300' : 'text-zinc-200'
            }`}
          >
            {overdueCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Past scheduled review</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">High confidence</span>
          <div className="text-2xl md:text-3xl font-extrabold text-purple-300 mt-1">
            {highConfidenceCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Confidence 4–5</span>
        </div>
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reviews.length === 0 ? (
          <div className="md:col-span-2 p-10 text-center glass-card rounded-2xl border border-dashed border-white/10 text-xs text-zinc-400">
            <CalendarClock className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
            <strong className="block text-zinc-200 text-sm">Your review queue is empty.</strong>
            Schedule topics with a confidence level to maintain long-term memory.
          </div>
        ) : (
          reviews.map((rev) => {
            const isDueToday = rev.due === todayIso();
            const isOverdue = rev.due < todayIso();

            return (
              <div
                key={rev.id}
                className="glass-card p-5 rounded-2xl flex flex-col justify-between border hover:border-white/20 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          isOverdue
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isDueToday
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        }`}
                      >
                        {isOverdue ? 'Overdue' : isDueToday ? 'Due today' : 'Upcoming'}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {getSubjectName(rev.subjectId)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-purple-200 font-semibold">
                        Confidence {rev.confidence}/5
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openReviewModal(rev)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(rev)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white tracking-tight mt-1">{rev.topic}</h4>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Last reviewed: {rev.lastDate ? dateLabel(rev.lastDate) : 'Not recorded'} · Next:{' '}
                    <strong className={isOverdue ? 'text-rose-300' : 'text-zinc-200'}>
                      {dateLabel(rev.due)}
                    </strong>
                  </div>

                  {rev.notes && (
                    <p className="text-xs text-zinc-300/80 mt-3 p-2.5 rounded-xl bg-white/5 leading-relaxed">
                      {rev.notes}
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">
                    Interval based on {rev.confidence}/5 rating
                  </span>
                  <button
                    onClick={() => handleMarkReviewedToday(rev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-semibold text-emerald-200 shadow transition-all hover:-translate-y-0.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Reviewed today</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white tracking-tight mb-4">
              {editingReview ? 'Edit Scheduled Review' : 'Schedule a Topic Review'}
            </h3>

            <form onSubmit={handleSaveReview} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Subject *</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">Topic Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mendelian Genetics Crosses"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Last Reviewed
                  </label>
                  <input
                    type="date"
                    value={lastDate}
                    onChange={(e) => setLastDate(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Next Review *</label>
                  <input
                    type="date"
                    required
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Confidence Rating (1 to 5)
                </label>
                <select
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full glass-input text-xs"
                >
                  <option value={1}>1 · Needs urgent help</option>
                  <option value={2}>2 · Weak / shaky recall</option>
                  <option value={3}>3 · Developing / average</option>
                  <option value={4}>4 · Good / solid</option>
                  <option value={5}>5 · Confident / mastered</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Formulas or tricky subtopics to focus on"
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
                  Save Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Scheduled Review?"
        message={`Delete scheduled review for "${confirmDelete?.topic}"? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) {
            onUpdateState({
              ...state,
              topicReviews: state.topicReviews.filter((r) => r.id !== confirmDelete.id),
            });
            setConfirmDelete(null);
            onShowToast('Scheduled review removed.', 'info');
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
