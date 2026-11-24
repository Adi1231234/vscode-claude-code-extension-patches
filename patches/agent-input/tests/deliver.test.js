/* The host's end: host/deliver.js against a stand-in for the conversation's
 * SDK query, answering the way the 2.1.331 CLI answered in the live probe.
 *
 *     node patches/agent-input/tests/deliver.test.js
 *
 * Pinned: the CLI's own request is tried first and is the only one used when
 * it works; "Unsupported" falls through to the mod with check_permissions;
 * the CLI's words for a call a hook answered read as handed over; the mod's
 * refusals come back as their reason; a mod that did not load says what to
 * do; a real refusal of the CLI's own request wins over the mod's. */
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL: ' + m)); };

const ctx = { console };
ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'host', 'deliver.js'), 'utf8'), ctx);
const send = ctx.__ccAgentSend;

const NOT_RUN = 'The tool did not run: ';
const err = (message, errorCode) => Object.assign(new Error(message), errorCode ? { errorCode } : {});
const UNSUPPORTED = err('Unsupported control request subtype: send_task_message', 'unsupported_request');

/* A conversation whose CLI answers each subtype as told; records every request. */
function comms(answers) {
  const asked = [];
  const query = {
    request: async (r) => {
      asked.push(r);
      const a = answers[r.subtype];
      if (a instanceof Error) throw a;
      return { subtype: 'success', response: a || {} };
    },
  };
  return { asked, withChannel: async (id, fn) => { if (id !== 'ch1') throw new Error('no channel ' + id); return fn({ query }); } };
}

const req = { taskId: 'a55f', agentId: 'a55f', text: 'also say BANANA' };

(async () => {
  let c = comms({ send_task_message: {} });
  let r = await send(c, 'ch1', req);
  ok(r.type === 'cc_agent_send_response' && r.via === 'official' && !r.error, 'the CLI\'s own request, when it works');
  ok(c.asked.length === 1 && c.asked[0].task_id === 'a55f' && c.asked[0].message === 'also say BANANA', 'asked once, with the task id and the text');

  c = comms({ send_task_message: UNSUPPORTED, mcp_call: err(NOT_RUN + 'The result went to the host that asked for this call.') });
  r = await send(c, 'ch1', req);
  ok(r.via === 'mod' && !r.error, '"Unsupported" goes to the mod, and the CLI\'s words for a hook\'s answer mean handed over');
  const call = c.asked[1];
  ok(call.subtype === 'mcp_call' && call.tool === 'mcp__agent-input__SendToAgent' && call.check_permissions === true,
    'the mod\'s tool, checked - a plain call never reaches its hooks');
  ok(call.arguments.agent === 'a55f' && call.arguments.text === 'also say BANANA', 'with the agent id and the text');

  c = comms({ send_task_message: UNSUPPORTED, mcp_call: {} });
  r = await send(c, 'ch1', req);
  ok(r.via === 'mod' && !r.error, 'a plain success from a later CLI is handed over too');

  c = comms({ send_task_message: UNSUPPORTED, mcp_call: err(NOT_RUN + 'agent-input: Agent "a55f" could not be resumed: No transcript found') });
  r = await send(c, 'ch1', req);
  ok(r.error === 'Agent "a55f" could not be resumed: No transcript found', 'the mod\'s refusal, as its reason: ' + r.error);

  c = comms({ send_task_message: UNSUPPORTED, mcp_call: err('MCP server not connected: agent-input') });
  r = await send(c, 'ch1', req);
  ok(/started without the agent-input mod/.test(r.error), 'a mod that did not load says what to do: ' + r.error);

  c = comms({ send_task_message: err('no task with id a55f'), mcp_call: err(NOT_RUN + 'agent-input: not found') });
  r = await send(c, 'ch1', req);
  ok(r.error === 'no task with id a55f', 'a real refusal of the CLI\'s own request is the one shown: ' + r.error);

  c = comms({ send_task_message: err('validation: field "content" required'), mcp_call: err(NOT_RUN + 'The result went to the host that asked for this call.') });
  r = await send(c, 'ch1', req);
  ok(r.via === 'mod', 'a CLI request shaped differently than guessed still reaches the agent through the mod');

  c = comms({});
  r = await send(c, 'ch1', { taskId: 'a55f', text: '   ' });
  ok(r.error === 'nothing to send' && c.asked.length === 0, 'blank text is refused before the CLI is asked');
  r = await send(c, 'ch1', { text: 'x' });
  ok(r.error === 'nothing to send', 'no task id is refused');

  c = comms({ send_task_message: UNSUPPORTED, mcp_call: {} });
  await send(c, 'ch1', { taskId: 'a99', text: 'hi' });
  ok(c.asked[1].arguments.agent === 'a99', 'the agent id falls back to the task id');

  r = await send(comms({}), 'other', req);
  ok(/no channel other/.test(r.error), 'a channel that is gone is an answer, not a throw');

  console.log(pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  process.exitCode = fail ? 1 : 0;
})();
