/* What each panel's dialog shows of its chat's tree: which folders are open in
   it, how many pages each folder shows, and whether the dialog is open at all -
   a tree is built only for a chat some dialog shows. One build per chat at a
   time: a list that changed during a build is built once that one ends, so a
   chat writing files nonstop is rebuilt back to back, never in parallel. */
globalThis.__ccCFViews = globalThis.__ccCFViews || (function () {
    var T = globalThis.__ccCFTree, R = globalThis.__ccCFTreeRows;
    var PAGE = 200;
    var states = new WeakMap(), trees = new Map();

    function stateOf(wv) {
        var s = states.get(wv);
        if (!s) states.set(wv, (s = { view: R.newView(PAGE), open: false, seq: 0 }));
        return s;
    }

    /* The tree of the newest list asked for this chat. */
    function treeOf(id, files) {
        var t = trees.get(id);
        if (!t) trees.set(id, (t = { files: null, root: null, running: null, wanted: null }));
        if (t.files === files && !t.running) return Promise.resolve(t.root);
        t.wanted = files;
        if (!t.running) t.running = (async function () {
            try {
                while (t.wanted !== t.files) {
                    var next = t.wanted;
                    t.root = await T.build(next);
                    t.files = next;
                }
                return t.root;
            } finally { t.running = null; }
        })();
        return t.running;
    }

    /* The rows this panel's dialog shows now: null while it is closed, undefined
       when a newer delivery to it is already on its way with the rows. */
    function rowsFor(id, wv, files) {
        var s = stateOf(wv);
        if (!s.open) return Promise.resolve(null);
        var seq = ++s.seq;
        return treeOf(id, files).then(function (root) { return seq === s.seq ? R.rows(root, s.view) : undefined; });
    }

    return {
        rowsFor: rowsFor,
        setOpen: function (wv, open) { stateOf(wv).open = !!open; },
        toggle: function (wv, key) { R.toggle(stateOf(wv).view, String(key)); },
        more: function (wv, key) { R.more(stateOf(wv).view, String(key)); },
        /* No panel shows this chat any more. */
        forget: function (id) { trees.delete(id); }
    };
})();
