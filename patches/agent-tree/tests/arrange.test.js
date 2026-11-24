// node patches/agent-tree/tests/arrange.test.js
// Active agents first at every level, and "Only active agents" leaving out
// the ones with nothing running in or under them - but never the one on screen.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = {};
for (const f of ['model.js', 'arrange.js']) eval(fs.readFileSync(path.join(__dirname, '..', 'runtime', f), 'utf8'));
const A = window.__ccAT;
const K = { status: (a) => a.status };

const node = (id, status, children = [], tasks = []) => ({ agent: { taskId: id, toolUseId: id, status }, children, tasks });
const roots = () => [
    node('P1', 'finished', [node('C1', 'finished'), node('C2', 'working')]),
    node('P3', 'finished'),
    node('P2', 'working'),
    node('P4', 'failed', [], [{ taskId: 't1' }]),
    node('P5', 'stopped', [node('C3', 'finished')])
];
const ids = (nodes) => nodes.map((n) => n.agent.taskId);

// Everything shown: the busy ones first, each group in the app's order.
const all = A.arrange(K, roots(), new Set(), false, null);
assert.deepStrictEqual(ids(all.roots), ['P1', 'P2', 'P4', 'P3', 'P5'], 'busy first: P1 through its child, P4 through its task');
assert.deepStrictEqual(ids(all.roots[0].children), ['C2', 'C1'], 'the running child comes first under its parent');
assert.strictEqual(all.hidden, 0);

// Only active: an ended agent stays when something under it runs, and only then.
const active = A.arrange(K, roots(), new Set(), true, null);
assert.deepStrictEqual(ids(active.roots), ['P1', 'P2', 'P4'], 'P3 and P5 have nothing running');
assert.deepStrictEqual(ids(active.roots[0].children), ['C2'], 'the ended child is left out');
assert.strictEqual(active.hidden, 4, 'C1, P3, C3 and P5 are counted');

// The agent on screen is never hidden, and neither is the way down to it.
const kept = A.arrange(K, roots(), new Set(), true, 'C3');
assert.deepStrictEqual(ids(kept.roots), ['P1', 'P2', 'P4', 'P5']);
assert.deepStrictEqual(ids(kept.roots[3].children), ['C3']);
assert.strictEqual(kept.hidden, 2);

console.log('agent-tree arrange: ok');
