/* The host half, loaded with vscode stubbed, against real files and a real git
 * repository in a throwaway folder.
 *
 *   node patches/created-files/tests/host.test.js
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-host-'));
process.env.USERPROFILE = path.join(root, 'home');
process.env.LOCALAPPDATA = path.join(root, 'local');
const ledgerDir = path.join(process.env.LOCALAPPDATA, 'claude-code-patches', 'created-files');
fs.mkdirSync(ledgerDir, { recursive: true });

const trashed = [];
let clipboard = '';
const vscodeStub = {
  Uri: { file: (p) => ({ fsPath: p }) },
  commands: { executeCommand: async () => {} },
  env: { clipboard: { writeText: async (t) => { clipboard = t; } } },
  workspace: { fs: { delete: async (uri) => { trashed.push(uri.fsPath); fs.rmSync(uri.fsPath); } } }
};
const load = (name) => new Function('require', fs.readFileSync(path.join(__dirname, '..', 'host', name), 'utf8'))(
  (m) => (m === 'vscode' ? vscodeStub : require(m)));
['tracked.js', 'ledger.js', 'actions.js', 'live.js'].forEach(load);

const touch = (...parts) => {
  const p = path.join(root, ...parts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x');
  return p;
};
const ledger = (id, paths) => fs.writeFileSync(path.join(ledgerDir, id + '.jsonl'),
  paths.map((p) => JSON.stringify({ t: '2026-11-19T00:00:00Z', op: 'new', path: p })).join('\r\n') + '\r\n');

function panel() {
  const got = [];
  let waiting = null;
  let dispose = () => {};
  const webview = { postMessage: async (m) => { got.push(m); if (waiting) { waiting(m); waiting = null; } return true; } };
  return {
    webview, got,
    onDidDispose: (fn) => { dispose = fn; },
    dispose: () => dispose(),
    next: () => new Promise((resolve, reject) => {
      waiting = resolve;
      setTimeout(() => reject(new Error('no message from the host')), 8000).unref();
    })
  };
}
const send = (view, msg) => globalThis.__ccCF.handle(Object.assign({ type: 'ccCF' }, msg), view);
async function open(id) {
  const view = panel();
  const first = view.next();
  send(view, { op: 'subscribe', sessionId: id });
  return { view, data: await first };
}
const names = (m) => m.files.map((f) => f.name).sort();

const tests = {
  async 'only the chat\'s own leftovers are listed'() {
    const repo = path.join(root, 'repo');
    fs.mkdirSync(repo);
    const git = (...a) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    const committed = touch('repo', 'src', 'app.ts');
    git('add', '-A'); git('commit', '-qm', 'x');
    const folder = path.join(root, 'folder');
    fs.mkdirSync(folder);
    ledger('listed', [
      committed, folder,
      touch('repo', '.git', 'objects', 'ab', 'cdef'),
      touch('wt', '.git'),
      touch('home', '.claude', 'projects', 'p', 'chat.jsonl'),
      path.join(root, 'gone.txt'),
      touch('repo', 'left-behind.log'),
      touch('outside.txt')
    ]);
    const { view, data } = await open('listed');
    assert.deepStrictEqual(names(data), ['left-behind.log', 'outside.txt']);
    assert.strictEqual(data.total, 2);
    view.dispose();
  },

  async 'a stray .git folder does not hide the files below it'() {
    fs.mkdirSync(path.join(root, 'stray', '.git'), { recursive: true });
    ledger('stray', [touch('stray', 'deep', 'kept.log')]);
    const { view, data } = await open('stray');
    assert.deepStrictEqual(names(data), ['kept.log']);
    view.dispose();
  },

  async 'a damaged ledger does not break the list'() {
    const ok = touch('damaged-ok.txt');
    fs.writeFileSync(path.join(ledgerDir, 'bad.jsonl'),
      'null\n42\n{"op":"new"}\n{half\n' + JSON.stringify({ op: 'new', path: ok, t: 'x' }) + '\n');
    const { view, data } = await open('bad');
    assert.deepStrictEqual(names(data), ['damaged-ok.txt']);
    view.dispose();
  },

  async 'delete reaches only a file on this chat\'s list'() {
    const mine = touch('del', 'mine.txt');
    const other = touch('del', 'not-listed.txt');
    ledger('del', [mine]);
    const { view } = await open('del');
    const after = view.next();
    send(view, { op: 'delete', path: other });
    send(view, { op: 'delete', path: mine.toUpperCase() });
    assert.strictEqual((await after).total, 0);
    assert.deepStrictEqual(trashed.splice(0), [mine]);
    assert.ok(fs.existsSync(other), 'a path off the list is left alone');
    view.dispose();
  },

  async 'the list is capped, while copy and delete all cover every file'() {
    const many = Array.from({ length: 320 }, (_, i) => touch('many', `f${i}.txt`));
    ledger('many', many);
    const { view, data } = await open('many');
    assert.strictEqual(data.files.length, 300);
    assert.strictEqual(data.total, 320);
    const copied = view.next();
    send(view, { op: 'copyAll' });
    assert.strictEqual((await copied).copied, 320);
    assert.strictEqual(clipboard.split('\n').length, 320);
    const after = view.next();
    send(view, { op: 'deleteAll' });
    assert.strictEqual((await after).total, 0);
    assert.strictEqual(trashed.splice(0).length, 320);
    view.dispose();
  },

  async 'a new ledger line is pushed, and a disposed panel hears nothing more'() {
    const a = touch('push', 'a.txt');
    ledger('push', [a]);
    const { view } = await open('push');
    const pushed = view.next();
    ledger('push', [a, touch('push', 'b.txt')]);
    assert.strictEqual((await pushed).total, 2);
    view.dispose();
    const before = view.got.length;
    ledger('push', [a]);
    await new Promise((r) => setTimeout(r, 900));
    assert.strictEqual(view.got.length, before);
  },

  async 'an action from a panel that never subscribed does nothing'() {
    const file = touch('stranger.txt');
    ledger('stranger', [file]);
    assert.strictEqual(send(panel(), { op: 'deleteAll' }), true);
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(fs.existsSync(file));
  }
};

(async () => {
  let failed = 0;
  for (const [name, run] of Object.entries(tests)) {
    try { await run(); console.log('ok   ' + name); }
    catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
  }
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) {}
  console.log(failed ? failed + ' failed' : 'all passed');
  process.exit(failed ? 1 : 0);
})();
