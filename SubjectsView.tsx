import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Palette,
  Layers,
} from 'lucide-react';
import { VegaState, Subject, Topic } from '../types';
import {
  fmt,
  logHours,
  totalQs,
  uid,
  dateLabel,
  getSubjectColor,
  PRESET_SUBJECT_COLORS,
} from '../lib/storage';
import { ConfirmModal } from '../components/ConfirmModal';

interface SubjectsViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectColorHex, setSubjectColorHex] = useState(PRESET_SUBJECT_COLORS[0].hex);

  // Topic modals
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<{ subjectId: string; topic: Topic } | null>(null);
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [topicName, setTopicName] = useState('');

  const [confirmDeleteSubj, setConfirmDeleteSubj] = useState<Subject | null>(null);
  const [confirmDeleteTopic, setConfirmDeleteTopic] = useState<{ subjectId: string; topic: Topic } | null>(null);

  const openSubjectModal = (subj?: Subject) => {
    if (subj) {
      setEditingSubject(subj);
      setSubjectName(subj.name);
      setSubjectColorHex(getSubjectColor(subj));
    } else {
      setEditingSubject(null);
      setSubjectName('');
      // Suggest next available preset color
      const usedColors = state.subjects.map((s) => getSubjectColor(s).toLowerCase());
      const nextUnused = PRESET_SUBJECT_COLORS.find(
        (c) => !usedColors.includes(c.hex.toLowerCase())
      );
      setSubjectColorHex(nextUnused?.hex || PRESET_SUBJECT_COLORS[0].hex);
    }
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = subjectName.trim();
    if (!cleanName) return;

    if (
      state.subjects.some(
        (s) =>
          s.name.toLowerCase() === cleanName.toLowerCase() &&
          s.id !== editingSubject?.id
      )
    ) {
      onShowToast('A subject with this name already exists.', 'error');
      return;
    }

    const matchedPreset = PRESET_SUBJECT_COLORS.find(
      (c) => c.hex.toLowerCase() === subjectColorHex.toLowerCase()
    );
    const presetId = matchedPreset ? matchedPreset.id : 'blue';

    let updated: Subject[];
    if (editingSubject) {
      updated = state.subjects.map((s) =>
        s.id === editingSubject.id
          ? {
              ...s,
              name: cleanName,
              color: presetId as any,
              colorHex: subjectColorHex,
            }
          : s
      );
    } else {
      const newSubject: Subject = {
        id: uid(),
        name: cleanName,
        color: presetId as any,
        colorHex: subjectColorHex,
        topics: [],
      };
      updated = [...state.subjects, newSubject];
    }

    onUpdateState({ ...state, subjects: updated });
    setIsSubjectModalOpen(false);
    onShowToast(
      editingSubject
        ? `Updated "${cleanName}" with color.`
        : `Added custom subject "${cleanName}".`,
      'success'
    );
  };

  const openAddTopicModal = (subjId: string) => {
    setEditingTopic(null);
    setTargetSubjectId(subjId);
    setTopicName('');
    setIsTopicModalOpen(true);
  };

  const openEditTopicModal = (subjectId: string, topic: Topic) => {
    setEditingTopic({ subjectId, topic });
    setTargetSubjectId(subjectId);
    setTopicName(topic.name);
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTopicName = topicName.trim();
    if (!cleanTopicName || !targetSubjectId) return;

    const subj = state.subjects.find((s) => s.id === targetSubjectId);
    if (!subj) return;

    if (
      subj.topics.some(
        (t) =>
          t.name.toLowerCase() === cleanTopicName.toLowerCase() &&
          t.id !== editingTopic?.topic.id
      )
    ) {
      onShowToast('This topic name already exists for this subject.', 'error');
      return;
    }

    let updatedSubjects: Subject[];
    if (editingTopic) {
      updatedSubjects = state.subjects.map((s) =>
        s.id === targetSubjectId
          ? {
              ...s,
              topics: s.topics.map((t) =>
                t.id === editingTopic.topic.id ? { ...t, name: cleanTopicName } : t
              ),
            }
          : s
      );
    } else {
      const newTopic: Topic = { id: uid(), name: cleanTopicName };
      updatedSubjects = state.subjects.map((s) =>
        s.id === targetSubjectId ? { ...s, topics: [...s.topics, newTopic] } : s
      );
    }

    onUpdateState({ ...state, subjects: updatedSubjects });
    setIsTopicModalOpen(false);
    onShowToast(
      editingTopic
        ? `Renamed topic to "${cleanTopicName}".`
        : `Added topic "${cleanTopicName}" to ${subj.name}.`,
      'success'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Subjects & Topics</h3>
          <p className="text-xs text-zinc-400">
            Create custom subjects, select unique identifiable colors, and structure curriculum topics.
          </p>
        </div>
        <button
          onClick={() => openSubjectModal()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Subject</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.subjects.map((subj) => {
          const subjColor = getSubjectColor(subj);
          const logs = state.logs.filter((l) => l.subjectId === subj.id);
          const hours = logs.reduce((acc, l) => acc + logHours(l), 0);
          const loggedQs = logs.reduce((acc, l) => acc + totalQs(l), 0);

          const openErrors = state.errors.filter(
            (e) => e.subjectId === subj.id && e.status !== 'resolved'
          );

          const assessments = state.assessments
            .filter((a) => a.subjectId === subj.id && Number(a.total) > 0)
            .sort((a, b) => a.date.localeCompare(b.date));

          const lastAssess = assessments.at(-1);
          const prevAssess = assessments.at(-2);
          const latestScore = lastAssess?.score ?? null;
          const prevScore = prevAssess?.score ?? null;
          const diff = latestScore !== null && prevScore !== null ? latestScore - prevScore : null;

          const totalQuestions =
            loggedQs + assessments.reduce((acc, a) => acc + Number(a.total || 0), 0);

          return (
            <div
              key={subj.id}
              className="glass-card p-6 rounded-2xl flex flex-col justify-between border transition-all hover:border-white/20"
              style={{ borderLeftColor: subjColor, borderLeftWidth: '4px' }}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md"
                      style={{
                        backgroundColor: `${subjColor}25`,
                        color: subjColor,
                        border: `1.5px solid ${subjColor}60`,
                      }}
                    >
                      {subj.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white tracking-tight">{subj.name}</h4>
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                          style={{ backgroundColor: subjColor }}
                          title={`Color: ${subjColor}`}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {subj.topics.length} topics · {fmt(hours)}h studied · {fmt(totalQuestions, 0)} questions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openSubjectModal(subj)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                      title="Edit subject name & color"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteSubj(subj)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Score & trend badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {latestScore !== null ? (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 font-medium text-white flex items-center gap-1.5">
                      <span>Latest:</span>
                      <strong className="text-sky-300">{fmt(latestScore)}%</strong>
                      {diff !== null && (
                        <span
                          className={`text-[9px] font-bold ${
                            diff >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          ({diff >= 0 ? '+' : ''}{fmt(diff)} pp)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                      No assessment recorded
                    </span>
                  )}

                  {openErrors.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{openErrors.length} open error loop(s)</span>
                    </span>
                  )}
                </div>

                {/* Color-consistent progress bar */}
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, latestScore ?? (hours > 0 ? 30 : 5))}%`,
                      backgroundColor: subjColor,
                    }}
                  />
                </div>

                {/* Topics list */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
                    Topics ({subj.topics.length}):
                  </span>
                  {subj.topics.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-zinc-500 border border-dashed border-white/10 rounded-xl">
                      No topics added yet. Click "+ Add topic" below.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {subj.topics.map((t) => (
                        <span
                          key={t.id}
                          className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-200 hover:border-white/20 transition-all"
                        >
                          <span>{t.name}</span>
                          <button
                            onClick={() => openEditTopicModal(subj.id, t)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white transition-opacity"
                            title="Edit topic name"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Add Topic button */}
              <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">
                  Color consistent across all charts & calendar
                </span>
                <button
                  onClick={() => openAddTopicModal(subj.id)}
                  className="flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add topic</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Subject Modal with Color Palette & Hex Picker */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white tracking-tight mb-4">
              {editingSubject ? 'Edit Subject' : 'Add Custom Subject'}
            </h3>
            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Molecular Genetics, World History"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              {/* Color Customization (Requirement 3) */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Subject Color (Used Consistently Across All Charts & Events)
                </label>
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {PRESET_SUBJECT_COLORS.map((c) => {
                    const isSelected = subjectColorHex.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSubjectColorHex(c.hex)}
                        className={`h-8 rounded-xl transition-all relative flex items-center justify-center shadow-sm ${
                          isSelected ? 'ring-2 ring-white scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white shadow" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Input Picker */}
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                  <input
                    type="color"
                    value={subjectColorHex}
                    onChange={(e) => setSubjectColorHex(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    title="Choose custom hex color"
                  />
                  <input
                    type="text"
                    value={subjectColorHex}
                    onChange={(e) => setSubjectColorHex(e.target.value)}
                    placeholder="#38bdf8"
                    className="flex-1 glass-input text-xs font-mono uppercase"
                  />
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow"
                    style={{ backgroundColor: subjectColorHex }}
                  >
                    Preview
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-white shadow transition-all"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Topic Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl">
            <h3 className="text-lg font-bold text-white tracking-tight mb-4">
              {editingTopic ? 'Edit Topic Name' : 'Add Topic'}
            </h3>
            <form onSubmit={handleSaveTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Topic Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Recombinant DNA Technology"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsTopicModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-white shadow"
                >
                  Save Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation */}
      <ConfirmModal
        isOpen={!!confirmDeleteSubj}
        title="Delete Subject?"
        message={`Delete "${confirmDeleteSubj?.name}" and its topics? Existing logs will remain, but the subject name will display as General.`}
        onConfirm={() => {
          if (confirmDeleteSubj) {
            onUpdateState({
              ...state,
              subjects: state.subjects.filter((s) => s.id !== confirmDeleteSubj.id),
            });
            setConfirmDeleteSubj(null);
            onShowToast('Subject deleted.', 'info');
          }
        }}
        onCancel={() => setConfirmDeleteSubj(null)}
      />
    </div>
  );
};
