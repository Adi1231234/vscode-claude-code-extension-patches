/* Every agent-input suite, no editor needed.
 *
 *     node patches/agent-input/tests/run-all.mjs */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const f of ['deliver.test.js', 'agent-store.test.js', 'mods.test.js']) {
    const r = spawnSync(process.execPath, [join(here, f)], { encoding: 'utf8' });
    const out = (r.stdout + r.stderr).trim();
    console.log(`  ${f.padEnd(22)} ${out.split(/\r?\n/).slice(-1)[0]}`);
    if (r.status !== 0) { failed++; console.log(out); }
}
console.log(failed ? `\n  ${failed} suite(s) failed` : '\n  all suites passed');
process.exitCode = failed ? 1 : 0;
