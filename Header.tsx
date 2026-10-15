import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Plus,
  Search,
  Calendar,
  LogOut,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { PageView } from './Navbar';
import { VegaState } from '../types';
import { dateLabel, todayIso } from '../lib/storage';

interface HeaderProps {
  currentPage: PageView;
  pageTitle: string;
  onToggleSidebar: () => void;
  onOpenQuickLog: () => void;
  onNavigate: (page: PageView) => void;
  state: VegaState;
  user: User | null;
  hasCalendarToken: boolean;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  pageTitle,
  onToggleSidebar,
  onOpenQuickLog,
  onNavigate,
  state,
  user,
  hasCalendarToken,
  onSignInWithGoogle,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search results on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSubjectName = (id?: string) =>
    state.subjects.find((s) => s.id === id)?.name || 'General';

  // Search indexing
  const getSearchResults = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { type: string; label: string; detail: string; page: PageView }[] = [];

    state.subjects.forEach((s) => {
      if (s.name.toLowerCase().includes(q)) {
        results.push({ type: 'Subject', label: s.name, detail: `${s.topics.length} topics`, page: 'subjects' });
      }
      s.topics.forEach((t) => {
        if (t.name.toLowerCase().includes(q)) {
          results.push({ type: 'Topic', label: t.name, detail: s.name, page: 'subjects' });
        }
      });
    });

    state.logs.forEach((l) => {
      if ((l.notes || '').toLowerCase().includes(q) || (l.source || '').toLowerCase().includes(q)) {
        results.push({
          type: 'Study Log',
          label: l.source || 'Study Session',
          detail: `${getSubjectName(l.subjectId)} · ${l.date}`,
          page: 'logs',
        });
      }
    });

    state.tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q)) {
        results.push({
          type: 'Planned Task',
          label: t.title,
          detail: `${dateLabel(t.date)} · ${getSubjectName(t.subjectId)}`,
          page: 'calendar',
        });
      }
    });

    state.errors.forEach((e) => {
      if (e.title.toLowerCase().includes(q) || (e.cause || '').toLowerCase().includes(q)) {
        results.push({
          type: 'Error Loop',
          label: e.title,
          detail: `${getSubjectName(e.subjectId)} · ${e.status}`,
          page: 'errors',
        });
      }
    });

    state.projects.forEach((p) => {
      if (p.name.toLowerCase().includes(q) || (p.notes || '').toLowerCase().includes(q)) {
        results.push({
          type: 'Project',
          label: p.name,
          detail: `${p.progress}% completed`,
          page: 'projects',
        });
      }
    });

    state.resources.forEach((r) => {
      if (r.title.toLowerCase().includes(q) || (r.topic || '').toLowerCase().includes(q)) {
        results.push({
          type: 'Resource',
          label: r.title,
          detail: `${r.type} · ${getSubjectName(r.subjectId)}`,
          page: 'resources',
        });
      }
    });

    return results.slice(0, 8);
  };

  const searchResults = getSearchResults();

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-7 pb-4 border-b border-white/10">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors"
          title="Toggle navigation"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-sky-300/80">
            {currentPage === 'dashboard' ? 'YOUR STUDY SPACE' : `VEGA CORE / ${currentPage.toUpperCase()}`}
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-0.5">
            {pageTitle}
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Bar */}
        <div ref={searchRef} className="relative flex-1 sm:w-60 md:w-64">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Search everything…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-9 pr-3 py-1.5 glass-input text-xs placeholder:text-zinc-400/80 rounded-xl"
            />
          </div>

          {/* Search Dropdown */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 glass-card p-2 rounded-xl z-50 border border-white/20 shadow-2xl animate-in fade-in max-h-80 overflow-y-auto">
              <div className="text-[10px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider">
                Search Results ({searchResults.length})
              </div>
              {searchResults.length === 0 ? (
                <div className="text-xs text-zinc-400 p-3 text-center">No matching records found.</div>
              ) : (
                searchResults.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      onNavigate(item.page);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">{item.label}</div>
                      <div className="text-[10px] text-zinc-400 truncate">{item.detail}</div>
                    </div>
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-sky-200 shrink-0">
                      {item.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Date pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-zinc-300">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <span>{dateLabel(todayIso())}</span>
        </div>

        {/* Google Calendar Auth Button */}
        {hasCalendarToken && user ? (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-zinc-200 transition-all"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-sky-500/30 text-sky-200 text-[10px] flex items-center justify-center font-bold">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="max-w-[100px] truncate font-medium">
                {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 glass-card p-2 rounded-xl z-50 border border-white/20 shadow-2xl animate-in fade-in">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {user.displayName || 'Google Account'}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">{user.email}</div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Google Calendar Synced</span>
                  </div>
                </div>

                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open Google Calendar</span>
                </a>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onNavigate('calendar');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>Phone & PC Sync Guide</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onSignInWithGoogle}
            className="gsi-material-button text-xs !h-9 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
            title="Sign in with your Google account to sync your study planner with Google Calendar"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">Sign in with Google</span>
            </div>
          </button>
        )}

        {/* Quick Log Action */}
        <button
          onClick={onOpenQuickLog}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/40 text-xs font-semibold text-sky-100 shadow-md shadow-sky-950/40 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add study log</span>
        </button>
      </div>
    </header>
  );
};
