import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Member } from '../types/member.ts';
import { DEFAULT_PERFORMANCE_THRESHOLDS, validatePerformanceThresholds } from '../config/performance.ts';
import type { PerformanceThresholds } from '../config/performance.ts';
import { analyzePerformance } from '../utils/performance.ts';
import { formatDate, formatPower } from '../utils/statistics.ts';
import { Change, RankBadge } from './MemberTable.tsx';

const fields: { key: keyof PerformanceThresholds; label: string; min: number; step: number; max?: number }[] = [
  { key: 'significantDeclinePercent', label: 'Significant decline (%)', min: 0.1, step: 0.1, max: 100 },
  { key: 'stableChangePercent', label: 'Minor growth threshold (%)', min: 0, step: 0.1 },
  { key: 'sustainedDeclineIntervals', label: 'Consecutive declining intervals', min: 2, step: 1 },
  { key: 'sustainedDeclineDays', label: 'Minimum trend duration (days)', min: 1, step: 1 },
  { key: 'inactivityReviewDays', label: 'Inactivity review (days)', min: 1, step: 1 },
];
const labelClass = (label: string) => label.toLowerCase().replaceAll(' ', '-');

export default function PerformanceAnalysis({ member, dates, date }: { member: Member; dates: string[]; date: string }) {
  const [config, setConfig] = useState<PerformanceThresholds>({ ...DEFAULT_PERFORMANCE_THRESHOLDS });
  const [errors, setErrors] = useState<string[]>([]);
  const analysis = useMemo(() => analyzePerformance(member, dates, date, config), [member, dates, date, config]);
  const label = analysis.latest?.label ?? 'Insufficient data';
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = Object.fromEntries(fields.map(({ key }) => [key, Number(form.get(key))])) as unknown as PerformanceThresholds;
    const issues = validatePerformanceThresholds(next);
    setErrors(issues);
    if (!issues.length) setConfig(next);
  }
  return <section className="panel performance-panel" aria-labelledby="performance-title">
    <div className="panel-heading"><div><span className="eyebrow">POWER · HQ · RANK · LOGIN · RECOVERY</span><h2 id="performance-title">Player performance analysis</h2></div><span className={`performance-label ${labelClass(label)}`}>{label}</span></div>
    <p className="analysis-context">Evidence through <strong>{formatDate(date)}</strong>. {analysis.departed ? 'Confirmed departure: this is a historical analysis, not a current member review.' : 'Labels describe observations; they are not promotion or demotion recommendations.'}</p>
    <div className="analysis-summary">
      <div><span>Starting recorded power</span><strong>{formatPower(analysis.startingPower?.power)}</strong><small>{analysis.startingPower ? formatDate(analysis.startingPower.date) : 'Unknown'}</small></div>
      <div><span>Latest recorded power</span><strong>{formatPower(analysis.latestPower?.power)}</strong><small>{analysis.latestPower ? formatDate(analysis.latestPower.date) : 'Unknown'}</small></div>
      <div><span>Historical power change</span><strong><Change change={analysis.historicalChange} /></strong><small>Between the dated power records above</small></div>
      <div><span>HQ progression</span><strong>{analysis.firstHQ?.level ?? '—'} → {analysis.latestHQ?.level ?? '—'}</strong><small>{analysis.firstHQ && analysis.latestHQ ? `${analysis.firstHQ.date} → ${analysis.latestHQ.date}` : 'Unknown'}</small></div>
      <div><span>Last observed login</span><strong>{analysis.latestLogin?.online === true ? 'Online' : analysis.latestLogin?.activityText ?? 'Unknown'}</strong><small>{analysis.latestLogin ? formatDate(analysis.latestLogin.date) : 'Unknown'} · point-in-time evidence</small></div>
      <div><span>Rank history</span><strong>{analysis.rankChanges.length} observed changes</strong><small>{analysis.rankChanges.length ? analysis.rankChanges.map(c => `${c.from.rank} → ${c.to.rank} (${c.from.date}–${c.to.date})`).join('; ') : 'No changes established between adjacent captures'}</small></div>
    </div>
    <div className="analysis-explanation">
      <h3>Power context</h3><p>Power can decrease because of troop losses, wounded troops or changes in military strength. Screenshots alone cannot identify the cause of a reduction. A loss does not establish inactivity, lack of commitment or poor performance.</p>
      <p>Troop losses, battle participation, hospital status, hero upgrades and research progression: <strong>Unknown</strong>. These details are not supplied by the roster data.</p>
      <p>Current power pattern: <strong>{analysis.latest?.powerLabel ?? 'Insufficient data'}</strong>. {analysis.latest?.sustainedDecline ? `Repeated downward pattern: at least ${config.sustainedDeclineIntervals} declining intervals over ${config.sustainedDeclineDays}+ days, with a cumulative loss of at least ${config.significantDeclinePercent}%.` : 'No sustained downward pattern is established at this point under the selected thresholds.'} A single reduction is an interval fluctuation; available captures cannot prove that it was temporary.</p>
    </div>
    <details className="analysis-settings"><summary>Analysis thresholds</summary><p>Defaults: {DEFAULT_PERFORMANCE_THRESHOLDS.significantDeclinePercent}% decline and {DEFAULT_PERFORMANCE_THRESHOLDS.inactivityReviewDays} days away. Changes apply to this profile analysis while it remains open; they do not alter alliance rules, source JSON or the dashboard activity monitor.</p><form onSubmit={apply}>
      <div className="threshold-grid">{fields.map(field => <label key={field.key}>{field.label}<input name={field.key} type="number" min={field.min} max={field.max} step={field.step} defaultValue={config[field.key]} required /></label>)}</div>
      {!!errors.length && <p role="alert" className="negative">{errors.join(' ')}</p>}<button className="primary-button" type="submit">Apply thresholds</button>
    </form><p>Stable includes minor growth up to the configured fluctuation threshold and reductions below the significant-decline rule. Growing means larger positive progression. Recovering means an increase during a tracked significant-loss cycle. Inactivity Review is shown separately from the power pattern.</p></details>
    <div className="inset-heading"><h3>Observation analysis</h3><span className="subtle">{analysis.fluctuations.length} decline / recovery observations</span></div>
    <div className="table-scroll" role="region" tabIndex={0} aria-label="Performance observations and daily power changes"><table><thead><tr><th>Date</th><th>Power</th><th>Interval change</th><th>Daily change</th><th>HQ / rank</th><th>Login</th><th>Analysis</th><th>Recovery evidence</th></tr></thead><tbody>{analysis.points.map(point => <tr key={point.date} className={point.significantDecline ? 'significant-power-loss' : ''}>
      <th scope="row">{formatDate(point.date)}</th><td>{formatPower(point.observation?.visible ? point.observation.power : null)}</td>
      <td><Change change={point.change} /><small>{point.change ? `${point.previousDate} → ${point.date} · ${point.intervalDays} day(s)` : 'No comparable adjacent captures'}</small>{point.significantDecline && <small className="warning-text">Reduction ≥ {config.significantDeclinePercent}%</small>}{point.sustainedDecline && <small className="warning-text">Repeated downward pattern</small>}</td>
      <td><Change change={point.dailyChange} /><small>{point.intervalDays === 1 ? 'Two captures one day apart' : 'Daily change not measured'}</small></td>
      <td>{point.observation?.visible ? point.observation.level ?? '—' : '—'} / <RankBadge rank={point.observation?.visible ? point.observation.rank : null} /></td><td>{point.observation?.online === true ? 'Online' : point.observation?.activityText ?? 'Unknown'}</td>
      <td><span className={`performance-label ${labelClass(point.label)}`}>{point.label}</span>{point.inactivityReview && <small>Power: {point.powerLabel}</small>}</td>
      <td>{point.recovery ? <><span className="positive">+{formatPower(point.recovery.regained)} from trough</span><small>{point.recovery.percentOfLoss.toFixed(1)}% of prior loss recovered</small><small>Baseline: {formatPower(point.recovery.baselinePower)} · {point.recovery.baselineDate}</small><small>Trough: {formatPower(point.recovery.troughPower)} · {point.recovery.troughDate}</small><small>{point.recovery.complete ? 'Baseline reached or exceeded' : 'Partial recovery'}</small></> : '—'}</td>
    </tr>)}</tbody></table></div>
    {!analysis.points.length && <p className="empty-state compact">No observations available through the selected date.</p>}
    <div className="analysis-monitoring"><h3>Suggested monitoring points</h3><ul>{analysis.monitoring.map(point => <li key={point}>{point}</li>)}</ul></div>
    <p className="panel-note">Power losses never independently trigger demotion recommendations. All indicators are descriptive; officers review context and retain decision authority. Missing measurements and uncertain identities interrupt trend and recovery tracking. Multi-day interval changes are not presented as measured daily changes.</p>
  </section>;
}
