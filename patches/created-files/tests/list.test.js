/* What a chat's list may hold.   node patches/created-files/tests/list.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root, ledgerDir, touch, ledger, repo, open, names, run } = require('./harness');

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
      path.join(root, 'gone.txt'),
      touch('repo', 'left-behind.log'),
      touch('outside.txt')
    ]);
    const { view, data } = await open('listed');
    assert.deepStrictEqual(names(data), ['left-behind.log', 'outside.txt']);
    assert.strictEqual(data.total, 2);
    view.dispose();
  },

  async 'tracked names with Hebrew, spaces and glob characters are recognised'() {
    const r = repo('names');
    const tracked = [touch('names', 'תיקייה', 'קובץ עם רווח.txt'), touch('names', 'pages', '[id].tsx')];
    r.commitAll();
    ledger('names', [...tracked, touch('names', 'תיקייה', 'נשאר.log'), touch('names', 'pages', 'i.tsx')]);
    const { view, data } = await open('names');
    assert.deepStrictEqual(names(data), ['i.tsx', 'נשאר.log']);
    view.dispose();
  },

  async 'more tracked files than fit on a command line stay hidden'() {
    const r = repo('huge');
    const tracked = Array.from({ length: 900 }, (_, i) => touch('huge', 'a-fairly-long-generated-folder', `generated-source-${i}.ts`));
    r.commitAll();
    ledger('huge', [...tracked, touch('huge', 'left.log')]);
    const { view, data } = await open('huge');
    assert.deepStrictEqual(names(data), ['left.log']);
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
  }
});
