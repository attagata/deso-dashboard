import { useEffect, useState } from 'react';
import type { Dataset } from './types/member.ts';
import { loadData } from './services/dataService.ts';
import { formatDate } from './utils/statistics.ts';
import Dashboard from './components/Dashboard.tsx';
import MemberDetails from './components/MemberDetails.tsx';
import { Icon } from './components/Icons.tsx';

function readRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const [path, query] = hash.split('?');
  let memberId: string | null = null;
  try { memberId = path.startsWith('/member/') ? decodeURIComponent(path.slice(8)) : null; } catch { /* invalid URL becomes not found */ }
  return { memberId, date: new URLSearchParams(query).get('date') };
}

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal).then(setData).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load alliance data.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const date = data && route.date && data.dates.includes(route.date) ? route.date : data?.dates.at(-1) ?? '';
  const member = data?.members.find(m => m.id === route.memberId);
  function navigateSection(id: string) {
    if (route.memberId) {
      window.location.hash = `/?date=${date}`;
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView()));
    } else document.getElementById(id)?.scrollIntoView();
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <aside className="sidebar"><a className="brand" href={`#/?date=${date}`}><img src={`${import.meta.env.BASE_URL}emblem.svg`} alt="" /><span>DESO<small>ALLIANCE COMMAND</small></span></a><div className="sidebar-label">OPERATIONS</div><nav aria-label="Main navigation"><a className={!route.memberId ? 'nav-item selected' : 'nav-item'} href={`#/?date=${date}`}><Icon name="grid" /><span>Overview</span></a><button className="nav-item" onClick={() => navigateSection('roster')}><Icon name="users" /><span>Members</span></button><button className="nav-item" onClick={() => navigateSection('activity')}><Icon name="pulse" /><span>Activity</span></button><button className="nav-item" onClick={() => navigateSection('movements')}><Icon name="arrow" /><span>Rank history</span></button><button className="nav-item" onClick={() => navigateSection('guidelines')}><Icon name="shield" /><span>Guidelines</span></button></nav><div className="sidebar-bottom"><span className="server-label"><span className="live-dot" /> SERVER {data?.snapshots.at(-1)?.alliance.server ?? '—'}</span><strong>Death Soldiers</strong><p>Last War: Survival</p><div className="read-only"><Icon name="shield" size={14} /> READ-ONLY INTELLIGENCE</div></div></aside>
    <div className="main-shell"><header className="topbar"><span className="breadcrumb">DESO <span>/</span> <strong>Alliance dashboard</strong></span><div className="topbar-right"><span className="updated">Updated <strong>{data?.dates.at(-1) ? formatDate(data.dates.at(-1)!) : '—'}</strong></span><label className="date-control"><Icon name="clock" size={16} /><span className="sr-only">Select snapshot date</span><select aria-label="Select snapshot date" value={date} disabled={!data?.dates.length} onChange={e => { window.location.hash = `${route.memberId ? `/member/${encodeURIComponent(route.memberId)}` : '/'}?date=${e.target.value}`; }}>{!data?.dates.length && <option value="">No snapshots</option>}{data?.dates.map(d => <option key={d} value={d}>{formatDate(d)}</option>)}</select></label></div></header>
      <main id="main-content" tabIndex={-1}>
        {error ? <section className="panel error-state" role="alert"><h1>Data unavailable</h1><p>{error}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></section> : !data ? <div className="loading-state" role="status"><img src={`${import.meta.env.BASE_URL}emblem.svg`} alt="" /><span className="eyebrow">LOADING ALLIANCE INTELLIGENCE</span></div> : !data.dates.length ? <section className="panel empty-state"><h1>Your command center is ready.</h1><p>No captures have been published yet. Add a daily JSON file and run data validation.</p></section> : <>
          {route.date && !data.dates.includes(route.date) && <p role="status" className="notice">No capture exists for {route.date}. Showing the latest recorded date: {formatDate(date)}.</p>}
          {route.memberId ? member ? <MemberDetails data={data} member={member} date={date} /> : <section className="panel empty-state"><h1>Player not found</h1><a href={`#/?date=${date}`}>Return to overview</a></section> : <Dashboard data={data} date={date} />}
        </>}
      </main><footer className="footer"><span><strong>DESO</strong> · © 2026 Anderson Tagata — ATTecnologies</span><span>Screenshot observations · No automatic administrative actions</span></footer>
    </div>
  </div>;
}
