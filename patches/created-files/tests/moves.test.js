/* A moved folder takes its files along.   node patches/created-files/tests/moves.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root, touch, events, open, run } = require('./harness');

const made = (p, fid) => ({ op: 'new', path: p, verified: true, fid: fid });
const moved = (from, to) => ({ op: 'move', from: from, path: to, pid: 1, image: 'node.exe' });

run({
  async 'a moved folder\'s files are listed under its new name'() {
    const a = touch('mv', 'build', 'out', 'app.exe');
    events('mv', [made(a, String(fs.statSync(a, { bigint: true }).ino))]);
    const to = path.join(root, 'mv', 'dist');
    fs.renameSync(path.join(root, 'mv', 'build'), to);
    events('mv', [made(a, String(fs.statSync(path.join(to, 'out', 'app.exe'), { bigint: true }).ino)),
      moved(path.join(root, 'mv', 'build'), to)]);
    const { view, data } = await open('mv');
    assert.deepStrictEqual(data.files.map((f) => f.name), ['app.exe']);
    assert.strictEqual(data.total, 1);
    view.dispose();
  },

  async 'a removed worktree leaves nothing behind to look for'() {
    const wt = path.join(root, 'wt', 'a1'), gone = wt + '.removing-77';
    const f = touch('wt', 'a1', 'package.json');
    const keep = touch('wt', 'keep.txt');
    const lines = [made(f), made(keep), moved(wt, gone), { op: 'delete', path: path.join(gone, 'package.json') }];
    fs.rmSync(wt, { recursive: true });
    events('wt', lines);
    const { view, data } = await open('wt');
    assert.deepStrictEqual(data.files.map((x) => x.name), ['keep.txt']);
    view.dispose();
  },

  async 'the replay holds a removed worktree\'s files under no name at all'() {
    const r = globalThis.__ccCFReplay.create(), touched = new Set();
    const wt = 'C:\\p\\.claude\\worktrees\\a1', gone = wt + '.removing-77';
    [made(wt + '\\package.json'), moved(wt, gone), { op: 'delete', path: gone + '\\package.json' }]
      .forEach((e) => r.apply(JSON.stringify(Object.assign({ t: '2026-11-24T10:00:00Z' }, e)), touched));
    assert.strictEqual(r.alive.size, 0);
    assert.ok(touched.has((wt + '\\package.json').toLowerCase()) && touched.has((gone + '\\package.json').toLowerCase()));
  },
});
