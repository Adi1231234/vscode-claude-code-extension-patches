/* agent-tree: the component that replaces the app's Agent map dialog. The app
   renders it in the place of that dialog's own component, always, with its
   open flag (`ccOpen`) - so the sidebar starts collapsed, the footer's agents
   pill and /agents open it, and picking a row swaps the conversation view.
   `kit` carries the app's own pieces, named by patch.ps1. */
(function (A) {
    /* The picked agent or task, as it is now: a picked agent that left the
       store is no longer pickable; a picked task that ended stays on screen,
       marked ended, until the user leaves it. */
    function resolve(sel, agents, tasks) {
        if (!sel) return null;
        if (sel.kind === "task") {
            var live = tasks.get(sel.id);
            return { kind: "task", task: live || sel.task, running: !!live };
        }
        var found = null;
        agents.forEach(function (a) { if (A.keyOf(a) === sel.key) found = a; });
        return found ? { kind: "agent", agent: found } : null;
    }

    function pane(K, p, picked, back) {
        if (!picked) return null;
        if (picked.kind === "agent") {
            return K.h(A.AgentPane, { K: K, session: p.session, agent: picked.agent, renderRow: p.renderTranscriptRow, onBack: back }, "pane");
        }
        return K.h(A.TaskPane, { K: K, session: p.session, context: p.context, task: picked.task, running: picked.running, onBack: back }, "pane");
    }

    window.__ccAgentTree = function (p) {
        var K = p.kit, s = p.session;
        K.track();
        var selState = K.useState(null), foldState = K.useState(function () { return new Set(); });
        var messages = s.messages.value;
        var waiting = K.waitingSet(s.permissionRequests.value);
        /* Newer releases hand the agents and tasks in; older ones did not, and
           the dialog read them from the store the same way. */
        var stored = s.agentMapAgents.value;
        var fromStore = K.useMemo(function () {
            return p.agents ? null : K.withParents(stored, messages);
        }, [p.agents, stored, messages]);
        var agents = p.agents || fromStore;
        var tasks = p.tasks || s.backgroundTasks.value;
        var model = K.useMemo(function () {
            return A.model(K, agents, tasks, messages);
        }, [agents, tasks, messages]);
        var picked = resolve(selState[0], agents, tasks);
        var back = function () { selState[1](null); };
        var ctx = {
            K: K,
            session: s,
            waiting: waiting,
            open: !!p.ccOpen,
            setOpen: p.ccSetOpen,
            sel: picked ? selState[0] : null,
            select: selState[1],
            collapsed: foldState[0],
            toggle: function (id) {
                foldState[1](function (prev) {
                    var next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                });
            }
        };
        var side = K.h(A.Sidebar, { ctx: ctx, model: model, running: A.activeCount(K, model, waiting) }, "side");
        var view = pane(K, p, picked, back);
        return [
            side,
            view ? K.h("div", { className: ctx.open ? "cc-at-over cc-at-over-open" : "cc-at-over", children: view }, "over") : null
        ];
    };
})(window.__ccAT = window.__ccAT || {});
