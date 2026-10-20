import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Member } from '../types/member.ts';
import { formatDate, formatPower } from '../utils/statistics.ts';

export default function PowerChart({ member, dates }: { member: Member; dates: string[] }) {
  const first = member.history[0]?.date;
  const points = dates.filter(date => !first || date >= first).map(date => {
    const observation = member.history.find(o => o.date === date);
    return { date, power: observation?.visible ? observation.power : null };
  });
  return <div className="chart-container" role="img" aria-label={`Power history for ${member.history.at(-1)?.name}. Only recorded values are shown. Exact values are in the observation table below.`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points} margin={{ top: 16, right: 20, bottom: 10, left: 0 }} accessibilityLayer>
        <CartesianGrid stroke="#26303b" strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="date" tickFormatter={d => String(d).slice(5)} stroke="#8e9aab" fontSize={12} tickLine={false} axisLine={false} padding={{ left: 20, right: 20 }} />
        <YAxis tickFormatter={v => formatPower(Number(v))} stroke="#8e9aab" fontSize={12} tickLine={false} axisLine={false} width={65} domain={['auto', 'auto']} />
        <Tooltip labelFormatter={v => formatDate(String(v))} formatter={v => [formatPower(Number(v)), 'Observed power']} contentStyle={{ background: '#17202b', border: '1px solid #3b4756', borderRadius: 8, color: '#edf1f5' }} />
        <Line type="linear" dataKey="power" stroke="#d8b46a" strokeWidth={2.5} connectNulls={false} dot={{ r: 5, fill: '#d8b46a', stroke: '#17202b', strokeWidth: 3 }} activeDot={{ r: 7 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
