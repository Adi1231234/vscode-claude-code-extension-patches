/* Which agent of a chat made a file: the chat itself ("main") or one of its
   subagents (their agent id). The same as adi-tools' packages/created-files/agents
   (pairing.mjs, whoMade.mjs, windows.mjs); change them together.

   Subagents run inside the chat's own process, so the recorder can only say which
   of the chat's tool shells made a file (its `via`, a "spawn" line). That shell is
   paired with the call that ran it: a Bash shell by its exact command, a background
   one by its task id, a foreground PowerShell one - whose command is not on its line -
   in order: each PowerShell call takes the first PowerShell shell that started after
   it and before it ended. A file with no shell goes to the one agent with a command
   running then (or none: "unclear"); a Write to the transcript that wrote it. */
globalThis.__ccCFAgentWho = globalThis.__ccCFAgentWho || (function () {
    var S = globalThis.__ccCFAgentShell;
    var SLACK_MS = 2000, OPEN_MS = 30 * 60000;
    function idOf(s) { return s.pid + "@" + s.t; }

    /* Each agent's calls as merged [start, end] spans, for a lookup by time. */
    function spans(calls) {
        var out = [];
        calls.map(function (c) { return [c.t, isFinite(c.end) ? c.end : c.t + OPEN_MS]; })
            .sort(function (a, b) { return a[0] - b[0]; })
            .forEach(function (s) { var last = out[out.length - 1]; if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else out.push(s); });
        return out;
    }
    function within(list, t) {
        for (var lo = 0, hi = list.length - 1; lo <= hi;) {
            var mid = (lo + hi) >> 1;
            if (list[mid][0] > t) hi = mid - 1; else if (list[mid][1] < t) lo = mid + 1; else return true;
        }
        return false;
    }

    function pairShells(agents, spawns) {
        var calls = [], byCommand = new Map(), paired = new Map(), tasked = new Set();
        agents.forEach(function (a) { a.replay.calls.forEach(function (c) { calls.push(Object.assign({}, c, { agent: a.key })); }); });
        calls.forEach(function (c) { byCommand.set(c.command, (byCommand.get(c.command) || []).concat(c)); });
        var shells = [];
        spawns.forEach(function (list) { list.forEach(function (s) { shells.push(Object.assign({ call: S.call(s.cmd) }, s)); }); });
        shells.forEach(function (s) {
            var owner = s.call.task && agents.find(function (a) { return a.replay.byTask.has(s.call.task); });
            if (owner) paired.set(idOf(s), owner.key);
        });
        agents.forEach(function (a) { a.replay.byTask.forEach(function (c) { tasked.add(c.id); }); });
        var ps = shells.filter(function (s) { return s.call.powershell && !paired.has(idOf(s)); }).sort(function (a, b) { return a.t - b.t; });
        var next = 0;
        calls.filter(function (c) { return c.tool === "PowerShell" && !tasked.has(c.id); }).sort(function (a, b) { return a.t - b.t; }).forEach(function (c) {
            while (next < ps.length && ps[next].t < c.t - SLACK_MS) next++;
            if (next < ps.length && ps[next].t <= c.end + SLACK_MS) paired.set(idOf(ps[next++]), c.agent);
        });
        return function (spawn) {
            var id = idOf(spawn);
            if (paired.has(id)) return paired.get(id);
            var command = S.call(spawn.cmd).command, best = null;
            if (command !== undefined) (byCommand.get(command) || []).forEach(function (c) {
                if (c.t <= spawn.t + SLACK_MS && spawn.t <= c.end + SLACK_MS && (!best || c.t > best.t)) best = c;
            });
            paired.set(id, best ? best.agent : null);
            return best ? best.agent : null;
        };
    }

    /* @returns (file) => the agent's key, or null when two agents could have made it */
    function make(agents, spawns) {
        var shellAgent = pairShells(agents, spawns);
        var busy = agents.map(function (a) { return { key: a.key, spans: spans(Array.from(a.replay.calls.values())) }; });
        function byTime(t) {
            var keys = busy.filter(function (b) { return within(b.spans, t); }).map(function (b) { return b.key; });
            return keys.length === 0 ? "main" : keys.length === 1 ? keys[0] : null;
        }
        function byWrite(key) {
            var best = null;
            agents.forEach(function (a) { var e = a.replay.alive.get(key); if (e && (!best || Date.parse(e.t) > Date.parse(best[1].t))) best = [a.key, e]; });
            return best ? best[0] : null;
        }
        return function (file) {
            var t = Date.parse(file.t), list = file.via ? (spawns.get(file.via) || []) : [];
            var spawn = list.filter(function (s) { return s.t <= t + SLACK_MS; }).pop();
            var key = spawn ? shellAgent(spawn) : null;
            if (key) return key;
            if (file.op === "write" || /^claude[.]exe$/i.test(file.image || "")) return byWrite(file.path.toLowerCase()) || "main";
            return byTime(t);
        };
    }

    return { make: make };
})();
