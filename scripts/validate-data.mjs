import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateDailyData, validateTimeline } from '../src/utils/validation.ts';

const directory = fileURLToPath(new URL('../public/data/', import.meta.url));
const filenames = (await readdir(directory)).filter(name => name.endsWith('.json') && name !== 'index.json').sort();
const errors = [];
const snapshots = [];
for (const filename of filenames) {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(filename)) { errors.push(`${filename}: expected YYYY-MM-DD.json`); continue; }
  try {
    const data = JSON.parse(await readFile(`${directory}/${filename}`, 'utf8'));
    const issues = validateDailyData(data, filename);
    errors.push(...issues);
    if (data.date !== filename.slice(0, -5)) errors.push(`${filename}: date must match the filename`);
    if (!issues.length) snapshots.push(data);
  } catch (error) { errors.push(`${filename}: invalid JSON — ${error.message}`); }
}
if (!errors.length) errors.push(...validateTimeline(snapshots));
if (errors.length) {
  console.error(`Data validation failed (${errors.length} errors):\n${errors.map(e => `  - ${e}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const manifest = { schema_version: 2, last_updated: snapshots.at(-1)?.date ?? null, files: filenames };
  await writeFile(`${directory}/index.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Validated ${snapshots.length} daily snapshots, ${new Set(snapshots.flatMap(s => s.observations.map(o => o.player_id))).size} unique identities. Updated data/index.json.`);
}
