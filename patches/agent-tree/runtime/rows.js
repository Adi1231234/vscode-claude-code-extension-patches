/* agent-tree: one row of the tree, and the kinds that use it.
   A row is a disclosure button (when it has anything under it), a status
   lead, a label and a meta line. Running rows keep full colour and a pulsing
   dot; ended ones are dimmed, so the two read apart at a glance. */
(function (A) {
    function Twist(p) {
        var h = p.ctx.K.h;
        if (!p.hasKids) return h("span", { className: "cc-at-twist cc-at-twist-none" });
        return h("button", A.tipFor({
            type: "button",
            className: "cc-at-twist",
            "aria-label": p.open ? "Collapse" : "Expand",
            onClick: function () { p.ctx.toggle(p.id); },
            children: A.chevron(h)
        }, A.textTip(p.ctx, p.open ? "Hide what is under it" : "Show what is under it")));
    }

    /* What leads a row: the app's status dot, or for the main conversation
       and a background task a glyph that says what kind of row it is (its
       colour still says whether it runs). */
    function Lead(p) {
        var K = p.ctx.K, h = K.h;
        if (p.glyph) return h("span", { className: "cc-at-lead cc-at-lead-" + p.dot, children: p.glyph });
        return h("span", {
            className: "cc-at-lead",
            children: h(K.dot, { state: p.dot, className: p.active ? "cc-at-pulse" : "" })
        });
    }

    /* The generic row. p: ctx, id, depth, open, hasKids, active, selected,
       dot, glyph (optional), label, meta, tip (tip-content.js), onSelect,
       children (the rows under it, drawn in a group whose edge is the tree's
       indent guide). */
    A.Row = function (p) {
        var h = p.ctx.K.h;
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
                    children: [
                        h(Twist, p, "twist"),
                        h("button", A.tipFor({
                            type: "button",
                            className: "cc-at-pick",
                            onClick: p.onSelect,
                            children: [
                                h(Lead, p, "lead"),
                                h("span", { className: "cc-at-label", children: p.label }, "l"),
                                h("span", { className: "cc-at-meta", children: p.meta }, "m")
                            ]
                        }, p.tip), "pick")
                    ]
                }, "row"),
                p.open && p.hasKids ? h("div", { role: "group", className: "cc-at-group", children: p.children }, "kids") : null
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
            glyph: A.terminalIcon(h),
            label: K.taskLabel(t),
            meta: h(K.taskTime, { task: t }),
            tip: A.taskTip(p.ctx, t),
            onSelect: function () { p.ctx.select({ kind: "task", id: t.taskId, task: t }); }
        });
    };

    A.AgentNode = function (p) {
        var ctx = p.ctx, K = ctx.K, h = K.h, node = p.node, a = node.agent;
        var st = A.agentStatus(ctx, a), key = st.key;
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
            active: st.active,
            selected: st.selected,
            dot: st.dot,
            label: st.label,
            meta: [
                h("span", { className: "cc-at-st cc-at-st-" + st.status, children: K.labels[st.status] }, "s"),
                h("span", { className: "cc-at-time", children: h(K.agentTime, { agent: a }) }, "t")
            ],
            tip: A.agentTip(ctx, a),
            onSelect: st.select,
            children: kids
        });
    };
})(window.__ccAT = window.__ccAT || {});
