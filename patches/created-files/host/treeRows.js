/* The rows of a tree on screen: every open folder's entries under it, a page at
   a time. Folders at the top are open until closed, every other folder closed
   until opened (`toggled` flips that), so a chat shows its first branching at
   once. The same as adi-tools' packages/created-files/treeRows.mjs; change the
   two together. */
globalThis.__ccCFTreeRows = globalThis.__ccCFTreeRows || (function () {
    var T = globalThis.__ccCFTree;

    /* view: { toggled: Set of folder keys, more: Map key -> extra pages, page }. */
    function rows(root, view) {
        var out = [];
        (function walk(node, depth) {
            var all = T.entries(node);
            var shown = Math.min(all.length, view.page * (1 + (view.more.get(node.key) || 0)));
            for (var i = 0; i < shown; i++) {
                var e = all[i];
                if (!e.dir) { out.push({ kind: "file", key: e.file.path.toLowerCase(), path: e.file.path, name: e.name, depth: depth }); continue; }
                var d = e.dir, open = (depth === 0) !== view.toggled.has(d.key);
                out.push({ kind: "dir", key: d.key, path: d.levels[d.levels.length - 1].path, name: d.name, depth: depth,
                    count: d.count, open: open, levels: d.levels });
                if (open) walk(d, depth + 1);
            }
            if (shown < all.length) out.push({ kind: "more", key: node.key + "|more", folder: node.key, depth: depth, left: all.length - shown });
        })(root, 0);
        return out;
    }

    function newView(page) { return { toggled: new Set(), more: new Map(), page: page }; }
    function toggle(view, key) { if (!view.toggled.delete(key)) view.toggled.add(key); }
    function more(view, key) { view.more.set(key, (view.more.get(key) || 0) + 1); }

    return { rows: rows, newView: newView, toggle: toggle, more: more };
})();
