import type { MemberRow } from '../types/member.ts';
import { ACTIVITIES, formatPower, memberHref } from '../utils/statistics.ts';
import { RankBadge } from './MemberTable.tsx';
import { Icon } from './Icons.tsx';

export default function ActivityMonitor({ rows, date }: { rows: MemberRow[]; date: string }) {
  const active = rows.filter(r => r.status === 'active');
  const flagged = active.filter(r => r.activity === 'Review Required');
  return <section className="panel" id="activity" aria-labelledby="activity-title">
    <div className="panel-heading"><div><span className="eyebrow">PARTICIPATION INTELLIGENCE</span><h2 id="activity-title">Activity monitor</h2></div><Icon name="pulse" /></div>
    <div className="activity-categories">{ACTIVITIES.map((category, i) => <div key={category}><span className={`activity-marker marker-${i}`} /><strong>{active.filter(r => r.activity === category).length}</strong><span>{category}</span><small>{['At capture time', 'Less than 24 hours', '1 to under 5 days', '5 days or longer', 'No activity data'][i]}</small></div>)}</div>
    <div className="inset-heading"><h3>Administrative review <span className="count-badge">{flagged.length}</span></h3><span className="warning-text">5+ days away</span></div>
    {flagged.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Players flagged for activity review"><table><thead><tr><th>Player</th><th>Rank</th><th>Power</th><th>Observed inactivity</th></tr></thead><tbody>{flagged.map(row => <tr key={row.member.id}><th scope="row"><a href={memberHref(row.member.id, date)}>{row.name}</a></th><td><RankBadge rank={row.observation?.rank} /></td><td>{formatPower(row.observation?.power)}</td><td className="warning-text">{row.observation?.activityText ?? 'Unknown'}</td></tr>)}</tbody></table></div> : <p className="empty-state compact">No observed members meet the five-day review threshold.</p>}
    <p className="panel-note">Review flags are advisory. No automatic demotion or expulsion. Last-seen values describe the capture moment, not daily playtime or session duration.</p>
  </section>;
}
