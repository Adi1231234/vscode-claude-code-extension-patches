/* The dialog's tree.   node patches/created-files/tests/tree.test.js */
const assert = require('assert');
const path = require('path');
const { root, touch, ledger, panel, send, open, wait, run } = require('./harness');

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
  }
});
