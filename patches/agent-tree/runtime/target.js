/* agent-tree: the message box follows the view (lib/js/ccTarget.js). While an
   agent's view is open, the box under it talks to that agent
   (patches/agent-input, patches/prompt-queue); leaving the view, or opening a
   background task's, gives it back to the main conversation. Without
   agent-input (a CLI before mods) nothing can reach an agent, so the view
   claims nothing and covers the box as it always did. */
(function (A) {
    A.talksToAgents = function () { return !!window.__ccAgentInput; };

    function targetOf(agent) {
        return { agentId: agent.agentId || agent.taskId, taskId: agent.taskId, name: agent.description };
    }

    /* A ref for the agent's view. Memoized per agent, so React calls it when
       the view mounts, when it unmounts and when it moves to another agent -
       never on a plain re-render, which would flap the target. */
    A.useTargetRef = function (K, agent) {
        var t = targetOf(agent);
        return K.useMemo(function () {
            return function (el) {
                if (!A.talksToAgents()) return;
                if (el) window.__ccTarget.show(t);
                else window.__ccTarget.hide(t);
            };
        }, [t.taskId]);
    };

    /* The line under the agent's transcript, just above the box: where what is
       typed goes, what the agent does with it, and why the last one did not go
       (lib/js/ccTarget.js note). Subscribed while it is on screen. */
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
                h("div", { className: "cc-at-tohow", children: ["The message box below talks to this agent. ", how] }, "how"),
                note[0] ? h("div", { className: "cc-at-tofail", children: note[0] }, "fail") : null
            ]
        });
    };
})(window.__ccAT = window.__ccAT || {});
