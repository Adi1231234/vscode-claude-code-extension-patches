/* The copy button of a folder row. A row that is one folder copies its path at
   once. A row that joins a chain of folders (Users, me, ..., scratchpad) opens a
   short list of every level under it instead, deepest first, and the level
   picked is copied - so a path can be copied at any depth the tree shows. One
   list is open at a time, and Escape closes it before it closes the dialog. */
window.__ccCFCopyLevels = window.__ccCFCopyLevels || (function () {
    var G = window.__ccCFGlyphs, P = window.__ccCFParts;
    var COPIED_MS = 1200;
    var current = null;   // the list open now: { close, button }

    function copy(path, button) {
        Promise.resolve(window.__ccCopyText(path)).then(function () {
            button.innerHTML = G.check;
            setTimeout(function () { button.innerHTML = G.copy; }, COPIED_MS);
        }, function () {});
    }

    /* The list of levels, under the row's line. */
    function panel(levels, button, close) {
        var box = P.el("div", "cc-cf-levels");
        box.appendChild(P.el("div", "cc-cf-levels-head", "Copy the path of"));
        levels.slice().reverse().forEach(function (l) {
            var b = P.button("cc-cf-level", l.path);
            b.onclick = function (ev) { ev.stopPropagation(); copy(l.path, button); close(); };
            box.appendChild(b);
        });
        return box;
    }

    /* A copy button for `node` (the row element); getLevels: the row's chain now. */
    function button(node, getLevels) {
        var open = null;
        var b = P.iconButton("cc-cf-copy", "Copy the folder's path", G.copy, function () {
            var levels = getLevels();
            if (levels.length < 2) return copy(levels[0].path, b);
            if (open) return close();
            if (current) current.close();
            open = panel(levels, b, close);
            node.appendChild(open);
            current = { close: close, button: b };
            b.setAttribute("aria-expanded", "true");
            open.querySelector("button").focus();
        });
        function close() {
            if (!open) return;
            open.remove();
            open = null;
            if (current && current.close === close) current = null;
            b.setAttribute("aria-expanded", "false");
        }
        return b;
    }

    /* For the dialog's onKey (__ccModal hears every key first): Escape closes an open
       list and puts the focus back on its button. True when it did. */
    function escape(ev) {
        if (ev.key !== "Escape" || !current) return false;
        var was = current;
        was.button.focus();   // first: a row's buttons are hidden unless the row holds the focus
        was.close();
        return true;
    }

    return { button: button, escape: escape };
})();
