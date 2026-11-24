/* agent-tree: the sidebar. Collapsed it is the rail (rail.js): an icon for the
   main conversation and one per agent. Open it is the tree: the main
   conversation at the root, its agents (nested as they spawned each other) and
   every agent's background tasks under it. */
(function (A) {
    function MainNode(p) {
        var ctx = p.ctx, K = ctx.K, h = K.h;
        K.track();
        var st = A.mainStatus(ctx);
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
            active: st.active,
            selected: st.selected,
            dot: st.dot,
            glyph: A.chatIcon(h),
            label: st.label,
            meta: st.meta,
            title: "Back to the main conversation",
            onSelect: st.select,
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

    /* "Agents" and, while anything runs, how many agents and tasks do. */
    function Title(p) {
        var ctx = p.ctx, K = ctx.K, h = K.h;
        K.track();
        var running = A.flatten(p.model.roots).filter(function (a) {
            return A.isActive(K.status(a, ctx.waiting));
        }).length + ctx.taskCount;
        return h("span", {
            className: "cc-at-title",
            children: [
                "Agents",
                running > 0 ? h("span", { className: "cc-at-count", children: running + " running" }, "n") : null
            ]
        });
    }

    A.Sidebar = function (p) {
        var ctx = p.ctx, h = ctx.K.h;
        if (!ctx.open) {
            return h("aside", {
                className: "cc-at cc-at-rail",
                "data-cc": "",
                "aria-label": "Agents",
                children: h(A.Rail, p)
            });
        }
        return h("aside", {
            className: "cc-at cc-at-open",
            "data-cc": "",
            "aria-label": "Agent tree",
            children: [
                h("div", {
                    className: "cc-at-top",
                    children: [
                        h(Title, p, "t"),
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
