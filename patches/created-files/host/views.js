/* What each panel's dialog shows of its chat's tree: which folders are open in
   it, how many pages each folder shows, which of its files were looked at on disk
   since it opened, and whether it is open at all - a tree is built only for a chat
   some dialog shows. One build per chat at a time: a list that changed during a
   build is built once that one ends, so a chat writing files nonstop is rebuilt
   back to back, never in parallel. */
globalThis.__ccCFViews = globalThis.__ccCFViews || (function () {
    var T = globalThis.__ccCFTree, R = globalThis.__ccCFTreeRows;
    var PAGE = 200;
    var states = new WeakMap(), trees = new Map();

    function stateOf(wv) {
        var s = states.get(wv);
        if (!s) states.set(wv, (s = { view: R.newView(PAGE), looked: new Set(), open: false, seq: 0 }));
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

    /* What this panel's dialog shows now: its rows, and the files on them it shows for
       the first time since it opened (to be looked at again: a file deleted outside any
       chat leaves no line). Null while it is closed, or when a newer delivery to it is
       already on its way. */
    function rowsFor(id, wv, files) {
        var s = stateOf(wv);
        if (!s.open) return Promise.resolve(null);
        var seq = ++s.seq;
        return treeOf(id, files).then(function (root) {
            if (seq !== s.seq) return null;
            var rows = R.rows(root, s.view), unlooked = [];
            rows.forEach(function (r) {
                if (r.kind === "file" && !s.looked.has(r.key)) { s.looked.add(r.key); unlooked.push(r.path); }
            });
            return { rows: rows, unlooked: unlooked };
        });
    }

    /* A dialog that opens again looks at what it shows again. */
    function setOpen(wv, open) {
        var s = stateOf(wv);
        if (s.open !== !!open) s.looked = new Set();
        s.open = !!open;
    }

    /* The panel moved to another chat: nothing it opened or saw there carries over. */
    function forgetShown(wv) {
        var s = states.get(wv);
        if (!s) return;
        s.view = R.newView(PAGE);
        s.looked = new Set();
    }

    return {
        rowsFor: rowsFor,
        setOpen: setOpen,
        forgetShown: forgetShown,
        toggle: function (wv, key) { R.toggle(stateOf(wv).view, String(key)); },
        more: function (wv, key) { R.more(stateOf(wv).view, String(key)); },
        /* The paths directly in a folder of the chat's tree as its dialog shows it; null when there is none. */
        itemsOf: function (id, p) { var t = trees.get(id); return t && t.root ? T.childPaths(t.root, String(p)) : null; },
        /* No panel shows this chat any more. */
        forget: function (id) { trees.delete(id); }
    };
})();
