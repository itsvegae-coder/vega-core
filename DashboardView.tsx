import React, { useState } from 'react';
import {
  Clock,
  BookOpen,
  AlertTriangle,
  Award,
  Sparkles,
  ArrowRight,
  Smartphone,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { VegaState } from '../types';
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
  getSubjectColor,
} from '../lib/storage';
import { PageView } from '../components/Navbar';
import { PointChart, PointChartDataPoint } from '../components/PointChart';

interface DashboardViewProps {
  state: VegaState;
  onNavigate: (page: PageView) => void;
  onQuickLog: () => void;
  hasCalendarToken: boolean;
  onSignInWithGoogle: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigate,
  onQuickLog,
  hasCalendarToken,
  onSignInWithGoogle,
}) => {
  const [chartSubject, setChartSubject] = useState<string>('all');
  const [chartTopic, setChartTopic] = useState<string>('all');
  const [chartMetric, setChartMetric] = useState<'hours' | 'questions' | 'accuracy'>('hours');
  const [showPulseDetails, setShowPulseDetails] = useState<boolean>(false);

  // Stats calculation
  const totalHours = state.logs.reduce((acc, l) => acc + logHours(l), 0);
  const totalQuestions = state.logs.reduce((acc, l) => acc + totalQs(l), 0);
  const openErrors = state.errors.filter((e) => e.status !== 'resolved');

  const assessed = state.assessments.filter((a) => Number(a.total) > 0);
  const assessmentAvg = assessed.length
    ? assessed.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / assessed.length
    : null;

  // 7-day trend
  const last7Days = Array.from({ length: 7 }, (_, i) => addDays(todayIso(), i - 6));

  const chartData = last7Days.map((d) => {
    const logs = state.logs.filter((l) => {
      if (l.date !== d) return false;
      if (chartSubject !== 'all' && l.subjectId !== chartSubject) return false;
      if (chartTopic !== 'all' && l.topicId !== chartTopic) return false;
      return true;
    });

    let val: number | null = 0;
    let hasData = logs.length > 0;

    if (chartMetric === 'hours') {
      val = logs.reduce((acc, l) => acc + logHours(l), 0);
    } else if (chartMetric === 'questions') {
      val = logs.reduce((acc, l) => acc + totalQs(l), 0);
    } else {
      // Accuracy: average of attemptAccuracy
      const logsWithQuestions = logs.filter((l) => attemptAccuracy(l) !== null);
      if (logsWithQuestions.length > 0) {
        val =
          logsWithQuestions.reduce((acc, l) => acc + (attemptAccuracy(l) || 0), 0) /
          logsWithQuestions.length;
      } else {
        val = null; // No questions attempted; not zero!
        hasData = false;
      }
    }

    return {
      date: d,
      day: dateObj(d).toLocaleDateString(undefined, { weekday: 'short' }),
      value: val,
      hasData,
    };
  });

  // Calculate numeric scale for chart
  const validVals = chartData.filter((d) => d.value !== null).map((d) => d.value as number);
  let maxVal = Math.max(1, ...validVals);
  if (chartMetric === 'accuracy') {
    maxVal = 100;
  } else if (chartMetric === 'hours') {
    maxVal = Math.ceil(maxVal * 1.25 * 2) / 2;
  } else {
    maxVal = Math.ceil(maxVal * 1.2) || 10;
  }

  // Combined open loops
  const urgentErrors = state.errors
    .filter((e) => e.status !== 'resolved')
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      title: e.title,
      type: 'error' as const,
      meta: `${state.subjects.find((s) => s.id === e.subjectId)?.name || 'General'}${
        e.due ? ` · Due ${e.due}` : ''
      }`,
    }));

  const urgentActions = state.actions
    .filter((a) => !a.done)
    .slice(0, 3)
    .map((a) => ({
      id: a.id,
      title: a.title,
      type: 'action' as const,
      meta: a.due ? `Due ${a.due}` : 'Next action',
    }));

  const openLoops = [...urgentErrors, ...urgentActions].slice(0, 5);

  const cardPrefs = state.preferences.dashboardCards || ['hours', 'questions', 'average', 'errors'];

  // Detailed Study Pulse calculations for each subject
  const subjectPulseStats = state.subjects.map((s) => {
    const subLogs = state.logs.filter((l) => l.subjectId === s.id);
    const hours = subLogs.reduce((acc, l) => acc + logHours(l), 0);
    const totalQ = subLogs.reduce((acc, l) => acc + totalQs(l), 0);
    const correctQ = subLogs.reduce((acc, l) => acc + Number(l.correct || 0), 0);
    const wrongQ = subLogs.reduce((acc, l) => acc + Number(l.wrong || 0), 0);
    const unansweredQ = subLogs.reduce((acc, l) => acc + Number(l.unanswered || 0), 0);
    const attemptedQ = correctQ + wrongQ;

    const attemptAcc = attemptedQ > 0 ? (correctQ / attemptedQ) * 100 : null;
    const compRate = totalQ > 0 ? (correctQ / totalQ) * 100 : null;

    // Assess trend: compare older logs vs newer logs
    const sorted = [...subLogs].sort((a, b) => a.date.localeCompare(b.date));
    let trend: 'improving' | 'declining' | 'stable' | 'insufficient' = 'insufficient';
    let trendDelta: number | null = null;
    if (sorted.length >= 2) {
      const recent = sorted.slice(-Math.ceil(sorted.length / 2));
      const older = sorted.slice(0, Math.floor(sorted.length / 2));

      const recentAtt = recent.reduce((sum, l) => sum + attemptedQs(l), 0);
      const recentCor = recent.reduce((sum, l) => sum + Number(l.correct || 0), 0);
      const olderAtt = older.reduce((sum, l) => sum + attemptedQs(l), 0);
      const olderCor = older.reduce((sum, l) => sum + Number(l.correct || 0), 0);

      if (recentAtt > 0 && olderAtt > 0) {
        const recentAcc = (recentCor / recentAtt) * 100;
        const olderAcc = (olderCor / olderAtt) * 100;
        trendDelta = recentAcc - olderAcc;
        if (trendDelta > 2) trend = 'improving';
        else if (trendDelta < -2) trend = 'declining';
        else trend = 'stable';
      }
    }

    const subAssessments = state.assessments
      .filter((a) => a.subjectId === s.id && Number(a.total) > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const lastScore = subAssessments.length ? subAssessments[subAssessments.length - 1].score : null;

    return {
      subject: s,
      hours,
      sessionsCount: subLogs.length,
      totalQ,
      correctQ,
      wrongQ,
      unansweredQ,
      attemptedQ,
      attemptAcc,
      compRate,
      trend,
      trendDelta,
      lastScore,
      openErrorsCount: state.errors.filter((e) => e.subjectId === s.id && e.status !== 'resolved')
        .length,
    };
  });

  // Available topics for chart filter
  const availableTopics =
    chartSubject === 'all'
      ? state.subjects.flatMap((s) => s.topics)
      : state.subjects.find((s) => s.id === chartSubject)?.topics || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero card */}
      <div className="relative overflow-hidden glass-card p-6 md:p-8 rounded-3xl border border-sky-400/20 bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-indigo-950/40">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/25 text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3 h-3" />
            <span>A clearer view of your progress</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Small steps.<br />Meaningful momentum.
          </h2>
          <p className="mt-2 text-xs md:text-sm text-zinc-300 leading-relaxed">
            Your study history, patterns, and scheduled sessions in one quiet space. Start with the data you have; refine your system as you go.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => onNavigate('review')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 text-sky-100 text-xs font-semibold border border-sky-400/30 shadow-md transition-all hover:-translate-y-0.5"
            >
              <span>Start weekly review</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onQuickLog}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-medium border border-white/10 transition-colors"
            >
              Log a session
            </button>
            {!hasCalendarToken && (
              <button
                onClick={onSignInWithGoogle}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-medium border border-emerald-500/30 transition-all"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Sync with Phone & PC</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status Banner if authenticated */}
      {hasCalendarToken && (
        <div className="flex items-center justify-between p-3.5 px-4 glass-card rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Google Calendar connected.</strong> Your planned study blocks and review reminders sync with your phone and computer.
            </span>
          </div>
          <button
            onClick={() => onNavigate('calendar')}
            className="text-[11px] font-semibold text-emerald-300 hover:text-white underline"
          >
            Manage calendar ↗
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardPrefs.includes('hours') && (
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Study time logged</span>
              <Clock className="w-4 h-4 text-sky-300" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white mt-2">
              {fmt(totalHours)}h
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Across all recorded sessions</div>
          </div>
        )}

        {cardPrefs.includes('questions') && (
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Questions attempted</span>
              <BookOpen className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white mt-2">
              {fmt(totalQuestions, 0)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">Daily logs + practice sets</div>
          </div>
        )}

        {cardPrefs.includes('average') && (
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Assessment average</span>
              <Award className="w-4 h-4 text-purple-300" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-white mt-2">
              {assessmentAvg === null ? '—' : `${fmt(assessmentAvg)}%`}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {assessed.length} recorded assessment(s)
            </div>
          </div>
        )}

        {cardPrefs.includes('errors') && (
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Open error loops</span>
              <AlertTriangle className="w-4 h-4 text-rose-300" />
            </div>
            <div
              className={`text-2xl md:text-3xl font-extrabold mt-2 ${
                openErrors.length > 0 ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {openErrors.length}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {openErrors.length ? 'Items needing review' : 'No open errors'}
            </div>
          </div>
        )}
      </div>

      {/* Grid content: Subjects & Open loops */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Pulse (Section 3.2 - Critical Requirement) */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Subject pulse</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 font-semibold">
                  Academic Intelligence
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Study duration, question accuracy, and recent performance trends
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPulseDetails(!showPulseDetails)}
                className="flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 font-semibold px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                title="Toggle detailed academic breakdown"
              >
                <span>{showPulseDetails ? 'Summary view' : 'Detailed pulse'}</span>
                {showPulseDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => onNavigate('subjects')}
                className="text-xs text-sky-300 hover:text-sky-200 font-semibold"
              >
                View all ↗
              </button>
            </div>
          </div>

          {!showPulseDetails ? (
            /* Summary view with progress bars & latest scores */
            <div className="space-y-3.5">
              {subjectPulseStats.map((item) => {
                const s = item.subject;
                return (
                  <div key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{s.name}</span>
                        {item.openErrorsCount > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {item.openErrorsCount} open error(s)
                          </span>
                        )}
                      </div>
                      <span className="text-sky-200 font-bold">
                        {item.lastScore !== null && item.lastScore !== undefined
                          ? `${fmt(item.lastScore)}%`
                          : 'No score'}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            item.openErrorsCount > 0
                              ? Math.min(99, item.lastScore ?? (item.hours > 0 ? 30 : 0))
                              : item.lastScore ?? (item.hours > 0 ? 30 : 0)
                          )}%`,
                          backgroundColor:
                            s.color === 'sage'
                              ? '#a3c2b0'
                              : s.color === 'lav'
                              ? '#c4b5e0'
                              : s.color === 'peach'
                              ? '#e2bc9d'
                              : '#8dc7f2',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1.5">
                      <span>
                        {fmt(item.hours)}h logged · {item.sessionsCount} sessions · {fmt(item.totalQ, 0)} questions
                      </span>
                      <span>
                        {item.attemptAcc !== null ? `Acc: ${fmt(item.attemptAcc, 0)}%` : 'No practice sets'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Detailed Pulse Table (Section 3.2 explicit requirements) */
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 font-semibold">
                      <th className="pb-2">Subject</th>
                      <th className="pb-2">Duration</th>
                      <th className="pb-2">Questions</th>
                      <th className="pb-2">Attempt Acc</th>
                      <th className="pb-2">Completion</th>
                      <th className="pb-2 text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subjectPulseStats.map((item) => (
                      <tr key={item.subject.id} className="text-zinc-200">
                        <td className="py-2.5 font-medium text-white">{item.subject.name}</td>
                        <td className="py-2.5">{fmt(item.hours)}h</td>
                        <td className="py-2.5 text-zinc-300">
                          {item.correctQ}/{item.totalQ}{' '}
                          <span className="text-[9px] text-zinc-500">
                            ({item.wrongQ}w, {item.unansweredQ}u)
                          </span>
                        </td>
                        <td className="py-2.5 font-semibold text-sky-300">
                          {item.attemptAcc !== null ? `${fmt(item.attemptAcc)}%` : '—'}
                        </td>
                        <td className="py-2.5 text-zinc-300">
                          {item.compRate !== null ? `${fmt(item.compRate)}%` : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          {item.trend === 'improving' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold text-[10px]">
                              <TrendingUp className="w-3 h-3" />
                              +{fmt(item.trendDelta)} pp
                            </span>
                          ) : item.trend === 'declining' ? (
                            <span className="inline-flex items-center gap-1 text-rose-300 font-semibold text-[10px]">
                              <TrendingDown className="w-3 h-3" />
                              {fmt(item.trendDelta)} pp
                            </span>
                          ) : item.trend === 'stable' ? (
                            <span className="inline-flex items-center gap-1 text-sky-300 text-[10px]">
                              <Minus className="w-3 h-3" />
                              Stable
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">Need more data</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Data interpretation notice */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-zinc-300 leading-relaxed">
                <span className="font-semibold text-white block mb-0.5">Study Pulse Interpretation:</span>
                Attempt accuracy measures correct vs attempted questions; completion rate accounts for unanswered items. Trends are grounded only in recorded data and indicate directional momentum.
              </div>
            </div>
          )}
        </div>

        {/* Open Loops */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Open loops</h3>
                <p className="text-[11px] text-zinc-400">Mistakes and actions waiting for attention</p>
              </div>
              <button
                onClick={() => onNavigate('errors')}
                className="text-xs text-sky-300 hover:text-sky-200 font-semibold"
              >
                Review all ↗
              </button>
            </div>

            <div className="space-y-2.5">
              {openLoops.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400/80 mx-auto mb-2" />
                  <strong className="block text-zinc-200">Nothing waiting in the wings.</strong>
                  Open errors and next actions will appear here.
                </div>
              ) : (
                openLoops.map((loop) => (
                  <div
                    key={loop.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start gap-3"
                  >
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 mt-0.5 ${
                        loop.type === 'error'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                      }`}
                    >
                      {loop.type === 'error' ? 'Error' : 'Action'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{loop.title}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 truncate">{loop.meta}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Focus note */}
          <div className="mt-5 p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                A note to your future self
              </span>
              <button
                onClick={() => onNavigate('planning')}
                className="text-[10px] font-semibold text-sky-300 hover:text-white"
              >
                Edit plan ↗
              </button>
            </div>
            <p className="text-zinc-200 leading-relaxed text-[11px]">
              {state.notes ||
                'Add your first study log, then use the weekly review to turn activity into a clear plan.'}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive 7-Day Rhythm Chart (Section 3.1 & 3.2 Requirements) */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Study rhythm</h3>
            <p className="text-[11px] text-zinc-400">Activity logged over the last 7 days</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={chartSubject}
              onChange={(e) => {
                setChartSubject(e.target.value);
                setChartTopic('all');
              }}
              className="glass-input text-xs py-1"
            >
              <option value="all">All subjects</option>
              {state.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={chartTopic}
              onChange={(e) => setChartTopic(e.target.value)}
              className="glass-input text-xs py-1"
            >
              <option value="all">All topics</option>
              {availableTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={chartMetric}
              onChange={(e) => setChartMetric(e.target.value as any)}
              className="glass-input text-xs py-1"
            >
              <option value="hours">Study hours (h)</option>
              <option value="questions">Questions logged (count)</option>
              <option value="accuracy">Practice accuracy (%)</option>
            </select>
          </div>
        </div>

        {/* Point-based Visualization (Requirement 2) */}
        {(() => {
          const selectedSubjObj = state.subjects.find((s) => s.id === chartSubject);
          const activeColor = chartSubject !== 'all' ? getSubjectColor(selectedSubjObj) : '#38bdf8';
          const yUnit = chartMetric === 'hours' ? 'h' : chartMetric === 'accuracy' ? '%' : ' qs';
          const yLabel = chartMetric === 'hours' ? 'Hours Studied' : chartMetric === 'accuracy' ? 'Practice Accuracy' : 'Questions Logged';

          const pointData: PointChartDataPoint[] = chartData.map((d) => ({
            xLabel: d.day,
            xSubLabel: dateObj(d.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
            value: d.hasData ? d.value : null,
            color: activeColor,
            tooltipTitle: dateLabel(d.date),
            tooltipSubtitle: d.hasData
              ? `${chartMetric === 'hours' ? `${fmt(d.value)} study hours` : chartMetric === 'questions' ? `${fmt(d.value, 0)} questions solved` : `${fmt(d.value)}% attempt accuracy`}`
              : 'No activity recorded on this day',
          }));

          const legend = chartSubject === 'all'
            ? state.subjects.map((s) => ({ label: s.name, color: getSubjectColor(s) }))
            : [{ label: selectedSubjObj?.name || 'Selected Subject', color: activeColor }];

          return (
            <div className="space-y-3">
              <PointChart
                data={pointData}
                yUnit={yUnit}
                yLabel={yLabel}
                xLabelTitle="Last 7 Days (Point-based timeline)"
                fixedMaxY={chartMetric === 'accuracy' ? 100 : undefined}
                height={210}
                showConnectingLine={true}
                showValuesOnPoints={true}
                accentColor={activeColor}
                decimals={chartMetric === 'hours' ? 1 : chartMetric === 'accuracy' ? 1 : 0}
                legend={legend}
                emptyMessage="No activity recorded for this filter in the last 7 days."
              />
              <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 border-t border-white/5 pt-2 gap-2">
                <span>
                  Active Metric: <strong>{chartMetric === 'hours' ? 'Actual Study Duration' : chartMetric === 'questions' ? 'Questions Attempted' : 'Attempt Accuracy'}</strong>
                </span>
                <span className="text-zinc-500">
                  Points represent exact recorded sessions; missing days are left unconnected to prevent misleading zero assumptions.
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
