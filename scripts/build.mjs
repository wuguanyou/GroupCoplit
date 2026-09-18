import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
// Only the build output of this repository is removed, never user data.
rmSync(resolve(root, 'dist'), { recursive: true, force: true });
const r = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/vinext/dist/cli.js'), 'build'],
  { cwd: root, stdio: 'inherit' },
);
process.exit(r.status ?? 1);
