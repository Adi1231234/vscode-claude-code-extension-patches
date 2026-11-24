// SendToAgent - a message typed in the editor panel, for one of this
// session's agents.
//
// While an agent's view is open in the panel, its message box sends to that
// agent (patches/agent-input). The CLI has a request of its own for it,
// send_task_message, but 2.1.331 answers it "Unsupported control request
// subtype"; the host tries it first and comes here when it is refused.
//
// The host calls this tool with mcp_call and check_permissions, so it runs at
// once - mid-turn too - and takes no model turn. Measured on 2.1.331:
//   - a plain mcp_call goes straight to the plugin's MCP server, whose only
//     answer is "no hook answered this call"; a checked one runs the model's
//     own tool path, and tool.run below answers it;
//   - the host then gets "The tool did not run: The result went to the host
//     that asked for this call." - the CLI's words for a call a hook answered,
//     whose result is the host's and never the model's - and a deny's reason
//     the same way, after "The tool did not run: ";
//   - $.session.send to a running agent reaches it at its next tool round;
//     to a finished one, it wakes it with the message.
// The model is never offered the tool, and the person typed the message, so
// there is nothing to ask. Every matcher is spelled out: the engine reads a
// matcher from the source as written.

const NAME = 'SendToAgent'

const spec = {
  name: NAME,
  description: 'Hands text typed in the editor panel to one of this session agents. Called by the editor, never by the model.',
  inputSchema: {
    type: 'object',
    properties: {
      agent: { type: 'string', description: 'The agent id, as the panel knows it' },
      text: { type: 'string', description: 'What the person typed' },
    },
    required: ['agent', 'text'],
    additionalProperties: false,
  },
}

// A refusal the host can tell from the CLI's own (host/deliver.js).
const refuse = (reason) => ({ deny: 'agent-input: ' + reason })

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.tool.register(spec)
    return next(e)
  })

  on('tool.offer', { tool: 'mcp__agent-input__SendToAgent' }, async () => ({ isOffered: false }))
    .catch(() => ({ isOffered: false }))

  on('tool.check', { tool: 'mcp__agent-input__SendToAgent' }, async () => ({ decision: 'allow' }))
    .catch(() => ({ decision: 'deny', reason: 'agent-input: the check failed' }))

  on('tool.run', { tool: 'mcp__agent-input__SendToAgent' }, async ($, e) => {
    const input = e.input && typeof e.input === 'object' ? e.input : e
    const agent = String(input.agent || '')
    const text = String(input.text || '')
    if (!agent || !text.trim()) return refuse('nothing to send')
    const sent = await $.session.send({ to: { agentId: agent }, text })
    return sent.isDelivered ? { result: 'delivered' } : refuse(sent.reason || 'not delivered')
  }).catch(() => refuse('the message could not be handed over'))
}
