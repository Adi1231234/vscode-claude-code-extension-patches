/* agent-tree: what takes the conversation's place while an agent or a task is
   picked. It lies over the chat's transcript, down to the top of the message
   box; the chat itself stays mounted underneath, so the main conversation
   keeps running, keeps its scroll, and comes back exactly as it was. The body
   is the app's own "Open transcript" view (or, for a shell task, its own
   output view). While an agent's view is open, the box below talks to that
   agent (runtime/target.js). */
(function (A) {
    function StopButton(p) {
        var K = p.K, h = K.h;
        var busy = K.useState(false), failed = K.useState(false);
        if (!p.show) return null;
        return h("div", {
            className: "cc-at-acts",
            children: [
                h("button", {
                    type: "button",
                    className: K.list.actionButton + " " + K.list.dangerButton,
                    disabled: busy[0],
                    onClick: function () {
                        busy[1](true);
                        failed[1](false);
                        p.session.stopSubagent(p.taskId).then(function () { busy[1](false); },
                            function () { busy[1](false); failed[1](true); });
                    },
                    children: busy[0] ? "Stopping…" : p.label
                }, "b"),
                failed[0] ? h("span", { className: "cc-at-fail", children: "Could not stop it. It may have ended already." }, "f") : null
            ]
        });
    }

    /* The view ends at the top of the message box (runtime/inset.js), so the
       box and the permission cards drawn in its place stay in reach; foot is
       what sits between the transcript and the box. */
    function Frame(p) {
        var K = p.K, h = K.h;
        return h("section", {
            ref: p.paneRef,
            className: "cc-at-pane " + A.columnClasses(),
            "aria-label": p.aria,
            tabIndex: -1,
            onKeyDown: function (e) {
                if (e.key === "Escape") { e.stopPropagation(); p.onBack(); }
            },
            children: [
                h("header", {
                    className: "cc-at-panehead",
                    children: [
                        h("button", { type: "button", className: "cc-at-back", onClick: p.onBack, children: [A.chevron(h), "Main conversation"] }, "b"),
                        h("div", { className: "cc-at-panetitle", children: [h(K.dot, { state: p.dot }, "d"), h("span", { children: p.title }, "t")] }, "t"),
                        h("div", { className: "cc-at-panemeta", children: p.meta }, "m"),
                        p.stop
                    ]
                }, "head"),
                h("div", {
                    className: "cc-at-panebody " + A.listClasses(),
                    children: h("div", { className: "cc-at-follow", ref: A.followRef, children: p.body }, p.followKey)
                }, "body"),
                p.foot || null
            ]
        });
    }

    A.AgentPane = function (p) {
        var K = p.K, h = K.h, a = p.agent, s = p.session;
        K.track();
        var st = K.status(a, K.waitingSet(s.permissionRequests.value));
        var live = A.isActive(st);
        var meta = [K.labels[st], a.subagentType].filter(Boolean).join(" · ");
        return h(Frame, {
            K: K,
            session: s,
            paneRef: A.useTargetRef(K, a),
            foot: A.talksToAgents() ? h(A.ToAgent, { K: K, running: live }, "to") : null,
            aria: "Agent: " + a.description,
            followKey: "agent:" + a.taskId,
            onBack: p.onBack,
            dot: K.dotState(st),
            title: a.description,
            meta: [meta, h("span", { className: "cc-at-time", children: h(K.agentTime, { agent: a }) }, "t")],
            stop: h(StopButton, { K: K, show: live, session: s, taskId: a.taskId, label: "Stop agent" }, "stop:" + a.taskId),
            body: h(K.transcript, { session: A.transcriptSession(s, a), agent: a, running: live, renderRow: A.ownRenderRow(p.renderRow, a.taskId) }, a.taskId)
        });
    };

    A.TaskPane = function (p) {
        var K = p.K, h = K.h, t = p.task, s = p.session;
        var shell = p.context.host === "vscode" && t.taskType === "local_bash";
        return h(Frame, {
            K: K,
            session: s,
            aria: "Background task: " + K.taskLabel(t),
            followKey: "task:" + t.taskId,
            onBack: p.onBack,
            dot: p.running ? "running" : "idle",
            title: K.taskLabel(t),
            meta: [p.running ? "Running" : "Ended", h("span", { className: "cc-at-time", children: h(K.taskTime, { task: t }) }, "t")],
            stop: h(StopButton, { K: K, show: p.running, session: s, taskId: t.taskId, label: "Stop" }, "stop:" + t.taskId),
            body: shell
                ? h(K.taskOutput, { session: s, taskId: t.taskId, running: p.running }, t.taskId)
                : h("div", { className: "cc-at-note", children: "The app shows no output for this kind of task." })
        });
    };
})(window.__ccAT = window.__ccAT || {});
