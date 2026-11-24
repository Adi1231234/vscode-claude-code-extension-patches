/* The message box's route: webview/route.js with lib/js/ccTarget.js, against a
 * stand-in box, agent store and document.
 *
 *     node patches/agent-input/tests/route.test.js
 *
 * Pinned: with the main conversation on screen the session itself is used;
 * with an agent on screen text goes to its store, attachments and CLI
 * commands are refused (a path or an unknown /word is text), what is refused
 * is put back into an empty box and the reason noted; Escape in the box goes
 * back unless a menu is open or no agent is on screen. */
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); };
const lib = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'lib', 'js', n), 'utf8');

let menuOpen = false, keyFn = null, backs = 0;
const box = { textContent: '', events: 0, dispatchEvent() { this.events++; }, getAttribute: (n) => (n === 'aria-controls' ? 'command-menu-list' : null) };
const sent = [];
let agentAnswer = () => Promise.resolve({ via: 'mod' });
const ctx = {
  console, Promise, Error,
  InputEvent: function (type) { this.type = type; },
  document: { getElementById: (id) => ({ querySelectorAll: () => [{ getClientRects: () => (menuOpen && id === 'command-menu-list' ? [{}] : []) }] }) },
  addEventListener: (type, fn) => { if (type === 'keydown') keyFn = fn; },
  __ccInput: () => box,
  __ccAgentStore: { of: (store, t) => ({ send: (text) => { sent.push({ t: t.taskId, text }); return agentAnswer(); } }) },
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.runInNewContext(lib('ccTarget.js') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'webview', 'route.js'), 'utf8'), ctx);
const T = ctx.__ccTarget, R = ctx.__ccAgentInput;
T.onBack(() => { backs++; T.hide(T.get()); });
const store = { send: () => 'main' };
const agent = { agentId: 'a1', taskId: 'a1', name: 'probe' };
const settle = (p) => p.then(() => 'sent', (e) => 'refused: ' + e.message);

(async () => {
  ok(R.route(store) === store, 'the main conversation on screen: the session itself');

  T.show(agent);
  const to = R.route(store);
  ok(to !== store, 'an agent on screen: its own sender');

  ok((await settle(to.send('hello', [], true))) === 'sent' && sent[0].text === 'hello' && sent[0].t === 'a1', 'plain text goes to the agent');

  ok(/refused: an agent takes text only/.test(await settle(to.send('look', [{ name: 'f.png' }], true))), 'an attachment is refused');
  ok(box.textContent === 'look' && box.events === 1, 'and the text is put back into the empty box');
  ok(/^Not sent: an agent takes text only/.test(T.noteFor('a1')), 'with the reason noted');

  box.textContent = 'a new draft';
  await settle(to.send('/compact', [], true));
  ok(box.textContent === 'a new draft', 'a draft typed since is never overwritten');
  ok(/slash commands run in the main conversation/.test(T.noteFor('a1')), 'a CLI command is refused');
  box.textContent = '';

  ok((await settle(to.send('/usr/bin/env node', [], true))) === 'sent', 'a path is text');
  ok((await settle(to.send('/foo bar', [], false))) === 'sent', 'a /word the CLI does not know is text');
  ok(T.noteFor('b2') === '', 'a note belongs to the agent it is about');

  agentAnswer = () => Promise.reject(new Error('Agent could not be resumed'));
  ok((await settle(to.send('again', [], true))) === 'refused: Agent could not be resumed', 'the agent store\'s refusal comes back');
  ok(box.textContent === 'again', 'and the text is put back (the store notes its own reason)');
  box.textContent = '';

  const esc = (target) => {
    const ev = { key: 'Escape', target, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    keyFn(ev);
    return ev;
  };
  menuOpen = true;
  ok(!esc(box).prevented && backs === 0, 'Escape with a menu open is the menu\'s');
  menuOpen = false;
  ok(!esc({}).prevented, 'Escape outside the box is left alone');
  const ev = esc(box);
  ok(ev.prevented && ev.stopped && backs === 1 && T.get() === null, 'Escape in the box goes back to the main conversation');
  ok(!esc(box).prevented && backs === 1, 'and with the main conversation on screen it is the app\'s again');

  console.log(pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  process.exitCode = fail ? 1 : 0;
})();
