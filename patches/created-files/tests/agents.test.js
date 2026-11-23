/* Which agent of a chat made each file, as the dialog gets it: the chat itself,
   each subagent, and one agent's files alone when picked.
   node patches/created-files/tests/agents.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { touch, events, transcript, send, until, open, run } = require('./harness');

const T = Date.now() - 60000, iso = (t) => new Date(t).toISOString();
// The shells' command lines as CLI 2.1.330 starts them (measured), shortened in the middle.
const bashLine = (cmd) => '"C:\\Program Files\\Git\\bin\\bash.exe" -c "source /c/x/s.sh 2>/dev/null || true && eval \'' +
  cmd.split("'").join("'\\''").split('"').join('\\"') + '\' < /dev/null && pwd -P >| /c/x/claude-1-cwd"';
const psLine = (task) => 'C:\\windows\\System32\\cmd.exe /d /s /c ""C:\\windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "$__claudeCodeScript = $env:CLAUDE_CODE_SHELL_LAUNCHER_SCRIPT; Invoke-Expression -Command $__claudeCodeScript" > "C:\\T\\tasks\\' + task + '.output" 2>&1"';
const call = (t, id, name, input) => ({ type: 'assistant', timestamp: iso(t), message: { content: [{ type: 'tool_use', id, name, input }] } });
const result = (t, id, content) => ({ type: 'user', timestamp: iso(t), message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } });

run({
  async 'each file goes to the agent whose call made it, and a pick shows that agent alone'() {
    const id = 'agents-1';
    const [mine, theirs, ps, written] = ['mine.txt', 'theirs.txt', 'ps.txt', 'written.txt'].map((n) => touch('agents', n));
    transcript(id, [call(T, 'm1', 'Bash', { command: 'echo "a" > mine.txt' }), result(T + 5000, 'm1', 'ok')]);
    const sub = transcript(id, [
      call(T + 1000, 's1', 'Bash', { command: "echo 'b' > theirs.txt" }), result(T + 4000, 's1', 'ok'),
      call(T + 1000, 's2', 'Write', { file_path: written, content: 'x' }), result(T + 1100, 's2', 'File created successfully at: ' + written),
      call(T + 6000, 's3', 'PowerShell', { command: 'Set-Content ps.txt x' }), result(T + 9000, 's3', '(PowerShell completed with no output)'),
    ], { agent: 'sub1' });
    fs.writeFileSync(path.join(path.dirname(sub), 'agent-sub1.meta.json'), JSON.stringify({ description: 'Build the docs', agentType: 'Explore' }));
    events(id, [
      { t: iso(T + 100), op: 'spawn', pid: 10, image: 'bash.exe', cmd: bashLine('echo "a" > mine.txt') },
      { t: iso(T + 1200), op: 'spawn', pid: 11, image: 'bash.exe', cmd: bashLine("echo 'b' > theirs.txt") },
      { t: iso(T + 6100), op: 'spawn', pid: 12, image: 'cmd.exe', cmd: psLine('f1') },
      { t: iso(T + 1300), op: 'new', path: mine, image: 'bash.exe', verified: true, via: 10 },
      { t: iso(T + 1300), op: 'new', path: theirs, image: 'bash.exe', verified: true, via: 11 },
      { t: iso(T + 1050), op: 'new', path: written, image: 'claude.exe', verified: true },
      { t: iso(T + 6500), op: 'new', path: ps, image: 'powershell.exe', verified: true, via: 12 },
    ]);
    const { view, data: all } = await open(id);
    assert.deepStrictEqual(all.agents.map((a) => [a.key, a.label, a.count]), [['main', '', 1], ['sub1', 'Build the docs', 3]]);
    const whose = (m) => Object.fromEntries(m.rows.filter((r) => r.kind === 'file').map((r) => [r.name, r.agent]));
    assert.deepStrictEqual(whose(all), { 'mine.txt': 'main', 'ps.txt': 'sub1', 'theirs.txt': 'sub1', 'written.txt': 'sub1' });
    send(view, { op: 'agent', key: 'sub1' });
    const picked = await until(view, (m) => m.agent === 'sub1');
    assert.deepStrictEqual(Object.keys(whose(picked)).sort(), ['ps.txt', 'theirs.txt', 'written.txt']);
    view.dispose();
  },
});
