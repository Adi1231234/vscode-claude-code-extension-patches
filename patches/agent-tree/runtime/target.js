/* agent-tree: the message box follows the view (lib/js/ccTarget.js). While an
   agent's view is open, the box under it talks to that agent
   (patches/agent-input, patches/prompt-queue); leaving the view, or opening a
   background task's, gives it back to the main conversation. Without
   agent-input (a CLI before mods) nothing can reach an agent, so the view
   claims nothing and covers the box as it always did. */
(function (A) {
    A.talksToAgents = function () { return !!window.__ccAgentInput; };

    /* A ref for the agent's view. Memoized per agent, so React calls it when
       the view mounts, when it unmounts and when it moves to another agent -
       never on a plain re-render, which would flap the target. */
    A.useTargetRef = function (K, agent) {
        var t = { agentId: agent.agentId || agent.taskId, taskId: agent.taskId, name: agent.description };
        return K.useMemo(function () {
            return function (el) {
                if (!A.talksToAgents()) return;
                if (el) window.__ccTarget.show(t);
                else window.__ccTarget.hide(t);
            };
        }, [t.taskId]);
    };
})(window.__ccAT = window.__ccAT || {});
