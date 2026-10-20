import test from 'node:test';
import assert from 'node:assert/strict';
import type { Member, Observation } from '../src/types/member.ts';
import { analyzePerformance } from '../src/utils/performance.ts';
import { DEFAULT_PERFORMANCE_THRESHOLDS as defaults, validatePerformanceThresholds } from '../src/config/performance.ts';

// Synthetic cases are test fixtures only; production JSON is never generated here.
const date = (day: number) => `2026-10-${String(day).padStart(2, '0')}`;
const fixture = (powers: (number | null)[]): Member => ({ id: 'test-only', events: [], history: powers.map((power, i): Observation => ({
  date: date(i + 1), name: 'Test fixture', power, rank: 'R2', level: 28,
  visible: true, activityText: '1h', inactivityMinutes: 60, online: false, identityUncertain: false,
})) });
const analyze = (member: Member, config = { ...defaults }) => analyzePerformance(member, member.history.map(o => o.date), member.history.at(-1)!.date, config);

test('exact 5% reduction is highlighted without assigning inactivity or a cause', () => {
  const result = analyze(fixture([100, 95]));
  assert.equal(result.latest?.significantDecline, true);
  assert.equal(result.latest?.label, 'Power Decline');
  assert.equal(result.latest?.inactivityReview, false);
  assert.equal(result.latest?.sustainedDecline, false);
  assert.deepEqual(result.latest?.dailyChange, { absolute: -5, percent: -5 });
  assert.equal(analyze(fixture([100, 95.01])).latest?.significantDecline, false);
  assert.ok(result.monitoring.every(m => !m.includes('Missing power')));
});

test('growth and minor fluctuations use configurable neutral thresholds', () => {
  assert.equal(analyze(fixture([100, 100.5])).latest?.label, 'Stable');
  assert.equal(analyze(fixture([100, 102])).latest?.label, 'Growing');
  assert.equal(analyze(fixture([100, 97])).latest?.label, 'Stable');
  assert.equal(analyze(fixture([100, 100])).latest?.label, 'Stable');
  assert.equal(analyze(fixture([100, 102]), { ...defaults, stableChangePercent: 3 }).latest?.label, 'Stable');
});

test('a sustained decline needs repeated intervals, duration and cumulative magnitude', () => {
  const result = analyze(fixture([100, 97, 94]));
  assert.equal(result.latest?.significantDecline, false);
  assert.equal(result.latest?.sustainedDecline, true);
  assert.equal(result.latest?.label, 'Power Decline');
  assert.equal(analyze(fixture([100, 99, 98])).latest?.sustainedDecline, false);
  assert.equal(analyze(fixture([100, 97, 94]), { ...defaults, sustainedDeclineDays: 3 }).latest?.sustainedDecline, false);
  assert.equal(analyze(fixture([100, 97, 94]), { ...defaults, sustainedDeclineIntervals: 3 }).latest?.sustainedDecline, false);
});

test('partial, complete and subsequent growth recovery retain the correct baseline and trough', () => {
  const result = analyze(fixture([100, 90, 95, 100, 102]));
  assert.equal(result.points[2].label, 'Recovering');
  assert.deepEqual(result.points[2].recovery, {
    baselineDate: date(1), baselinePower: 100, troughDate: date(2), troughPower: 90,
    regained: 5, percentOfLoss: 50, complete: false,
  });
  assert.equal(result.points[3].recovery?.complete, true);
  assert.equal(result.points[3].recovery?.percentOfLoss, 100);
  assert.equal(result.latest?.label, 'Growing');
  assert.equal(result.latest?.recovery, null);
});

test('further losses update the recovery trough and overshoot is not capped', () => {
  const result = analyze(fixture([100, 90, 80, 110]));
  assert.equal(result.latest?.recovery?.baselinePower, 100);
  assert.equal(result.latest?.recovery?.troughPower, 80);
  assert.equal(result.latest?.recovery?.regained, 30);
  assert.equal(result.latest?.recovery?.percentOfLoss, 150);
});

test('a recovery can be observed even when net historical power is still negative', () => {
  const result = analyze(fixture([100, 80, 81]));
  assert.equal(result.latest?.label, 'Recovering');
  assert.equal(result.historicalChange?.absolute, -19);
  assert.equal(result.latest?.recovery?.complete, false);
});

test('multi-day capture changes never become fabricated daily measurements', () => {
  const member = fixture([100, 90]); member.history[1].date = date(6);
  const result = analyze(member);
  assert.equal(result.latest?.intervalDays, 5);
  assert.equal(result.latest?.change?.absolute, -10);
  assert.equal(result.latest?.dailyChange, null);
});

