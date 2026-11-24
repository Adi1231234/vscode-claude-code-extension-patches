/* What is on its way to an agent: lib/js/ccOutbox.js waiting / arrived / lost,
 * against a stand-in for the app's store and connection.
 *
 *     node patches/agent-input/tests/outbox.test.js
 *
 * Pinned: a message waits from the moment it is sent, so the agent's view can
 * draw it at once; a refusal takes it back; it is matched to the first box row
 * with its text written since it was sent (an older row with the same text does
 * not count, and two equal messages need two rows); a stopped agent drops what
 * still waits and says so; every change is heard. */
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); };
const lib = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'lib', 'js', n), 'utf8');

const ctx = { console, setTimeout, clearTimeout, Promise, Map, WeakMap, Set, Date, JSON };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.runInNewContext([lib('ccTarget.js'), lib('ccOutbox.js')].join('\n'), ctx);
const O = ctx.__ccOutbox, T = ctx.__ccTarget;

function store(answer) {
  let release;
  const gate = new Promise((r) => { release = r; });
  return {
    claudeChannelId: 'ch1',
    release,
    getConnection: async () => ({ sendRequest: async (r) => { await gate; return answer(r); } }),
  };
}
const agent = { taskId: 't1', agentId: 'a1' };
const texts = () => O.waiting('t1').map((w) => w.text);

(async () => {
  let heard = 0;
  const off = O.on(() => heard++);

  let s = store(() => ({ via: 'mod' }));
  const p = O.send(s, agent, 'hello');
  ok(texts().join() === 'hello', 'waits from the moment it is sent, before the host answers');
  ok(heard === 1, 'the send is heard');
  s.release();
  await p;
  ok(texts().join() === 'hello', 'still waits once handed over: the agent reads it at its next step');

  const sentAt = O.waiting('t1')[0].at;
  O.arrived('t1', [{ text: 'hello', at: sentAt - 60000 }]);
  ok(texts().join() === 'hello', 'an older row with the same text is not this message');
  O.arrived('t1', [{ text: 'hello', at: sentAt + 50 }]);
  ok(texts().length === 0, 'a row written since it was sent is');

  s = store(() => ({ via: 'mod' }));
  const two = [O.send(s, agent, '?'), O.send(s, agent, '?')];
  s.release();
  await Promise.all(two);
  const at = O.waiting('t1')[0].at;
  O.arrived('t1', [{ text: '?', at: at + 10 }]);
  ok(texts().join() === '?', 'two equal messages need two rows');
  O.arrived('t1', [{ text: '?', at: at + 10 }, { text: '?', at: at + 20 }]);
  ok(texts().length === 0, 'and two rows settle both');

  s = store(() => ({ error: 'agent-input: this agent was stopped' }));
  const refused = O.send(s, agent, 'too late');
  ok(texts().join() === 'too late', 'waits while the host is asked');
  s.release();
  let err = null;
  try { await refused; } catch (e) { err = e; }
  ok(err && err.parks === true, 'a refusal rejects, marked parks');
  ok(texts().length === 0, 'and takes the message back');
  ok(/^Not sent: /.test(T.noteFor('a1')), 'with the reason noted for the agent');

  s = store(() => ({ via: 'mod' }));
  const lostOne = O.send(s, agent, 'unread');
  s.release();
  await lostOne;
  const before = heard;
  O.lost(agent, 'the agent was stopped before it read it');
  ok(texts().length === 0, 'a stopped agent drops what still waits');
  ok(T.noteFor('a1') === 'Not read: the agent was stopped before it read it', 'and says so');
  ok(heard === before + 1, 'the drop is heard');
  O.lost(agent, 'again');
  ok(heard === before + 1 && T.noteFor('a1') !== 'Not read: again', 'nothing waiting: nothing to drop or say');

  off();
  const quiet = heard;
  s = store(() => ({ via: 'mod' }));
  const last = O.send(s, agent, 'after off');
  s.release();
  await last;
  ok(heard === quiet, 'an unsubscribed listener hears nothing');

  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
