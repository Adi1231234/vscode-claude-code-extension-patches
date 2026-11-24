/* agent-tree: the collapsed sidebar. A button that opens the tree, then one
   icon for the main conversation and one per agent, in tree order. Clicking an
   icon shows that conversation exactly as a click on its tree row does, so the
   agents can be switched between without opening the tree. Each icon is the
   first letter of the agent's description with the app's own status dot on
   its corner: running ones pulse, ended ones are dimmed; the full description
   and status are in its tooltip. */
(function (A) {
    function initial(text) {
        var first = Array.from(String(text || "").trim())[0];
        return first ? first.toUpperCase() : "?";
    }

    function Icon(p) {
        var K = p.K, h = K.h, st = p.status;
        var cls = "cc-at-icon" + (st.active ? " cc-at-live" : " cc-at-done") +
            (st.selected ? " cc-at-selected" : "");
        return h("button", {
            type: "button",
            className: cls,
            title: p.title,
            "aria-label": p.title,
            "aria-current": st.selected ? "true" : undefined,
            onClick: st.select,
            children: [
                h("span", { className: "cc-at-face", "aria-hidden": "true", children: p.face }, "f"),
                h(K.dot, { state: st.dot, className: "cc-at-icondot" + (st.active ? " cc-at-pulse" : "") }, "d")
            ]
        });
    }

    A.Rail = function (p) {
        var ctx = p.ctx, K = ctx.K, h = K.h;
        K.track();
        var main = A.mainStatus(ctx);
        var icons = A.flatten(p.model.roots).map(function (agent) {
            var st = A.agentStatus(ctx, agent);
            return h(Icon, { K: K, status: st, face: initial(agent.description), title: st.title }, agent.taskId);
        });
        return [
            h("button", {
                type: "button",
                className: "cc-at-railbtn",
                "aria-label": "Open the agent tree",
                title: "Open the agent tree",
                onClick: function () { ctx.setOpen(true); },
                children: A.treeIcon(h)
            }, "open"),
            h("span", { className: "cc-at-railsep", "aria-hidden": "true" }, "sep"),
            h(Icon, { K: K, status: main, face: A.chatIcon(h), title: "Main conversation: " + main.label }, "main")
        ].concat(icons);
    };
})(window.__ccAT = window.__ccAT || {});
