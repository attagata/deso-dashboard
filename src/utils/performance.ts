import type { Member, Observation } from '../types/member.ts';
import { DEFAULT_PERFORMANCE_THRESHOLDS, validatePerformanceThresholds } from '../config/performance.ts';
import type { PerformanceThresholds } from '../config/performance.ts';
import { powerChange } from './statistics.ts';

export type PerformanceLabel = 'Growing' | 'Stable' | 'Power Decline' | 'Recovering' | 'Inactivity Review' | 'Insufficient data';
export interface Recovery {
  baselineDate: string;
  baselinePower: number;
  troughDate: string;
  troughPower: number;
  regained: number;
  percentOfLoss: number;
  complete: boolean;
}
export interface PerformancePoint {
  date: string;
  observation: Observation | null;
  previousDate: string | null;
  intervalDays: number | null;
  change: ReturnType<typeof powerChange>;
  dailyChange: ReturnType<typeof powerChange>;
  significantDecline: boolean;
  decliningIntervals: number;
  sustainedDecline: boolean;
  recovery: Recovery | null;
  powerLabel: PerformanceLabel;
  label: PerformanceLabel;
  inactivityReview: boolean;
}

const measuredPower = (o: Observation | null): o is Observation & { power: number } =>
  !!o?.visible && !o.identityUncertain && o.power !== null;
const daysBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

