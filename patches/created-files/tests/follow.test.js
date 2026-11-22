/* A chat followed as its ledger grows.   node patches/created-files/tests/follow.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ledgerDir, touch, ledger, repo, send, until, open, wait, run } = require('./harness');

run({
  async 'a big chat answers with its newest files first, and the rest follow'() {
    const files = Array.from({ length: 700 }, (_, i) => touch('big', `f${String(i).padStart(3, '0')}.txt`));
    fs.writeFileSync(path.join(ledgerDir, 'big.jsonl'), files.map((p, i) =>
      JSON.stringify({ t: new Date(Date.UTC(2026, 10, 19, 0, 0, i)).toISOString(), op: 'new', path: p })).join('\r\n') + '\r\n');
    const { view, data } = await open('big');
    assert.ok(data.checking > 0, 'the first answer comes before every file was looked at');
    assert.strictEqual(data.total, 600, 'the newest 600 are looked at first');
    const last = await until(view, (m) => m.checking === 0);
    assert.strictEqual(last.total, 700);
    view.dispose();
  },

  async 'a new line is taken in without the old ones read again'() {
    const a = touch('grow', 'a.txt');
    ledger('grow', [a]);
    const { view } = await open('grow');
    const b = touch('grow', 'b.txt');
    const next = view.next();
    fs.appendFileSync(path.join(ledgerDir, 'grow.jsonl'), JSON.stringify({ t: '2026-11-19T01:00:00Z', op: 'new', path: b }) + '\r\n');
    assert.deepStrictEqual((await next).files.map((f) => f.name), ['a.txt', 'b.txt']);
    view.dispose();
  },

  async 'a file deleted outside any chat leaves the list when the dialog opens again'() {
    const a = touch('outside', 'a.txt'), b = touch('outside', 'b.txt');
    ledger('outside', [a, b]);
    const { view } = await open('outside');
    send(view, { op: 'view', open: false });
    fs.rmSync(a);
    send(view, { op: 'view', open: true });
    const m = await until(view, (x) => x.files.length === 1);
    assert.deepStrictEqual(m.files.map((f) => f.name), ['b.txt']);
    view.dispose();
  },

  async 'a file the chat commits leaves the list, though no ledger line says so'() {
    const r = repo('committed');
    touch('committed', 'seed.txt');
    r.commitAll();
    const mine = touch('committed', 'app.js'), other = touch('committed', 'left.log');
    ledger('commit', [mine, other]);
    const { view, data } = await open('commit');
    assert.strictEqual(data.total, 2);
    r.git('add', 'app.js');
    r.git('commit', '-qm', 'app');
    const next = view.next();
    send(view, { op: 'refresh' });
    assert.deepStrictEqual((await next).files.map((f) => f.name), ['left.log']);
    view.dispose();
  },

  async 'a file deleted and made again in a moment stays listed, though read between the lines'() {
    const file = touch('between', 'out.txt');
    const add = (op, extra) => fs.appendFileSync(path.join(ledgerDir, 'between.jsonl'),
      JSON.stringify(Object.assign({ t: new Date().toISOString(), op, path: file }, extra)) + '\r\n');
    const fid = () => String(fs.statSync(file, { bigint: true }).ino);
    add('new', { verified: true, fid: fid() });
    const { view, data } = await open('between');
    assert.deepStrictEqual(data.files.map((f) => f.name), ['out.txt']);
    fs.rmSync(file);
    add('delete');
    await wait(900);   // the delete line is read on its own, while the file is gone
    touch('between', 'out.txt');
    const next = view.next();
    add('rewrite', { fid: fid() });
    assert.deepStrictEqual((await next).files.map((f) => f.name), ['out.txt']);
    view.dispose();
  },

  async 'delete all waits until every file was looked at'() {
    const files = Array.from({ length: 900 }, (_, i) => touch('wait', `w${i}.txt`));
    ledger('wait', files);
    const { view, data } = await open('wait');
    assert.ok(data.checking > 0);
    send(view, { op: 'deleteAll', list: data.list });
    await until(view, (m) => m.checking === 0);
    await wait(300);
    assert.ok(files.every((p) => fs.existsSync(p)), 'nothing was moved from a list still being looked at');
    view.dispose();
  }
});
