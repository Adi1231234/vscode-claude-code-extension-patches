/* The host half, loaded with vscode stubbed, against real files and a real git
 * repository in a throwaway folder. Each test file gets a folder of its own. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-host-'));
process.env.USERPROFILE = path.join(root, 'home');
process.env.LOCALAPPDATA = path.join(root, 'local');
process.env.TEMP = process.env.TMP = path.join(root, 'temp');
const ledgerDir = path.join(process.env.LOCALAPPDATA, 'claude-code-patches', 'created-files');
fs.mkdirSync(ledgerDir, { recursive: true });

const trashed = [];
const editor = { clipboard: '' };
const vscodeStub = {
  Uri: { file: (p) => ({ fsPath: p }) },
  commands: { executeCommand: async () => {} },
  env: { clipboard: { writeText: async (t) => { editor.clipboard = t; } } },
  workspace: { fs: { delete: async (uri) => { trashed.push(uri.fsPath); fs.rmSync(uri.fsPath); } } }
};
const load = (name) => new Function('require', fs.readFileSync(path.join(__dirname, '..', 'host', name), 'utf8'))(
  (m) => (m === 'vscode' ? vscodeStub : require(m)));
require('../host/load-order.json').forEach(load);

const touch = (...parts) => {
  const p = path.join(root, ...parts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x');
  return p;
};
const ledger = (id, paths) => fs.writeFileSync(path.join(ledgerDir, id + '.jsonl'),
  paths.map((p) => JSON.stringify({ t: '2026-11-19T00:00:00Z', op: 'new', path: p })).join('\r\n') + '\r\n');

/* A ledger of exact events: { op, path, ...anything else the line carries }. */
const events = (id, list) => fs.writeFileSync(path.join(ledgerDir, id + '.jsonl'),
  list.map((e) => JSON.stringify(Object.assign({ t: '2026-11-19T00:00:00Z' }, e))).join('\r\n') + '\r\n');

/* A chat's transcript in its project folder (or a subagent's), from lines given as
   objects; and a file in the chat's scratchpad. */
function transcript(id, lines, opts) {
  const o = opts || {}, dir = path.join(root, 'home', '.claude', 'projects', o.slug || 'C--proj');
  const file = o.agent ? path.join(dir, id, 'subagents', `agent-${o.agent}.jsonl`) : path.join(dir, `${id}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return file;
}
const said = (t) => ({ type: 'user', message: { role: 'user', content: 'hi' }, timestamp: new Date(t).toISOString() });
const wrote = (p, t, type) => ({ type: 'user', timestamp: new Date(t).toISOString(),
  toolUseResult: Object.assign(type ? { type } : {}, { filePath: p, structuredPatch: [], content: 'x' }) });
/* A subagent's Write as its transcript has it: the call, then its result, with no toolUseResult (CLI 2.1.330). */
const called = (p, t, id, result) => [
  { type: 'assistant', timestamp: new Date(t).toISOString(), message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Write', input: { file_path: p, content: 'x' } }] } },
  { type: 'user', timestamp: new Date(t).toISOString(), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: result || 'File created successfully at: ' + p }] } },
];
const scratch = (id, ...parts) => touch('temp', 'claude', 'C--proj', id, 'scratchpad', ...parts);

function repo(name) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir);
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  return { git, commitAll: () => { git('add', '-A'); git('commit', '-qm', 'x'); } };
}

/* A panel with its dialog open: next() is the next message carrying the tree's
   rows, with `files` added - the file rows it shows. */
function panel() {
  const got = [];
  let waiting = null;
  let dispose = () => {};
  const webview = {
    postMessage: async (m) => {
      got.push(m);
      if (m.rows) m.files = m.rows.filter((r) => r.kind === 'file');
      if (waiting && m.rows) { waiting(m); waiting = null; }
      return true;
    }
  };
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

/* The messages a panel gets until one passes `done`. The host posts only when
   something a panel shows changed, and a look at what a dialog shows can land
   between two steps, so a step awaits the message it means, not the next one. */
async function until(view, done) {
  for (let i = 0; i < 50; i++) {
    const m = await view.next();
    if (done(m)) return m;
  }
  throw new Error('never came');
}

/* The next tree with every folder open: each closed one is opened, once. */
async function opened(view, first) {
  const asked = new Set();
  for (let m = await first; ; m = await view.next()) {
    const closed = m.rows.filter((r) => r.kind === 'dir' && !r.open);
    if (!closed.length) return m;
    closed.filter((r) => !asked.has(r.key)).forEach((r) => { asked.add(r.key); send(view, { op: 'toggle', key: r.key }); });
  }
}

async function open(id) {
  const view = panel();
  const first = view.next();
  send(view, { op: 'subscribe', sessionId: id });
  send(view, { op: 'view', open: true });
  return { view, data: await opened(view, first) };
}
const names = (m) => m.files.map((f) => f.name).sort();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(tests) {
  let failed = 0;
  for (const [name, test] of Object.entries(tests)) {
    try { await test(); console.log('ok   ' + name); }
    catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
  }
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) {}
  console.log(failed ? failed + ' failed' : 'all passed');
  process.exit(failed ? 1 : 0);
}

module.exports = { root, ledgerDir, trashed, editor, touch, ledger, events, transcript, said, wrote, called, scratch, repo, panel, send, until, open, names, wait, run };
