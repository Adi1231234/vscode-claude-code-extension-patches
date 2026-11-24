/* agent-tree: the "Only active agents" switch under the tree's header, on by
   default. The whole row is the control, as in the app's own settings rows,
   and the switch is drawn to the app's measurements (CLAUDE.md: a 32x18
   track, a 14px thumb, .15s). While it hides anything it says how many. The
   rail follows the same choice. */
(function (A) {
    A.Filter = function (p) {
        var ctx = p.ctx, h = ctx.K.h, on = ctx.onlyActive, hidden = p.model.hidden;
        return h("button", A.tipFor({
            type: "button",
            role: "switch",
            "aria-checked": on,
            className: "cc-at-filter",
            onClick: function () { ctx.setOnlyActive(!on); },
            children: [
                h("span", {
                    className: "cc-at-filtertext",
                    children: [
                        "Only active agents",
                        on && hidden > 0 ? h("span", { className: "cc-at-hidden", children: hidden + " hidden" }, "n") : null
                    ]
                }, "t"),
                h("span", {
                    className: "cc-at-switch",
                    "aria-hidden": "true",
                    children: h("span", { className: "cc-at-thumb" })
                }, "s")
            ]
        }, A.textTip(ctx, on ? "Show the agents that ended too" : "Show only the agents that are running")));
    };
})(window.__ccAT = window.__ccAT || {});