test('null power, absent captures and uncertain identities interrupt trend and recovery', () => {
  const member = fixture([100, 90, null, 95]);
  assert.equal(analyze(member).latest?.change, null);
  assert.equal(analyze(member).latest?.recovery, null);
  assert.ok(analyze(member).monitoring.some(m => m.includes('Missing power')));
  const absent = fixture([100, 90, 95]); absent.history[2].date = date(4);
  const result = analyzePerformance(absent, [date(1), date(2), date(3), date(4)], date(4));
  assert.equal(result.points[2].observation, null);
  assert.equal(result.latest?.recovery, null);
  const uncertain = fixture([100, 90, 95]); uncertain.history[1].identityUncertain = true;
  assert.equal(analyze(uncertain).latest?.change, null);
});

test('inactivity review depends only on observed activity and keeps power pattern separate', () => {
  const member = fixture([100, 110]); member.history[1].inactivityMinutes = 7200; member.history[1].activityText = '5d';
  const result = analyze(member);
  assert.equal(result.latest?.label, 'Inactivity Review');
  assert.equal(result.latest?.powerLabel, 'Growing');
  assert.equal(analyze(member, { ...defaults, inactivityReviewDays: 6 }).latest?.label, 'Growing');
  member.history[1].online = true; member.history[1].inactivityMinutes = null;
  assert.equal(analyze(member).latest?.inactivityReview, false);
});

test('historical date selection excludes future power, HQ, rank and activity', () => {
  const member = fixture([100, 90, 110]); member.history[2].level = 30; member.history[2].rank = 'R4';
  const result = analyzePerformance(member, member.history.map(o => o.date), date(2));
  assert.equal(result.latestPower?.power, 90);
  assert.equal(result.latestHQ?.level, 28);
  assert.equal(result.rankChanges.length, 0);
  assert.equal(result.points.length, 2);
});

test('HQ and rank evidence coexist with power loss without a demotion recommendation', () => {
  const member = fixture([100, 90]); member.history[1].level = 29; member.history[1].rank = 'R3';
  const result = analyze(member);
  assert.equal(result.latest?.label, 'Power Decline');
  assert.equal(result.firstHQ?.level, 28);
  assert.equal(result.latestHQ?.level, 29);
  assert.equal(result.rankChanges[0].from.rank, 'R2');
  assert.equal(result.rankChanges[0].to.rank, 'R3');
  assert.ok(result.monitoring.some(m => m.includes('HQ progression')));
  assert.ok(result.monitoring.every(m => !m.toLowerCase().includes('demote')));
});

test('unknown and zero power do not manufacture percentages or baseline classifications', () => {
  assert.equal(analyze(fixture([null])).latest?.label, 'Insufficient data');
  assert.equal(analyze(fixture([100])).historicalChange, null);
  const result = analyze(fixture([0, 10]));
  assert.equal(result.latest?.change?.percent, null);
  assert.equal(result.latest?.label, 'Growing');
});

test('departed and unobserved players do not acquire current inactivity flags', () => {
  const member = fixture([100, null]); member.history[1].visible = false;
  const missing = analyze(member);
  assert.equal(missing.latest?.label, 'Insufficient data');
  assert.equal(missing.latestPower?.date, date(1));
  member.events.push({ event_type: 'departure', player_id: member.id, name: 'Test fixture', recorded_on: date(2), effective_date: null, source: 'test' });
  assert.equal(analyze(member).departed, true);
  assert.equal(analyze(member).latest?.inactivityReview, false);
});

test('membership events interrupt comparisons across a departure and rejoin', () => {
  const member = fixture([100, 90, 95]);
  member.events.push({ event_type: 'departure', player_id: member.id, name: 'Test fixture', recorded_on: date(2), effective_date: null, source: 'test' },
    { event_type: 'rejoin', player_id: member.id, name: 'Test fixture', recorded_on: date(3), effective_date: null, source: 'test' });
  assert.equal(analyze(member).latest?.change, null);
  assert.equal(analyze(member).latest?.recovery, null);
});

test('invalid threshold configurations are rejected explicitly', () => {
  assert.deepEqual(validatePerformanceThresholds({ ...defaults }), []);
  for (const config of [
    { ...defaults, significantDeclinePercent: 0 }, { ...defaults, stableChangePercent: 5 },
    { ...defaults, sustainedDeclineIntervals: 1 }, { ...defaults, inactivityReviewDays: -1 },
    { ...defaults, significantDeclinePercent: Number.NaN },
  ]) assert.throws(() => analyze(fixture([100, 90]), config));
});
