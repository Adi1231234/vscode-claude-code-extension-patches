/* The dialog's file rows. A chat at work changes its ledger every moment, so rows
   are matched by path and only what changed is touched: rebuilding the list threw
   the scroll position and the keyboard focus away on every update. */
window.__ccCFRows = window.__ccCFRows || (function () {
    var REVEAL = "<svg width='15' height='15' viewBox='0 0 20 20' fill='none'><path d='M3 7 A1 1 0 0 1 4 6 H8 L9.5 7.5 H16 A1 1 0 0 1 17 8.5 V15 A1 1 0 0 1 16 16 H4 A1 1 0 0 1 3 15 Z' stroke='currentColor' stroke-width='1.3' stroke-linejoin='round'/></svg>";
    var TRASH = "<svg width='15' height='15' viewBox='0 0 20 20' fill='none'><path d='M5 6 H15 M8 6 V4.5 H12 V6 M6.5 6 V15.5 A1 1 0 0 0 7.5 16.5 H12.5 A1 1 0 0 0 13.5 15.5 V6 M9 9 V13.5 M11 9 V13.5' stroke='currentColor' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/></svg>";

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
        b.onclick = onClick;
        return b;
    }

    function make(f, send) {
        var r = el("div", "cc-cf-row");
        var text = el("div", "cc-cf-text");
        text.appendChild(el("div", "cc-cf-name", f.name));
        text.appendChild(el("div", "cc-cf-path", f.path));
        r.appendChild(text);
        r.appendChild(action("cc-cf-reveal", "Show in file explorer", REVEAL, function () { send({ op: "reveal", path: f.path }); }));
        r.appendChild(action("cc-cf-del", "Delete to Recycle Bin", TRASH, function () { send({ op: "delete", path: f.path }); }));
        return r;
    }

    /* A keeper of one list's rows: sync(files) makes the list match, in order. */
    function list(host, send) {
        var rows = new Map();
        return function sync(files) {
            var wanted = new Set(files.map(function (f) { return f.path; }));
            rows.forEach(function (r, p) {
                if (!wanted.has(p)) { r.remove(); rows.delete(p); }
            });
            var at = host.firstChild;
            files.forEach(function (f) {
                var r = rows.get(f.path);
                if (!r) { r = make(f, send); rows.set(f.path, r); }
                if (r === at) at = at.nextSibling;
                else host.insertBefore(r, at);
            });
        };
    }

    return { el: el, list: list };
})();
