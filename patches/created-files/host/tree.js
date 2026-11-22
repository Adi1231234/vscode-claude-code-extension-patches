/* A chat's files as a folder tree. A chain of folders that holds nothing but the
   next folder is one node, so a scratchpad ten folders deep is one row, not ten
   clicks; the node keeps every level of its chain (`levels`), so any of them can
   still be copied. The same as adi-tools' packages/created-files/tree.mjs;
   change the two together.

   A file's folder is looked up whole and walked into only the first time: most
   files share a folder, and walking every path was 0.8 s for a chat of 372,000
   files, 270 ms this way (2026-11-22) - built in slices, so the thread every
   extension shares is let go between them. */
globalThis.__ccCFTree = globalThis.__ccCFTree || (function () {
    var breathe = globalThis.__ccCFBreathe;
    var SLICE = 20000, BACKSLASH = 92, SLASH = 47;
    var SEP = String.fromCharCode(BACKSLASH);

    function isSep(c) { return c === BACKSLASH || c === SLASH; }
    /* A drive on its own is copied with its backslash ("C:" + it). */
    function asCopied(p) { return p.charAt(p.length - 1) === ":" ? p + SEP : p; }
    function folder(name, path) {
        return { name: name, path: path, key: path.toLowerCase(), dirs: new Map(), files: [], count: 0, levels: null, sorted: null };
    }

    function into(parent, name) {
        var key = name.toLowerCase(), child = parent.dirs.get(key);
        if (!child) parent.dirs.set(key, (child = folder(name, parent.path ? parent.path + SEP + name : name)));
        return child;
    }

    function walk(root, dir) {
        var at = root, from = 0;
        for (var i = 0; i <= dir.length; i++) {
            if (i < dir.length && !isSep(dir.charCodeAt(i))) continue;
            if (i > from) at = into(at, dir.slice(from, i));
            from = i + 1;
        }
        return at;
    }

    function count(node) {
        node.count = node.files.length;
        node.dirs.forEach(function (d) { node.count += count(d); });
        return node.count;
    }

    function rekey(node, dirs) { node.dirs = new Map(dirs.map(function (d) { return [d.key, d]; })); }

    /* Joins a folder holding only one folder with it, and so on down. */
    function join(node) {
        var levels = [{ name: node.name, path: asCopied(node.path) }];
        while (node.files.length === 0 && node.dirs.size === 1) {
            var only = node.dirs.values().next().value;
            levels.push({ name: only.name, path: asCopied(only.path) });
            node.name = node.name + SEP + only.name;
            node.path = only.path;
            node.key = only.key;
            node.dirs = only.dirs;
            node.files = only.files;
        }
        node.levels = levels;
        var dirs = Array.from(node.dirs.values());
        dirs.forEach(join);
        rekey(node, dirs);
    }

    /* items: the files, each with its full `path`. Resolves to the root, a nameless folder. */
    async function build(items) {
        var root = folder("", ""), byFolder = new Map();
        for (var n = 0; n < items.length; n++) {
            if (n % SLICE === SLICE - 1) await breathe();
            var p = items[n].path, end = p.length - 1;
            while (end >= 0 && !isSep(p.charCodeAt(end))) end--;
            var dir = end > 0 ? p.slice(0, end) : "", at = byFolder.get(dir);
            if (!at) byFolder.set(dir, (at = walk(root, dir)));
            at.files.push(items[n]);
        }
        count(root);
        var tops = Array.from(root.dirs.values());
        tops.forEach(join);
        rekey(root, tops);
        return root;
    }

    function baseName(p) {
        var i = p.length - 1;
        while (i >= 0 && !isSep(p.charCodeAt(i))) i--;
        return p.slice(i + 1);
    }
    function byName(a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0; }

    /* A folder's entries as shown: its folders, then its files, each by name ignoring case. */
    function entries(node) {
        if (node.sorted) return node.sorted;
        var dirs = Array.from(node.dirs.values()).map(function (d) { return { dir: d, sort: d.name.toLowerCase() }; }).sort(byName);
        var files = node.files.map(function (f) {
            var name = baseName(f.path);
            return { file: f, name: name, sort: name.toLowerCase() };
        }).sort(byName);
        node.sorted = dirs.concat(files);
        return node.sorted;
    }

    /* A path as a folder's key: any case, either slash, with or without a trailing one. */
    function keyOf(p) {
        var k = String(p || "").split("/").join(SEP).toLowerCase();
        while (k.length && k.charAt(k.length - 1) === SEP) k = k.slice(0, -1);
        return k;
    }

    /* The node a folder path is a level of: its own row, or the row whose joined
       chain passes through it. The root for "", null when the tree has no such folder. */
    function find(root, p) {
        var key = keyOf(p);
        if (!key) return root;
        for (var at = root; ;) {
            var next = null;
            for (var d of at.dirs.values()) {
                if (d.levels.some(function (l) { return keyOf(l.path) === key; })) return d;
                if (key.indexOf(d.key + SEP) === 0) next = d;
            }
            if (!next) return null;
            at = next;
        }
    }

    /* The paths of what is directly in the folder at `p` - the first level: its files,
       and the first folder of each row under it. A folder in the middle of a joined
       row holds only the next one. Null when the tree has no such folder. */
    function childPaths(root, p) {
        var node = find(root, p);
        if (!node) return null;
        if (node !== root) {
            var key = keyOf(p), at = node.levels.findIndex(function (l) { return keyOf(l.path) === key; });
            if (at < node.levels.length - 1) return [node.levels[at + 1].path];
        }
        return entries(node).map(function (e) { return e.dir ? e.dir.levels[0].path : e.file.path; });
    }

    return { build: build, entries: entries, find: find, childPaths: childPaths };
})();
