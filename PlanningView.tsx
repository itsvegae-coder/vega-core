import React, { useState } from 'react';
import { Plus, CheckSquare, Edit2, Trash2, Calendar, Sparkles } from 'lucide-react';
import { VegaState, ActionItem } from '../types';
import { dateLabel, uid } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface PlanningViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [planningNotesText, setPlanningNotesText] = useState(state.notes || '');

  const [confirmDelete, setConfirmDelete] = useState<ActionItem | null>(null);

  const getSubjectName = (id?: string) =>
    state.subjects.find((s) => s.id === id)?.name || '';

  const openActionModal = (item?: ActionItem) => {
    if (item) {
      setEditingAction(item);
      setTitle(item.title);
      setSubjectId(item.subjectId || '');
      setDue(item.due || '');
      setNotes(item.notes || '');
    } else {
      setEditingAction(null);
      setTitle('');
      setSubjectId('');
      setDue('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const obj: ActionItem = {
      id: editingAction?.id || uid(),
      title: title.trim(),
      subjectId: subjectId || undefined,
      due: due || undefined,
      done: editingAction ? editingAction.done : false,
      notes: notes.trim() || undefined,
    };

    const updated = editingAction
      ? state.actions.map((a) => (a.id === editingAction.id ? obj : a))
      : [obj, ...state.actions];

    onUpdateState({ ...state, actions: updated });
    setIsModalOpen(false);
    onShowToast(editingAction ? 'Action updated.' : 'Action created.', 'success');
  };

  const handleToggleDone = (item: ActionItem) => {
    const updated = state.actions.map((a) =>
      a.id === item.id ? { ...a, done: !a.done } : a
    );
    onUpdateState({ ...state, actions: updated });
  };

  const handleSaveNotes = () => {
    onUpdateState({ ...state, notes: planningNotesText });
    onShowToast('Planning notes saved.', 'success');
  };

  const openCount = state.actions.filter((a) => !a.done).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Next actions</h3>
          <p className="text-xs text-zinc-400">
            Turn weekly findings into manageable, trackable steps.
          </p>
        </div>
        <button
          onClick={() => openActionModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add action</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Action Queue */}
        <div className="lg:col-span-7 glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Action queue</h4>
                <p className="text-[11px] text-zinc-400">Prioritized by status and target date</p>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 font-semibold">
                {openCount} open
              </span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {state.actions.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-xs text-zinc-400">
                  <CheckSquare className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
                  Your action queue is clear. Create one from the weekly review or add one manually.
                </div>
              ) : (
                state.actions
                  .slice()
                  .sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'))
                  .map((act) => (
                    <div
                      key={act.id}
                      className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        act.done
                          ? 'bg-white/[0.02] border-white/5 opacity-55'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={act.done}
                        onChange={() => handleToggleDone(act)}
                        className="mt-0.5 rounded border-white/20 text-sky-500 focus:ring-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs font-semibold ${
                            act.done ? 'line-through text-zinc-400' : 'text-white'
                          }`}
                        >
                          {act.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400 mt-1">
                          {act.subjectId && (
                            <span className="text-sky-300 font-medium">
                              {getSubjectName(act.subjectId)}
                            </span>
                          )}
                          {act.due && <span>Due {dateLabel(act.due)}</span>}
                          {act.notes && <span>· {act.notes}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openActionModal(act)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(act)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Planning Notes */}
        <div className="lg:col-span-5 glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight mb-1">Planning notes</h4>
            <p className="text-[11px] text-zinc-400 mb-4">
              Your plan can evolve with the evidence. Keep core focus areas visible.
            </p>

            <textarea
              rows={8}
              placeholder="What do you want to do differently next week?"
              value={planningNotesText}
              onChange={(e) => setPlanningNotesText(e.target.value)}
              className="w-full glass-input text-xs resize-none"
            />
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Saved locally</span>
            <button
              onClick={handleSaveNotes}
              className="px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
            >
              Save notes
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Action Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white tracking-tight mb-1">
              {editingAction ? 'Edit Action' : 'Add Next Action'}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Make the next step specific enough to complete.
            </p>

            <form onSubmit={handleSaveAction} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete 10 kinematics problem sets"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Subject (Optional)
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full glass-input text-xs"
                >
                  <option value="">No subject / General</option>
                  {state.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Context or success criteria"
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
                  Save Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Action Item?"
        message={`Delete "${confirmDelete?.title}"? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) {
            onUpdateState({
              ...state,
              actions: state.actions.filter((a) => a.id !== confirmDelete.id),
            });
            setConfirmDelete(null);
            onShowToast('Action deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
