/* A chat the recorder did not see from its start: what its own records say it made.
   node patches/created-files/tests/old-chat.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root, touch, events, transcript, said, wrote, scratch, repo, send, until, open, names, run } = require('./harness');

const OLD = Date.UTC(2026, 9, 1), HOUR = 3600000;
const now = () => Date.now();
const listed = async (id) => { const { view, data } = await open(id); view.dispose(); return data; };

run({
  async 'a chat older than recording lists the files Claude wrote and its scratchpad, and says so'() {
    events('recorded-elsewhere', [{ t: '2026-11-19T10:00:00Z', op: 'gap' }]);   // recording began here then
    const a = touch('old', 'report.md'), b = scratch('old-1', 'out', 'data.csv');
    transcript('old-1', [said(OLD), wrote(a.replace(/\\/g, '/'), now(), 'create')]);
    const data = await listed('old-1');
    assert.deepStrictEqual(names(data), ['data.csv', 'report.md']);
    assert.strictEqual(data.unrecorded, true);
  },

  async 'a file Claude edited after writing it is still its file'() {
    const a = touch('edited', 'notes.txt');
    transcript('old-2', [said(OLD), wrote(a, now() - HOUR, 'create'), wrote(a, now())]);
    assert.deepStrictEqual(names(await listed('old-2')), ['notes.txt']);
  },

  async 'a file born after every write of the chat was made by someone else'() {
    const a = touch('replaced', 'notes.txt');
    transcript('old-3', [said(OLD), wrote(a, now() - HOUR, 'create')]);
    assert.deepStrictEqual(names(await listed('old-3')), []);
  },

  async 'an edit of a file the chat did not write does not list it'() {
    const a = touch('foreign', 'config.json');
    transcript('old-4', [said(OLD), wrote(a, now())]);
    assert.deepStrictEqual(names(await listed('old-4')), []);
  },

  async 'what git tracks, a .git folder and a link out of the scratchpad are not listed'() {
    fs.mkdirSync(path.join(root, 'temp', 'claude', 'C--proj', 'old-5', 'scratchpad'), { recursive: true });
    const r = repo(path.join('temp', 'claude', 'C--proj', 'old-5', 'scratchpad', 'clone'));
    scratch('old-5', 'clone', 'src.ts');
    r.commitAll();
    scratch('old-5', 'clone', 'build.log');
    const outside = touch('elsewhere', 'secret.txt');
    fs.symlinkSync(path.dirname(outside), path.join(root, 'temp', 'claude', 'C--proj', 'old-5', 'scratchpad', 'link'), 'junction');
    transcript('old-5', [said(OLD)]);
    assert.deepStrictEqual(names(await listed('old-5')), ['build.log']);
  },

  async 'a subagent writes in its own transcript, and a moved transcript is found'() {
    const a = touch('agent', 'made-by-agent.txt'), b = touch('agent', 'made-by-chat.txt');
    transcript('old-6', [said(OLD), wrote(b, now(), 'create')], { slug: 'C--proj--claude-worktrees-x' });
    transcript('old-6', [said(OLD), wrote(a, now(), 'create')], { agent: 'a1', slug: 'C--proj--claude-worktrees-x' });
    assert.deepStrictEqual(names(await listed('old-6')), ['made-by-agent.txt', 'made-by-chat.txt']);
  },

  async 'a chat recorded from its start is read from its ledger alone'() {
    const a = touch('whole', 'in-ledger.txt'), b = touch('whole', 'only-in-transcript.txt');
    const start = now() - 1000;
    events('new-1', [{ t: new Date(start).toISOString(), op: 'new', path: a }]);
    transcript('new-1', [said(start), wrote(b, now(), 'create')]);
    const data = await listed('new-1');
    assert.deepStrictEqual(names(data), ['in-ledger.txt']);
    assert.strictEqual(data.unrecorded, false);
  },

  async 'a transcript that moves while the chat is shown is read where it went'() {
    const a = touch('moving', 'before.txt'), b = touch('moving', 'after.txt');
    const first = transcript('old-8', [said(OLD), wrote(a, now(), 'create')]);
    const { view, data } = await open('old-8');
    assert.deepStrictEqual(names(data), ['before.txt']);
    fs.rmSync(first);
    transcript('old-8', [said(OLD), wrote(a, now(), 'create'), wrote(b, now(), 'create')], { slug: 'C--proj--claude-worktrees-y' });
    const done = until(view, (m) => m.checking === 0 && m.files.length === 2);   // a moved record is read from its start
    send(view, { op: 'refresh' });
    assert.deepStrictEqual(names(await done), ['after.txt', 'before.txt']);
    view.dispose();
  },

  async 'a file that lands in the scratchpad later shows when the dialog opens'() {
    scratch('old-7', 'first.txt');
    transcript('old-7', [said(OLD)]);
    const { view, data } = await open('old-7');
    assert.deepStrictEqual(names(data), ['first.txt']);
    scratch('old-7', 'second.txt');
    const next = view.next();
    send(view, { op: 'refresh' });
    assert.deepStrictEqual(names(await next), ['first.txt', 'second.txt']);
    view.dispose();
  }
});
