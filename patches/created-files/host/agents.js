/* A chat's files by the agent that made each: the chat itself ("main"), one of its
   subagents (its agent id, named by what the chat called it in its
   agent-<id>.meta.json) or "unclear". The same as adi-tools' ChatAgents and byAgent
   (packages/created-files/agents); change them together. Only chats a panel
   follows are kept, and a chat's groups are made again only when its files or its
   transcripts changed. */
globalThis.__ccCFAgents = globalThis.__ccCFAgents || (function () {
    var fsp = globalThis.__ccCFFs.promises;
    var F = globalThis.__ccCFFollow, T = globalThis.__ccCFTranscript;
    var C = globalThis.__ccCFAgentCalls, W = globalThis.__ccCFAgentWho;
    var SUBAGENT = /[\\/]subagents[\\/]agent-([^\\/]+)[.]jsonl$/i;
    var chats = new Map();

    async function metaOf(file) {
        try {
            var m = JSON.parse(await fsp.readFile(file.replace(/[.]jsonl$/i, ".meta.json"), "utf8"));
            return { label: typeof m.description === "string" ? m.description : "", type: typeof m.agentType === "string" ? m.agentType : "" };
        } catch (e) { return { label: "", type: "" }; }
    }

    /* Takes in what the chat's transcripts gained; true when who made a file may have changed. */
    async function read(c, id) {
        var files = await T.find(id), now = new Map(), changed = files.length !== c.followed.size;
        for (var file of files) {
            var k = file.toLowerCase(), f = c.followed.get(k);
            if (!f) {
                var m = SUBAGENT.exec(file), key = m ? m[1] : "main";
                f = Object.assign({ key: key }, key === "main" ? { label: "", type: "" } : await metaOf(file), { ledger: F.follow(file, C.kind) });
                changed = true;
            }
            var before = f.ledger.replay.seen, got = await f.ledger.read();
            changed = changed || got === null || got.size > 0 || f.ledger.replay.seen !== before;
            now.set(k, f);
        }
        c.followed = now;
        return changed;
    }

    /* The chat's files in groups, the chat first, then its subagents, then "unclear":
       { key, label, type, count, bytes }, and byPath: lower-cased path -> key. */
    async function groups(id, data) {
        var c = chats.get(id);
        if (!c) chats.set(id, (c = { followed: new Map(), files: null, shells: -1, result: null }));
        var changed = await read(c, id), shells = 0;
        data.spawns.forEach(function (list) { shells += list.length; });
        if (!changed && c.files === data.files && c.shells === shells && c.result) return c.result;
        var agents = Array.from(c.followed.values()).map(function (f) { return { key: f.key, label: f.label, type: f.type, replay: f.ledger.replay }; });
        if (!agents.some(function (a) { return a.key === "main"; })) agents.unshift({ key: "main", label: "", type: "" });
        agents.sort(function (a, b) { return a.key === "main" ? -1 : b.key === "main" ? 1 : 0; });
        var who = W.make(agents.filter(function (a) { return a.replay; }), data.spawns), byPath = new Map();
        var out = new Map(agents.concat({ key: "unclear", label: "", type: "" }).map(function (a) {
            return [a.key, { key: a.key, label: a.label, type: a.type, count: 0, bytes: 0, files: [] }];
        }));
        data.files.forEach(function (f) {
            var g = out.get(who(f) || "unclear") || out.get("main");
            g.count++; g.bytes += f.size || 0; g.files.push(f);
            byPath.set(f.path.toLowerCase(), g.key);
        });
        c.files = data.files; c.shells = shells;
        c.result = { list: Array.from(out.values()).filter(function (g) { return g.count > 0; }), byPath: byPath };
        return c.result;
    }

    return { groups: groups, forget: function (id) { chats.delete(id); } };
})();
