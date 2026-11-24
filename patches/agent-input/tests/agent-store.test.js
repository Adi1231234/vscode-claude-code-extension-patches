/* An agent in the shape of a session store: lib/js/ccAgentStore.js against a
 * stand-in for the app's store, read with the real lib/js/ccReply.js.
 *
 *     node patches/agent-input/tests/agent-store.test.js
 *
 * Pinned: busy is the agent's run (and an agent the store does not hold); a
 * stop of the agent leaves the row ccReply reads a stop off, a finish does
 * not; a send wakes a finished agent and holds busy until its run shows;
 * files and a missing channel are refused; one store per agent. */
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); };
const lib = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'lib', 'js', n), 'utf8');

const ctx = { console, setTimeout, clearTimeout, Promise, Map, WeakMap, Set, Date };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.runInNewContext([lib('ccTarget.js'), lib('ccOutbox.js'), lib('ccAgentStore.js'), lib('ccReply.js')].join('\n'), ctx);
const A = ctx.__ccAgentStore, R = ctx.__ccReply, T = ctx.__ccTarget;

/* The app's agentMapAgents: a signal of a Map keyed by task id. */
function sig(v) {
  const subs = [];
  return { get value() { return v; }, set value(n) { v = n; subs.forEach((f) => f(v)); }, peek: () => v, subscribe(f) { subs.push(f); f(v); return () => {}; } };
}
function appStore(status, answer) {
  const s = {
    agentMapAgents: sig(new Map(status ? [['t1', { taskId: 't1', agentId: 'a1', status }]] : [])),
    claudeChannelId: 'ch1',
    sent: [], stopped: [],
    getConnection: async () => ({ sendRequest: async (r, ch) => { s.sent.push({ r, ch }); return answer ? answer(r) : { type: 'cc_agent_send_response', via: 'mod' }; } }),
    stopSubagent: async (id) => { s.stopped.push(id); },
  };
  s.set = (st) => { s.agentMapAgents.value = new Map([['t1', { taskId: 't1', agentId: 'a1', status: st }]]); };
  return s;
}
const agent = { taskId: 't1', agentId: 'a1', name: 'probe' };

(async () => {
  let s = appStore('working'), a = A.of(s, agent);
  ok(A.of(s, agent) === a, 'one store per conversation store and agent');
  ok(a.busy.value === true, 'a working agent is busy');
  const mark = R.mark(a);
  s.set('finished');
  ok(a.busy.value === false, 'a finished one is not');
  ok(R.since(mark, a).stopped === false, 'a finish leaves no stop');

  s = appStore('working'); a = A.of(s, agent);
  const mark2 = R.mark(a);
  s.set('stopped');
  ok(a.busy.value === false && R.since(mark2, a).stopped === true, 'a stop leaves the row ccReply reads a stop off');

  s = appStore(null); a = A.of(s, agent);
  ok(a.busy.value === true, 'an agent the store does not hold reads busy: nothing is sent to it');

  s = appStore('finished'); a = A.of(s, agent);
  ok(a.busy.value === false, 'finished, not busy');
  await a.send('carry on');
  ok(s.sent.length === 1 && s.sent[0].ch === 'ch1', 'sent on the conversation\'s channel');
  const r = s.sent[0].r;
  ok(r.type === 'cc_agent_send' && r.taskId === 't1' && r.agentId === 'a1' && r.text === 'carry on', 'as a cc_agent_send with both ids');
  ok(a.busy.value === true, 'a send that wakes it holds busy until its run shows');
  s.set('working');
  ok(a.busy.value === true, 'its run showed');
  s.set('finished');
  ok(a.busy.value === false, 'and ended');

  let threw = '';
  await a.send('x', [{ name: 'f.png' }]).catch((e) => { threw = e.message; });
  ok(/text only/.test(threw) && s.sent.length === 1, 'files are refused before the host is asked');

  let answer = { type: 'cc_agent_send_response', error: 'Agent could not be resumed' };
  s = appStore('finished', () => answer); a = A.of(s, agent);
  let err = null;
  await a.send('x').catch((e) => { err = e; });
  ok(err && err.message === 'Agent could not be resumed' && a.busy.value === false, 'the host\'s reason comes back, and a refused send wakes nothing');
  ok(err && err.parks === true, 'marked parks: trying again will not make it go');
  ok(T.noteFor('a1') === 'Not sent: Agent could not be resumed' && T.noteFor('b2') === '', 'noted for that agent alone');
  answer = { type: 'cc_agent_send_response', via: 'mod' };
  await a.send('y');
  ok(T.noteFor('a1') === '', 'a send that goes clears the note');

  s = appStore('stopped', () => ({ type: 'cc_agent_send_response', error: 'Agent x was stopped and won\'t be resumed. Treat its work as cancelled.' })); a = A.of(s, agent);
  err = null;
  await a.send('x').catch((e) => { err = e; });
  ok(err && /^this agent was stopped, and a stopped agent cannot be woken from here/.test(err.message) && err.parks === true,
    'a stopped agent\'s refusal is said in the store\'s words, whatever the CLI\'s: ' + (err && err.message));
  ok(/^Not sent: this agent was stopped/.test(T.noteFor('a1')), 'and that is the note');

  s = appStore('finished'); s.claudeChannelId = undefined; a = A.of(s, agent);
  err = null;
  await a.send('x').catch((e) => { err = e; });
  ok(err && /not running/.test(err.message) && err.parks === true, 'no channel, no send, held');

  s = appStore('working'); a = A.of(s, agent);
  await a.interrupt();
  ok(s.stopped[0] === 't1', 'interrupt stops the agent');

  console.log(pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  process.exitCode = fail ? 1 : 0;
})();
