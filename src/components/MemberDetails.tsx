import { lazy, Suspense } from 'react';
import type { Dataset, Member } from '../types/member.ts';
import { classifyActivity, formatDate, formatPower, powerChange, rowsForDate } from '../utils/statistics.ts';
import { Change, RankBadge } from './MemberTable.tsx';
import { Icon } from './Icons.tsx';

const PowerChart = lazy(() => import('./PowerChart.tsx'));

export default function MemberDetails({ data, member, date }: { data: Dataset; member: Member; date: string }) {
  const row = rowsForDate(data, date).find(r => r.member.id === member.id);
  const latest = member.history.findLast(o => o.visible);
  const history = member.history;
  const visible = history.filter(o => o.visible);
  const name = row?.name ?? latest?.name ?? member.id;
  return <>
    <a href={`#/?date=${date}`} className="back-link"><Icon name="back" size={17} /> Back to alliance overview</a>
    <section className="panel profile-header"><div className="profile-identity"><span className="avatar large">{Array.from(name)[0]}</span><div><span className="eyebrow">PERSONNEL DOSSIER · {member.id}</span><h1>{name}</h1><span className="subtle">Selected snapshot: {formatDate(date)} · {row?.status ?? 'Not yet observed'}</span></div></div><RankBadge rank={row?.status === 'active' ? row.observation?.rank : null} /></section>
    {row?.status !== 'active' && <div className="notice">{row?.status === 'departed' ? 'Confirmed departure retained in the historical record.' : 'This player was not observed on the selected date.'} Selected-date power is unknown; the latest values below are explicitly historical.</div>}
    <div className="profile-stats">{[
      ['Selected-date power', row?.status === 'active' ? formatPower(row.observation?.power) : '—'],
      ['Latest recorded power', formatPower(latest?.power)],
      ['Latest HQ / rank', `${latest?.level ?? '—'} / ${latest?.rank ?? '—'}`],
      ['Latest activity', latest?.activityText === 'online' ? 'Online' : latest?.activityText ?? 'Unknown'],
    ].map(([label, value]) => <div className="panel" key={label}><span className="eyebrow">{label}</span><strong>{value}</strong></div>)}</div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ALL AVAILABLE OBSERVATIONS</span><h2>Power evolution</h2></div><span className="subtle">First: {visible[0] ? formatDate(visible[0].date) : '—'}<br />Latest: {latest ? formatDate(latest.date) : '—'}</span></div><Suspense fallback={<div className="chart-container empty-state">Loading chart…</div>}><PowerChart member={member} dates={data.dates} /></Suspense><p className="panel-note">Markers are measured observations; lines are visual guides between adjacent captures. Gaps remain unconnected. Power fluctuations can reflect army composition and do not imply poor performance.</p></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">POWER · RANK · HQ · ACTIVITY</span><h2>Observation history</h2></div></div><div className="table-scroll" role="region" aria-label="Player observation history" tabIndex={0}><table><thead><tr><th>Date</th><th>Name</th><th>Rank</th><th>HQ</th><th>Power</th><th>Change</th><th>Activity</th><th>Observation</th></tr></thead><tbody>{history.map(o => <tr key={o.date}><th scope="row">{formatDate(o.date)}</th><td>{o.name}</td><td><RankBadge rank={o.rank} /></td><td>{o.level ?? '—'}</td><td>{formatPower(o.visible ? o.power : null)}</td><td><Change change={powerChange(o, history.filter(p => p.date < o.date && p.visible).at(-1) ?? null)} /></td><td>{o.activityText === 'online' ? 'Online' : o.activityText ?? '—'}<small>{classifyActivity(o)}</small></td><td>{o.visible ? 'Observed' : 'Unobserved'}</td></tr>)}</tbody></table></div></section>
    {!!member.events.length && <section className="panel"><div className="panel-heading"><h2>Membership events</h2></div>{member.events.map(event => <p className="panel-note" key={`${event.recorded_on}:${event.event_type}`}>{event.event_type === 'departure' ? 'Departure' : 'Rejoin'} confirmed on {formatDate(event.recorded_on)}. Effective date: {event.effective_date ? formatDate(event.effective_date) : 'unknown'}. Source: {event.source}.</p>)}</section>}
  </>;
}
