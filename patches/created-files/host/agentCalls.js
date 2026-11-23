/* The commands one transcript ran (its Bash, PowerShell and Monitor calls), each
   with when it began and ended, followed as the transcript grows (follow.js), with
   the files its Write tool made (transcript.js). The same as adi-tools'
   packages/created-files/agents/toolCalls.mjs; change the two together. A
   background call ends when its task-notification comes, not with its result. */
globalThis.__ccCFAgentCalls = globalThis.__ccCFAgentCalls || (function () {
    var T = globalThis.__ccCFTranscript;
    var NEEDLES = ['"command":', '"tool_use_id"', "<task-notification>"].map(function (s) { return Buffer.from(s); });
    var TASK_ID = /with ID: ([A-Za-z0-9_-]+)/, NOTIFIED = /<tool-use-id>([^<]+)<\/tool-use-id>/g;

    function blocks(o) { var c = o && o.message && o.message.content; return Array.isArray(c) ? c : []; }
    function textOf(c) {
        if (typeof c === "string") return c;
        return Array.isArray(c) ? c.map(function (x) { return (x && x.text) || ""; }).join("") : "";
    }

    function takeLine(r, o) {
        var t = Date.parse(o.timestamp);
        if (!isFinite(t)) return;
        blocks(o).forEach(function (b) {
            if (b && b.type === "tool_use" && b.input && typeof b.input.command === "string")
                r.calls.set(b.id, { id: b.id, tool: b.name, command: b.input.command, t: t, end: Infinity, background: !!b.input.run_in_background });
            if (!b || b.type !== "tool_result" || !r.calls.has(b.tool_use_id)) return;
            var call = r.calls.get(b.tool_use_id), task = TASK_ID.exec(textOf(b.content));
            if (task) r.byTask.set(task[1], call);
            if (!call.background) call.end = t;
        });
        var said = typeof (o.message && o.message.content) === "string" ? o.message.content
            : blocks(o).map(function (b) { return textOf(b && (b.content || b.text)); }).join("");
        for (var m of said.matchAll(NOTIFIED)) { var c = r.calls.get(m[1]); if (c) c.end = t; }
    }

    var kind = {
        /* seen: how many lines about calls were taken in, so a reader can tell that a call began or ended. */
        create: function () { return Object.assign(T.kind.create(), { calls: new Map(), byTask: new Map(), seen: 0 }); },
        take: async function (r, buf) {
            var touched = await T.kind.take(r, buf);
            T.linesWith(buf, NEEDLES).forEach(function (span) {
                var o;
                try { o = JSON.parse(buf.toString("utf8", span[0], span[1])); } catch (e) { return; }
                if (o && typeof o === "object") { takeLine(r, o); r.seen++; }
            });
            return touched;
        }
    };

    return { kind: kind };
})();
