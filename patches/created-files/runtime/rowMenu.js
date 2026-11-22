/* What a tree row's menu (lib/js/ccMenu.js) holds. It opens from the row's "more"
   button, a right-click or Shift+F10, so every action in it is also reachable
   without a mouse, and nothing that matters is reachable only by a right-click: a
   file's menu repeats its two buttons. A folder's menu copies its path, copies the
   paths of what is directly in it (the first level), and - for a row that joins a
   chain of folders - copies the path of any folder of the chain. Right-clicking one
   folder's name in such a row opens that folder's own menu. */
window.__ccCFRowMenu = window.__ccCFRowMenu || (function () {
    var F = window.__ccCFFeedback;

    /* level: the index in row.levels of the folder it is for; the row's own (its
       deepest) when null. A folder in the middle of a chain holds only the next one. */
    function forDir(row, level, line, send) {
        var last = row.levels.length - 1, at = level == null ? last : level, l = row.levels[at];
        var items = at === last ? row.items : 1;
        var entries = [
            { head: l.path, title: l.path },
            { label: "Copy path", onPick: function () { F.copy(line, l.path); } },
            { label: "Copy paths of its " + F.plural(items, "item", "items"), hint: "first level",
                title: "One path per line: the files and folders directly in it",
                onPick: function () { send({ op: "copyItems", path: l.path, key: row.key }); } }
        ];
        if (level != null || last === 0) return entries;
        entries.push({ separator: true }, { head: "Folders in this row" });
        row.levels.slice(0, last).forEach(function (o) {
            entries.push({ label: "Copy path of " + o.name, title: o.path, onPick: function () { F.copy(line, o.path); } });
        });
        return entries;
    }

    function forFile(row, line, send) {
        return [
            { head: row.path, title: row.path },
            { label: "Copy path", onPick: function () { F.copy(line, row.path); } },
            { label: "Show in file explorer", onPick: function () { send({ op: "reveal", path: row.path }); } },
            { label: "Delete to Recycle Bin", danger: true, onPick: function () { send({ op: "delete", path: row.path }); } }
        ];
    }

    /* The keys that open a row's menu from the keyboard, as a right-click would. */
    function isMenuKey(ev) { return ev.key === "ContextMenu" || (ev.key === "F10" && ev.shiftKey); }

    return { forDir: forDir, forFile: forFile, isMenuKey: isMenuKey };
})();
