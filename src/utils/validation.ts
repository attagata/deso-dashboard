import type { DailySnapshot } from '../types/member.ts';

type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export const validDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const rank = (v: unknown) => v === null || (typeof v === 'string' && /^R[1-5]$/.test(v));

export function validateDailyData(value: unknown, label = 'snapshot'): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(`${label}: ${message}`);
  if (!object(value)) return [`${label}: expected a JSON object`];
  if (value.schema_version !== 2) fail('schema_version must be 2');
  if (!validDate(value.date)) fail('date must be a valid ISO date (YYYY-MM-DD)');
  if (!object(value.alliance) || !text(value.alliance.tag) || !text(value.alliance.name) || !text(value.alliance.server)) fail('alliance requires tag, name and server strings');
  if (!object(value.summary)) fail('summary must be an object (use {} if unknown)');
  else {
    for (const key of ['reported_members', 'alliance_power']) {
      const v = value.summary[key];
      if (v !== undefined && v !== null && !nonnegative(v)) fail(`summary.${key} must be a nonnegative number or null`);
    }
    if (value.summary.reported_ranks !== undefined) {
      if (!object(value.summary.reported_ranks)) fail('summary.reported_ranks must be an object');
      else for (const [key, count] of Object.entries(value.summary.reported_ranks)) {
        if (!/^R[1-5]$/.test(key) || !nonnegative(count) || !Number.isInteger(count)) fail(`invalid reported rank count: ${key}`);
      }
    }
  }
  if (!Array.isArray(value.observations)) fail('observations must be an array');
  else {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const [i, row] of value.observations.entries()) {
      const at = `observations[${i}]`;
      if (!object(row)) { fail(`${at} must be an object`); continue; }
      if (!text(row.player_id)) fail(`${at}.player_id is required`);
      else { if (ids.has(row.player_id)) fail(`${at}: duplicate player ID / observation ${row.player_id} on ${String(value.date)}`); ids.add(row.player_id); }
      if (!text(row.name)) fail(`${at}.name is required`);
      else {
        const name = row.name.normalize('NFKC').trim().toLocaleLowerCase('en');
        if (names.has(name)) fail(`${at}: duplicate member name ${row.name}; verify the identity match`);
        names.add(name);
      }
      if (!rank(row.rank)) fail(`${at}.rank must be R1–R5 or null`);
      if (row.power_m !== null && !nonnegative(row.power_m)) fail(`${at}.power_m must be a nonnegative number or null`);
      if (row.base_level !== null && (!nonnegative(row.base_level) || !Number.isInteger(row.base_level) || row.base_level === 0)) fail(`${at}.base_level must be a positive integer or null`);
      if (typeof row.visible !== 'boolean') fail(`${at}.visible must be boolean`);
      if (![true, false, null].includes(row.online_at_capture as boolean | null) || row.online_at_capture === undefined) fail(`${at}.online_at_capture must be boolean or null`);
      if (row.last_seen_minutes !== null && !nonnegative(row.last_seen_minutes)) fail(`${at}.last_seen_minutes must be nonnegative or null`);
      if (row.last_seen !== null && (typeof row.last_seen !== 'string' || !/^(online|\d+(?:\.\d+)?[mhd])$/.test(row.last_seen))) fail(`${at}.last_seen must be online, a numeric m/h/d activity value, or null (invalid activity unit)`);
      if (row.last_seen === 'online' && row.online_at_capture !== true) fail(`${at}: online activity requires online_at_capture=true`);
      if (row.online_at_capture === true && row.last_seen !== 'online') fail(`${at}: online_at_capture=true requires last_seen=online`);
      if (row.online_at_capture === true && row.last_seen_minutes !== null) fail(`${at}: preserve online status separately; online last_seen_minutes must be null`);
      if (typeof row.last_seen === 'string' && row.last_seen !== 'online') {
        const match = /^(\d+(?:\.\d+)?)([mhd])$/.exec(row.last_seen);
        if (match && row.last_seen_minutes !== null) {
          const nominal = Number(match[1]) * ({ m: 1, h: 60, d: 1440 }[match[2]] ?? 1);
          if (row.last_seen_minutes !== nominal) fail(`${at}: last_seen_minutes conflicts with the observed activity value`);
        }
      }
      if (row.visible === false && ['rank', 'power_m', 'base_level', 'last_seen', 'last_seen_minutes', 'online_at_capture'].some(k => row[k] !== null)) fail(`${at}: unobserved values must be null; do not copy older observations`);
      if (row.identity_uncertain !== undefined && typeof row.identity_uncertain !== 'boolean') fail(`${at}.identity_uncertain must be boolean`);
      if (!text(row.source)) fail(`${at}.source is required`);
    }
  }
  if (!Array.isArray(value.membership_events)) fail('membership_events must be an array');
  else {
    const seen = new Set<string>();
    for (const [i, event] of value.membership_events.entries()) {
      const at = `membership_events[${i}]`;
      if (!object(event)) { fail(`${at} must be an object`); continue; }
      if (!['departure', 'rejoin'].includes(String(event.event_type))) fail(`${at}.event_type must be departure or rejoin`);
      if (!text(event.player_id) || !text(event.name) || !text(event.source)) fail(`${at}: player_id, name and source are required`);
      if (!validDate(event.recorded_on) || event.recorded_on !== value.date) fail(`${at}.recorded_on must equal the snapshot date`);
      if (event.effective_date !== null && (!validDate(event.effective_date) || String(event.effective_date) > String(event.recorded_on))) fail(`${at}: effective_date must be null or a valid date no later than recorded_on`);
      if (event.previous_rank !== undefined && !rank(event.previous_rank)) fail(`${at}: invalid previous_rank`);
      const key = `${String(event.player_id)}:${String(event.recorded_on)}`;
      if (seen.has(key)) fail(`${at}: duplicate membership event ${key}`);
      seen.add(key);
    }
  }
  return errors;
}

export function validateTimeline(snapshots: DailySnapshot[]): string[] {
  const errors: string[] = [];
  const dates = new Set<string>();
  const known = new Set<string>();
  const departed = new Set<string>();
  let previousDate = '';
  for (const snapshot of snapshots) {
    if (dates.has(snapshot.date)) errors.push(`Duplicate observation date: ${snapshot.date}`);
    if (snapshot.date <= previousDate) errors.push(`Chronologically inconsistent snapshot order: ${snapshot.date} after ${previousDate}`);
    previousDate = snapshot.date;
    dates.add(snapshot.date);
    for (const row of snapshot.observations) known.add(row.player_id);
    for (const event of snapshot.membership_events) {
      if (!known.has(event.player_id)) errors.push(`${snapshot.date}: event references unknown player ${event.player_id}`);
      if (event.event_type === 'departure') {
        if (departed.has(event.player_id)) errors.push(`${snapshot.date}: duplicate departure without rejoin for ${event.player_id}`);
        departed.add(event.player_id);
      } else {
        if (!departed.has(event.player_id)) errors.push(`${snapshot.date}: rejoin without prior departure for ${event.player_id}`);
        departed.delete(event.player_id);
      }
    }
    for (const row of snapshot.observations) {
      if (row.visible && departed.has(row.player_id)) errors.push(`${snapshot.date}: ${row.player_id} observed after confirmed departure; record an explicit rejoin`);
    }
  }
  return errors;
}
