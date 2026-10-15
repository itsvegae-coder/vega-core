import React, { useState, useMemo } from 'react';
import {
  Clock,
  BookOpen,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Calendar,
  Layers,
  HelpCircle,
  Target,
  ArrowRight,
  Info,
} from 'lucide-react';
import { VegaState, Subject, Topic, StudyLog, Assessment, Goal } from '../types';
import {
  fmt,
  logHours,
  totalQs,
  attemptedQs,
  attemptAccuracy,
  completionRate,
  dateObj,
  addDays,
  todayIso,
  dateLabel,
  weekStart,
  getSubjectColor,
  DateRangePreset,
  isDateInRange,
} from '../lib/storage';
import { PointChart, PointChartDataPoint } from '../components/PointChart';

interface AnalyticsViewProps {
  state: VegaState;
}

type AnalyticsTab = 'study_time' | 'questions' | 'mastery' | 'topic_comparison';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ state }) => {
  // Primary Filters (Requirement 6)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(addDays(todayIso(), -30));
  const [customEndDate, setCustomEndDate] = useState<string>(todayIso());

  // Active view tab
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('study_time');

  // Sub-controls
  const [timeGranularity, setTimeGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [compareTopicId, setCompareTopicId] = useState<string>('');
  const [comparisonBaseline, setComparisonBaseline] = useState<'previous' | 'first'>('previous');

  const selectedSubject = state.subjects.find((s) => s.id === selectedSubjectId);

  // Filtered topics based on selected subject (Requirement 6)
  const availableTopics = useMemo(() => {
    if (selectedSubjectId === 'all') {
      return state.subjects.flatMap((s) => s.topics);
    }
    return selectedSubject?.topics || [];
  }, [selectedSubjectId, selectedSubject, state.subjects]);

  // Keep compareTopicId synced with available topics
  React.useEffect(() => {
    if (availableTopics.length > 0 && (!compareTopicId || !availableTopics.some((t) => t.id === compareTopicId))) {
      setCompareTopicId(availableTopics[0].id);
    }
  }, [availableTopics, compareTopicId]);

  // Filter study logs by subject, topic, and date range
  const filteredLogs = useMemo(() => {
    return state.logs.filter((log) => {
      if (selectedSubjectId !== 'all' && log.subjectId !== selectedSubjectId) return false;
      if (selectedTopicId !== 'all' && log.topicId !== selectedTopicId) return false;
      if (!isDateInRange(log.date, dateRangePreset, customStartDate, customEndDate, state.preferences?.weekStart ?? 1)) {
        return false;
      }
      return true;
    });
  }, [state.logs, selectedSubjectId, selectedTopicId, dateRangePreset, customStartDate, customEndDate, state.preferences]);

  // Filter assessments by subject, topic, and date range
  const filteredAssessments = useMemo(() => {
    return state.assessments
      .filter((a) => {
        if (selectedSubjectId !== 'all' && a.subjectId !== selectedSubjectId) return false;
        if (selectedTopicId !== 'all' && a.topicId !== selectedTopicId) return false;
        if (!isDateInRange(a.date, dateRangePreset, customStartDate, customEndDate, state.preferences?.weekStart ?? 1)) {
          return false;
        }
        return Number(a.total) > 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [state.assessments, selectedSubjectId, selectedTopicId, dateRangePreset, customStartDate, customEndDate, state.preferences]);

  // Primary color for selected subject or general accent
  const activeColor =
    selectedSubjectId !== 'all' && selectedSubject
      ? getSubjectColor(selectedSubject)
      : '#38bdf8';

  // Helper names
  const getSubjectName = (id?: string) => state.subjects.find((s) => s.id === id)?.name || 'General';
  const getTopicName = (sid?: string, tid?: string) =>
    state.subjects.find((s) => s.id === sid)?.topics.find((t) => t.id === tid)?.name ||
    'General / not specified';

  // Active Subject Target Goal if configured (Requirement 6.A)
  const activeGoal = state.goals?.find((g) => {
    if (g.metric !== 'hours') return false;
    if (selectedSubjectId === 'all') return !g.subjectId;
    return g.subjectId === selectedSubjectId;
  });

  // -------------------------------------------------------------
  // SECTION A: STUDY-TIME PROGRESS CALCULATIONS
  // -------------------------------------------------------------
  const totalStudyHours = useMemo(() => {
    return filteredLogs.reduce((sum, l) => sum + logHours(l), 0);
  }, [filteredLogs]);

  // Daily study points over the active range
  const studyTimePoints = useMemo<PointChartDataPoint[]>(() => {
    if (filteredLogs.length === 0) return [];

    if (timeGranularity === 'daily') {
      // Find start and end date of range
      const dates = Array.from(new Set(filteredLogs.map((l) => l.date))).sort();
      if (dates.length === 0) return [];
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      // Build continuous days if range <= 31 days, otherwise use recorded days
      const daysDiff = (dateObj(maxDate).getTime() - dateObj(minDate).getTime()) / (1000 * 3600 * 24);
      const continuousDates: string[] = [];
      if (daysDiff <= 31) {
        let cur = minDate;
        while (cur <= maxDate) {
          continuousDates.push(cur);
          cur = addDays(cur, 1);
        }
      } else {
        continuousDates.push(...dates);
      }

      return continuousDates.map((d) => {
        const dayLogs = filteredLogs.filter((l) => l.date === d);
        const dayHours = dayLogs.reduce((sum, l) => sum + logHours(l), 0);
        const has = dayLogs.length > 0;

        return {
          xLabel: dateObj(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          xSubLabel: dateObj(d).toLocaleDateString(undefined, { weekday: 'short' }),
          value: has ? dayHours : 0,
          color: activeColor,
          tooltipTitle: dateLabel(d),
          tooltipSubtitle: has
            ? `${fmt(dayHours)} study hours (${dayLogs.length} sessions logged)`
            : '0 study hours recorded',
        };
      });
    }

    if (timeGranularity === 'weekly') {
      // Group by week start
      const weekGroups: Record<string, number> = {};
      filteredLogs.forEach((l) => {
        const w = weekStart(l.date, state.preferences?.weekStart ?? 1);
        weekGroups[w] = (weekGroups[w] || 0) + logHours(l);
      });

      const sortedWeeks = Object.keys(weekGroups).sort();
      return sortedWeeks.map((w) => ({
        xLabel: `Wk ${dateObj(w).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        value: weekGroups[w],
        color: activeColor,
        tooltipTitle: `Week of ${dateLabel(w)}`,
        tooltipSubtitle: `${fmt(weekGroups[w])} total study hours logged`,
      }));
    }

    // Monthly
    const monthGroups: Record<string, number> = {};
    filteredLogs.forEach((l) => {
      const m = l.date.slice(0, 7);
      monthGroups[m] = (monthGroups[m] || 0) + logHours(l);
    });

    const sortedMonths = Object.keys(monthGroups).sort();
    return sortedMonths.map((m) => {
      const [year, month] = m.split('-');
      const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
      });
      return {
        xLabel: monthName,
        value: monthGroups[m],
        color: activeColor,
        tooltipTitle: `${monthName}`,
        tooltipSubtitle: `${fmt(monthGroups[m])} total study hours logged in this month`,
      };
    });
  }, [filteredLogs, timeGranularity, activeColor, state.preferences]);

  // Prior period comparison for study time (Requirement 6.A)
  const periodComparison = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    const dates = filteredLogs.map((l) => l.date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const daysSpan = Math.max(1, (dateObj(maxDate).getTime() - dateObj(minDate).getTime()) / (1000 * 3600 * 24));

    const priorStart = addDays(minDate, -daysSpan);
    const priorEnd = addDays(minDate, -1);

    const priorLogs = state.logs.filter((l) => {
      if (selectedSubjectId !== 'all' && l.subjectId !== selectedSubjectId) return false;
      if (selectedTopicId !== 'all' && l.topicId !== selectedTopicId) return false;
      return l.date >= priorStart && l.date <= priorEnd;
    });

    const currentTotal = totalStudyHours;
    const priorTotal = priorLogs.reduce((sum, l) => sum + logHours(l), 0);
    const diffHours = currentTotal - priorTotal;
    const pctChange = priorTotal > 0 ? (diffHours / priorTotal) * 100 : null;

    return {
      priorTotal,
      diffHours,
      pctChange,
      priorSpanLabel: `${dateLabel(priorStart)} – ${dateLabel(priorEnd)}`,
    };
  }, [filteredLogs, totalStudyHours, state.logs, selectedSubjectId, selectedTopicId]);

  // -------------------------------------------------------------
  // SECTION B: QUESTION & TEST PROGRESS CALCULATIONS
  // -------------------------------------------------------------
  const questionStats = useMemo(() => {
    let totalQuestions = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unansweredQuestions = 0;
    let totalTestsCount = 0;

    filteredLogs.forEach((l) => {
      totalQuestions += totalQs(l);
      correctAnswers += Number(l.correct || 0);
      incorrectAnswers += Number(l.wrong || 0);
      unansweredQuestions += Number(l.unanswered || 0);
      totalTestsCount += Number(l.tests || 1);
    });

    const attemptedQuestions = correctAnswers + incorrectAnswers;
    const overallAttemptAccuracy =
      attemptedQuestions > 0 ? (correctAnswers / attemptedQuestions) * 100 : null;
    const overallCompletionRate =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : null;

    return {
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      attemptedQuestions,
      totalTestsCount,
      overallAttemptAccuracy,
      overallCompletionRate,
    };
  }, [filteredLogs]);

  // Question Volume points over time (Requirement 6.B)
  const questionTimePoints = useMemo<PointChartDataPoint[]>(() => {
    if (filteredLogs.length === 0) return [];
    // Aggregate by date
    const dateMap: Record<string, { total: number; correct: number; wrong: number; unanswered: number }> = {};
    filteredLogs.forEach((l) => {
      if (!dateMap[l.date]) {
        dateMap[l.date] = { total: 0, correct: 0, wrong: 0, unanswered: 0 };
      }
      dateMap[l.date].total += totalQs(l);
      dateMap[l.date].correct += Number(l.correct || 0);
      dateMap[l.date].wrong += Number(l.wrong || 0);
      dateMap[l.date].unanswered += Number(l.unanswered || 0);
    });

    const sortedDates = Object.keys(dateMap).sort();
    return sortedDates.map((d) => {
      const q = dateMap[d];
      return {
        xLabel: dateObj(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        xSubLabel: dateObj(d).toLocaleDateString(undefined, { weekday: 'short' }),
        value: q.total,
        color: activeColor,
        tooltipTitle: `${dateLabel(d)} · ${q.total} Questions`,
        tooltipSubtitle: `${q.correct} correct · ${q.wrong} incorrect · ${q.unanswered} unanswered`,
      };
    });
  }, [filteredLogs, activeColor]);

  // Questions grouped by Subject & Topic
  const topicQuestionBreakdown = useMemo(() => {
    const map: Record<string, { topicId: string; topicName: string; subjectName: string; questions: number; correct: number; wrong: number }> = {};
    filteredLogs.forEach((l) => {
      const key = `${l.subjectId}_${l.topicId || 'none'}`;
      if (!map[key]) {
        map[key] = {
          topicId: l.topicId || 'none',
          topicName: getTopicName(l.subjectId, l.topicId),
          subjectName: getSubjectName(l.subjectId),
          questions: 0,
          correct: 0,
          wrong: 0,
        };
      }
      map[key].questions += totalQs(l);
      map[key].correct += Number(l.correct || 0);
      map[key].wrong += Number(l.wrong || 0);
    });
    return Object.values(map).sort((a, b) => b.questions - a.questions);
  }, [filteredLogs, state.subjects]);

  // -------------------------------------------------------------
  // SECTION C: MASTERY & EXAM-PERFORMANCE GROWTH
  // -------------------------------------------------------------
  const assessmentGrowthPoints = useMemo<PointChartDataPoint[]>(() => {
    return filteredAssessments.map((a) => {
      const subj = state.subjects.find((s) => s.id === a.subjectId);
      const pColor = subj ? getSubjectColor(subj) : activeColor;
      return {
        xLabel: dateObj(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        xSubLabel: a.name.length > 14 ? a.name.slice(0, 12) + '…' : a.name,
        value: a.score ?? null,
        color: pColor,
        tooltipTitle: `${a.name} (${dateLabel(a.date)})`,
        tooltipSubtitle: `${fmt(a.score)}% · ${getSubjectName(a.subjectId)} · ${a.correct}/${a.total} correct`,
      };
    });
  }, [filteredAssessments, activeColor, state.subjects]);

  // Changes between assessments with clear pp vs % distinction (Requirement 6.C)
  const assessmentComparisons = useMemo(() => {
    if (filteredAssessments.length < 2) return null;
    const first = filteredAssessments[0];
    const prev = filteredAssessments[filteredAssessments.length - 2];
    const latest = filteredAssessments[filteredAssessments.length - 1];

    const firstScore = Number(first.score || 0);
    const prevScore = Number(prev.score || 0);
    const latestScore = Number(latest.score || 0);

    // Latest vs Previous
    const prevPpDelta = latestScore - prevScore;
    const prevRelDelta = prevScore > 0 ? ((latestScore - prevScore) / prevScore) * 100 : null;

    // Latest vs First
    const firstPpDelta = latestScore - firstScore;
    const firstRelDelta = firstScore > 0 ? ((latestScore - firstScore) / firstScore) * 100 : null;

    return {
      first,
      prev,
      latest,
      prevComparison: {
        ppDelta: prevPpDelta,
        relDelta: prevRelDelta,
      },
      firstComparison: {
        ppDelta: firstPpDelta,
        relDelta: firstRelDelta,
      },
    };
  }, [filteredAssessments]);

  // Topic-level Trajectory Comparison (Section 6.C Topic deep-dive)
  const compareTopicAssessments = useMemo(() => {
    if (!compareTopicId) return [];
    return state.assessments
      .filter((a) => a.topicId === compareTopicId && Number(a.total) > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [state.assessments, compareTopicId]);

  const topicBaseline =
    compareTopicAssessments.length >= 2
      ? comparisonBaseline === 'first'
        ? compareTopicAssessments[0]
        : compareTopicAssessments[compareTopicAssessments.length - 2]
      : null;

  const topicLatest =
    compareTopicAssessments.length >= 2
      ? compareTopicAssessments[compareTopicAssessments.length - 1]
      : null;

  const topicPpDiff =
    topicLatest?.score !== undefined && topicBaseline?.score !== undefined
      ? topicLatest.score - topicBaseline.score
      : null;

  const topicRelDiff =
    topicLatest?.score !== undefined &&
    topicBaseline?.score !== undefined &&
    topicBaseline.score > 0
      ? ((topicLatest.score - topicBaseline.score) / topicBaseline.score) * 100
      : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Three Primary Filters (Requirement 6) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-white tracking-tight">Academic Progress Analytics</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 font-semibold">
              Evidence-Based
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Precision analytics with point-based trends, consistent subject colors, and rigorous mathematical distinctions.
          </p>
        </div>

        {/* 3 Primary Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Subject Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400 font-medium">Subject:</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedTopicId('all');
              }}
              className="glass-input text-xs py-1.5 font-medium"
            >
              <option value="all">All Subjects</option>
              {state.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Topic Filter (responds to selected subject) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400 font-medium">Topic:</span>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="glass-input text-xs py-1.5 font-medium max-w-[160px]"
            >
              <option value="all">All Topics ({availableTopics.length})</option>
              {availableTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Date Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400 font-medium">Date:</span>
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as DateRangePreset)}
              className="glass-input text-xs py-1.5 font-medium"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
              <option value="all">All History</option>
            </select>
          </div>

          {/* Custom Date Pickers when 'custom' is active */}
          {dateRangePreset === 'custom' && (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="glass-input text-xs py-1"
                title="Start date"
              />
              <span className="text-zinc-500 text-xs">→</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="glass-input text-xs py-1"
                title="End date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs for Analytics Sections */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('study_time')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'study_time'
              ? 'bg-sky-500/30 text-white border border-sky-400/40 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Clock className="w-4 h-4 text-sky-400" />
          <span>A. Study-Time Progress</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'questions'
              ? 'bg-sky-500/30 text-white border border-sky-400/40 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>B. Questions & Practice</span>
        </button>

        <button
          onClick={() => setActiveTab('mastery')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'mastery'
              ? 'bg-sky-500/30 text-white border border-sky-400/40 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>C. Mastery & Exam Growth</span>
        </button>

        <button
          onClick={() => setActiveTab('topic_comparison')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'topic_comparison'
              ? 'bg-sky-500/30 text-white border border-sky-400/40 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-400" />
          <span>Topic Trajectory</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB A: STUDY-TIME PROGRESS (Requirement 6.A) */}
      {/* ========================================================= */}
      {activeTab === 'study_time' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Total study duration</span>
              <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                {fmt(totalStudyHours)}h
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                {filteredLogs.length} study session(s) recorded
              </span>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Daily study average</span>
              <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                {filteredLogs.length > 0
                  ? `${fmt(totalStudyHours / Math.max(1, new Set(filteredLogs.map((l) => l.date)).size))}h`
                  : '—'}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">On active study days</span>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Study target goal</span>
              <div className="text-2xl md:text-3xl font-extrabold text-sky-300 mt-1">
                {activeGoal ? `${activeGoal.target}h` : 'No target'}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                {activeGoal ? `${fmt((totalStudyHours / activeGoal.target) * 100, 0)}% of goal reached` : 'Configure in Goals view'}
              </span>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Period momentum</span>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">
                {periodComparison && periodComparison.pctChange !== null ? (
                  <span className={periodComparison.pctChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {periodComparison.pctChange >= 0 ? '+' : ''}
                    {fmt(periodComparison.pctChange, 0)}%
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                {periodComparison ? `${periodComparison.diffHours >= 0 ? '+' : ''}${fmt(periodComparison.diffHours)}h vs prior period` : 'No prior baseline'}
              </span>
            </div>
          </div>

          {/* Point-based Study Hours Chart (Requirement 2 & 6.A) */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Study duration over time</h4>
                <p className="text-[11px] text-zinc-400">
                  Actual hours studied plotted with point-based markers and connecting trend lines.
                </p>
              </div>

              {/* Granularity Switcher */}
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
                {(['daily', 'weekly', 'monthly'] as const).map((gran) => (
                  <button
                    key={gran}
                    onClick={() => setTimeGranularity(gran)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      timeGranularity === gran
                        ? 'bg-sky-500/30 text-white border border-sky-400/30 shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {gran}
                  </button>
                ))}
              </div>
            </div>

            <PointChart
              data={studyTimePoints}
              yUnit="h"
              yLabel="Study Duration"
              xLabelTitle={`Recorded Timeline (${timeGranularity})`}
              height={230}
              showConnectingLine={true}
              showValuesOnPoints={true}
              accentColor={activeColor}
              decimals={1}
              targetLine={
                activeGoal
                  ? {
                      value: timeGranularity === 'daily' ? activeGoal.target / 7 : activeGoal.target,
                      label: activeGoal.name,
                      color: '#f59e0b',
                    }
                  : undefined
              }
              legend={
                selectedSubjectId === 'all'
                  ? state.subjects.map((s) => ({ label: s.name, color: getSubjectColor(s) }))
                  : [{ label: selectedSubject?.name || 'Selected Subject', color: activeColor }]
              }
              emptyMessage="No study sessions recorded for the selected subject, topic, and date range."
            />
          </div>

          {/* Period comparison breakdown */}
          {periodComparison && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  <strong>Comparative Study Period:</strong> Active filter ({fmt(totalStudyHours)}h) compared to immediately preceding period ({fmt(periodComparison.priorTotal)}h).
                </span>
              </div>
              <div className="font-semibold text-white">
                Net difference: <span className={periodComparison.diffHours >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {periodComparison.diffHours >= 0 ? '+' : ''}{fmt(periodComparison.diffHours)} hours
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB B: QUESTIONS & PRACTICE (Requirement 6.B) */}
      {/* ========================================================= */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Question KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Total questions</span>
              <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                {fmt(questionStats.totalQuestions, 0)}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">In selected scope</span>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Attempted questions</span>
              <div className="text-2xl md:text-3xl font-extrabold text-sky-300 mt-1">
                {fmt(questionStats.attemptedQuestions, 0)}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">Correct + Incorrect</span>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Correct answers</span>
              <div className="text-2xl md:text-3xl font-extrabold text-emerald-300 mt-1">
                {fmt(questionStats.correctAnswers, 0)}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                {questionStats.totalQuestions > 0 ? `${fmt((questionStats.correctAnswers / questionStats.totalQuestions) * 100, 0)}% of total` : '—'}
              </span>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Incorrect answers</span>
              <div className="text-2xl md:text-3xl font-extrabold text-rose-300 mt-1">
                {fmt(questionStats.incorrectAnswers, 0)}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">Actionable mistakes</span>
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 block">Unanswered items</span>
              <div className="text-2xl md:text-3xl font-extrabold text-amber-300 mt-1">
                {fmt(questionStats.unansweredQuestions, 0)}
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">Omissions / skipped</span>
            </div>
          </div>

          {/* Point-based Question Volume Chart (Requirement 2 & 6.B) */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Question volume over time</h4>
                <p className="text-[11px] text-zinc-400">
                  Exact question counts represented as individual point observations.
                </p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded bg-sky-500/20 text-sky-200 border border-sky-400/20 font-semibold">
                Units: Count
              </span>
            </div>

            <PointChart
              data={questionTimePoints}
              yUnit=" qs"
              yLabel="Practice Questions"
              xLabelTitle="Practice Sessions Timeline"
              height={230}
              showConnectingLine={true}
              showValuesOnPoints={true}
              accentColor={activeColor}
              decimals={0}
              legend={
                selectedSubjectId === 'all'
                  ? state.subjects.map((s) => ({ label: s.name, color: getSubjectColor(s) }))
                  : [{ label: selectedSubject?.name || 'Selected Subject', color: activeColor }]
              }
              emptyMessage="No practice questions recorded for the active filter set."
            />
          </div>

          {/* Questions by Subject and Topic Breakdown (Requirement 6.B) */}
          <div className="glass-card p-6 rounded-2xl">
            <h4 className="text-sm font-bold text-white tracking-tight mb-1">
              Question distribution by topic
            </h4>
            <p className="text-[11px] text-zinc-400 mb-4">
              Detailed accounting of questions solved, separated cleanly from study session counts.
            </p>

            {topicQuestionBreakdown.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 border border-dashed border-white/10 rounded-xl">
                No topic practice question records found for the active filter set.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 font-semibold">
                      <th className="pb-2.5">Topic</th>
                      <th className="pb-2.5">Subject</th>
                      <th className="pb-2.5">Questions</th>
                      <th className="pb-2.5">Correct</th>
                      <th className="pb-2.5">Incorrect</th>
                      <th className="pb-2.5 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topicQuestionBreakdown.map((row, idx) => {
                      const acc = row.questions > 0 ? (row.correct / row.questions) * 100 : null;
                      return (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 font-medium text-white">{row.topicName}</td>
                          <td className="py-2.5 text-zinc-400">{row.subjectName}</td>
                          <td className="py-2.5 font-semibold text-white">{fmt(row.questions, 0)}</td>
                          <td className="py-2.5 text-emerald-300">{fmt(row.correct, 0)}</td>
                          <td className="py-2.5 text-rose-300">{fmt(row.wrong, 0)}</td>
                          <td className="py-2.5 text-right font-bold text-sky-300">
                            {acc !== null ? `${fmt(acc)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB C: MASTERY & EXAM GROWTH (Requirement 6.C) */}
      {/* ========================================================= */}
      {activeTab === 'mastery' && (
        <div className="space-y-6">
          {/* Exam Mastery Point-Based Chart (Requirement 2 & 6.C) */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Assessment percentages over time</h4>
                <p className="text-[11px] text-zinc-400">
                  Exam score trajectory with visible percentage scale (0–100%) and exact point labels.
                </p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded bg-amber-500/20 text-amber-200 border border-amber-500/20 font-semibold">
                Vertical Axis: Percent (%)
              </span>
            </div>

            <PointChart
              data={assessmentGrowthPoints}
              yUnit="%"
              yLabel="Assessment Score"
              xLabelTitle="Assessment Dates"
              fixedMaxY={100}
              minY={0}
              height={240}
              showConnectingLine={true}
              showValuesOnPoints={true}
              accentColor={activeColor}
              decimals={1}
              legend={
                selectedSubjectId === 'all'
                  ? state.subjects.map((s) => ({ label: s.name, color: getSubjectColor(s) }))
                  : [{ label: selectedSubject?.name || 'Selected Subject', color: activeColor }]
              }
              emptyMessage="No exam or assessment scores recorded for this filter selection."
            />
          </div>

          {/* Rigorous Assessment Change Cards (Requirement 6.C: Distinguish pp from %) */}
          {assessmentComparisons && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Previous vs Latest */}
              <div className="glass-card p-5 rounded-2xl border border-sky-400/20">
                <span className="text-xs font-bold text-sky-300 uppercase tracking-wider block mb-1">
                  Consecutive Assessment Change
                </span>
                <div className="text-xs text-zinc-300 mb-3">
                  {assessmentComparisons.prev.name} ({fmt(assessmentComparisons.prev.score)}%) →{' '}
                  {assessmentComparisons.latest.name} ({fmt(assessmentComparisons.latest.score)}%)
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-[10px] text-zinc-400 block">Percentage-point change</span>
                    <strong
                      className={`text-lg block mt-0.5 ${
                        assessmentComparisons.prevComparison.ppDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {assessmentComparisons.prevComparison.ppDelta >= 0 ? '+' : ''}
                      {fmt(assessmentComparisons.prevComparison.ppDelta)} pp
                    </strong>
                    <span className="text-[9px] text-zinc-500 block mt-0.5">Absolute rate delta</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-[10px] text-zinc-400 block">Relative percentage change</span>
                    <strong
                      className={`text-lg block mt-0.5 ${
                        assessmentComparisons.prevComparison.relDelta !== null &&
                        assessmentComparisons.prevComparison.relDelta >= 0
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }`}
                    >
                      {assessmentComparisons.prevComparison.relDelta !== null
                        ? `${assessmentComparisons.prevComparison.relDelta >= 0 ? '+' : ''}${fmt(
                            assessmentComparisons.prevComparison.relDelta
                          )}%`
                        : '—'}
                    </strong>
                    <span className="text-[9px] text-zinc-500 block mt-0.5">Relative to previous score</span>
                  </div>
                </div>
              </div>

              {/* First vs Latest */}
              <div className="glass-card p-5 rounded-2xl border border-emerald-500/20">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                  Overall Trajectory Growth (First vs Latest)
                </span>
                <div className="text-xs text-zinc-300 mb-3">
                  {assessmentComparisons.first.name} ({fmt(assessmentComparisons.first.score)}%) →{' '}
                  {assessmentComparisons.latest.name} ({fmt(assessmentComparisons.latest.score)}%)
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-[10px] text-zinc-400 block">Percentage-point change</span>
                    <strong
                      className={`text-lg block mt-0.5 ${
                        assessmentComparisons.firstComparison.ppDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {assessmentComparisons.firstComparison.ppDelta >= 0 ? '+' : ''}
                      {fmt(assessmentComparisons.firstComparison.ppDelta)} pp
                    </strong>
                    <span className="text-[9px] text-zinc-500 block mt-0.5">Total curriculum gain</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-[10px] text-zinc-400 block">Relative percentage change</span>
                    <strong
                      className={`text-lg block mt-0.5 ${
                        assessmentComparisons.firstComparison.relDelta !== null &&
                        assessmentComparisons.firstComparison.relDelta >= 0
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }`}
                    >
                      {assessmentComparisons.firstComparison.relDelta !== null
                        ? `${assessmentComparisons.firstComparison.relDelta >= 0 ? '+' : ''}${fmt(
                            assessmentComparisons.firstComparison.relDelta
                          )}%`
                        : '—'}
                    </strong>
                    <span className="text-[9px] text-zinc-500 block mt-0.5">Proportionate baseline rise</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mathematical distinction explanatory note (Requirement 6.C) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 flex items-start gap-3">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-white block">Percentage-Point (pp) vs Relative Percentage (%) Distinction:</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                An increase from 60% to 70% is an absolute gain of <strong>+10 percentage points (+10 pp)</strong>, but represents a <strong>+16.7% relative improvement</strong> ({'('}70 − 60{')'} ÷ 60 × 100). Vega Core displays both metrics side-by-side to guarantee honest, unambiguous academic interpretation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: TOPIC TRAJECTORY COMPARISON (Section 6.C & Section 8) */}
      {/* ========================================================= */}
      {activeTab === 'topic_comparison' && (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Compare Topic with its own history</h4>
                <p className="text-[11px] text-zinc-400">
                  Topic scores are never inferred from whole-subject scores; only direct assessments are evaluated.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={compareTopicId}
                  onChange={(e) => setCompareTopicId(e.target.value)}
                  className="glass-input text-xs py-1.5 font-medium"
                >
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <select
                  value={comparisonBaseline}
                  onChange={(e) => setComparisonBaseline(e.target.value as any)}
                  className="glass-input text-xs py-1.5 font-medium"
                >
                  <option value="previous">Latest vs Previous</option>
                  <option value="first">Latest vs First Recorded</option>
                </select>
              </div>
            </div>

            {compareTopicAssessments.length < 2 ? (
              <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-xs text-zinc-400">
                <strong className="block text-zinc-200 mb-1">Not enough comparable data yet.</strong>
                Record at least two assessments for "{availableTopics.find((t) => t.id === compareTopicId)?.name || 'this topic'}" to examine its individual trajectory.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">
                      {comparisonBaseline === 'first' ? 'First recorded test' : 'Previous test'}
                    </span>
                    <strong className="text-xl text-white mt-1 block">
                      {fmt(topicBaseline?.score)}%
                    </strong>
                    <span className="text-[10px] text-zinc-500 mt-1 block">{topicBaseline?.name} ({dateLabel(topicBaseline?.date)})</span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Latest recorded test</span>
                    <strong className="text-xl text-white mt-1 block">
                      {fmt(topicLatest?.score)}%
                    </strong>
                    <span className="text-[10px] text-zinc-500 mt-1 block">{topicLatest?.name} ({dateLabel(topicLatest?.date)})</span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Percentage-point change</span>
                    <strong
                      className={`text-xl mt-1 block ${
                        topicPpDiff !== null && topicPpDiff >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {topicPpDiff !== null ? `${topicPpDiff >= 0 ? '+' : ''}${fmt(topicPpDiff)} pp` : '—'}
                    </strong>
                    <span className="text-[10px] text-zinc-500 mt-1 block">Rate difference</span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Relative percentage change</span>
                    <strong
                      className={`text-xl mt-1 block ${
                        topicRelDiff !== null && topicRelDiff >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {topicRelDiff !== null ? `${topicRelDiff >= 0 ? '+' : ''}${fmt(topicRelDiff)}%` : '—'}
                    </strong>
                    <span className="text-[10px] text-zinc-500 mt-1 block">Relative growth</span>
                  </div>
                </div>

                {/* Point chart for this specific topic */}
                <div className="pt-3">
                  <PointChart
                    data={compareTopicAssessments.map((a) => ({
                      xLabel: dateObj(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                      xSubLabel: a.name.length > 12 ? a.name.slice(0, 10) + '…' : a.name,
                      value: a.score ?? null,
                      color: activeColor,
                      tooltipTitle: `${a.name} (${dateLabel(a.date)})`,
                      tooltipSubtitle: `${fmt(a.score)}% · ${a.correct}/${a.total} correct`,
                    }))}
                    yUnit="%"
                    yLabel="Topic Assessment Percentage"
                    xLabelTitle={`Topic Assessment History: ${availableTopics.find((t) => t.id === compareTopicId)?.name || ''}`}
                    fixedMaxY={100}
                    minY={0}
                    height={210}
                    showConnectingLine={true}
                    showValuesOnPoints={true}
                    accentColor={activeColor}
                    decimals={1}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
