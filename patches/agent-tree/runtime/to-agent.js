/* agent-tree: the line under the agent's transcript, just above the message
   box: that the box talks to this agent, what the agent does with a message,
   and why the last one to it did not go - from the box or from its queue
   lane (lib/js/ccTarget.js noteFor). Subscribed while it is on screen. */
(function (A) {
    A.ToAgent = function (p) {
        var K = p.K, h = K.h, id = p.agentId;
        var note = K.useState(window.__ccTarget.noteFor(id));
        var ref = K.useMemo(function () {
            var off = null;
            return function (el) {
                if (off) { off(); off = null; }
                if (el) off = window.__ccTarget.notes(function () { note[1](window.__ccTarget.noteFor(id)); });
            };
        }, [id]);
        var how = p.running ? "It reads a message at its next step." : "A message wakes it up to carry on.";
        return h("div", {
            ref: ref,
            className: "cc-at-to",
            role: "status",
            children: [
                h("div", { children: ["The message box below talks to this agent. ", how] }, "how"),
                note[0] ? h("div", { className: "cc-at-tofail", children: note[0] }, "fail") : null
            ]
        });
    };
})(window.__ccAT = window.__ccAT || {});
