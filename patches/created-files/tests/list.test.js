/* What a chat's list may hold.   node patches/created-files/tests/list.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root, ledgerDir, touch, ledger, events, repo, open, names, run } = require('./harness');

const listed = async (id) => { const { view, data } = await open(id); view.dispose(); return names(data); };
const idOf = (p) => String(fs.statSync(p, { bigint: true }).ino);

run({
  async 'only the chat\'s own leftovers are listed'() {
    const r = repo('repo');
    const committed = touch('repo', 'src', 'app.ts');
    r.commitAll();
    const folder = path.join(root, 'folder');
    fs.mkdirSync(folder);
    ledger('listed', [
      committed, folder,
      touch('repo', '.git', 'objects', 'ab', 'cdef'),
      touch('wt', '.git'),
      touch('home', '.claude', 'projects', 'p', 'chat.jsonl'),
      touch('home', '.claude.json'),
      touch('home', '.claude.json.backup'),
      touch('local', 'claude-cli-nodejs', 'Cache', 'mcp.log'),
      `${touch('stream.txt')}:Zone.Identifier`,
      path.join(root, 'gone.txt'),
      touch('repo', 'left-behind.log'),
      touch('outside.txt')
    ]);
    assert.deepStrictEqual(await listed('listed'), ['left-behind.log', 'outside.txt']);
  },

  async 'a file that was only saved again is not the chat\'s'() {
    const a = touch('saved', 'config.ini'), b = touch('saved', 'settings.json');
    events('saved', [{ op: 'rewrite', path: a }, { op: 'rename', path: b }]);
    assert.deepStrictEqual(await listed('saved'), []);
  },

  async 'a file the chat made stays listed when the chat saves it again'() {
    const a = touch('own', 'report.txt');
    events('own', [{ op: 'new', path: a, verified: true, fid: '1' }, { op: 'rewrite', path: a, fid: idOf(a) }]);
    assert.deepStrictEqual(await listed('own'), ['report.txt']);
  },

  async 'a file the chat renamed into place counts once the journal confirmed it'() {
    const a = touch('placed', 'output.bin');
    events('placed', [{ op: 'rename', path: a, verified: true, fid: idOf(a) }]);
    assert.deepStrictEqual(await listed('placed'), ['output.bin']);
  },

  async 'another file saved at the same path later is not the chat\'s'() {
    const a = touch('other', 'budget.xlsx');
    events('other', [{ op: 'new', path: a, verified: true, fid: '12345' }]);
    assert.deepStrictEqual(await listed('other'), []);
  },

  async 'a file older than its own creation was overwritten, not made'() {
    const a = touch('older', 'notes.txt');
    events('older', [{ op: 'new', path: a, t: new Date(Date.now() + 3600000).toISOString() }]);
    assert.deepStrictEqual(await listed('older'), []);
  },

  async 'a bare repository is never listed'() {
    for (const part of ['HEAD', path.join('objects', 'ab', 'cd'), path.join('refs', 'heads', 'main')]) touch('bare.git', part);
    ledger('bare', [path.join(root, 'bare.git', 'HEAD'), path.join(root, 'bare.git', 'objects', 'ab', 'cd')]);
    assert.deepStrictEqual(await listed('bare'), []);
  },

  async 'a tracked file named in another case stays hidden'() {
    const r = repo('cased');
    const tracked = touch('cased', 'Docs', 'README.md');
    r.commitAll();
    ledger('cased', [tracked.toLowerCase().replace(root.toLowerCase(), root)]);
    assert.deepStrictEqual(await listed('cased'), []);
  },

  async 'tracked names with Hebrew, spaces and glob characters are recognised'() {
    const r = repo('names');
    const tracked = [touch('names', 'תיקייה', 'קובץ עם רווח.txt'), touch('names', 'pages', '[id].tsx')];
    r.commitAll();
    ledger('names', [...tracked, touch('names', 'תיקייה', 'נשאר.log'), touch('names', 'pages', 'i.tsx')]);
    assert.deepStrictEqual(await listed('names'), ['i.tsx', 'נשאר.log']);
  },

  async 'more tracked files than fit on a command line stay hidden'() {
    const r = repo('huge');
    const tracked = Array.from({ length: 900 }, (_, i) => touch('huge', 'a-fairly-long-generated-folder', `generated-source-${i}.ts`));
    r.commitAll();
    ledger('huge', [...tracked, touch('huge', 'left.log')]);
    assert.deepStrictEqual(await listed('huge'), ['left.log']);
  },

  async 'a file committed after the list was read stops being listed'() {
    const r = repo('later');
    const a = touch('later', 'one.txt');
    touch('later', 'seed.txt');
    r.git('add', 'seed.txt'); r.git('commit', '-qm', 'seed');
    ledger('later', [a]);
    assert.deepStrictEqual(await listed('later'), ['one.txt']);
    r.commitAll();
    assert.deepStrictEqual(await listed('later'), []);
  },

  async 'a stray .git folder does not hide the files below it'() {
    fs.mkdirSync(path.join(root, 'stray', '.git'), { recursive: true });
    ledger('stray', [touch('stray', 'deep', 'kept.log')]);
    assert.deepStrictEqual(await listed('stray'), ['kept.log']);
  },

  async 'a damaged ledger does not break the list'() {
    const ok = touch('damaged-ok.txt');
    fs.writeFileSync(path.join(ledgerDir, 'bad.jsonl'),
      'null\n42\n{"op":"new"}\n{half\n' + JSON.stringify({ op: 'new', path: ok, t: '2026-11-19T00:00:00Z' }) + '\n');
    assert.deepStrictEqual(await listed('bad'), ['damaged-ok.txt']);
  }
});
