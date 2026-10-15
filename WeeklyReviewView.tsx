import React, { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  BookmarkCheck,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  CalendarCheck,
} from 'lucide-react';
import { VegaState, ActionItem, WeeklySnapshot } from '../types';
import {
  todayIso,
  weekStart,
  addDays,
  dateLabel,
  dateObj,
  fmt,
  uid,
  logHours,
  totalQs,
  attemptAccuracy,
  getSubjectColor,
} from '../lib/storage';
import { PageView } from '../components/Navbar';
import { PointChart, PointChartDataPoint } from '../components/PointChart';

interface WeeklyReviewViewProps {
  state: VegaState;
  onUpdateState: (newState: VegaState) => void;
  onNavigate: (page: PageView) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WeeklyReviewView: React.FC<WeeklyReviewViewProps> = ({
  state,
  onUpdateState,
  onNavigate,
  onShowToast,
}) => {
  const [reviewDate, setReviewDate] = useState(todayIso());
  const [chartSubject, setChartSubject] = useState('all');
  const [chartTopic, setChartTopic] = useState('all');
  const [chartMetric, setChartMetric] = useState<'score' | 'hours' | 'questions'>('score');

  // Guided reflection questions
  const [worked, setWorked] = useState('');
  const [change, setChange] = useState('');
  const [follow, setFollow] = useState('');

  // Monthly Review State
  const [monthlyReviewMonth, setMonthlyReviewMonth] = useState(todayIso().slice(0, 7));
  const [monthlyGenerated, setMonthlyGenerated] = useState(true);

  const start = weekStart(reviewDate);
  const end = addDays(start, 6);

  const prevStart = addDays(start, -7);
  const prevEnd = addDays(prevStart, 6);

  // Current week data
  const currentLogs = state.logs.filter((l) => l.date >= start && l.date <= end);
  const currentAssess = state.assessments.filter((a) => a.date >= start && a.date <= end);
  const hours = currentLogs.reduce((acc, l) => acc + logHours(l), 0);
  const qs = currentLogs.reduce((acc, l) => acc + totalQs(l), 0);
  const corQs = currentLogs.reduce((acc, l) => acc + Number(l.correct || 0), 0);
  const wrgQs = currentLogs.reduce((acc, l) => acc + Number(l.wrong || 0), 0);
  const unansQs = currentLogs.reduce((acc, l) => acc + Number(l.unanswered || 0), 0);

  const currentAvg = currentAssess.length
    ? currentAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / currentAssess.length
    : null;

  // Previous week data
  const prevLogs = state.logs.filter((l) => l.date >= prevStart && l.date <= prevEnd);
  const prevAssess = state.assessments.filter((a) => a.date >= prevStart && a.date <= prevEnd);
  const prevHours = prevLogs.reduce((acc, l) => acc + logHours(l), 0);
  const prevAvg = prevAssess.length
    ? prevAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / prevAssess.length
    : null;

  const hoursDelta = hours - prevHours;
  const avgDelta = currentAvg !== null && prevAvg !== null ? currentAvg - prevAvg : null;

  // Errors due
  const openErrors = state.errors.filter((e) => e.status !== 'resolved');
  const errorsDue = openErrors.filter((e) => e.due && e.due <= end);

  // Subject rows comparison
  const subjectRows = state.subjects
    .map((s) => {
      const sLogs = currentLogs.filter((l) => l.subjectId === s.id);
      const sHours = sLogs.reduce((acc, l) => acc + logHours(l), 0);
      const sNowAssess = currentAssess.filter((a) => a.subjectId === s.id);
      const sPrevAssess = prevAssess.filter((a) => a.subjectId === s.id);

      const nowScore = sNowAssess.length
        ? sNowAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / sNowAssess.length
        : null;
      const prevScore = sPrevAssess.length
        ? sPrevAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / sPrevAssess.length
        : null;

      const delta = nowScore !== null && prevScore !== null ? nowScore - prevScore : null;

      return {
        subject: s,
        hours: sHours,
        nowScore,
        prevScore,
        delta,
      };
    })
    .filter((x) => x.hours > 0 || x.nowScore !== null || x.prevScore !== null);

  // Topic rows comparison: shown only when exact topic has data
  const topicRows = state.subjects.flatMap((s) =>
    s.topics.map((t) => {
      const tNowAssess = currentAssess.filter((a) => a.subjectId === s.id && a.topicId === t.id);
      const tPrevAssess = prevAssess.filter((a) => a.subjectId === s.id && a.topicId === t.id);

      const nowScore = tNowAssess.length
        ? tNowAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / tNowAssess.length
        : null;
      const prevScore = tPrevAssess.length
        ? tPrevAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / tPrevAssess.length
        : null;

      const tLogs = currentLogs.filter((l) => l.subjectId === s.id && l.topicId === t.id);
      const tHours = tLogs.reduce((acc, l) => acc + logHours(l), 0);
      const delta = nowScore !== null && prevScore !== null ? nowScore - prevScore : null;

      return {
        subject: s,
        topic: t,
        hours: tHours,
        nowScore,
        prevScore,
        delta,
      };
    })
  ).filter((x) => x.hours > 0 || x.nowScore !== null || x.prevScore !== null);

  // Available topics for chart
  const availableTopics =
    chartSubject === 'all'
      ? state.subjects.flatMap((s) => s.topics)
      : state.subjects.find((s) => s.id === chartSubject)?.topics || [];

  // 8-Week trajectory
  const trajectoryWeeks = Array.from({ length: 8 }, (_, i) => {
    const wStart = addDays(start, -7 * (7 - i));
    const wEnd = addDays(wStart, 6);
    const wLogs = state.logs.filter(
      (l) =>
        l.date >= wStart &&
        l.date <= wEnd &&
        (chartSubject === 'all' || l.subjectId === chartSubject) &&
        (chartTopic === 'all' || l.topicId === chartTopic)
    );
    const wAssess = state.assessments.filter(
      (a) =>
        a.date >= wStart &&
        a.date <= wEnd &&
        (chartSubject === 'all' || a.subjectId === chartSubject) &&
        (chartTopic === 'all' || a.topicId === chartTopic)
    );

    let val = 0;
    if (chartMetric === 'hours') {
      val = wLogs.reduce((acc, l) => acc + logHours(l), 0);
    } else if (chartMetric === 'questions') {
      val = wLogs.reduce((acc, l) => acc + totalQs(l), 0);
    } else {
      val = wAssess.length
        ? wAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / wAssess.length
        : 0;
    }

    return {
      label: dateObj(wStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: val,
      hasData: chartMetric === 'score' ? wAssess.length > 0 : wLogs.length > 0,
    };
  });

  const maxTraj = Math.max(1, ...trajectoryWeeks.map((t) => t.value));

  // Save weekly review snapshot
  const handleSaveSnapshot = () => {
    const existing = state.reviews.find((r) => r.start === start);
    const snap: WeeklySnapshot = {
      id: existing?.id || uid(),
      start,
      end,
      hours,
      qs,
      avg: currentAvg,
      prevHours,
      prevAvg,
      logs: currentLogs.length,
      assessments: currentAssess.length,
      createdAt: new Date().toISOString(),
    };

    const updatedReviews = existing
      ? state.reviews.map((r) => (r.start === start ? snap : r))
      : [snap, ...state.reviews];

    onUpdateState({
      ...state,
      reviews: updatedReviews,
    });
    onShowToast('Weekly snapshot saved!', 'success');
  };

  // Create next actions from reflections
  const handleCreateActions = () => {
    const pieces: { title: string; note: string }[] = [];
    if (change.trim()) {
      pieces.push({
        title: change.trim(),
        note: `Target improvement identified in weekly review for ${start}`,
      });
    }
    if (follow.trim()) {
      pieces.push({
        title: follow.trim(),
        note: `Immediate follow-up task from weekly review for ${start}`,
      });
    }

    if (pieces.length === 0) {
      onShowToast('Please write at least one action in the reflection fields below.', 'info');
      return;
    }

    const newActions: ActionItem[] = pieces.map((p) => ({
      id: uid(),
      title: p.title,
      due: addDays(end, 3),
      done: false,
      notes: p.note,
    }));

    const combinedNotes = [
      worked ? `What worked: ${worked}` : '',
      change ? `What to change: ${change}` : '',
      follow ? `Follow-up items: ${follow}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    onUpdateState({
      ...state,
      actions: [...newActions, ...state.actions],
      notes: combinedNotes || state.notes,
    });

    onShowToast(`${newActions.length} next action(s) created from your review!`, 'success');
    onNavigate('planning');
  };

  // Monthly Review Calculations
  const mStart = `${monthlyReviewMonth}-01`;
  const mYear = Number(monthlyReviewMonth.slice(0, 4));
  const mMonth = Number(monthlyReviewMonth.slice(5, 7));
  const lastDayOfMonth = new Date(mYear, mMonth, 0).getDate();
  const mEnd = `${monthlyReviewMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const mLogs = state.logs.filter((l) => l.date >= mStart && l.date <= mEnd);
  const mAssess = state.assessments.filter((a) => a.date >= mStart && a.date <= mEnd);
  const mTasks = state.tasks.filter((t) => t.date >= mStart && t.date <= mEnd);
  const mHours = mLogs.reduce((acc, l) => acc + logHours(l), 0);
  const mQuestions = mLogs.reduce((acc, l) => acc + totalQs(l), 0);
  const mAvg = mAssess.length
    ? mAssess.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / mAssess.length
    : null;
  const mOpenErrors = state.errors.filter(
    (e) => e.status !== 'resolved' && ((e.date >= mStart && e.date <= mEnd) || (e.due && e.due <= mEnd))
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-sky-400/20 bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-purple-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300 mb-1">
              WEEKLY REVIEW · {dateLabel(start)} — {dateLabel(end)}
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Look back with honesty.<br />Move forward with intention.
            </h2>
            <p className="mt-1 text-xs text-zinc-300 max-w-xl">
              This review summarizes recorded activity and highlights patterns worth investigating. It won't invent a cause where the data can't support one.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSnapshot}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Save review snapshot</span>
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-3">
          <label className="text-xs text-zinc-300 font-medium">Select week to review:</label>
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            className="glass-input text-xs py-1"
          />
          <span className="text-[11px] text-zinc-400">
            Pick any date within the week you want to inspect.
          </span>
        </div>
      </div>

      {/* Week over Week KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Study hours</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {fmt(hours)}h
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {hoursDelta >= 0 ? `+${fmt(hoursDelta)}h` : `${fmt(hoursDelta)}h`} vs previous week
          </span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Questions logged</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {fmt(qs, 0)}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {corQs} correct, {wrgQs} wrong, {unansQs} unanswered
          </span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Assessment average</span>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
            {currentAvg !== null ? `${fmt(currentAvg)}%` : '—'}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {avgDelta !== null
              ? `${avgDelta >= 0 ? '+' : ''}${fmt(avgDelta)} pp vs previous week`
              : 'No prior week comparison'}
          </span>
        </div>
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs text-zinc-400 block">Errors due by week end</span>
          <div
            className={`text-2xl md:text-3xl font-extrabold mt-1 ${
              errorsDue.length ? 'text-rose-300' : 'text-emerald-300'
            }`}
          >
            {errorsDue.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {openErrors.length} open overall
          </span>
        </div>
      </div>

      {/* 8-Week Trajectory Chart */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">Performance trajectory</h4>
            <p className="text-[11px] text-zinc-400">Recorded results across the preceding 8 weeks</p>
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
              <option value="score">Assessment percentage (%)</option>
              <option value="hours">Study hours (h)</option>
              <option value="questions">Questions logged (count)</option>
            </select>
          </div>
        </div>

        {(() => {
          const selectedSubjObj = state.subjects.find((s) => s.id === chartSubject);
          const activeColor = chartSubject !== 'all' ? getSubjectColor(selectedSubjObj) : '#38bdf8';
          const yUnit = chartMetric === 'hours' ? 'h' : chartMetric === 'score' ? '%' : ' qs';
          const yLabel = chartMetric === 'hours' ? 'Weekly Study Hours' : chartMetric === 'score' ? 'Assessment Score' : 'Questions Logged';

          const pointData: PointChartDataPoint[] = trajectoryWeeks.map((w) => ({
            xLabel: w.label,
            value: w.hasData ? w.value : null,
            color: activeColor,
            tooltipTitle: `Week of ${w.label}`,
            tooltipSubtitle: w.hasData
              ? `${chartMetric === 'hours' ? `${fmt(w.value)} hours studied` : chartMetric === 'score' ? `${fmt(w.value)}% exam average` : `${fmt(w.value, 0)} questions attempted`}`
              : 'No activity recorded this week',
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
                xLabelTitle="Preceding 8 Weeks (Point-based Trend)"
                fixedMaxY={chartMetric === 'score' ? 100 : undefined}
                height={210}
                showConnectingLine={true}
                showValuesOnPoints={true}
                accentColor={activeColor}
                decimals={chartMetric === 'hours' ? 1 : chartMetric === 'score' ? 1 : 0}
                legend={legend}
                emptyMessage="No weekly trajectory data matching current filters."
              />
              <div className="text-[11px] text-zinc-400 border-t border-white/5 pt-2 flex items-center justify-between">
                <span>
                  Metric: <strong>{chartMetric === 'hours' ? 'Logged Hours' : chartMetric === 'score' ? 'Exam Performance' : 'Questions Attempted'}</strong>
                </span>
                <span className="text-zinc-500">
                  Points mark weekly totals; connected lines visualize week-to-week momentum.
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Grid: Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance by Subject */}
        <div className="glass-card p-6 rounded-2xl">
          <h4 className="text-sm font-bold text-white tracking-tight mb-1">
            Performance by subject
          </h4>
          <p className="text-[11px] text-zinc-400 mb-4">
            Current week compared with the previous week. Percentages reflect recorded assessments.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 font-semibold text-[10px] uppercase">
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Hours</th>
                  <th className="pb-2">Previous</th>
                  <th className="pb-2">This week</th>
                  <th className="pb-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {subjectRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-400">
                      No activity recorded for this week yet.
                    </td>
                  </tr>
                ) : (
                  subjectRows.map((r) => (
                    <tr key={r.subject.id} className="text-zinc-200">
                      <td className="py-2.5 font-semibold text-white">{r.subject.name}</td>
                      <td className="py-2.5">{fmt(r.hours)}h</td>
                      <td className="py-2.5 text-zinc-400">
                        {r.prevScore !== null ? `${fmt(r.prevScore)}%` : '—'}
                      </td>
                      <td className="py-2.5 font-medium text-white">
                        {r.nowScore !== null ? `${fmt(r.nowScore)}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        {r.delta !== null ? (
                          <span
                            className={`font-semibold text-[11px] ${
                              r.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {r.delta >= 0 ? '+' : ''}
                            {fmt(r.delta)} pp
                          </span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance by Topic (Only when exact topic has data) */}
        <div className="glass-card p-6 rounded-2xl">
          <h4 className="text-sm font-bold text-white tracking-tight mb-1">
            Performance by topic
          </h4>
          <p className="text-[11px] text-zinc-400 mb-4">
            Topic comparisons are shown only when that exact topic has recorded assessments.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 font-semibold text-[10px] uppercase">
                  <th className="pb-2">Subject / Topic</th>
                  <th className="pb-2">Hours</th>
                  <th className="pb-2">Previous</th>
                  <th className="pb-2">This week</th>
                  <th className="pb-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topicRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-400">
                      No topic-level assessment data for this week.
                    </td>
                  </tr>
                ) : (
                  topicRows.map((tr) => (
                    <tr key={`${tr.subject.id}-${tr.topic.id}`} className="text-zinc-200">
                      <td className="py-2.5">
                        <div className="font-semibold text-white">{tr.subject.name}</div>
                        <div className="text-[10px] text-zinc-400">{tr.topic.name}</div>
                      </td>
                      <td className="py-2.5">{fmt(tr.hours)}h</td>
                      <td className="py-2.5 text-zinc-400">
                        {tr.prevScore !== null ? `${fmt(tr.prevScore)}%` : '—'}
                      </td>
                      <td className="py-2.5 font-medium text-white">
                        {tr.nowScore !== null ? `${fmt(tr.nowScore)}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        {tr.delta !== null ? (
                          <span
                            className={`font-semibold text-[11px] ${
                              tr.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {tr.delta >= 0 ? '+' : ''}
                            {fmt(tr.delta)} pp
                          </span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid: Error Audit & Wins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Audit */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">Error audit</h4>
                <p className="text-[11px] text-zinc-400">Mistakes due or unresolved this week</p>
              </div>
              <button
                onClick={() => onNavigate('errors')}
                className="text-xs text-sky-300 hover:text-white font-semibold"
              >
                View all ↗
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {errorsDue.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 inline mr-1.5" />
                  <strong>No errors due by the end of this week.</strong>
                  Check your general error queue to confirm none are overdue.
                </div>
              ) : (
                errorsDue.map((e) => (
                  <div
                    key={e.id}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{e.title}</div>
                      <div className="text-[10px] text-zinc-400">
                        {dateLabel(e.due)} · {e.cause || 'No cause noted'}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 shrink-0 font-semibold">
                      Due
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 text-xs text-zinc-400">
            {openErrors.length} total open error loop(s) across all subjects.
          </div>
        </div>

        {/* Wins & Objective Evidence */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight mb-1">
              Evidence-based progress signals
            </h4>
            <p className="text-[11px] text-zinc-400 mb-4">
              Observations derived strictly from recorded entries
            </p>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200">
                <span className="font-semibold block text-white mb-0.5">Session Execution:</span>
                Completed {currentLogs.length} study sessions totaling {fmt(hours)} hours and{' '}
                {fmt(qs, 0)} questions attempted.
              </div>

              {currentAvg !== null && prevAvg !== null ? (
                <div
                  className={`p-3.5 rounded-xl border ${
                    currentAvg >= prevAvg
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                  }`}
                >
                  <span className="font-semibold block text-white mb-0.5">Assessment Trajectory:</span>
                  Average assessment score moved from {fmt(prevAvg)}% to {fmt(currentAvg)}% (
                  {currentAvg - prevAvg >= 0 ? '+' : ''}
                  {fmt(currentAvg - prevAvg)} pp). Verify scope and test difficulty before treating this as a direct comparison.
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300">
                  <span className="font-semibold block text-white mb-0.5">Assessment Evidence:</span>
                  Record assessments across consecutive weeks to generate a week-to-week percentage comparison.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Guided Reflection Questions for Next Week */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div>
          <h4 className="text-base font-bold text-white tracking-tight">Questions for next week</h4>
          <p className="text-xs text-zinc-400">
            Translate observations into decisions before moving on.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              What worked, and why do you think it worked?
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Morning 45-minute timed physics drills were most consistent"
              value={worked}
              onChange={(e) => setWorked(e.target.value)}
              className="w-full glass-input text-xs resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              What should change next week?
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Schedule dedicated review for ATP synthase before the weekend"
              value={change}
              onChange={(e) => setChange(e.target.value)}
              className="w-full glass-input text-xs resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              What needs immediate follow-up?
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Retest 5 projectile motion equations"
              value={follow}
              onChange={(e) => setFollow(e.target.value)}
              className="w-full glass-input text-xs resize-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={handleCreateActions}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 border border-sky-400/30 text-xs font-semibold text-sky-100 shadow transition-all hover:-translate-y-0.5"
          >
            <span>Create next actions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Monthly Review Card (Section 9 Requirement from original app) */}
      <div className="glass-card p-6 md:p-8 rounded-3xl space-y-5 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Monthly review</h3>
            <p className="text-xs text-zinc-400">
              Review the month using the same source records as your weekly analysis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthlyReviewMonth}
              onChange={(e) => {
                setMonthlyReviewMonth(e.target.value);
                setMonthlyGenerated(true);
              }}
              className="glass-input text-xs py-1.5"
            />
            <button
              onClick={() => {
                setMonthlyGenerated(true);
                onShowToast(`Monthly summary generated for ${monthlyReviewMonth}.`, 'success');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 text-xs font-semibold text-sky-100 border border-sky-400/30"
            >
              Generate monthly review
            </button>
          </div>
        </div>

        {monthlyGenerated && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs text-zinc-400 block">Study time</span>
                <div className="text-2xl font-bold text-white mt-1">{fmt(mHours)}h</div>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  {mLogs.length} logged sessions
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs text-zinc-400 block">Questions</span>
                <div className="text-2xl font-bold text-white mt-1">{fmt(mQuestions, 0)}</div>
                <span className="text-[10px] text-zinc-400 block mt-0.5">From study logs</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs text-zinc-400 block">Assessment average</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {mAvg !== null ? `${fmt(mAvg)}%` : '—'}
                </div>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  {mAssess.length} recorded assessment(s)
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs text-zinc-400 block">Scheduled tasks</span>
                <div className="text-2xl font-bold text-white mt-1">{mTasks.length}</div>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  {mTasks.filter((t) => t.done).length} completed
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-zinc-200 leading-relaxed">
              <span className="font-semibold text-sky-200 block mb-1">Monthly reflection:</span>
              {mLogs.length > 0 ? (
                <span>
                  You recorded {mLogs.length} sessions and {fmt(mHours)} study hours during {monthlyReviewMonth}, with {fmt(mQuestions, 0)} questions attempted.{' '}
                </span>
              ) : (
                <span>No study logs were recorded for this month yet.{' '}</span>
              )}
              {mAvg === null ? (
                <span>No assessment scores were recorded in this month.{' '}</span>
              ) : (
                <span>The mean assessment score was {fmt(mAvg)}%.{' '}</span>
              )}
              {mOpenErrors > 0 && (
                <span>There are {mOpenErrors} unresolved error loop(s) that need follow-up.{' '}</span>
              )}
              Treat these as signals from entered records, not a complete judgment of effort or ability.
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={() => onNavigate('analytics')}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300"
              >
                Open analysis
              </button>
              <button
                onClick={() => onNavigate('errors')}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300"
              >
                Review open errors
              </button>
              <button
                onClick={() => onNavigate('calendar')}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300"
              >
                Open calendar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
