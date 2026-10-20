import { lazy, Suspense } from 'react';
import type { Dataset } from '../types/member.ts';
import { formatDate, formatPower, memberHref, rankMovements, summarize } from '../utils/statistics.ts';
import MemberTable, { Change, RankBadge } from './MemberTable.tsx';
import ActivityMonitor from './ActivityMonitor.tsx';
import { Icon } from './Icons.tsx';

const RankDistribution = lazy(() => import('./RankDistribution.tsx'));

export default function Dashboard({ data, date }: { data: Dataset; date: string }) {
  const stats = summarize(data, date);
  const snapshot = data.snapshots.find(s => s.date === date)!;
  const movements = rankMovements(data, date);
  const top = stats.rows.filter(r => r.status === 'active' && r.observation?.power != null).slice(0, 10);
  return <>
    <div className="page-intro"><div><div className="eyebrow gold"><span className="live-dot" /> ALLIANCE INTELLIGENCE</div><h1>Alliance overview<span className="gold">.</span></h1><p>Your alliance. Every member. The complete picture.</p></div><div className="snapshot-tag"><Icon name="clock" size={16} /><span>Snapshot <strong>{formatDate(date)}</strong></span></div></div>
    <div className="metric-grid">
      <section className="panel metric"><div className="metric-label">Active members <Icon name="users" size={18} /></div><strong>{stats.active}<span>/ {snapshot.summary.reported_members ?? '—'}</span></strong><div className="metric-foot"><span className="positive-dot" />{stats.active} observed · {stats.unobserved} unobserved</div></section>
      <section className="panel metric featured"><div className="metric-label">Recorded member power <Icon name="bolt" size={18} /></div><strong>{(stats.totalPower / 1e9).toFixed(3)}<span>B</span></strong><div className="metric-foot">Sum of {stats.powerCoverage} selected-date records</div></section>
      <section className="panel metric"><div className="metric-label">Newly observed <Icon name="arrow" size={18} /></div><strong>{stats.firstSeen ?? '—'}<span>members</span></strong><div className="metric-foot">{stats.firstSeen === null ? 'Baseline capture · entry dates unknown' : 'First seen today · entry dates unknown'}</div></section>
      <section className="panel metric"><div className="metric-label">Activity review <Icon name="flag" size={18} /></div><strong>{stats.flagged.length}<span>flagged</span></strong><div className="metric-foot"><span className="warning-dot" />5+ days away · officer review</div></section>
    </div>
    <div className="data-strip"><span><Icon name="shield" size={16} /> <strong>{stats.departed}</strong> confirmed departures through this date</span><span>Official alliance power: <strong>{snapshot.summary.alliance_power == null ? 'Not recorded for this date' : `${snapshot.summary.alliance_power.toLocaleString('en-US')} (screenshot)`}</strong></span></div>
    <div className="overview-grid"><Suspense fallback={<div className="panel chart-placeholder">Loading rank distribution…</div>}><RankDistribution ranks={stats.ranks} active={stats.active} /></Suspense>
      <section className="panel leaders" aria-labelledby="leaders-title"><div className="panel-heading"><div><span className="eyebrow">FRONTLINE STRENGTH</span><h2 id="leaders-title">Top 10 by power</h2></div><a href="#roster" className="text-link" onClick={e => { e.preventDefault(); document.getElementById('roster')?.scrollIntoView(); }}>Full roster <Icon name="chevron" size={13} /></a></div><div className="leader-list">{top.map((row, i) => <a href={memberHref(row.member.id, date)} key={row.member.id} className="leader-row"><span className={`leader-position ${i < 3 ? 'gold' : ''}`}>{String(i + 1).padStart(2, '0')}</span><span className="leader-name">{row.name}</span><RankBadge rank={row.observation?.rank} /><span className="leader-bar"><span style={{ width: `${(row.observation!.power! / top[0].observation!.power!) * 100}%` }} /></span><strong>{formatPower(row.observation?.power)}</strong><span className="leader-change"><Change change={row.change} /></span></a>)}</div>{!top.length && <p className="empty-state">No observed power values on this date.</p>}</section>
    </div>
    <MemberTable rows={stats.rows} date={date} />
    <ActivityMonitor rows={stats.rows} date={date} />
    <div className="bottom-grid"><section className="panel" id="movements"><div className="panel-heading"><div><span className="eyebrow">OBSERVED CHANGES</span><h2>Rank movements <span className="count-badge">{movements.length}</span></h2></div><Icon name="arrow" /></div>{movements.length ? <div className="table-scroll movements-scroll" role="region" aria-label="Historical rank changes" tabIndex={0}><table><thead><tr><th>Player</th><th>Rank change</th><th>Between observations</th></tr></thead><tbody>{movements.map(m => <tr key={`${m.id}:${m.to}`}><th scope="row"><a href={memberHref(m.id, date)}>{m.name}</a></th><td><RankBadge rank={m.previous} /><span className="movement-arrow">→</span><RankBadge rank={m.current} /></td><td>{m.from.slice(5)} → {m.to.slice(5)}</td></tr>)}</tbody></table></div> : <p className="empty-state compact">No rank changes confirmed between adjacent captures.</p>}<p className="panel-note">Differences between adjacent captures; the action date is unknown. Missing observations and uncertain identities are excluded.</p></section>
      <section className="panel rules" id="guidelines"><div className="panel-heading"><div><span className="eyebrow">CASUAL ALLIANCE · SHARED DIRECTION</span><h2>Alliance guidelines</h2></div><Icon name="shield" /></div><div className="rule-item"><span>01</span><div><h3>People before automation</h3><p>Promotions are never automatic. R4 officers evaluate members; R5 has final authority over leadership appointments.</p></div></div><div className="rule-item"><span>02</span><div><h3>Room to grow</h3><p>HQ 29+ was the initial criterion for R3 consideration. Members below HQ 29 may qualify through performance.</p></div></div><div className="rule-item"><span>03</span><div><h3>Review, then decide</h3><p>Five days away triggers review, not automatic demotion or expulsion. Recommendations are reviewed approximately every two weeks.</p></div></div><div className="advisory-tag"><Icon name="shield" size={15} /> All indicators are advisory. Officers make the decisions.</div></section></div>
  </>;
}
