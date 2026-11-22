/* The dialog's tree.   node patches/created-files/tests/tree.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root, editor, touch, ledger, panel, send, until, open, wait, run } = require('./harness');

const shown = (m) => m.rows.map((r) => `${r.depth}:${r.kind === 'more' ? `+${r.left}` : r.name}`);

run({
  async 'a closed dialog gets the count, and no rows'() {
    ledger('closed', [touch('closed', 'a.txt')]);
    const view = panel();
    send(view, { op: 'subscribe', sessionId: 'closed' });
    await wait(400);
    assert.ok(view.got.length > 0, 'the host answered');
    assert.ok(view.got.every((m) => m.total === 1 && !m.rows));
    view.dispose();
  },

  async 'a folder holding only the next folder is one row, which keeps every level'() {
    const x = touch('tree', 'a', 'b', 'c', 'x.txt'), y = touch('tree', 'a', 'b', 'c', 'y.txt'), z = touch('tree', 'z.txt');
    ledger('tree', [x, y, z]);
    const { view, data } = await open('tree');
    const top = path.join(root, 'tree');
    assert.deepStrictEqual(shown(data).slice(1), ['1:a\\b\\c', '2:x.txt', '2:y.txt', '1:z.txt']);
    assert.strictEqual(data.rows[0].path, top);
    assert.strictEqual(data.rows[0].count, 3);
    const abc = data.rows[1];
    assert.deepStrictEqual(abc.levels.map((l) => l.path), ['a', 'a\\b', 'a\\b\\c'].map((p) => path.join(top, p)));
    view.dispose();
  },

  async 'closing a folder hides what is under it, and opening shows it again'() {
    const x = touch('fold', 'sub', 'x.txt');
    ledger('fold', [x, touch('fold', 'top.txt')]);
    const { view, data } = await open('fold');
    const sub = data.rows.find((r) => r.kind === 'dir' && r.name === 'sub');
    let next = view.next();
    send(view, { op: 'toggle', key: sub.key });
    assert.deepStrictEqual((await next).files.map((f) => f.name), ['top.txt']);
    next = view.next();
    send(view, { op: 'toggle', key: sub.key });
    assert.deepStrictEqual((await next).files.map((f) => f.name), ['x.txt', 'top.txt']);
    view.dispose();
  },

  async 'a folder\'s first level is copied: its files and the first folder of each row under it'() {
    const top = path.join(root, 'items');
    ledger('items', [touch('items', 'a.txt'), touch('items', 'deep', 'x', 'y', 'z.txt'), touch('items', 'sub', 'b.txt'), touch('items', 'sub', 'c.txt')]);
    const { view, data } = await open('items');
    const row = data.rows.find((r) => r.kind === 'dir' && r.path === top);
    assert.strictEqual(row.items, 3, 'a.txt, deep, sub');
    const ask = async (p) => { const m = until(view, (x) => x.copiedFor === row.key); send(view, { op: 'copyItems', path: p, key: row.key }); return m; };
    assert.strictEqual((await ask(top)).copiedItems, 3);
    assert.deepStrictEqual(editor.clipboard.split('\n'), ['deep', 'sub', 'a.txt'].map((n) => path.join(top, n)));
    assert.strictEqual((await ask(path.join(top, 'deep', 'x'))).copiedItems, 1, 'a folder in the middle of a joined row holds the next one');
    assert.strictEqual(editor.clipboard, path.join(top, 'deep', 'x', 'y'));
    assert.strictEqual((await ask(path.join(top, 'nothing-here'))).copyFailed, true);
    view.dispose();
  },

  async 'a file deleted outside any chat leaves the tree once its folder is opened'() {
    const x = touch('late', 'sub', 'x.txt');
    ledger('late', [x, touch('late', 'sub', 'y.txt'), touch('late', 'top.txt')]);
    const view = panel();
    const first = view.next();
    send(view, { op: 'subscribe', sessionId: 'late' });
    send(view, { op: 'view', open: true });
    const sub = (await first).rows.find((r) => r.kind === 'dir' && r.name === 'sub');
    assert.strictEqual(sub.open, false, 'a folder below the top starts closed');
    fs.rmSync(x);
    send(view, { op: 'toggle', key: sub.key });
    const m = await until(view, (r) => r.files.length === 2);
    assert.deepStrictEqual(m.files.map((f) => f.name), ['y.txt', 'top.txt']);
    assert.strictEqual(m.total, 2);
    view.dispose();
  }
});
