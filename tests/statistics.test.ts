import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { classifyActivity, normalizeSnapshots, powerChange, rankMovements, rowsForDate, summarize } from '../src/utils/statistics.ts';
import { validDate, validateDailyData, validateTimeline } from '../src/utils/validation.ts';
import type { DailySnapshot, Observation } from '../src/types/member.ts';

const root = new URL('../', import.meta.url);
const snapshots: DailySnapshot[] = readdirSync(new URL('public/data/', root)).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().map(n => JSON.parse(readFileSync(new URL(`public/data/${n}`, root), 'utf8')) as DailySnapshot);
const data = normalizeSnapshots(snapshots);
const observation = (overrides: Partial<Observation> = {}): Observation => ({ date: '2026-10-14', name: 'Test fixture', rank: 'R1', level: 29, power: 10_000_000, visible: true, activityText: '1h', inactivityMinutes: 60, online: false, identityUncertain: false, ...overrides });
const clone = () => structuredClone(snapshots[0]);

test('historical power differences preserve positive, negative, zero and unknown cases', () => {
  assert.deepEqual(powerChange(observation({ power: 11_000_000 }), observation()), { absolute: 1_000_000, percent: 10 });
  assert.deepEqual(powerChange(observation({ power: 9_000_000 }), observation()), { absolute: -1_000_000, percent: -10 });
  assert.deepEqual(powerChange(observation({ power: 10 }), observation({ power: 0 })), { absolute: 10, percent: null });
  assert.equal(powerChange(observation({ power: null }), observation()), null);
  assert.equal(powerChange(observation(), observation({ visible: false })), null);
  assert.equal(powerChange(observation(), null), null);
});

test('real captures have deterministic selected-date totals and rank distributions', () => {
  for (const [date, active, power, r3] of [
    ['2026-10-14', 91, 5_429_600_000, 23], ['2026-10-19', 97, 5_615_800_000, 36], ['2026-10-20', 98, 5_690_200_000, 36],
  ] as const) {
    const stats = summarize(data, date);
    assert.equal(stats.active, active);
    assert.equal(stats.totalPower, power);
    assert.equal(stats.ranks.R3, r3);
    assert.equal(stats.ranks.R5, 1);
    assert.equal(Object.values(stats.ranks).reduce((a, b) => a + b, 0), active);
  }
  assert.equal(summarize(data, data.dates[0]).firstSeen, null);
  assert.equal(summarize(data, '2026-10-19').firstSeen, 10);
  assert.equal(summarize(data, '2026-10-20').firstSeen, 2);
});

test('activity boundaries use observed elapsed time and online status separately', () => {
  assert.equal(classifyActivity(observation({ online: true, inactivityMinutes: null })), 'Online');
  for (const [minutes, expected] of [[0, 'Recently Active'], [1439, 'Recently Active'], [1440, 'Away'], [7199, 'Away'], [7200, 'Review Required'], [23040, 'Review Required']] as const) {
    assert.equal(classifyActivity(observation({ inactivityMinutes: minutes })), expected);
  }
  assert.equal(classifyActivity(observation({ inactivityMinutes: null })), 'Unknown');
  assert.equal(classifyActivity(observation({ visible: false })), 'Unknown');
  assert.equal(classifyActivity(null), 'Unknown');
});

test('departures respect confirmation date and unobserved players never become departed', () => {
  assert.equal(summarize(data, '2026-10-14').departed, 0);
  assert.equal(summarize(data, '2026-10-19').departed, 4);
  assert.equal(summarize(data, '2026-10-20').departed, 4);
  const row = rowsForDate(data, '2026-10-20').find(r => r.member.id === 'p094')!;
  assert.equal(row.status, 'unobserved');
  assert.equal(row.observation?.power, null);
  assert.equal(row.lastKnown?.power, 107_700_000);
  assert.equal(row.change, null);
  assert.equal(row.position, null);
  assert.equal(rowsForDate(data, '2026-10-14').some(r => r.member.id === 'p094'), false);
});

test('missing observations and null power are excluded, not forward filled', () => {
  const copy = structuredClone(snapshots);
  copy[2].observations = copy[2].observations.filter(o => o.player_id !== 'p001');
  copy[2].observations.find(o => o.player_id === 'p002')!.power_m = null;
  const missing = normalizeSnapshots(copy);
  const row = rowsForDate(missing, '2026-10-20').find(r => r.member.id === 'p001')!;
  assert.equal(row.observation, null);
  assert.equal(row.status, 'unobserved');
  assert.equal(summarize(missing, '2026-10-20').totalPower, 5_690_200_000 - 93_900_000 - 97_900_000);
  assert.equal(summarize(missing, '2026-10-20').powerCoverage, 96);
});

