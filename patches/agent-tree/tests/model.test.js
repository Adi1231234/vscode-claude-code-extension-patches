// node patches/agent-tree/tests/model.test.js
// Which agent each background task lands under, with a stand-in for the app's
// own pieces (tree builder, call finder, owner lookup) that behaves like them.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'runtime', 'model.js'), 'utf8'));
const A = window.__ccAT;

// messages: [{ call, parent }] - a tool call and the agent call it ran in,
// shaped the way the store keeps an assistant message.
const msg = (call, parent) => ({ type: 'assistant', call, parent, content: [{ content: { type: 'tool_use', id: call } }] });
function kit(messages) {
    return {
        buildTree: (agents) => {
            const nodes = [...agents.values()].map((agent) => ({ agent, children: [] }));
            const byCall = new Map(nodes.map((n) => [n.agent.toolUseId, n]));
            return nodes.filter((n) => {
                const p = byCall.get(n.agent.parentToolUseId);
                if (p) p.children.push(n);
                return !p;
            });
        },
        owner: (ms, id) => { const m = ms.find((x) => x.call === id); return m && m.parent; },
        status: (a) => a.status
    };
}

const agents = new Map([
    ['a1', { taskId: 'a1', toolUseId: 'callA', status: 'working' }],
    ['a2', { taskId: 'a2', toolUseId: 'callB', parentToolUseId: 'callA', status: 'finished' }]
]);
const messages = [
    msg('callA', null),
    msg('callB', 'callA'),
    msg('bashMain', null),
    { type: 'user', content: [{ content: { type: 'tool_result', id: 'bashMain' } }] },
    msg('bashInA', 'callA'),
    msg('bashInB', 'callB'),
    msg('bashInGone', 'callZ')
];
const tasks = new Map([
    ['t1', { taskId: 't1', toolUseId: 'bashMain' }],
    ['t2', { taskId: 't2', toolUseId: 'bashInA' }],
    ['t3', { taskId: 't3', toolUseId: 'bashInB' }],
    ['t4', { taskId: 't4', toolUseId: 'trimmedAway' }],
    ['t5', { taskId: 't5' }],
    ['t6', { taskId: 't6', toolUseId: 'bashInGone' }]
]);

const K = kit(messages);
const m = A.model(K, agents, tasks, messages);
const ids = (list) => list.map((t) => t.taskId).sort();

assert.deepStrictEqual(ids(m.main), ['t1'], 'an untagged call belongs to the main conversation');
assert.strictEqual(m.roots.length, 1, 'the nested agent is not a root');
assert.deepStrictEqual(ids(m.roots[0].tasks), ['t2'], 'a task started by agent A sits under A');
assert.deepStrictEqual(ids(m.roots[0].children[0].tasks), ['t3'], 'a task started by the nested agent sits under it');
assert.deepStrictEqual(ids(m.unknown), ['t4', 't5', 't6'], 'no call, a trimmed call or an unknown agent is never guessed');
assert.strictEqual(A.activeCount(K, m, new Set()), 1 + 6, 'one working agent plus six live tasks');
assert.strictEqual(A.keyOf({ taskId: 'x' }), 'x', 'an agent without a call id is keyed by its task id');

// A main call tagged undefined rather than null still counts as main.
const main2 = [msg('bashMain', undefined)];
const m2 = A.model(kit(main2), new Map(), new Map([['t1', { taskId: 't1', toolUseId: 'bashMain' }]]), main2);
assert.deepStrictEqual(ids(m2.main), ['t1']);

console.log('agent-tree model: ok');
