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
const scratch = (id, ...parts) => touch('temp', 'claude', 'C--proj', id, 'scratchpad', ...parts);

function repo(name) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir);
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  return { git, commitAll: () => { git('add', '-A'); git('commit', '-qm', 'x'); } };
}

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

module.exports = { root, ledgerDir, trashed, editor, touch, ledger, events, transcript, said, wrote, scratch, repo, panel, send, open, names, wait, run };
