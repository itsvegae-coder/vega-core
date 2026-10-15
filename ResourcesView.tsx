import React, { useState } from 'react';
import { Plus, Bookmark, ExternalLink, Edit2, Trash2, Search, BookOpen } from 'lucide-react';
import { VegaState, ResourceItem } from '../types';
import { uid } from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface ResourcesViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState('Book');
  const [subjectId, setSubjectId] = useState('');
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<ResourceItem | null>(null);

  const getSubjectName = (id?: string) =>
    state.subjects.find((s) => s.id === id)?.name || 'General';

  const filteredResources = state.resources.filter((r) => {
    if (subjectFilter && r.subjectId !== subjectFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const combined = `${r.title} ${r.type} ${r.topic || ''} ${r.notes || ''} ${r.url || ''} ${getSubjectName(
        r.subjectId
      )}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }
    return true;
  });

  const openResourceModal = (r?: ResourceItem) => {
    if (r) {
      setEditingResource(r);
      setTitle(r.title);
      setType(r.type);
      setSubjectId(r.subjectId || '');
      setUrl(r.url || '');
      setTopic(r.topic || '');
      setNotes(r.notes || '');
    } else {
      setEditingResource(null);
      setTitle('');
      setType('Book');
      setSubjectId(state.subjects[0]?.id || '');
      setUrl('');
      setTopic('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const obj: ResourceItem = {
      id: editingResource?.id || uid(),
      title: title.trim(),
      type,
      subjectId: subjectId || undefined,
      url: url.trim() || undefined,
      topic: topic.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: editingResource?.createdAt || new Date().toISOString(),
    };

    const updated = editingResource
      ? state.resources.map((r) => (r.id === editingResource.id ? obj : r))
      : [obj, ...state.resources];

    onUpdateState({ ...state, resources: updated });
    setIsModalOpen(false);
    onShowToast(editingResource ? 'Resource updated.' : 'Resource added.', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Study resources</h3>
          <p className="text-xs text-zinc-400">
            Keep textbooks, websites, question banks, and notes linked to subjects.
          </p>
        </div>
        <button
          onClick={() => openResourceModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add resource</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-card p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            placeholder="Search resources by title, topic, or notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 glass-input text-xs"
          />
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="glass-input text-xs py-1.5 w-full sm:w-48"
        >
          <option value="">All subjects</option>
          {state.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredResources.length === 0 ? (
          <div className="md:col-span-2 p-10 text-center glass-card rounded-2xl border border-dashed border-white/10 text-xs text-zinc-400">
            <Bookmark className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
            <strong className="block text-zinc-200 text-sm">No resources found.</strong>
            Add a syllabus link, question bank, or core textbook to keep reference materials at your fingertips.
          </div>
        ) : (
          filteredResources.map((res) => (
            <div
              key={res.id}
              className="glass-card p-5 rounded-2xl flex flex-col justify-between border hover:border-white/20 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-sky-500/20 text-sky-200 border border-sky-400/30">
                      {res.type}
                    </span>
                    <span className="text-[11px] text-zinc-400">{getSubjectName(res.subjectId)}</span>
                    {res.topic && (
                      <span className="text-[11px] text-zinc-400">· {res.topic}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openResourceModal(res)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(res)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-base font-bold text-white tracking-tight mt-1">{res.title}</h4>

                {res.url && (
                  <div className="mt-2">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 underline break-all"
                    >
                      <span>{res.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}

                {res.notes && (
                  <p className="text-xs text-zinc-300/90 mt-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5 leading-relaxed">
                    {res.notes}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white tracking-tight mb-4">
              {editingResource ? 'Edit Resource' : 'Add Study Resource'}
            </h3>

            <form onSubmit={handleSaveResource} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Halliday & Resnick Physics"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="Book">Book</option>
                    <option value="Website">Website</option>
                    <option value="Video">Video</option>
                    <option value="Question bank">Question bank</option>
                    <option value="Notes">Notes</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="">General</option>
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Web URL or Location
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Topic / Chapter
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kinematics Chapter 2"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key concepts, page references, or access details"
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
                  Save Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Resource?"
        message={`Delete "${confirmDelete?.title}"? This cannot be undone.`}
        onConfirm={() => {
          if (confirmDelete) {
            onUpdateState({
              ...state,
              resources: state.resources.filter((r) => r.id !== confirmDelete.id),
            });
            setConfirmDelete(null);
            onShowToast('Resource deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
