/* agent-tree: the line under the agent's transcript, just above the message
   box: that the box talks to this agent, what the agent does with a message,
   and why the last one did not go (lib/js/ccTarget.js note). Subscribed while
   it is on screen. */
(function (A) {
    A.ToAgent = function (p) {
        var K = p.K, h = K.h;
        var note = K.useState(window.__ccTarget.noteText());
        var ref = K.useMemo(function () {
            var off = null;
            return function (el) {
                if (off) { off(); off = null; }
                if (el) off = window.__ccTarget.notes(function (t) { note[1](t); });
            };
        }, []);
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
