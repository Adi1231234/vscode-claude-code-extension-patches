/* agent-tree: one row of the tree, and the three kinds that use it.
   A row is a disclosure button (when it has anything under it), the app's own
   status dot, a label and a meta line. Running rows keep full colour and a
   pulsing dot; ended ones are dimmed, so the two read apart at a glance. */
(function (A) {
    function Twist(p) {
        var h = p.ctx.K.h;
        if (!p.hasKids) return h("span", { className: "cc-at-twist cc-at-twist-none" });
        return h("button", {
            type: "button",
            className: "cc-at-twist",
            "aria-label": p.open ? "Collapse" : "Expand",
            title: p.open ? "Hide what is under it" : "Show what is under it",
            onClick: function () { p.ctx.toggle(p.id); },
            children: A.chevron(h)
        });
    }

    /* The generic row. p: ctx, id, depth, open, hasKids, active, selected,
       dot, label, meta, title, onSelect, children (the rows under it). */
    A.Row = function (p) {
        var K = p.ctx.K, h = K.h;
        var cls = "cc-at-row" + (p.active ? " cc-at-live" : " cc-at-done") +
            (p.selected ? " cc-at-selected" : "");
        return h("div", {
            role: "treeitem",
            "aria-level": p.depth + 1,
            "aria-expanded": p.hasKids ? p.open : undefined,
            "aria-selected": p.selected,
            className: "cc-at-item",
            children: [
                h("div", {
                    className: cls,
                    style: { "--cc-at-depth": p.depth },
                    children: [
                        h(Twist, p, "twist"),
                        h("button", {
                            type: "button",
                            className: "cc-at-pick",
                            title: p.title,
                            onClick: p.onSelect,
                            children: [
                                h(K.dot, { state: p.dot, className: p.active ? "cc-at-pulse" : "" }),
                                h("span", { className: "cc-at-label", children: p.label }),
                                h("span", { className: "cc-at-meta", children: p.meta })
                            ]
                        }, "pick")
                    ]
                }, "row"),
                p.open && p.hasKids ? h("div", { role: "group", children: p.children }, "kids") : null
            ]
        });
    };

    A.TaskRow = function (p) {
        var K = p.ctx.K, h = K.h, t = p.task, sel = p.ctx.sel;
        return h(A.Row, {
            ctx: p.ctx,
            id: "task:" + t.taskId,
            depth: p.depth,
            hasKids: false,
            active: true,
            selected: !!sel && sel.kind === "task" && sel.id === t.taskId,
            dot: "running",
            label: K.taskLabel(t),
            meta: h(K.taskTime, { task: t }),
            title: "Background task: " + K.taskLabel(t),
            onSelect: function () { p.ctx.select({ kind: "task", id: t.taskId, task: t }); }
        });
    };

    A.AgentNode = function (p) {
        var ctx = p.ctx, K = ctx.K, h = K.h, node = p.node, a = node.agent;
        var key = A.keyOf(a), st = K.status(a, ctx.waiting);
        var open = !ctx.collapsed.has(key);
        var kids = node.children.map(function (c) {
            return h(A.AgentNode, { ctx: ctx, node: c, depth: p.depth + 1 }, c.agent.taskId);
        }).concat(node.tasks.map(function (t) {
            return h(A.TaskRow, { ctx: ctx, task: t, depth: p.depth + 1 }, t.taskId);
        }));
        return h(A.Row, {
            ctx: ctx,
            id: key,
            depth: p.depth,
            open: open,
            hasKids: kids.length > 0,
            active: A.isActive(st),
            selected: !!ctx.sel && ctx.sel.kind === "agent" && ctx.sel.key === key,
            dot: K.dotState(st),
            label: a.description,
            meta: [
                h("span", { children: K.labels[st] }, "s"),
                h("span", { className: "cc-at-time", children: h(K.agentTime, { agent: a }) }, "t")
            ],
            title: K.labels[st] + ": " + a.description,
            onSelect: function () { ctx.select({ kind: "agent", key: key }); },
            children: kids
        });
    };
})(window.__ccAT = window.__ccAT || {});
