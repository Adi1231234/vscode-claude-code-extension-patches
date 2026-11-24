/* agent-tree: what the person typed to an agent, drawn in its transcript as
   the person's own message.

   A message from the message box (patches/agent-input) reaches the agent as a
   queued row the CLI marks meta, with the origin it gives a plugin's message,
   { kind: "coordinator", plugin: "agent-input" }; one that wakes a finished
   agent comes inside the CLI's own words ("The coordinator sent a message
   while you were working: ..."). The app's transcript view draws a row that
   arrives mid-run only as "from the main agent" or "Sender not recorded", and
   leaves a meta one out - nobody could type to an agent in this panel before.
   Measured on 2.1.331: as it came, the message was not drawn; un-marked, it
   read "Sender not recorded".

   So the transcript the view fetches comes back with those rows un-marked
   (unmark, used by runtime/transcript-session.js), and the row renderer the
   view is given draws each as a copy that is plainly the person's: not
   synthetic, no origin, outside the app's own "sender not recorded" set (a
   WeakSet of the row objects), holding just what was typed
   (lib/js/ccOutbox.js sentTo). A fetched row has lost its origin by then,
   so its id is noted; a row the store streams keeps it. */
(function (A) {
    var PLUGIN = "agent-input";
    var typed = new Set();

    function fromBox(origin) {
        return !!origin && origin.plugin === PLUGIN;
    }

    /* What the person typed, out of what the agent was handed. */
    function ownText(text, taskId) {
        if (typeof text !== "string" || !window.__ccOutbox) return text;
        var best = "";
        window.__ccOutbox.sentTo(taskId).forEach(function (t) {
            if (t.length > best.length && text.indexOf(t) >= 0) best = t;
        });
        return best || text;
    }

    /* A fetched frame, un-marked if it came from the box; seen(text, frame)
       is told what was typed in it. */
    A.unmark = function (f, taskId, seen) {
        if (!f || f.type !== "user" || !fromBox(f.origin)) return f;
        if (typeof f.uuid === "string") typed.add(f.uuid);
        if (f.message && typeof f.message.content === "string") seen(ownText(f.message.content, taskId), f);
        return Object.assign({}, f, { is_meta: false, isMeta: false, isQueuedCommand: false });
    };

    function asOwn(row, taskId) {
        var blocks = row.content || [];
        var text = blocks.map(function (b) { return b.content && b.content.type === "text" ? b.content.text : ""; }).join("");
        var mine = ownText(text, taskId);
        var content = mine !== text && blocks[0] ? [new blocks[0].constructor({ type: "text", text: mine })] : blocks;
        return row.copyWith({ isSynthetic: false, origin: undefined, content: content });
    }

    A.ownRenderRow = function (render, taskId) {
        if (typeof render !== "function") return render;
        return function (row) {
            var args = Array.prototype.slice.call(arguments);
            if (row && row.type === "user" && typeof row.copyWith === "function" &&
                (typed.has(row.uuid) || fromBox(row.origin))) args[0] = asOwn(row, taskId);
            return render.apply(this, args);
        };
    };
})(window.__ccAT = window.__ccAT || {});
