import React, { useState } from 'react';
import { Plus, FolderKanban, Edit2, Trash2, CheckCircle2, ListFilter } from 'lucide-react';
import { VegaState, Project } from '../types';
import { dateLabel, todayIso, uid, fmt } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface ProjectsViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState<'not-started' | 'active' | 'on-hold' | 'completed'>('active');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [progress, setProgress] = useState(0);
  const [milestonesText, setMilestonesText] = useState('');
  const [notes, setNotes] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const openProjectModal = (p?: Project) => {
    if (p) {
      setEditingProject(p);
      setName(p.name);
      setStart(p.start || todayIso());
      setEnd(p.end || '');
      setStatus(p.status);
      setPriority(p.priority);
      setProgress(p.progress);
      setMilestonesText((p.milestones || []).join('; '));
      setNotes(p.notes || '');
      setCustomValues(p.custom || {});
    } else {
      setEditingProject(null);
      setName('');
      setStart(todayIso());
      setEnd('');
      setStatus('active');
      setPriority('normal');
      setProgress(0);
      setMilestonesText('');
      setNotes('');
      setCustomValues({});
    }
    setIsModalOpen(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const milestones = milestonesText
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    const obj: Project = {
      id: editingProject?.id || uid(),
      name: name.trim(),
      start: start || undefined,
      end: end || undefined,
      status,
      priority,
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      milestones,
      notes: notes.trim() || undefined,
      custom: customValues,
      updatedAt: new Date().toISOString(),
    };

    const updated = editingProject
      ? state.projects.map((p) => (p.id === editingProject.id ? obj : p))
      : [...state.projects, obj];

    onUpdateState({ ...state, projects: updated });
    setIsModalOpen(false);
    onShowToast(editingProject ? 'Project updated.' : 'Project created.', 'success');
  };

  const handleAddCustomField = () => {
    const fName = prompt('Enter custom field name (e.g. Lead, Module Code, Deliverable):');
    if (!fName?.trim()) return;
    const newField = { id: uid(), name: fName.trim() };
    onUpdateState({
      ...state,
      customProjectFields: [...state.customProjectFields, newField],
    });
    onShowToast('Custom field added.', 'success');
  };

  const activeCount = state.projects.filter((p) => p.status === 'active').length;
  const completedCount = state.projects.filter((p) => p.status === 'completed').length;
  const overdueCount = state.projects.filter(
    (p) => p.end && p.end < todayIso() && p.status !== 'completed'
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Project tracker</h3>
          <p className="text-xs text-zinc-400">
            Track milestones, multi-week objectives, and course deliverables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddCustomField}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 hover:text-white"
          >
            ＋ Custom field
          </button>
          <button
            onClick={() => openProjectModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New project</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Total projects</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {state.projects.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">In your workspace</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Active</span>
          <div className="text-2xl md:text-3xl font-extrabold text-sky-300 mt-1">
            {activeCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">In progress</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Completed</span>
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-300 mt-1">
            {completedCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Finished objectives</span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Past end date</span>
          <div
            className={`text-2xl md:text-3xl font-extrabold mt-1 ${
              overdueCount ? 'text-rose-300' : 'text-zinc-200'
            }`}
          >
            {overdueCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">Needs deadline update</span>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {state.projects.length === 0 ? (
          <div className="md:col-span-2 p-10 text-center glass-card rounded-2xl border border-dashed border-white/10 text-xs text-zinc-400">
            <FolderKanban className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
            <strong className="block text-zinc-200 text-sm">No projects created yet.</strong>
            Create a project to track milestones, syllabus targets, or multi-week study schedules.
          </div>
        ) : (
          state.projects.map((proj) => {
            const isOverdue = proj.end && proj.end < todayIso() && proj.status !== 'completed';
            return (
              <div
                key={proj.id}
                className="glass-card p-5 rounded-2xl flex flex-col justify-between border hover:border-white/20 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          proj.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : proj.status === 'active'
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                            : 'bg-white/10 text-zinc-300 border border-white/10'
                        }`}
                      >
                        {proj.status.replace('-', ' ')}
                      </span>
                      <span className="text-[10px] text-zinc-400 capitalize">
                        {proj.priority} priority
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openProjectModal(proj)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(proj)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-white tracking-tight">{proj.name}</h4>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {proj.start ? dateLabel(proj.start) : 'No start'} →{' '}
                    <span className={isOverdue ? 'text-rose-300 font-semibold' : ''}>
                      {proj.end ? dateLabel(proj.end) : 'No deadline'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="my-3.5">
                    <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                      <span>Progress</span>
                      <span className="font-semibold text-white">{proj.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-400 transition-all duration-500"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones */}
                  {proj.milestones.length > 0 && (
                    <div className="space-y-1.5 mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Milestones
                      </span>
                      {proj.milestones.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-1.5 px-2 rounded-lg bg-white/5 text-xs text-zinc-200"
                        >
                          <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />
                          <span className="truncate">{m}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom fields */}
                  {proj.custom && Object.keys(proj.custom).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10">
                      {Object.entries(proj.custom).map(([fId, val]) => {
                        const fieldName =
                          state.customProjectFields.find((f) => f.id === fId)?.name || fId;
                        if (!val) return null;
                        return (
                          <div key={fId} className="p-2 rounded-lg bg-white/5 text-[11px]">
                            <span className="text-zinc-400 block text-[9px] uppercase font-medium">
                              {fieldName}
                            </span>
                            <span className="text-white font-semibold truncate block">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {proj.notes && (
                    <p className="text-[11px] text-zinc-300/80 mt-3 p-2.5 rounded-lg bg-white/[0.03]">
                      {proj.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white tracking-tight mb-4">
              {editingProject ? 'Edit Project' : 'New Project'}
            </h3>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MCAT Preparation Sprint"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Target End Date</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="not-started">Not started</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Milestones (separate with semicolons ;)
                </label>
                <input
                  type="text"
                  placeholder="Phase 1 Complete; Mock Exam 1; Revision Week"
                  value={milestonesText}
                  onChange={(e) => setMilestonesText(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              {state.customProjectFields.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-xs font-semibold text-white block">Custom Fields</span>
                  <div className="grid grid-cols-2 gap-3">
                    {state.customProjectFields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-[11px] text-zinc-400 mb-1">{field.name}</label>
                        <input
                          type="text"
                          value={customValues[field.id] || ''}
                          onChange={(e) =>
                            setCustomValues({ ...customValues, [field.id]: e.target.value })
                          }
                          className="w-full glass-input text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
                <textarea
                  rows={2}
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
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Project?"
        message={`Delete project "${confirmDelete?.name}"? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) {
            onUpdateState({
              ...state,
              projects: state.projects.filter((p) => p.id !== confirmDelete.id),
            });
            setConfirmDelete(null);
            onShowToast('Project deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
