/* agent-tree: what the person typed to an agent, drawn in its transcript as
   the person's own message.

   A message sent from the message box (patches/agent-input) reaches the agent
   as a queued row the CLI marks meta, with the origin it gives a plugin's
   message: { kind: "coordinator", plugin: "agent-input" }; one that wakes a
   finished agent also comes inside the CLI's own words ("The coordinator sent
   a message while you were working: ..."). Read off a lab transcript on
   2.1.331. The app's transcript view draws a row that arrives mid-run as
   "from the main agent" or "Sender not recorded", and leaves a meta one out:
   nobody could type to an agent in this panel before. Measured: as it came,
   the message was not drawn at all; un-marked, it read "Sender not recorded".

   The view builds its rows from two sources, and both are met here:
   - the transcript it fetches: the agent's view gets the session with one
     difference - those frames come back from getSubagentTranscript
     un-marked, their ids noted (the app then strips the origin);
   - the live rows a running agent streams into the store: they keep the
     origin and are handed to the row renderer as they are.
   The row renderer the view is given draws either as a copy that is plainly
   the person's - not synthetic, no origin, outside the app's own "sender not
   recorded" set (a WeakSet of the row objects) - holding just what they typed
   (lib/js/ccAgentStore.js sentTo). Every other member of the session is its
   own, bound to it and kept, so a hook that depends on one sees the same
   function on every render. */
(function (A) {
    var PLUGIN = "agent-input";
    /* The CLI queues transcript lines and writes them every 100 ms
       (FLUSH_INTERVAL_MS, 2.1.331), so the file trails the events the store
       hears: measured, a fetch made as the agent finished read 37 frames, and
       the message and the answer it had already streamed came to 39 a moment
       later. While a message is waiting to be seen, a fetch waits this long,
       so it reads the file after the write that holds what the event said. */
    var SETTLE_MS = 300;
    var typed = new Set(), seen = new Map(), sessions = new WeakMap();

    function fromBox(origin) {
        return !!origin && origin.plugin === PLUGIN;
    }

    /* What the person typed, out of what the agent was handed. */
    function ownText(text, taskId) {
        if (typeof text !== "string" || !window.__ccAgentStore) return text;
        var best = "";
        window.__ccAgentStore.sentTo(taskId).forEach(function (t) {
            if (t.length > best.length && text.indexOf(t) >= 0) best = t;
        });
        return best || text;
    }

    function seenBy(taskId) {
        if (!seen.has(taskId)) seen.set(taskId, new Set());
        return seen.get(taskId);
    }

    function unmarked(f, taskId) {
        if (!f || f.type !== "user" || !fromBox(f.origin)) return f;
        if (typeof f.uuid === "string") typed.add(f.uuid);
        if (f.message && typeof f.message.content === "string") seenBy(taskId).add(ownText(f.message.content, taskId));
        return Object.assign({}, f, { is_meta: false, isMeta: false, isQueuedCommand: false });
    }

    /* A message the box sent that the view has not fetched yet. The app
       fetches an agent's transcript once and then draws what the agent
       streams, and a message handed to it is not in that stream: measured, a
       message that woke the agent and one sent mid-run were both missing
       until the view was opened again. */
    function pending(taskId) {
        if (!window.__ccAgentStore) return false;
        var have = seenBy(taskId);
        return window.__ccAgentStore.sentHere(taskId).some(function (t) { return !have.has(t); });
    }

    /* The rows the agent has streamed into the conversation's store. The
       message it was handed is never among them (measured), but the CLI
       writes it to the transcript before the agent's next request, so a new
       row means the transcript holds it. */
    function streamed(s, callId) {
        var l = s.drawnMessages && s.drawnMessages.value;
        if (!callId || !Array.isArray(l)) return 0;
        var n = 0;
        for (var i = 0; i < l.length; i++) if (l[i].sdkParentToolUseId === callId || l[i].parentToolUseId === callId) n++;
        return n;
    }

    /* The session the agent's view fetches through. Its identity is what the
       view's fetch depends on, so a new one fetches again: one per state of
       the agent, and - only while a message the box sent is not in the view
       yet - one per row the agent streams. Read only then, so the view is not
       re-drawn for every row otherwise. */
    A.transcriptSession = function (s, agent) {
        var v = agent.status;
        if (pending(agent.taskId)) v += "|" + streamed(s, agent.toolUseId) + "|" + ((agent.usage || {}).toolUses || 0);
        return A.withOwnRows(s, agent.taskId, v);
    };

    A.withOwnRows = function (s, taskId, version) {
        var held = sessions.get(s);
        if (held && held.version === version && held.taskId === taskId) return held.proxy;
        var bound = new Map(), p;
        p = new Proxy(s, {
            get: function (t, k) {
                if (bound.has(k)) return bound.get(k);
                var v = t[k];
                if (typeof v !== "function") return v;
                var f = k === "getSubagentTranscript"
                    ? function (id) {
                        var args = arguments;
                        var settled = pending(id) ? new Promise(function (go) { setTimeout(go, SETTLE_MS); }) : Promise.resolve();
                        return settled.then(function () { return v.apply(t, args); }).then(function (r) {
                            if (!r || !Array.isArray(r.frames)) return r;
                            return Object.assign({}, r, { frames: r.frames.map(function (fr) { return unmarked(fr, id); }) });
                        });
                    }
                    : v.bind(t);
                bound.set(k, f);
                return f;
            }
        });
        sessions.set(s, { proxy: p, version: version, taskId: taskId });
        return p;
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
