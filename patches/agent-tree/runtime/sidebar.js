/* agent-tree: the sidebar. Collapsed it is a rail with one button and a count
   of what is running; open it is the tree: the main conversation at the root,
   its agents (nested as they spawned each other) and every agent's background
   tasks under it. */
(function (A) {
    function MainNode(p) {
        var ctx = p.ctx, K = ctx.K, h = K.h, s = ctx.session;
        K.track();
        var asks = s.permissionRequests.value.some(function (r) { return !r.agentId; });
        var busy = s.visiblyBusy.value;
        var kids = p.model.roots.map(function (n) {
            return h(A.AgentNode, { ctx: ctx, node: n, depth: 1 }, n.agent.taskId);
        }).concat(p.model.main.map(function (t) {
            return h(A.TaskRow, { ctx: ctx, task: t, depth: 1 }, t.taskId);
        }));
        return h(A.Row, {
            ctx: ctx,
            id: "main",
            depth: 0,
            open: !ctx.collapsed.has("main"),
            hasKids: kids.length > 0,
            active: busy || asks,
            selected: !ctx.sel,
            dot: asks ? "waiting" : busy ? "running" : "idle",
            label: s.summary.value || "This session",
            meta: asks ? "Main conversation · waiting for you" : busy ? "Main conversation · working" : "Main conversation",
            title: "Back to the main conversation",
            onSelect: function () { ctx.select(null); },
            children: kids
        });
    }

    function Unknown(p) {
        var h = p.ctx.K.h;
        if (p.model.unknown.length === 0) return null;
        return h("div", {
            className: "cc-at-unknown",
            children: [
                h("div", { className: "cc-at-head", children: "Background tasks, agent unknown" }, "h"),
                p.model.unknown.map(function (t) {
                    return h(A.TaskRow, { ctx: p.ctx, task: t, depth: 0 }, t.taskId);
                })
            ]
        });
    }

    function Rail(p) {
        var h = p.ctx.K.h, n = p.running;
        return h("button", {
            type: "button",
            className: "cc-at-railbtn",
            "aria-label": "Show the agent tree",
            title: n > 0 ? "Show the agent tree: " + n + " running" : "Show the agent tree",
            onClick: function () { p.ctx.setOpen(true); },
            children: [
                A.treeIcon(h),
                n > 0 ? h("span", { className: "cc-at-badge", children: n }, "n") : null
            ]
        });
    }

    A.Sidebar = function (p) {
        var ctx = p.ctx, h = ctx.K.h;
        if (!ctx.open) {
            return h("aside", { className: "cc-at cc-at-rail", "data-cc": "", children: h(Rail, p) });
        }
        return h("aside", {
            className: "cc-at cc-at-open",
            "data-cc": "",
            "aria-label": "Agent tree",
            children: [
                h("div", {
                    className: "cc-at-top",
                    children: [
                        h("span", { className: "cc-at-title", children: "Agents" }, "t"),
                        h("button", {
                            type: "button",
                            className: "cc-at-close",
                            "aria-label": "Collapse the agent tree",
                            title: "Collapse the agent tree",
                            onClick: function () { ctx.setOpen(false); },
                            children: A.chevron(h)
                        }, "c")
                    ]
                }, "top"),
                h("div", {
                    role: "tree",
                    className: "cc-at-tree",
                    children: [h(MainNode, p, "main"), h(Unknown, p, "unknown")]
                }, "tree")
            ]
        });
    };
})(window.__ccAT = window.__ccAT || {});
