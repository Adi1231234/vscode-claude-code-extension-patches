/* agent-tree: what each tooltip says. Each returns a function, read while the
   tooltip shows (tip.js tracks the store), so a running agent's "Now" line
   and its clock keep up while the pointer rests on it.
   - an agent: its name, status line, what it is doing now (the app's own
     progress summary, or its latest tool), and what it was asked;
   - a background task: its name, how long it has run, and the command it
     runs, read off the tool call that started it;
   - the main conversation: its title and state;
   - a plain control: what pressing it does. */
(function (A) {
    function row(h, cls, children, key) {
        return h("div", { className: cls, dir: "auto", children: children }, key);
    }

    function title(h, lead, text) {
        return h("div", { className: "cc-at-tip-title", children: [lead, h("span", { dir: "auto", children: text }, "t")] }, "title");
    }

    A.textTip = function (ctx, text) {
        return function () { return row(ctx.K.h, "cc-at-tip-text", text, "x"); };
    };

    A.mainTip = function (ctx) {
        return function () {
            var h = ctx.K.h, st = A.mainStatus(ctx);
            return [title(h, A.chatIcon(h), st.label), row(h, "cc-at-tip-meta", st.meta, "m")];
        };
    };

    A.agentTip = function (ctx, agent) {
        return function () {
            var K = ctx.K, h = K.h, st = A.agentStatus(ctx, agent);
            var live = ctx.session.subagentTasks ? ctx.session.subagentTasks.value.get(agent.taskId) : null;
            var tools = live && live.recentTools;
            var now = live && (live.summary || (tools && tools[tools.length - 1]));
            return [
                title(h, h(K.dot, { state: st.dot }), agent.description),
                row(h, "cc-at-tip-meta", [
                    h("span", { className: "cc-at-st cc-at-st-" + st.status, children: K.labels[st.status] }, "s"),
                    agent.subagentType ? " · " + agent.subagentType : null,
                    h("span", { className: "cc-at-time", children: h(K.agentTime, { agent: agent }) }, "t")
                ], "m"),
                st.active && now ? row(h, "cc-at-tip-now", [h("span", { className: "cc-at-tip-label", children: "Now" }, "l"), now], "n") : null,
                agent.prompt ? row(h, "cc-at-tip-block", agent.prompt, "p") : null
            ];
        };
    };

    A.taskTip = function (ctx, task) {
        return function () {
            var K = ctx.K, h = K.h;
            var call = task.toolUseId ? A.findCall(ctx.session.messages.value, task.toolUseId) : null;
            var input = call && call.input;
            var command = input && (input.command || input.cmd);
            return [
                title(h, A.terminalIcon(h), K.taskLabel(task)),
                row(h, "cc-at-tip-meta", ["Running", h("span", { className: "cc-at-time", children: h(K.taskTime, { task: task }) }, "t")], "m"),
                command ? row(h, "cc-at-tip-block cc-at-tip-code", command, "c") : null
            ];
        };
    };
})(window.__ccAT = window.__ccAT || {});
