/* The dialog's tree rows: a folder (opens and closes, copies its path), a file
   (reveal, delete), or "more" (the next page of a big folder). A chat at work
   changes its list every moment, so rows are matched by key and only what changed
   is touched: rebuilding threw the scroll position and the keyboard focus away on
   every update. The host builds the rows (host/treeRows.js); this only draws. */
window.__ccCFRows = window.__ccCFRows || (function () {
    var G = window.__ccCFGlyphs, INDENT = 14, START = 6;

    function el(tag, cls, text) {
        var x = document.createElement(tag);
        if (cls) x.className = cls;
        if (text != null) x.textContent = text;
        return x;
    }

    function action(cls, label, svg, onClick) {
        var b = el("button", "cc-cf-act " + cls);
        b.type = "button";
        b.title = label;
        b.setAttribute("aria-label", label);
        b.innerHTML = svg;
        b.onclick = function (ev) { ev.stopPropagation(); onClick(); };
        return b;
    }

    function shell(row, glyph, cls) {
        var node = el("div", "cc-cf-node " + cls), line = el("div", "cc-cf-row");
        var twisty = el("span", "cc-cf-twisty");
        if (row.kind === "dir") twisty.innerHTML = G.chevron;
        var icon = el("span", "cc-cf-icon");
        icon.innerHTML = glyph;
        line.appendChild(twisty);
        line.appendChild(icon);
        node.appendChild(line);
        return { node: node, line: line };
    }

    function dirRow(row, send) {
        var s = shell(row, G.folder, "cc-cf-dir"), now = row;
        var name = el("span", "cc-cf-name"), count = el("span", "cc-cf-count");
        s.line.appendChild(name);
        s.line.appendChild(count);
        s.line.appendChild(window.__ccCFCopyLevels.button(s.node, function () { return now.levels; }));
        s.line.setAttribute("role", "button");
        s.line.tabIndex = 0;
        s.line.onclick = function () { send({ op: "toggle", key: now.key }); };
        s.line.onkeydown = function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); s.line.onclick(); } };
        s.update = function (r) {
            now = r;
            var dom = window.__ccDom;
            dom.setText(name, r.name);
            dom.setText(count, r.count.toLocaleString("en-US"));
            dom.toggle(s.node, "cc-cf-open", r.open);
            dom.setAttr(s.line, "aria-expanded", String(r.open));
        };
        return s;
    }

    function fileRow(row, send) {
        var s = shell(row, G.file, "cc-cf-file");
        s.line.appendChild(el("span", "cc-cf-name", row.name));
        s.line.title = row.path;
        s.line.appendChild(action("cc-cf-reveal", "Show in file explorer", G.reveal, function () { send({ op: "reveal", path: row.path }); }));
        s.line.appendChild(action("cc-cf-del", "Delete to Recycle Bin", G.trash, function () { send({ op: "delete", path: row.path }); }));
        s.update = function () {};
        return s;
    }

    function moreRow(row, send) {
        var s = shell(row, "", "cc-cf-more"), now = row;
        var b = el("button", "cc-cf-more-btn");
        b.type = "button";
        b.onclick = function () { send({ op: "more", key: now.folder }); };
        s.line.appendChild(b);
        s.update = function (r) { now = r; window.__ccDom.setText(b, "Show more (" + r.left.toLocaleString("en-US") + " left here)"); };
        return s;
    }

    var MAKE = { dir: dirRow, file: fileRow, more: moreRow };

    /* A keeper of one list's rows: sync(rows) makes the list match, in order. */
    function list(host, send) {
        var made = new Map();
        return function sync(rows) {
            var wanted = new Set(rows.map(function (r) { return r.key; }));
            made.forEach(function (m, k) { if (!wanted.has(k)) { m.node.remove(); made.delete(k); } });
            var at = host.firstChild;
            rows.forEach(function (r) {
                var m = made.get(r.key);
                if (!m) { m = MAKE[r.kind](r, send); made.set(r.key, m); }
                m.update(r);
                // A folder above can be joined or split as files come, which moves this row's depth.
                window.__ccDom.setStyle(m.line, "padding-inline-start", (START + r.depth * INDENT) + "px");
                if (m.node === at) at = at.nextSibling;
                else host.insertBefore(m.node, at);
            });
        };
    }

    return { el: el, list: list };
})();
