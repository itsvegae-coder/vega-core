import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  BookOpen,
  Award,
  AlertTriangle,
  BarChart3,
  RotateCcw,
  CalendarClock,
  FolderKanban,
  Target,
  CheckSquare,
  Bookmark,
  Settings,
  X,
  ChevronDown,
  CloudCheck,
  Smartphone,
} from 'lucide-react';
import { User } from 'firebase/auth';

export type PageView =
  | 'dashboard'
  | 'calendar'
  | 'logs'
  | 'subjects'
  | 'assessments'
  | 'errors'
  | 'analytics'
  | 'review'
  | 'reviewscheduler'
  | 'projects'
  | 'goals'
  | 'planning'
  | 'resources'
  | 'settings';

interface NavGroupItem {
  id: PageView;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  groupId: string;
  label: string;
  icon: React.ReactNode;
  items: NavGroupItem[];
}

interface NavbarProps {
  currentPage: PageView;
  onSelectPage: (page: PageView) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  user: User | null;
  hasCalendarToken: boolean;
  onOpenGoogleLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onSelectPage,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  user,
  hasCalendarToken,
  onOpenGoogleLogin,
}) => {
  // Navigation structure adhering strictly to the user's specification & original layout
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    calendar: true,
    learning: true,
    analytics: true,
    goals: true,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const navGroups: NavGroup[] = [
    {
      groupId: 'calendar',
      label: 'Calendar & Study Log',
      icon: <Calendar className="w-4 h-4 text-sky-300" />,
      items: [
        { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
        { id: 'logs', label: 'Study Log', icon: <Clock className="w-3.5 h-3.5" /> },
      ],
    },
    {
      groupId: 'learning',
      label: 'Learning Intelligence',
      icon: <BookOpen className="w-4 h-4 text-emerald-300" />,
      items: [
        { id: 'subjects', label: 'Subject & Topic', icon: <BookOpen className="w-3.5 h-3.5" /> },
        { id: 'assessments', label: 'Assessment', icon: <Award className="w-3.5 h-3.5" /> },
        { id: 'errors', label: 'Error Intelligence', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
      ],
    },
    {
      groupId: 'analytics',
      label: 'Analytics & Review',
      icon: <BarChart3 className="w-4 h-4 text-purple-300" />,
      items: [
        { id: 'analytics', label: 'Analysis', icon: <BarChart3 className="w-3.5 h-3.5" /> },
        { id: 'review', label: 'Weekly / Monthly Review', icon: <RotateCcw className="w-3.5 h-3.5" /> },
        { id: 'reviewscheduler', label: 'Smart Review', icon: <CalendarClock className="w-3.5 h-3.5" /> },
      ],
    },
    {
      groupId: 'goals',
      label: 'Goals & Projects',
      icon: <Target className="w-4 h-4 text-amber-300" />,
      items: [
        { id: 'projects', label: 'Project Tracker', icon: <FolderKanban className="w-3.5 h-3.5" /> },
        { id: 'goals', label: 'Goals & Targets', icon: <Target className="w-3.5 h-3.5" /> },
      ],
    },
  ];

  const handleNavClick = (id: PageView) => {
    onSelectPage(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 lg:static flex flex-col justify-between glass-sidebar transition-all duration-300 ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className="p-4 overflow-y-auto flex-1">
          {/* Brand header */}
          <div className="flex items-center justify-between mb-6 px-2">
            <div
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-200 font-bold text-base shadow-inner group-hover:bg-sky-500/30 transition-all">
                V
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="text-sm font-bold tracking-widest text-white leading-none">
                    VEGA CORE
                  </h1>
                  <p className="text-[10px] text-zinc-400 mt-1 font-medium leading-none">
                    A quiet space for big plans
                  </p>
                </div>
              )}
            </div>
            {/* Close button on mobile */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sync badge info */}
          {!isCollapsed && (
            <div className="mb-4 px-2">
              {hasCalendarToken && user ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                  <CloudCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Google Calendar Active</span>
                </div>
              ) : (
                <button
                  onClick={onOpenGoogleLogin}
                  className="w-full flex items-center gap-2 p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-[11px] transition-all text-left"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">Sync with Phone & PC</span>
                </button>
              )}
            </div>
          )}

          {/* Workspace sections */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400/80 mb-2">
                Workspace
              </p>
            )}

            {/* Overview / Dashboard */}
            <button
              onClick={() => handleNavClick('dashboard')}
              title={isCollapsed ? 'Overview' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentPage === 'dashboard'
                  ? 'bg-sky-500/20 text-sky-100 font-semibold border border-sky-400/20 shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <LayoutDashboard
                className={`w-4 h-4 ${
                  currentPage === 'dashboard' ? 'text-sky-300' : 'text-zinc-400'
                }`}
              />
              {!isCollapsed && <span className="truncate">Overview</span>}
            </button>

            {/* Collapsible Groups */}
            {navGroups.map((group) => {
              const isGroupActive = group.items.some((item) => item.id === currentPage);
              const isOpen = isCollapsed ? false : !!openGroups[group.groupId];

              return (
                <div key={group.groupId} className="pt-1">
                  {!isCollapsed ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.groupId)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isGroupActive
                            ? 'text-sky-200'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {group.icon}
                          <span className="truncate font-medium">{group.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Sub-items */}
                      {isOpen && (
                        <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-white/5 ml-4 mt-0.5">
                          {group.items.map((item) => {
                            const active = currentPage === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  active
                                    ? 'bg-sky-500/20 text-sky-100 font-semibold border border-sky-400/20 shadow-sm'
                                    : 'text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                              >
                                <span className={active ? 'text-sky-300' : 'text-zinc-400'}>
                                  {item.icon}
                                </span>
                                <span className="truncate">{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Collapsed mode: direct icons for all items in group */
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const active = currentPage === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id)}
                            title={item.label}
                            className={`w-full flex items-center justify-center py-2.5 rounded-xl text-xs transition-all ${
                              active
                                ? 'bg-sky-500/20 text-sky-100 border border-sky-400/20'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {item.icon}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Next Actions */}
            <button
              onClick={() => handleNavClick('planning')}
              title={isCollapsed ? 'Next actions' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentPage === 'planning'
                  ? 'bg-sky-500/20 text-sky-100 font-semibold border border-sky-400/20 shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <CheckSquare
                className={`w-4 h-4 ${
                  currentPage === 'planning' ? 'text-sky-300' : 'text-zinc-400'
                }`}
              />
              {!isCollapsed && <span className="truncate">Next actions</span>}
            </button>

            {/* Study Resources */}
            <button
              onClick={() => handleNavClick('resources')}
              title={isCollapsed ? 'Study resources' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentPage === 'resources'
                  ? 'bg-sky-500/20 text-sky-100 font-semibold border border-sky-400/20 shadow-sm'
                  : 'text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Bookmark
                className={`w-4 h-4 ${
                  currentPage === 'resources' ? 'text-sky-300' : 'text-zinc-400'
                }`}
              />
              {!isCollapsed && <span className="truncate">Study resources</span>}
            </button>
          </div>

          {/* Settings Section */}
          <div className="mt-5 pt-3 border-t border-white/10 space-y-1">
            {!isCollapsed && (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400/80 mb-2">
                Personalize
              </p>
            )}
            <button
              onClick={() => handleNavClick('settings')}
              title={isCollapsed ? 'Settings & data' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentPage === 'settings'
                  ? 'bg-sky-500/20 text-sky-100 font-semibold border border-sky-400/20'
                  : 'text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Settings
                className={`w-4 h-4 ${
                  currentPage === 'settings' ? 'text-sky-300' : 'text-zinc-400'
                }`}
              />
              {!isCollapsed && <span className="truncate">Settings & data</span>}
            </button>
          </div>
        </div>

        {/* Bottom status badge */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/10 text-[10px] text-zinc-400/80 leading-normal">
            <span className="font-semibold block text-zinc-300">LOCAL & GOOGLE SYNC</span>
            Private local workspace with direct Google Calendar connectivity.
          </div>
        )}
      </aside>
    </>
  );
};
