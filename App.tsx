import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Navbar, PageView } from './components/Navbar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { VegaState, StudyLog } from './types';
import {
  loadState,
  saveState,
  uid,
  todayIso,
} from './lib/storage';
import {
  initAuth,
  googleSignIn,
  logout,
} from './lib/firebase';

// Views
import { DashboardView } from './views/DashboardView';
import { StudyLogsView } from './views/StudyLogsView';
import { SubjectsView } from './views/SubjectsView';
import { AssessmentsView } from './views/AssessmentsView';
import { ErrorsView } from './views/ErrorsView';
import { AnalyticsView } from './views/AnalyticsView';
import { WeeklyReviewView } from './views/WeeklyReviewView';
import { PlanningView } from './views/PlanningView';
import { CalendarView } from './views/CalendarView';
import { ProjectsView } from './views/ProjectsView';
import { GoalsView } from './views/GoalsView';
import { ResourcesView } from './views/ResourcesView';
import { ReviewSchedulerView } from './views/ReviewSchedulerView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const [state, setState] = useState<VegaState>(() => loadState());
  const [currentPage, setCurrentPage] = useState<PageView>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  // Auth & Workspace token state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = uid();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync state to localStorage whenever it changes
  const updateState = (newState: VegaState) => {
    setState(newState);
    saveState(newState);
  };

  // Initialize Firebase Auth listener on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignInWithGoogle = async () => {
    try {
      showToast('Opening Google sign in…', 'info');
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        showToast(
          `Connected as ${result.user.displayName || result.user.email}! Google Calendar sync is active.`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      showToast(err.message || 'Failed to sign in with Google.', 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      showToast('Signed out from Google.', 'info');
    } catch (err: any) {
      console.error('Logout error:', err);
      showToast('Error signing out.', 'error');
    }
  };

  // Quick Log modal state from topbar
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [qlSubjectId, setQlSubjectId] = useState('');
  const [qlTopicId, setQlTopicId] = useState('');
  const [qlMode, setQlMode] = useState('Practice');
  const [qlDate, setQlDate] = useState(todayIso());
  const [qlMinutes, setQlMinutes] = useState(45);
  const [qlTests, setQlTests] = useState(1);
  const [qlCorrect, setQlCorrect] = useState(12);
  const [qlWrong, setQlWrong] = useState(2);
  const [qlUnanswered, setQlUnanswered] = useState(0);
  const [qlSource, setQlSource] = useState('');
  const [qlMistakes, setQlMistakes] = useState('');
  const [qlMistakeReasons, setQlMistakeReasons] = useState('');
  const [qlNextAction, setQlNextAction] = useState('');
  const [qlNotes, setQlNotes] = useState('');

  const handleOpenQuickLog = () => {
    setQlSubjectId(state.subjects[0]?.id || '');
    setQlTopicId('');
    setQlMode(state.modes[0] || 'Practice');
    setQlDate(todayIso());
    setQlMinutes(45);
    setQlTests(1);
    setQlCorrect(12);
    setQlWrong(2);
    setQlUnanswered(0);
    setQlSource('');
    setQlMistakes('');
    setQlMistakeReasons('');
    setQlNextAction('');
    setQlNotes('');
    setIsQuickLogOpen(true);
  };

  const handleSaveQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qlSubjectId) {
      showToast('Please select a subject.', 'error');
      return;
    }

    if (
      Number(qlMinutes) < 0 ||
      Number(qlCorrect) < 0 ||
      Number(qlWrong) < 0 ||
      Number(qlUnanswered) < 0
    ) {
      showToast('Numeric values cannot be negative.', 'error');
      return;
    }

    const newLog: StudyLog = {
      id: uid(),
      date: qlDate,
      subjectId: qlSubjectId,
      topicId: qlTopicId || undefined,
      mode: qlMode,
      minutes: Number(qlMinutes) || 0,
      tests: Number(qlTests) || 0,
      correct: Number(qlCorrect) || 0,
      wrong: Number(qlWrong) || 0,
      unanswered: Number(qlUnanswered) || 0,
      source: qlSource.trim() || undefined,
      mistakes: qlMistakes.trim() || undefined,
      mistakeReasons: qlMistakeReasons.trim() || undefined,
      nextAction: qlNextAction.trim() || undefined,
      notes: qlNotes.trim() || undefined,
    };

    updateState({
      ...state,
      logs: [newLog, ...state.logs],
    });

    setIsQuickLogOpen(false);
    showToast('Study session logged!', 'success');
  };

  const pageTitles: Record<PageView, string> = {
    dashboard: 'Overview',
    calendar: 'Calendar & planner',
    logs: 'Daily study logs',
    subjects: 'Subjects & topics',
    assessments: 'Assessments',
    errors: 'Error intelligence',
    analytics: 'Analytics',
    review: 'Weekly / monthly review',
    planning: 'Next actions',
    projects: 'Project tracker',
    goals: 'Goals & targets',
    resources: 'Study resources',
    reviewscheduler: 'Smart review',
    settings: 'Settings & data',
  };

  return (
    <div className="min-h-screen flex text-zinc-100 selection:bg-sky-500/30">
      {/* Navigation Sidebar */}
      <Navbar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        isCollapsed={isNavCollapsed}
        user={user}
        hasCalendarToken={!!accessToken}
        onOpenGoogleLogin={handleSignInWithGoogle}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Header
            currentPage={currentPage}
            pageTitle={pageTitles[currentPage] || 'Vega Core'}
            onToggleSidebar={() => {
              if (window.innerWidth < 1024) {
                setIsMobileNavOpen(!isMobileNavOpen);
              } else {
                setIsNavCollapsed(!isNavCollapsed);
              }
            }}
            onOpenQuickLog={handleOpenQuickLog}
            onNavigate={setCurrentPage}
            state={state}
            user={user}
            hasCalendarToken={!!accessToken}
            onSignInWithGoogle={handleSignInWithGoogle}
            onSignOut={handleSignOut}
          />

          {/* Views */}
          {currentPage === 'dashboard' && (
            <DashboardView
              state={state}
              onNavigate={setCurrentPage}
              onQuickLog={handleOpenQuickLog}
              hasCalendarToken={!!accessToken}
              onSignInWithGoogle={handleSignInWithGoogle}
            />
          )}

          {currentPage === 'logs' && (
            <StudyLogsView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'subjects' && (
            <SubjectsView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'assessments' && (
            <AssessmentsView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'errors' && (
            <ErrorsView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'analytics' && <AnalyticsView state={state} />}

          {currentPage === 'review' && (
            <WeeklyReviewView
              state={state}
              onUpdateState={updateState}
              onNavigate={setCurrentPage}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'planning' && (
            <PlanningView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'calendar' && (
            <CalendarView
              state={state}
              onUpdateState={updateState}
              user={user}
              hasCalendarToken={!!accessToken}
              accessToken={accessToken}
              onSignInWithGoogle={handleSignInWithGoogle}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'projects' && (
            <ProjectsView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'goals' && (
            <GoalsView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'resources' && (
            <ResourcesView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'reviewscheduler' && (
            <ReviewSchedulerView
              state={state}
              onUpdateState={updateState}
              onShowToast={showToast}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsView
              state={state}
              onUpdateState={updateState}
              user={user}
              hasCalendarToken={!!accessToken}
              onSignInWithGoogle={handleSignInWithGoogle}
              onSignOut={handleSignOut}
              onShowToast={showToast}
            />
          )}

          <footer className="mt-16 pt-8 border-t border-white/5 text-center text-[10px] text-zinc-500 tracking-wider uppercase font-semibold">
            VEGA CORE · A QUIET SPACE FOR BIG PLANS · BUILT FOR CONSISTENCY, NOT PERFECTION
          </footer>
        </main>
      </div>

      {/* Global Quick Add Study Log Modal */}
      {isQuickLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg p-6 glass-modal rounded-3xl border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white tracking-tight mb-1">Quick Log Study</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Record a completed study session in seconds.
            </p>

            <form onSubmit={handleSaveQuickLog} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Subject *</label>
                  <select
                    value={qlSubjectId}
                    onChange={(e) => {
                      setQlSubjectId(e.target.value);
                      setQlTopicId('');
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
                    value={qlTopicId}
                    onChange={(e) => setQlTopicId(e.target.value)}
                    className="w-full glass-input text-xs"
                  >
                    <option value="">General / not specified</option>
                    {state.subjects
                      .find((s) => s.id === qlSubjectId)
                      ?.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Study Mode</label>
                  <select
                    value={qlMode}
                    onChange={(e) => setQlMode(e.target.value)}
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
                    value={qlDate}
                    onChange={(e) => setQlDate(e.target.value)}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Duration (min) *</label>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    value={qlMinutes}
                    onChange={(e) => setQlMinutes(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Tests / Sets</label>
                  <input
                    type="number"
                    min="0"
                    value={qlTests}
                    onChange={(e) => setQlTests(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Correct</label>
                  <input
                    type="number"
                    min="0"
                    value={qlCorrect}
                    onChange={(e) => setQlCorrect(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Wrong</label>
                  <input
                    type="number"
                    min="0"
                    value={qlWrong}
                    onChange={(e) => setQlWrong(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Unanswered</label>
                  <input
                    type="number"
                    min="0"
                    value={qlUnanswered}
                    onChange={(e) => setQlUnanswered(Number(e.target.value))}
                    className="w-full glass-input text-xs"
                  />
                </div>
              </div>

              {/* Calculated metrics live indicator */}
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-zinc-300">
                <div>
                  Total questions: <strong className="text-white">{qlCorrect + qlWrong + qlUnanswered}</strong>
                </div>
                <div>
                  Attempt accuracy:{' '}
                  <strong className="text-sky-300">
                    {qlCorrect + qlWrong > 0
                      ? `${Math.round((qlCorrect / (qlCorrect + qlWrong)) * 100)}%`
                      : '—'}
                  </strong>
                </div>
                <div>
                  Completion rate:{' '}
                  <strong className="text-emerald-300">
                    {qlCorrect + qlWrong + qlUnanswered > 0
                      ? `${Math.round((qlCorrect / (qlCorrect + qlWrong + qlUnanswered)) * 100)}%`
                      : '—'}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Source / Session Label</label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 problem set, Midterm review"
                  value={qlSource}
                  onChange={(e) => setQlSource(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key takeaways or observations"
                  value={qlNotes}
                  onChange={(e) => setQlNotes(e.target.value)}
                  className="w-full glass-input text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsQuickLogOpen(false)}
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

      {/* Floating Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
