/* The buttons and the live updates.   node patches/created-files/tests/live.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ledgerDir, trashed, editor, touch, ledger, panel, send, open, wait, run } = require('./harness');

run({
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
    assert.strictEqual(editor.clipboard.split('\n').length, 320);
    const after = view.next();
    send(view, { op: 'deleteAll', list: data.list });
    assert.strictEqual((await after).total, 0);
    assert.strictEqual(trashed.splice(0).length, 320);
    view.dispose();
  },

  async 'delete all moves nothing when the list is not the one confirmed'() {
    const a = touch('confirm', 'a.txt');
    ledger('confirm', [a]);
    const { view, data } = await open('confirm');
    ledger('confirm', [a, touch('confirm', 'b.txt')]);
    const answer = view.next();
    send(view, { op: 'deleteAll', list: data.list });
    assert.strictEqual((await answer).failed, 0);
    await wait(400);
    assert.deepStrictEqual(trashed.splice(0), []);
    assert.ok(fs.existsSync(a));
    send(view, { op: 'deleteAll' });
    await wait(400);
    assert.deepStrictEqual(trashed.splice(0), [], 'no confirmation at all moves nothing either');
    view.dispose();
  },

  async 'a double click on delete is not reported as a failure'() {
    const file = touch('twice', 'a.txt');
    ledger('twice', [file]);
    const { view } = await open('twice');
    const seen = [];
    const done = new Promise((resolve) => {
      const post = view.webview.postMessage;
      view.webview.postMessage = async (m) => { seen.push(m); if ('failed' in m && m.total === 0) resolve(); return post(m); };
    });
    send(view, { op: 'delete', path: file });
    send(view, { op: 'delete', path: file });
    await done;
    await wait(500);
    assert.ok(seen.filter((m) => 'failed' in m).every((m) => m.failed === 0), JSON.stringify(seen.map((m) => m.failed)));
    trashed.splice(0);
    view.dispose();
  },

  async 'the recorder going down reaches every open chat'() {
    const status = path.join(ledgerDir, 'status.json');
    fs.writeFileSync(status, JSON.stringify({ running: true, pid: process.pid }));
    ledger('rec1', [touch('rec', 'one.txt')]);
    ledger('rec2', [touch('rec', 'two.txt')]);
    const first = await open('rec1');
    const second = await open('rec2');
    assert.strictEqual(first.data.running, true);
    assert.strictEqual(second.data.running, true);
    const a = first.view.next(), b = second.view.next();
    fs.writeFileSync(status, JSON.stringify({ running: false, pid: process.pid }));
    assert.deepStrictEqual([(await a).running, (await b).running], [false, false]);
    fs.writeFileSync(status, JSON.stringify({ running: true, pid: 4194300 }));   // a crashed recorder
    const c = first.view.next();
    send(first.view, { op: 'refresh' });
    assert.strictEqual((await c).running, false);
    fs.rmSync(status);
    first.view.dispose(); second.view.dispose();
  },

  async 'the ledger folder can be removed and the live list recovers'() {
    const a = touch('gone-dir', 'a.txt');
    ledger('dirgone', [a]);
    const { view } = await open('dirgone');
    const saved = fs.readdirSync(ledgerDir).map((n) => [n, fs.readFileSync(path.join(ledgerDir, n))]);
    fs.rmSync(ledgerDir, { recursive: true, force: true });
    const before = process.cpuUsage();
    await wait(700);
    const used = process.cpuUsage(before);
    assert.ok((used.user + used.system) / 1000 < 350, 'the removed folder must not spin the thread');
    fs.mkdirSync(ledgerDir, { recursive: true });
    saved.forEach(([n, b]) => fs.writeFileSync(path.join(ledgerDir, n), b));
    const pushed = view.next();
    ledger('dirgone', [a, touch('gone-dir', 'b.txt')]);
    assert.strictEqual((await pushed).total, 2);
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
    await wait(900);
    assert.strictEqual(view.got.length, before);
  },

  async 'an action from a panel that never subscribed does nothing'() {
    const file = touch('stranger.txt');
    ledger('stranger', [file]);
    assert.strictEqual(send(panel(), { op: 'deleteAll' }), true);
    await wait(200);
    assert.ok(fs.existsSync(file));
  }
});
