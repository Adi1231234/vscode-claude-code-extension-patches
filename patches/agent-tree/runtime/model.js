/* agent-tree: the data behind the tree, read from the app's own store.
   The app's own tree builder (the Agent map's) nests the agents; each live
   background task is then hung under the agent whose tool call started it.
   A task carries the id of the tool call that started it, and that call sits
   in the conversation tagged with the agent it ran in (no tag = the main
   conversation). When the call is no longer in the list the store keeps, its
   owner cannot be known, and the task goes in a group of its own. */
(function (A) {
    A.keyOf = function (agent) {
        return agent.toolUseId !== undefined ? agent.toolUseId : agent.taskId;
    };

    A.isActive = function (status) {
        return status === "working" || status === "waiting";
    };

    function index(nodes, byCall) {
        nodes.forEach(function (n) {
            n.tasks = [];
            if (n.agent.toolUseId !== undefined) byCall.set(n.agent.toolUseId, n);
            index(n.children, byCall);
        });
    }

    /* Is this tool call still in the list the store keeps? The app's owner
       lookup answers undefined both for "not there" and, on some releases,
       for "the main conversation", so the two are told apart here. */
    A.hasCall = function (messages, id) {
        for (var i = messages.length - 1; i >= 0; i--) {
            var m = messages[i];
            if (m.type !== "assistant") continue;
            for (var j = 0; j < m.content.length; j++) {
                var c = m.content[j].content;
                if (c.type === "tool_use" && c.id === id) return true;
            }
        }
        return false;
    };

    function place(K, messages, byCall, task, out) {
        var call = task.toolUseId;
        if (call === undefined || !A.hasCall(messages, call)) {
            out.unknown.push(task);
            return;
        }
        var parent = K.owner(messages, call);
        if (parent === undefined || parent === null) {
            out.main.push(task);
            return;
        }
        var node = byCall.get(parent);
        if (node) node.tasks.push(task);
        else out.unknown.push(task);
    }

    A.model = function (K, agents, tasks, messages) {
        var roots = K.buildTree(agents);
        var byCall = new Map();
        index(roots, byCall);
        var out = { roots: roots, main: [], unknown: [] };
        tasks.forEach(function (task) {
            place(K, messages, byCall, task, out);
        });
        return out;
    };

    function countNodes(nodes, waiting, K) {
        var n = 0;
        nodes.forEach(function (node) {
            if (A.isActive(K.status(node.agent, waiting))) n++;
            n += node.tasks.length + countNodes(node.children, waiting, K);
        });
        return n;
    }

    /* How many agents and tasks are running now: the rail's badge. */
    A.activeCount = function (K, model, waiting) {
        return countNodes(model.roots, waiting, K) + model.main.length + model.unknown.length;
    };
})(window.__ccAT = window.__ccAT || {});
