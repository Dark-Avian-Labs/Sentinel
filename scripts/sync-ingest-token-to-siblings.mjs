/**
 * Copy SENTINEL_INGEST_* from Sentinel into sibling app env files.
 * Usage: node scripts/sync-ingest-token-to-siblings.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from '@dotenvx/dotenvx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sentinelRoot = path.resolve(__dirname, '..');
const labsRoot = path.resolve(sentinelRoot, '..');

function loadSentinelEnv(file) {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('SENTINEL_') || k.startsWith('DOTENV_PRIVATE')) delete process.env[k];
  }
  loadEnv({ path: path.join(sentinelRoot, '.env.keys'), quiet: true, overload: true });
  loadEnv({ path: path.join(sentinelRoot, file), quiet: true, overload: true });
  return {
    token: (process.env.SENTINEL_INGEST_TOKEN ?? '').trim(),
  };
}

const siblings = ['Outfitter', 'Armory', 'BudgetPlanner', 'Codex'];
const pairs = [
  ['.env.development', 'http://127.0.0.1:3005/api/ingest'],
  ['.env.production', 'http://127.0.0.1:3005/api/ingest'],
];

for (const [file, ingestUrl] of pairs) {
  const { token } = loadSentinelEnv(file);
  if (!token) {
    console.error('SENTINEL_INGEST_TOKEN missing in Sentinel', file);
    process.exit(1);
  }
  for (const app of siblings) {
    const root = path.join(labsRoot, app);
    const envPath = path.join(root, file);
    if (!fs.existsSync(envPath)) continue;
    for (const [key, value] of [
      ['SENTINEL_INGEST_URL', ingestUrl],
      ['SENTINEL_INGEST_TOKEN', token],
    ]) {
      const r = spawnSync(
        'pnpm',
        ['exec', 'dotenvx', 'set', key, value, '-f', file, '--no-native', '--no-armor'],
        { cwd: root, encoding: 'utf8', shell: true },
      );
      if (r.status !== 0) {
        console.error(app, file, key, r.stderr || r.stdout);
        process.exit(r.status ?? 1);
      }
    }
    console.log('set', app, file);
  }
}
