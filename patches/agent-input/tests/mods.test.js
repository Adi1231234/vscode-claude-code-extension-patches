/* The mods folder on the CLI's spawn: lib/js/ccMods.js, the way
 * lib/Mods.ps1 writes it (its placeholder filled).
 *
 *     node patches/agent-input/tests/mods.test.js
 *
 * Pinned: no --plugin-dir while the folder is missing, and the folder itself -
 * not one mod in it - once it is there, so the CLI loads every mod in it. */
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); };

const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmods-'));
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'lib', 'js', 'ccMods.js'), 'utf8').replace('__MODSDIR__', 'patches-mods');
const ctx = { require, __dirname: extDir };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);

ok(JSON.stringify(ctx.__ccMods.args()) === '{}', 'no --plugin-dir while the mods folder is missing');
fs.mkdirSync(path.join(extDir, 'patches-mods', 'agent-input'), { recursive: true });
ok(ctx.__ccMods.args()['plugin-dir'] === path.join(extDir, 'patches-mods'), 'the folder of mods once it is there');

fs.rmSync(extDir, { recursive: true, force: true });
console.log(pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
process.exitCode = fail ? 1 : 0;
