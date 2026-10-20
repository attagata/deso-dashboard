import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { Rank } from '../types/member.ts';
import { RANKS } from '../utils/statistics.ts';
import { RankBadge } from './MemberTable.tsx';

export const rankColors = ['#d8b46a', '#a993cf', '#719abb', '#789f91', '#798492'];

export default function RankDistribution({ ranks, active }: { ranks: Record<Rank, number>; active: number }) {
  const data = RANKS.map((rank, i) => ({ name: rank, value: ranks[rank], color: rankColors[i] }));
  return <section className="panel rank-panel" aria-labelledby="rank-title">
    <div className="panel-heading"><div><span className="eyebrow">CHAIN OF COMMAND</span><h2 id="rank-title">Rank distribution</h2></div><span className="panel-icon">◇</span></div>
    <div className="rank-content"><div className="donut-wrap" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={data} dataKey="value" innerRadius="71%" outerRadius="94%" startAngle={90} endAngle={-270} paddingAngle={active > 0 ? 4 : 0} stroke="none" isAnimationActive={false}>{data.map(d => <Cell key={d.name} fill={d.color} />)}</Pie></PieChart></ResponsiveContainer><div className="donut-center"><strong>{active}</strong><span>MEMBERS</span></div></div>
      <ul className="rank-legend">{data.map(d => <li key={d.name}><RankBadge rank={d.name} /><span className="rank-track"><span style={{ width: `${active ? d.value / active * 100 : 0}%`, background: d.color }} /></span><strong>{d.value}</strong></li>)}</ul>
    </div><p className="panel-note">Observed ranks on the selected date. Unknown ranks are excluded.</p>
  </section>;
}
