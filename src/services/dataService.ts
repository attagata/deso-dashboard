import type { DailySnapshot, Dataset } from '../types/member.ts';
import { normalizeSnapshots } from '../utils/statistics.ts';
import { validateDailyData, validateTimeline } from '../utils/validation.ts';

async function fetchJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}?v=${Date.now()}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Unable to load ${path} (HTTP ${response.status}). Please refresh or contact an officer.`);
  try { return await response.json(); }
  catch { throw new Error(`${path} does not contain valid JSON.`); }
}

export async function loadData(signal: AbortSignal): Promise<Dataset> {
  const value = await fetchJson('index.json', signal);
  if (!value || typeof value !== 'object' || !('files' in value) || !Array.isArray(value.files) ||
    value.files.some((f: unknown) => typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}\.json$/.test(f))) throw new Error('Invalid data manifest. Run npm run validate:data before publishing.');
  const snapshots = await Promise.all((value.files as string[]).map(async file => {
    const raw = await fetchJson(file, signal);
    const errors = validateDailyData(raw, file);
    if (errors.length) throw new Error(errors.slice(0, 3).join('; '));
    const snapshot = raw as DailySnapshot;
    if (snapshot.date !== file.slice(0, -5)) throw new Error(`${file}: snapshot date does not match filename.`);
    return snapshot;
  }));
  const errors = validateTimeline(snapshots);
  if (errors.length) throw new Error(errors[0]);
  return normalizeSnapshots(snapshots);
}
