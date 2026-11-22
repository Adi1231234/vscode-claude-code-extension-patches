/* A folder row of the tree. A click opens or closes it. Its copy button copies its
   path at once - a row that joins a chain of folders too (its own, deepest folder).
   Its "more" button, a right-click or Shift+F10 open its menu (rowMenu.js). In a
   joined row each folder's name is a target of its own, as the parts of a path bar
   are: hovering one shows its path, and right-clicking it opens that folder's menu. */
window.__ccCFDirRow = window.__ccCFDirRow || (function () {
    var G = window.__ccCFGlyphs, P = window.__ccCFParts, M = window.__ccCFRowMenu, F = window.__ccCFFeedback;
    var el = P.el, SEP = String.fromCharCode(92);

    /* Each level's name as its own span, with the separator between them. */
    function drawNames(name, levels) {
        name.textContent = "";
        levels.forEach(function (l, i) {
            if (i) name.appendChild(el("span", "cc-cf-sep", SEP));
            var seg = el("span", "cc-cf-seg", l.name);
            seg.title = l.path;
            seg.setAttribute("data-level", String(i));
            name.appendChild(seg);
        });
    }

    /* row: the row as the host gave it; shell(row, glyph, cls) makes the line (rows.js). */
    function make(row, send, shell) {
        var s = shell(row, G.folder, "cc-cf-dir"), now = row, drawn = "";
        var name = el("span", "cc-cf-name"), count = el("span", "cc-cf-count");
        function deepest() { return now.levels[now.levels.length - 1]; }
        function menuOf(level) { return M.forDir(now, level, s.line, send); }
        var copy = P.iconButton("cc-cf-copy", "Copy the folder's path", G.copy, function () { F.copy(s.line, deepest().path); });
        var more = P.iconButton("cc-cf-more-act", "More actions", G.dots, function () { window.__ccMenu.toggle(more, menuOf(null)); });
        more.setAttribute("aria-haspopup", "menu");
        more.setAttribute("aria-expanded", "false");
        [name, count, copy, more].forEach(function (x) { s.line.appendChild(x); });
        s.line.setAttribute("role", "button");
        s.line.tabIndex = 0;
        s.line.onclick = function () { send({ op: "toggle", key: now.key }); };
        s.line.oncontextmenu = function (ev) {
            ev.preventDefault();
            var seg = ev.target.closest(".cc-cf-seg");
            window.__ccMenu.show(seg || name, menuOf(seg ? Number(seg.getAttribute("data-level")) : null));
        };
        s.line.onkeydown = function (ev) {
            if (M.isMenuKey(ev)) { ev.preventDefault(); window.__ccMenu.show(more, menuOf(null)); return; }
            // Only the line's own keys: Enter on one of its buttons is that button's.
            if (ev.target === s.line && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); s.line.onclick(); }
        };
        s.update = function (r) {
            now = r;
            var dom = window.__ccDom, levels = r.levels.map(function (l) { return l.path; }).join("|");
            if (levels !== drawn) { drawn = levels; drawNames(name, r.levels); }   // a chain joins or splits as files come
            dom.setText(count, r.count.toLocaleString("en-US"));
            dom.toggle(s.node, "cc-cf-open", r.open);
            dom.setAttr(s.line, "aria-expanded", String(r.open));
            dom.setAttr(s.line, "aria-label", deepest().path);
        };
        return s;
    }

    return { make: make };
})();
