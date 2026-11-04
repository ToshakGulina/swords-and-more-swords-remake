import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

for (const name of readdirSync('tools').filter(n => n.startsWith('test_') && n.endsWith('.mjs')).sort()) {
  const result = spawnSync(process.execPath, [`tools/${name}`], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
