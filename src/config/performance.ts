export interface PerformanceThresholds {
  significantDeclinePercent: number;
  stableChangePercent: number;
  sustainedDeclineIntervals: number;
  sustainedDeclineDays: number;
  inactivityReviewDays: number;
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: Readonly<PerformanceThresholds> = Object.freeze({
  significantDeclinePercent: 5,
  stableChangePercent: 1,
  sustainedDeclineIntervals: 2,
  sustainedDeclineDays: 2,
  inactivityReviewDays: 5,
});

export function validatePerformanceThresholds(config: PerformanceThresholds): string[] {
  const errors: string[] = [];
  if (Object.values(config).some(v => !Number.isFinite(v))) errors.push('All thresholds must be finite numbers.');
  if (config.significantDeclinePercent <= 0 || config.significantDeclinePercent > 100) errors.push('Power decline threshold must be greater than 0 and at most 100%.');
  if (config.stableChangePercent < 0 || config.stableChangePercent >= config.significantDeclinePercent) errors.push('Minor fluctuation threshold must be nonnegative and below the decline threshold.');
  if (!Number.isInteger(config.sustainedDeclineIntervals) || config.sustainedDeclineIntervals < 2) errors.push('A sustained trend requires at least two consecutive declining intervals.');
  if (config.sustainedDeclineDays < 1 || config.inactivityReviewDays < 1) errors.push('Duration thresholds must be at least one day.');
  return errors;
}
