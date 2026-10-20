import { useEffect, useMemo, useState } from 'react';
import type { Activity, MemberRow, Rank, Status } from '../types/member.ts';
import { ACTIVITIES, formatPower, memberHref, RANKS } from '../utils/statistics.ts';
import { Icon } from './Icons.tsx';

export function RankBadge({ rank }: { rank: Rank | null | undefined }) {
  return rank ? <span className={`rank rank-${rank}`}>{rank}</span> : <span className="muted">—</span>;
}

export function Change({ change }: { change: MemberRow['change'] }) {
  if (!change) return <span className="muted">—</span>;
  const { absolute, percent } = change;
  return <span className={absolute > 0 ? 'positive' : absolute < 0 ? 'negative' : 'muted'}>
    {absolute > 0 ? '+' : absolute < 0 ? '−' : ''}{formatPower(Math.abs(absolute))}
    {percent !== null && <small>{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</small>}
  </span>;
}

export default function MemberTable({ rows, date }: { rows: MemberRow[]; date: string }) {
  const [search, setSearch] = useState('');
  const [rank, setRank] = useState<Rank | ''>('');
  const [status, setStatus] = useState<Status | 'all'>('active');
  const [activity, setActivity] = useState<Activity | ''>('');
  const [sort, setSort] = useState<'power' | 'level' | 'name' | 'change'>('power');
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [date, search, rank, status, activity, sort, descending]);
  const visible = useMemo(() => rows.filter(row => row.name.toLocaleLowerCase('en').includes(search.toLocaleLowerCase('en')) &&
    (status === 'all' || row.status === status) && (!rank || row.observation?.rank === rank) && (!activity || row.activity === activity))
    .sort((a, b) => {
      if (sort === 'name') return (descending ? -1 : 1) * a.name.localeCompare(b.name, 'en');
      const val = (r: MemberRow) => r.status !== 'active' ? null : sort === 'change' ? r.change?.absolute ?? null : sort === 'level' ? r.observation?.level ?? null : r.observation?.power ?? null;
      const av = val(a), bv = val(b);
      if (av === null || bv === null) return av === null && bv === null ? a.name.localeCompare(b.name, 'en') : av === null ? 1 : -1;
      return (descending ? bv - av : av - bv) || a.name.localeCompare(b.name, 'en');
    }), [rows, search, rank, status, activity, sort, descending]);
  function changeSort(key: typeof sort) {
    if (key === sort) setDescending(v => !v); else { setSort(key); setDescending(key !== 'name'); }
  }
  const sortHeading = (key: typeof sort, label: string) => <button className="sort-button" onClick={() => changeSort(key)}>{label} <span>{sort === key ? descending ? '↓' : '↑' : '↕'}</span></button>;
  const pages = Math.max(1, Math.ceil(visible.length / 25));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * 25;
  return <section className="panel roster" id="roster" aria-labelledby="roster-title">
    <div className="panel-heading"><div><span className="eyebrow">ALLIANCE PERSONNEL</span><h2 id="roster-title">Member ranking <span className="count-badge">{rows.filter(r => r.status === 'active').length}</span></h2></div><span className="subtle desktop-only">Select a player to view their history <Icon name="arrow" size={15} /></span></div>
    <div className="table-controls">
      <label className="search-box"><Icon name="search" size={18} /><span className="sr-only">Search players</span><input type="search" placeholder="Search players…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label><span className="sr-only">Alliance rank</span><select aria-label="Alliance rank" value={rank} onChange={e => setRank(e.target.value as Rank | '')}><option value="">All ranks</option>{RANKS.map(r => <option key={r}>{r}</option>)}</select></label>
      <label><span className="sr-only">Membership status</span><select aria-label="Membership status" value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="active">Active members</option><option value="all">All records</option><option value="departed">Departed</option><option value="unobserved">Unobserved</option></select></label>
      <label><span className="sr-only">Activity</span><select aria-label="Activity" value={activity} onChange={e => setActivity(e.target.value as Activity | '')}><option value="">All activity</option>{ACTIVITIES.map(a => <option key={a}>{a}</option>)}</select></label>
      <label className="mobile-sort"><span className="sr-only">Sort members</span><select aria-label="Sort members" value={`${sort}:${descending}`} onChange={e => { const [s, d] = e.target.value.split(':'); setSort(s as typeof sort); setDescending(d === 'true'); }}><option value="power:true">Power: highest</option><option value="power:false">Power: lowest</option><option value="level:true">HQ: highest</option><option value="level:false">HQ: lowest</option><option value="name:false">Name: A–Z</option><option value="change:true">Power change</option></select></label>
    </div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Member ranking table; scroll horizontally for all columns">
      <table><thead><tr><th scope="col">#</th><th scope="col" aria-sort={sort === 'name' ? descending ? 'descending' : 'ascending' : 'none'}>{sortHeading('name', 'Player')}</th><th scope="col">Rank</th><th scope="col" aria-sort={sort === 'level' ? descending ? 'descending' : 'ascending' : 'none'}>{sortHeading('level', 'HQ')}</th><th scope="col" aria-sort={sort === 'power' ? descending ? 'descending' : 'ascending' : 'none'}>{sortHeading('power', 'Power')}</th><th scope="col" aria-sort={sort === 'change' ? descending ? 'descending' : 'ascending' : 'none'}>{sortHeading('change', 'Power change')}</th><th scope="col">Last online</th><th scope="col">Status</th></tr></thead>
        <tbody>{visible.slice(start, start + 25).map(row => <tr key={row.member.id} className={row.change?.percent !== null && Math.abs(row.change?.percent ?? 0) >= 10 ? 'notable' : ''}>
          <td className="position">{row.position ? String(row.position).padStart(2, '0') : '—'}</td>
          <th scope="row"><a className="player-link" href={memberHref(row.member.id, date)}><span className={`avatar rank-color-${row.observation?.rank ?? 'none'}`}>{Array.from(row.name)[0]?.toUpperCase()}</span><span>{row.name}<small>{row.member.id}</small></span></a></th>
          <td><RankBadge rank={row.status === 'active' ? row.observation?.rank : null} /></td><td>{row.status === 'active' ? row.observation?.level ?? '—' : '—'}</td>
          <td className="power-cell">{row.status === 'active' ? formatPower(row.observation?.power) : '—'}</td><td><Change change={row.change} /></td>
          <td><span className={`activity-dot ${row.activity === 'Online' ? 'online' : row.activity === 'Review Required' ? 'warning' : ''}`} />{row.status === 'active' ? row.observation?.activityText === 'online' ? 'Online' : row.observation?.activityText ?? 'Unknown' : '—'}</td>
          <td><span className={`status status-${row.status}`}>{row.status === 'active' ? 'Active' : row.status === 'departed' ? 'Departed' : 'Unobserved'}</span></td>
        </tr>)}</tbody></table>
      {!visible.length && <div className="empty-state">No players match these filters.</div>}
    </div>
    <div className="table-footer"><span aria-live="polite">Showing {visible.length ? start + 1 : 0}–{Math.min(start + 25, visible.length)} of {visible.length} matching members</span><div className="pagination"><button disabled={currentPage === 1} onClick={() => setPage(p => p - 1)} aria-label="Previous roster page">←</button><span>{currentPage} / {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(p => p + 1)} aria-label="Next roster page">→</button></div><span>Changes compare recorded observations.</span></div>
  </section>;
}
