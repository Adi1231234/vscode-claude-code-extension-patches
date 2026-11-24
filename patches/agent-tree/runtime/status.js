/* agent-tree: what a tree row and a rail icon both show about the main
   conversation and about an agent - read in one place, so the two never
   disagree. Callers are components that already track the store's signals. */
(function (A) {
    A.mainStatus = function (ctx) {
        var s = ctx.session;
        var asks = s.permissionRequests.value.some(function (r) { return !r.agentId; });
        var busy = s.visiblyBusy.value;
        return {
            active: busy || asks,
            dot: asks ? "waiting" : busy ? "running" : "idle",
            label: s.summary.value || "This session",
            meta: asks ? "Main conversation · waiting for you" : busy ? "Main conversation · working" : "Main conversation",
            selected: !ctx.sel,
            select: function () { ctx.select(null); }
        };
    };

    A.agentStatus = function (ctx, agent) {
        var K = ctx.K, key = A.keyOf(agent), st = K.status(agent, ctx.waiting);
        return {
            key: key,
            status: st,
            active: A.isActive(st),
            dot: K.dotState(st),
            label: agent.description,
            title: K.labels[st] + ": " + agent.description,
            selected: !!ctx.sel && ctx.sel.kind === "agent" && ctx.sel.key === key,
            select: function () { ctx.select({ kind: "agent", key: key }); }
        };
    };
})(window.__ccAT = window.__ccAT || {});
