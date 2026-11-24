/* agent-tree: which agents the tree and the rail show, and in what order.
   Active ones come first at every level. An agent counts as active when it
   runs or waits for a permission, or when anything under it does - an agent
   it spawned or a background task it started - so the way down to running
   work stays on top. With "Only active agents" on, an agent with nothing
   active in or under it is left out (and counted), except the one on screen.
   Within each group the app's own order is kept. */
(function (A) {
    function arrangeNodes(K, nodes, waiting, onlyActive, keep, out) {
        var kept = [];
        nodes.forEach(function (node) {
            var children = arrangeNodes(K, node.children, waiting, onlyActive, keep, out);
            var busy = A.isActive(K.status(node.agent, waiting)) || node.tasks.length > 0 ||
                children.some(function (c) { return c.busy; });
            if (onlyActive && !busy && children.length === 0 && A.keyOf(node.agent) !== keep) {
                out.hidden++;
                return;
            }
            kept.push({ agent: node.agent, children: children, tasks: node.tasks, busy: busy });
        });
        return kept.filter(function (n) { return n.busy; })
            .concat(kept.filter(function (n) { return !n.busy; }));
    }

    /* roots: the model's tree. keep: the key of the agent on screen, or null.
       Returns { roots, hidden } - the tree to draw and how many were left out. */
    A.arrange = function (K, roots, waiting, onlyActive, keep) {
        var out = { hidden: 0 };
        out.roots = arrangeNodes(K, roots, waiting, onlyActive, keep, out);
        return out;
    };
})(window.__ccAT = window.__ccAT || {});