export function analyzePerformance(member: Member, dates: string[], throughDate: string, config: PerformanceThresholds = DEFAULT_PERFORMANCE_THRESHOLDS) {
  const errors = validatePerformanceThresholds(config);
  if (errors.length) throw new Error(errors.join(' '));
  const history = [...member.history].filter(o => o.date <= throughDate).sort((a, b) => a.date.localeCompare(b.date));
  const visible = history.filter(o => o.visible && !o.identityUncertain);
  const powers = visible.filter(measuredPower);
  const startingPower = powers[0] ?? null;
  const latestPower = powers.at(-1) ?? null;
  const firstHQ = visible.find(o => o.level !== null) ?? null;
  const latestHQ = visible.findLast(o => o.level !== null) ?? null;
  const latestLogin = visible.findLast(o => o.online !== null || o.inactivityMinutes !== null) ?? null;
  const events = [...member.events].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const statusAt = (date: string) => events.filter(e => e.recorded_on <= date).at(-1)?.event_type === 'departure' ? 'departed' : 'not-confirmed-departed';
  const observationByDate = new Map(history.map(o => [o.date, o]));
  let previous: Observation | null = null;
  let decliningIntervals = 0;
  let runStart: Observation | null = null;
  let cycle: { baseline: Observation & { power: number }; trough: Observation & { power: number } } | null = null;
  const rankChanges: { from: Observation; to: Observation }[] = [];
  const points: PerformancePoint[] = [];
  for (const date of [...new Set(dates)].sort().filter(d => history.length > 0 && d <= throughDate && d >= history[0].date)) {
    const observation = observationByDate.get(date) ?? null;
    const boundary = previous && events.some(e => e.recorded_on > previous!.date && e.recorded_on <= date);
    const comparable = !boundary && measuredPower(previous) && measuredPower(observation);
    const change = comparable ? powerChange(observation, previous) : null;
    const intervalDays = comparable ? daysBetween(previous!.date, date) : null;
    const significantDecline = change?.percent !== null && (change?.percent ?? 0) <= -config.significantDeclinePercent;
    let recovery: Recovery | null = null;
    let sustainedDecline = false;
    let powerLabel: PerformanceLabel = 'Insufficient data';
    if (!change || !measuredPower(observation) || !measuredPower(previous)) {
      decliningIntervals = 0; runStart = null; cycle = null;
    } else {
      if (change.absolute < 0) {
        if (!decliningIntervals) runStart = previous;
        decliningIntervals++;
      } else { decliningIntervals = 0; runStart = null; }
      const runChange = runStart ? powerChange(observation, runStart) : null;
      sustainedDecline = decliningIntervals >= config.sustainedDeclineIntervals && !!runStart &&
        daysBetween(runStart.date, date) >= config.sustainedDeclineDays &&
        runChange?.percent !== null && (runChange?.percent ?? 0) <= -config.significantDeclinePercent;
      if ((significantDecline || sustainedDecline) && !cycle) {
        const baseline = sustainedDecline && measuredPower(runStart) ? runStart : previous;
        cycle = { baseline, trough: observation };
      }
      if (cycle && observation.power < cycle.trough.power) cycle.trough = observation;
      if (cycle && change.absolute > 0) {
        const loss = cycle.baseline.power - cycle.trough.power;
        recovery = {
          baselineDate: cycle.baseline.date, baselinePower: cycle.baseline.power,
          troughDate: cycle.trough.date, troughPower: cycle.trough.power,
          regained: observation.power - cycle.trough.power,
          percentOfLoss: loss > 0 ? (observation.power - cycle.trough.power) / loss * 100 : 0,
          complete: observation.power >= cycle.baseline.power,
        };
      }
      powerLabel = recovery ? 'Recovering' : significantDecline || sustainedDecline ? 'Power Decline' :
        change.absolute > 0 && (change.percent === null || change.percent > config.stableChangePercent) ? 'Growing' : 'Stable';
      if (recovery?.complete) cycle = null;
    }
    const inactivityReview = !!observation?.visible && !observation.identityUncertain && observation.online !== true &&
      observation.inactivityMinutes !== null && observation.inactivityMinutes >= config.inactivityReviewDays * 1440 && statusAt(date) !== 'departed';
    points.push({ date, observation, previousDate: change ? previous!.date : null, intervalDays, change,
      dailyChange: intervalDays === 1 ? change : null, significantDecline, decliningIntervals,
      sustainedDecline, recovery, powerLabel, inactivityReview, label: inactivityReview ? 'Inactivity Review' : powerLabel });
    if (!boundary && previous?.visible && observation?.visible && !previous.identityUncertain && !observation.identityUncertain &&
      previous.rank && observation.rank && previous.rank !== observation.rank) rankChanges.push({ from: previous, to: observation });
    previous = observation;
  }
  const latest = points.find(p => p.date === throughDate) ?? null;
  const fluctuations = points.filter(p => p.significantDecline || p.sustainedDecline || p.recovery);
  const monitoring: string[] = [];
  if (!latest?.observation?.visible) monitoring.push('No selected-date observation. Capture a new roster before assessing current activity or power.');
  if (history.some(o => o.identityUncertain)) monitoring.push('Verify uncertain identity matches; uncertain observations are excluded from comparisons.');
  if (latest?.inactivityReview) monitoring.push(`Observed absence meets the ${config.inactivityReviewDays}-day review threshold. Officers should review the context; no automatic action is recommended.`);
  if (points.some(p => p.significantDecline)) monitoring.push(`Compare future captures after reductions of ${config.significantDeclinePercent}% or more. Screenshots cannot establish the cause.`);
  if (latest?.sustainedDecline) monitoring.push('Repeated measured reductions meet the configured downward-trend rule. Continue observing; the pattern does not establish its cause or commitment.');
  if (latest?.recovery) monitoring.push(latest.recovery.complete ? 'Observed power has reached or exceeded the pre-decline baseline.' : 'A partial recovery is visible. Compare the next capture with the pre-decline baseline.');
  if (points.slice(1).some(p => !p.change)) monitoring.push('Missing power, observations or membership continuity prevent some interval comparisons. No missing measurements have been filled in.');
  if (firstHQ && latestHQ && firstHQ.level !== null && latestHQ.level !== null && latestHQ.level > firstHQ.level) monitoring.push('HQ progression is recorded independently of power fluctuations; it does not prove a specific upgrade date.');
  if (!monitoring.length) monitoring.push('Continue collecting dated power, HQ, rank and login observations. These indicators describe recorded changes, not commitment or administrative eligibility.');
  return { points, latest, fluctuations, startingPower, latestPower,
    historicalChange: startingPower && latestPower && startingPower.date !== latestPower.date ? powerChange(latestPower, startingPower) : null,
    firstHQ, latestHQ, latestLogin, rankChanges, monitoring, departed: statusAt(throughDate) === 'departed' };
}