test('rank movements require adjacent visible observations and certain identity', () => {
  const fixture = normalizeSnapshots(snapshots);
  const member = fixture.members[0];
  member.history[0].rank = 'R1'; member.history[1].rank = 'R3'; member.history[2].rank = 'R2';
  assert.equal(rankMovements(fixture, '2026-10-20').filter(m => m.id === member.id).length, 2);
  member.history[1].visible = false;
  assert.equal(rankMovements(fixture, '2026-10-20').filter(m => m.id === member.id).length, 0);
  member.history[1].visible = true; member.history[1].identityUncertain = true;
  assert.equal(rankMovements(fixture, '2026-10-20').filter(m => m.id === member.id).length, 0);
});

test('renaming a player preserves identity and uses the historical name on each date', () => {
  const copy = structuredClone(snapshots);
  copy[2].observations[0].name = 'Renamed fixture';
  const renamed = normalizeSnapshots(copy);
  assert.equal(renamed.members.length, data.members.length);
  assert.equal(rowsForDate(renamed, '2026-10-14').find(r => r.member.id === 'p001')?.name, 'ATT75');
  assert.equal(rowsForDate(renamed, '2026-10-20').find(r => r.member.id === 'p001')?.name, 'Renamed fixture');
});

test('duplicate observations and dates are rejected by validation and normalization', () => {
  const day = clone(); day.observations.push(day.observations[0]);
  assert.ok(validateDailyData(day).some(e => e.includes('duplicate player ID')));
  assert.throws(() => normalizeSnapshots([day]), /Duplicate player ID/);
  assert.throws(() => normalizeSnapshots([snapshots[0], snapshots[0]]), /Duplicate snapshot date/);
  assert.ok(validateTimeline([snapshots[0], snapshots[0]]).some(e => e.includes('Duplicate')));
});

test('validator checks required fields, ranks, power, activity units and impossible dates', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2026-10-20'), true);
  assert.equal(validDate('2026-1-2'), false);
  const day = clone();
  const row = day.observations[0] as unknown as Record<string, unknown>;
  delete row.player_id; row.rank = 'R6'; row.power_m = -1; row.last_seen = '3weeks'; day.date = '2026-02-30';
  const errors = validateDailyData(day).join(' ');
  for (const expected of ['player_id', 'rank', 'power_m', 'activity unit', 'ISO date']) assert.ok(errors.includes(expected), errors);
});

test('chronological inconsistencies and unrecorded rejoins are rejected', () => {
  assert.ok(validateTimeline([...snapshots].reverse()).some(e => e.includes('Chronologically')));
  const copy = structuredClone(snapshots);
  copy[2].observations.find(o => o.player_id === 'p042')!.visible = true;
  assert.ok(validateTimeline(copy).some(e => e.includes('after confirmed departure')));
  copy[2].observations.find(o => o.player_id === 'p042')!.visible = false;
  copy[1].membership_events[0].effective_date = '2026-10-20';
  assert.ok(validateDailyData(copy[1]).some(e => e.includes('effective_date')));
});

test('daily split preserves every original raw snapshot, profile and event', () => {
  const original = JSON.parse(readFileSync(new URL('source-data/DESO_member_history_2026-10-14_to_2026-10-20.json', root), 'utf8'));
  for (const day of snapshots.filter(s => original.snapshot_dates.includes(s.date))) {
    assert.deepEqual(validateDailyData(day), []);
    assert.deepEqual(day.alliance, original.alliance);
    assert.deepEqual(day.summary, original.snapshots_summary[day.date]);
    for (const row of day.observations) {
      const player = original.players.find((p: { player_id: string }) => p.player_id === row.player_id);
      const { player_id: _id, name, profile, ...raw } = row;
      assert.equal(name, player.name);
      assert.deepEqual(raw, player.snapshots[day.date]);
      assert.deepEqual(profile, player[`profile_${day.date}`]);
    }
    assert.equal(day.observations.length, original.players.filter((p: { snapshots: Record<string, unknown> }) => p.snapshots[day.date]).length);
    assert.deepEqual(day.membership_events, original.membership_events.filter((e: { recorded_on: string }) => e.recorded_on === day.date));
  }
  assert.deepEqual(validateTimeline(snapshots), []);
});
