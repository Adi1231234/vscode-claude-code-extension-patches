/* The copy button of a folder row. A row that is one folder copies its path at
   once. A row that joins a chain of folders (Users, me, ..., scratchpad) opens a
   short list of every level under it instead, deepest first, and the level
   picked is copied - so a path can be copied at any depth the tree shows. */
window.__ccCFCopyLevels = window.__ccCFCopyLevels || (function () {
    var G = window.__ccCFGlyphs, el = function (t, c, x) { return window.__ccCFRows.el(t, c, x); };
    var COPIED_MS = 1200;

    function copied(button) {
        button.innerHTML = G.check;
        setTimeout(function () { button.innerHTML = G.copy; }, COPIED_MS);
    }

    function copy(path, button) {
        Promise.resolve(window.__ccCopyText(path)).then(function () { copied(button); }, function () {});
    }

    /* The list of levels, under the row's line. */
    function panel(levels, button, close) {
        var box = el("div", "cc-cf-levels");
        box.appendChild(el("div", "cc-cf-levels-head", "Copy the path of"));
        levels.slice().reverse().forEach(function (l) {
            var b = el("button", "cc-cf-level", l.path);
            b.type = "button";
            b.onclick = function (ev) { ev.stopPropagation(); copy(l.path, button); close(); };
            box.appendChild(b);
        });
        box.onkeydown = function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); button.focus(); } };
        return box;
    }

    /* A copy button for `node` (the row element); levels: the row's chain. */
    function button(node, getLevels) {
        var b = el("button", "cc-cf-act cc-cf-copy");
        b.type = "button";
        b.title = "Copy the folder's path";
        b.setAttribute("aria-label", "Copy the folder's path");
        b.innerHTML = G.copy;
        var open = null;
        function close() { if (open) { open.remove(); open = null; b.setAttribute("aria-expanded", "false"); } }
        b.onclick = function (ev) {
            ev.stopPropagation();
            var levels = getLevels();
            if (levels.length < 2) return copy(levels[0].path, b);
            if (open) return close();
            open = panel(levels, b, close);
            node.appendChild(open);
            b.setAttribute("aria-expanded", "true");
            open.querySelector("button").focus();
        };
        return b;
    }

    return { button: button };
})();
