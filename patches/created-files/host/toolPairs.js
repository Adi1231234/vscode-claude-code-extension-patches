/* What a subagent's transcript says it wrote. A subagent's transcript carries no
   `toolUseResult` (277 of 277 subagent transcripts with a Write or an Edit, CLI
   2.1.330, 2026-11-23), so the line transcript.js reads in a chat's own transcript is
   not there, and nothing a subagent wrote itself was ever listed. What is there: the
   Write or Edit call (its file_path) and, later, its result ("File created
   successfully at: ..." for a new file), paired by the call's id. Adi Tools carries
   the same (packages/created-files/toolPairs.mjs). */
globalThis.__ccCFToolPairs = globalThis.__ccCFToolPairs || (function () {
    /* The lines worth parsing: a Write or Edit call, or the result of one. */
    var NEEDLES = ['"name":"Write"', '"name":"Edit"', "File created successfully at", "has been updated"]
        .map(function (s) { return Buffer.from(s); });
    var WRITERS = { Write: true, Edit: true }, CREATED = "File created successfully at";

    function blocks(o) { var c = o && o.message && o.message.content; return Array.isArray(c) ? c : []; }
    function textOf(c) {
        if (typeof c === "string") return c;
        return Array.isArray(c) ? c.map(function (x) { return (x && x.text) || ""; }).join("") : "";
    }

    /* The write a parsed line completes, as { path, created }; null when it completes
       none. A call waits in `pending` (id -> path) until its result comes. */
    function pairedWrite(pending, o) {
        var list = blocks(o);
        list.forEach(function (b) {
            if (b && b.type === "tool_use" && WRITERS[b.name] && b.input && typeof b.input.file_path === "string") pending.set(b.id, b.input.file_path);
        });
        for (var i = 0; i < list.length; i++) {
            var b = list[i];
            if (!b || b.type !== "tool_result" || !pending.has(b.tool_use_id)) continue;
            var p = pending.get(b.tool_use_id);
            pending.delete(b.tool_use_id);
            if (!b.is_error) return { path: p, created: textOf(b.content).indexOf(CREATED) === 0 };
        }
        return null;
    }

    return { NEEDLES: NEEDLES, pairedWrite: pairedWrite };
})();
