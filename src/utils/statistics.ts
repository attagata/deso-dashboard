import type { Activity, Dataset, DailySnapshot, Member, MemberRow, Observation, Rank } from '../types/member.ts';

export const RANKS: Rank[] = ['R5', 'R4', 'R3', 'R2', 'R1'];
export const ACTIVITIES: Activity[] = ['Online', 'Recently Active', 'Away', 'Review Required', 'Unknown'];

export function classifyActivity(observation: Observation | null): Activity {
  if (!observation?.visible) return 'Unknown';
  if (observation.online === true) return 'Online';
  const minutes = observation.inactivityMinutes;
  if (minutes === null || minutes < 0) return 'Unknown';
  if (minutes < 1440) return 'Recently Active';
  if (minutes < 7200) return 'Away';
  return 'Review Required';
}

export function powerChange(current: Observation | null, previous: Observation | null) {
  if (!current?.visible || !previous?.visible || current.power === null || previous.power === null) return null;
  const absolute = current.power - previous.power;
  return { absolute, percent: previous.power > 0 ? absolute / previous.power * 100 : null };
}

export function normalizeSnapshots(snapshots: DailySnapshot[]): Dataset {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const members = new Map<string, Member>();
  const seenDates = new Set<string>();
  for (const snapshot of sorted) {
    if (seenDates.has(snapshot.date)) throw new Error(`Duplicate snapshot date: ${snapshot.date}`);
    seenDates.add(snapshot.date);
    const seenIds = new Set<string>();
    for (const raw of snapshot.observations) {
      if (seenIds.has(raw.player_id)) throw new Error(`Duplicate player ID / observation: ${raw.player_id} on ${snapshot.date}`);
      seenIds.add(raw.player_id);
      const member = members.get(raw.player_id) ?? { id: raw.player_id, history: [], events: [] };
      member.history.push({
        date: snapshot.date, name: raw.name, rank: raw.rank, level: raw.base_level,
        power: raw.power_m === null ? null : Math.round(raw.power_m * 1_000_000),
        visible: raw.visible, activityText: raw.last_seen, inactivityMinutes: raw.last_seen_minutes,
        online: raw.online_at_capture, identityUncertain: raw.identity_uncertain ?? false,
      });
      members.set(member.id, member);
    }
  }
  for (const snapshot of sorted) {
    for (const event of snapshot.membership_events) {
      const member = members.get(event.player_id);
      if (!member) throw new Error(`Unknown event player: ${event.player_id}`);
      member.events.push(event);
    }
  }
  return { dates: sorted.map(s => s.date), snapshots: sorted, members: [...members.values()] };
}

export function rowsForDate(data: Dataset, date: string): MemberRow[] {
  const rows: MemberRow[] = [];
  for (const member of data.members) {
    const history = member.history.filter(o => o.date <= date);
    // Do not leak players or names from future captures into a historical roster.
    if (!history.length) continue;
    const observation = history.find(o => o.date === date) ?? null;
    const lastKnown = history.findLast(o => o.visible) ?? null;
    const event = member.events.filter(e => e.recorded_on <= date).at(-1);
    const departed = event?.event_type === 'departure';
    const status = departed ? 'departed' : observation?.visible ? 'active' : 'unobserved';
    const previous = history.filter(o => o.date < date && o.visible).at(-1) ?? null;
    rows.push({ member, name: history.at(-1)!.name, observation, lastKnown, status,
      position: null, change: status === 'active' ? powerChange(observation, previous) : null,
      activity: status === 'active' ? classifyActivity(observation) : 'Unknown' });
  }
  rows.sort((a, b) => {
    const ap = a.status === 'active' ? a.observation?.power ?? -1 : -1;
    const bp = b.status === 'active' ? b.observation?.power ?? -1 : -1;
    return bp - ap || a.name.localeCompare(b.name, 'en') || a.member.id.localeCompare(b.member.id);
  });
  let position = 0;
  for (const row of rows) if (row.status === 'active' && row.observation?.power !== null) row.position = ++position;
  return rows;
}

export function summarize(data: Dataset, date: string) {
  const rows = rowsForDate(data, date);
  const active = rows.filter(r => r.status === 'active');
  const ranks = Object.fromEntries(RANKS.map(rank => [rank, active.filter(r => r.observation?.rank === rank).length])) as Record<Rank, number>;
  return {
    rows, active: active.length, departed: rows.filter(r => r.status === 'departed').length,
    unobserved: rows.filter(r => r.status === 'unobserved').length,
    totalPower: active.reduce((sum, r) => sum + (r.observation?.power ?? 0), 0),
    powerCoverage: active.filter(r => r.observation?.power !== null).length,
    firstSeen: date === data.dates[0] ? null : active.filter(r => r.member.history.find(o => o.visible)?.date === date).length,
    flagged: active.filter(r => r.activity === 'Review Required'), ranks,
    activity: Object.fromEntries(ACTIVITIES.map(category => [category, active.filter(r => r.activity === category).length])) as Record<Activity, number>,
  };
}

export function rankMovements(data: Dataset, throughDate: string) {
  return data.members.flatMap(member => data.dates.slice(1).flatMap((date, i) => {
    if (date > throughDate) return [];
    const previous = member.history.find(o => o.date === data.dates[i]);
    const current = member.history.find(o => o.date === date);
    if (!previous?.visible || !current?.visible || !previous.rank || !current.rank ||
      previous.identityUncertain || current.identityUncertain || previous.rank === current.rank) return [];
    return [{ id: member.id, name: current.name, previous: previous.rank, current: current.rank, from: previous.date, to: date }];
  })).sort((a, b) => b.to.localeCompare(a.to) || a.name.localeCompare(b.name, 'en'));
}

export const formatPower = (n: number | null | undefined) => n == null ? '—' : `${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
export const formatDate = (date: string) => new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
export const memberHref = (id: string, date: string) => `#/member/${encodeURIComponent(id)}?date=${date}`;
