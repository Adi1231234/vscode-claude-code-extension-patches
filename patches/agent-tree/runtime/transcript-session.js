/* agent-tree: the session the agent's view fetches its transcript through.

   The app fetches an agent's transcript once and then draws what the agent
   streams into the store - and a message the box hands an agent is never in
   that stream, only in the transcript. Measured: a message that woke the
   agent and one sent mid-run were both missing until the view was opened
   again. The view's fetch depends on the session's identity, so this hands it
   a new one exactly when there may be something new: per state of the agent,
   and - only while a message the box sent is not in the view yet - per row
   the agent streams (the CLI writes the message to the transcript before the
   agent's next request, so a new row means it is there).

   Everything else about the session is its own, bound to it and kept, so a
   hook that depends on one member sees the same function on every render.
   Its transcript comes back with the box's rows un-marked
   (runtime/typed-rows.js). */
(function (A) {
    /* The CLI queues transcript lines and writes them every 100 ms
       (FLUSH_INTERVAL_MS, 2.1.331), so the file trails the events the store
       hears: measured, a fetch made as the agent finished read 37 frames, and
       the message and the answer it had already streamed came to 39 a moment
       later. While a message is waiting to be seen, a fetch waits this long,
       so it reads the file after the write that holds what the event said. */
    var SETTLE_MS = 300;
    var seen = new Map(), sessions = new WeakMap();

    function seenBy(taskId) {
        if (!seen.has(taskId)) seen.set(taskId, new Set());
        return seen.get(taskId);
    }

    function pending(taskId) {
        if (!window.__ccOutbox) return false;
        var have = seenBy(taskId);
        return window.__ccOutbox.sentHere(taskId).some(function (t) { return !have.has(t); });
    }

    /* How many rows the agent has streamed into the conversation's store. */
    function streamed(s, callId) {
        var l = s.drawnMessages && s.drawnMessages.value;
        if (!callId || !Array.isArray(l)) return 0;
        var n = 0;
        for (var i = 0; i < l.length; i++) if (l[i].sdkParentToolUseId === callId || l[i].parentToolUseId === callId) n++;
        return n;
    }

    function fetcher(t, get) {
        return function (taskId) {
            var args = arguments, have = seenBy(taskId);
            var settled = pending(taskId) ? new Promise(function (go) { setTimeout(go, SETTLE_MS); }) : Promise.resolve();
            return settled.then(function () { return get.apply(t, args); }).then(function (r) {
                if (!r || !Array.isArray(r.frames)) return r;
                var frames = r.frames.map(function (f) { return A.unmark(f, taskId, function (text) { have.add(text); }); });
                return Object.assign({}, r, { frames: frames });
            });
        };
    }

    function session(s, taskId, version) {
        var held = sessions.get(s);
        if (held && held.version === version && held.taskId === taskId) return held.proxy;
        var bound = new Map();
        var p = new Proxy(s, {
            get: function (t, k) {
                if (bound.has(k)) return bound.get(k);
                var v = t[k];
                if (typeof v !== "function") return v;
                var f = k === "getSubagentTranscript" ? fetcher(t, v) : v.bind(t);
                bound.set(k, f);
                return f;
            }
        });
        sessions.set(s, { proxy: p, version: version, taskId: taskId });
        return p;
    }

    /* Rows are read only while a message is pending, so the view is not
       re-drawn for every row of the conversation otherwise. */
    A.transcriptSession = function (s, agent) {
        var v = agent.status;
        if (pending(agent.taskId)) v += "|" + streamed(s, agent.toolUseId) + "|" + ((agent.usage || {}).toolUses || 0);
        return session(s, agent.taskId, v);
    };
})(window.__ccAT = window.__ccAT || {});
