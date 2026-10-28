import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAlliance, inspectRoster, probe } from './probe-lastwar.mjs';
const id = 'a'.repeat(32);
const alliance = { id, name: 'Death Soldiers', abbr: 'DeSo', server_id: 2052 };
test('selects only one exact alliance on the intended server', () => {
  assert.equal(selectAlliance([alliance]).id, id);
  for (const rows of [[alliance, alliance], [{ ...alliance, server_id: 2053 }], [{ ...alliance, name: 'Other' }]])
    assert.throws(() => selectAlliance(rows));
});
const members = Array.from({ length: 5 }, (_, i) => ({ uid: String(i), name: `p${i}`, power: 10, hq_level: 29, rank: 3, online: false, offline_time: i }));
const known = new Set(members.map(r => r.name));
test('checks identity and reports missing activity without inventing semantics', () => {
  const d = { alliance_id: id, members, member_count: 5, total_power: 50 };
  const report = inspectRoster(d, id, known);
  assert.equal(report.individual_power_sum, 50);
  assert.equal(report.coverage.join_time, 0);
  assert.throws(() => inspectRoster(d, 'b'.repeat(32), known));
  assert.throws(() => inspectRoster(d, id, new Set()));
  assert.throws(() => inspectRoster({ ...d, members: [...members, members[0]] }, id, known));
});
test('missing secret makes zero requests', async () => {
  assert.equal((await probe('', () => { throw Error('must not call'); })).requests, 0);
});
test('provider failures never expose secret or raw error response and do not retry', async () => {
  let calls = 0;
  const r = await probe('SECRET', async () => { calls++; return { ok: false, status: 503, text: async () => 'SECRET credentials: login response too short' }; });
  assert.equal(calls, 1);
  assert.equal(r.reason, 'HTTP_503: login response too short');
  assert.ok(!JSON.stringify(r).includes('SECRET'));
});
