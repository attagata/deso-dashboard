// Isolated, read-only provider probe. Never imports data into the dashboard.
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BASE = 'https://api.lastwar.tools';
export function selectAlliance(rows) {
  if (!Array.isArray(rows)) throw new Error('unexpected_rankings_schema');
  const matches = rows.filter(r => r && r.abbr?.toLowerCase() === 'deso' &&
    r.name?.toLowerCase() === 'death soldiers' && r.server_id === 2052);
  if (matches.length !== 1 || !/^[a-f0-9]{32}$/i.test(matches[0].id)) throw new Error('alliance_not_uniquely_identified');
  return matches[0];
}
export function inspectRoster(data, allianceId, knownNames) {
  if (!data || data.alliance_id !== allianceId || !Array.isArray(data.members) || !data.members.length)
    throw new Error('unexpected_roster_schema');
  const rows = data.members;
  const uids = rows.map(r => r?.uid);
  if (uids.some(id => typeof id !== 'string' || !id.trim()) || new Set(uids).size !== rows.length)
    throw new Error('missing_or_duplicate_game_ids');
  const matches = rows.filter(r => typeof r.name === 'string' && knownNames.has(r.name.toLowerCase())).length;
  if (matches < 5) throw new Error('insufficient_historical_identity_matches');
  const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const coverage = Object.fromEntries(['name', 'power', 'hq_level', 'rank', 'online', 'offline_time', 'join_time'].map(key => [key,
    rows.filter(r => key === 'name' ? typeof r[key] === 'string' && r[key].trim() :
      key === 'online' ? typeof r[key] === 'boolean' : finite(r[key])).length]));
  const offline = rows.map(r => r.offline_time).filter(finite);
  return { observed_members: rows.length, provider_member_count: finite(data.member_count) ? data.member_count : null,
    count_matches: data.member_count === rows.length, historical_name_matches: matches,
    coverage, ranks_observed: [...new Set(rows.map(r => r.rank))].filter(finite).sort(),
    individual_power_sum: coverage.power === rows.length ? rows.reduce((s, r) => s + r.power, 0) : null,
    provider_total_power: finite(data.total_power) ? data.total_power : null,
    offline_time_range: offline.length ? { min: Math.min(...offline), max: Math.max(...offline) } : null,
    activity_semantics: 'Unverified: offline_time unit/epoch and rank encoding must be confirmed before import.',
    freshness: 'No independent capture timestamp or freshness verified. This is current provider access, not a historical snapshot.' };
}
export async function probe(key, request = fetch) {
  if (!key) return { status: 'failed', reason: 'missing_repository_secret_LASTWAR_DESO_TOOLS', requests: 0 };
  let count = 0;
  async function get(path) {
    count++;
    const response = await request(`${BASE}${path}`, { headers: { 'X-API-Key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(120000), redirect: 'error' });
    if (!response.ok) {
      // Do not expose untrusted response text, headers, credentials or account details in public logs.
      const body = (await response.text()).toLowerCase();
      const markers = ['insufficient tokens', 'login response too short', 'invalid handshake', 'invalid api key', 'authentication may have failed'];
      const reason = markers.find(marker => body.includes(marker)) ?? 'provider_request_failed';
      throw new Error(`HTTP_${response.status}: ${reason}`);
    }
    return response.json();
  }
  try {
    const alliance = selectAlliance(await get('/rankings/2052/alliances?limit=200'));
    const data = await get(`/alliance/${alliance.id}/members?sort_by=power&descending=true`);
    const manifest = JSON.parse(await readFile(new URL('../public/data/index.json', import.meta.url), 'utf8'));
    const latest = JSON.parse(await readFile(new URL(`../public/data/${manifest.files.at(-1)}`, import.meta.url), 'utf8'));
    const known = new Set(latest.observations.map(r => r.name.toLowerCase()));
    return { status: 'read_success', requests: count, alliance: 'DeSo / Death Soldiers / 2052',
      ...inspectRoster(data, alliance.id, known), import_enabled: false };
  } catch (error) {
    const allowed = /^(HTTP_\d{3}: (provider_request_failed|insufficient tokens|login response too short|invalid handshake|invalid api key|authentication may have failed)|unexpected_rankings_schema|alliance_not_uniquely_identified|unexpected_roster_schema|missing_or_duplicate_game_ids|insufficient_historical_identity_matches)$/;
    return { status: 'failed', requests: count, reason: allowed.test(error.message) ? error.message :
      error.name === 'TimeoutError' ? 'provider_timeout' : 'network_or_unexpected_response', import_enabled: false };
  }
}
async function main() {
  const report = { checked_at: new Date().toISOString(), mode: 'shared_pool_no_game_session',
    ...await probe(process.env.LASTWAR_DESO_TOOLS) };
  await writeFile('lastwar-probe-report.json', JSON.stringify(report, null, 2) + '\n');
  const summary = 'LastWar shared access probe\n\n```json\n' + JSON.stringify(report, null, 2) + '\n```\n';
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  if (report.status !== 'read_success') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
