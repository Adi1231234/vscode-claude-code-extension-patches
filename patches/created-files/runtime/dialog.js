/* The list dialog the header icon opens: every file this chat created that still
   exists, name over full path, with reveal and delete per row and copy-all /
   delete-all below. It wears the shared dialog chrome (__ccModal), so its
   overlay, head, Escape and focus trap match every other dialog this repo adds.

   Deletes and reveals go to the host; after a delete the host pushes a fresh
   list and __ccCFRender re-draws the open dialog, so the row leaves on its own
   rather than being removed by hand. */
(function () {
    function el(tag, cls, text) {
        var x = document.createElement(tag);
        if (cls) x.className = cls;
        if (text != null) x.textContent = text;
        return x;
    }

    function iconBtn(cls, label, svg) {
        var b = el("button", "cc-cf-act " + cls);
        b.type = "button";
        b.title = label;
        b.setAttribute("aria-label", label);
        b.innerHTML = svg;
        return b;
    }

    var REVEAL = "<svg width='15' height='15' viewBox='0 0 20 20' fill='none'><path d='M3 7 A1 1 0 0 1 4 6 H8 L9.5 7.5 H16 A1 1 0 0 1 17 8.5 V15 A1 1 0 0 1 16 16 H4 A1 1 0 0 1 3 15 Z' stroke='currentColor' stroke-width='1.3' stroke-linejoin='round'/></svg>";
    var TRASH = "<svg width='15' height='15' viewBox='0 0 20 20' fill='none'><path d='M5 6 H15 M8 6 V4.5 H12 V6 M6.5 6 V15.5 A1 1 0 0 0 7.5 16.5 H12.5 A1 1 0 0 0 13.5 15.5 V6 M9 9 V13.5 M11 9 V13.5' stroke='currentColor' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/></svg>";

    var sh = null, listEl = null;

    function row(f) {
        var r = el("div", "cc-cf-row");
        var text = el("div", "cc-cf-text");
        text.appendChild(el("div", "cc-cf-name", f.name));
        text.appendChild(el("div", "cc-cf-path", f.path));
        r.appendChild(text);
        var reveal = iconBtn("cc-cf-reveal", "Show in file explorer", REVEAL);
        reveal.onclick = function () { window.__ccCFState.send({ type: "ccCF", op: "reveal", path: f.path }); };
        var del = iconBtn("cc-cf-del", "Delete to Recycle Bin", TRASH);
        del.onclick = function () { sendDelete([f.path]); };
        r.appendChild(reveal);
        r.appendChild(del);
        return r;
    }

    function sendDelete(paths) {
        var s = window.__ccCFState.get();
        window.__ccCFState.send({ type: "ccCF", op: "delete", paths: paths, sessionId: s.sid });
    }

    function render() {
        if (!sh || !listEl) return;
        var s = window.__ccCFState.get();
        listEl.textContent = "";
        if (s.gaps.length) listEl.appendChild(el("div", "cc-cf-warn", "Recording was off for a while - this list may be incomplete."));
        if (!s.files.length) {
            listEl.appendChild(el("div", "cc-cf-empty-note", "No files from this chat are still on disk."));
        } else {
            for (var i = 0; i < s.files.length; i++) listEl.appendChild(row(s.files[i]));
        }
        sh.sub.textContent = s.files.length + (s.files.length === 1 ? " file still on disk" : " files still on disk");
    }

    function footBtn(label, cls) {
        var b = el("button", "cc-cf-foot-btn " + cls, label);
        b.type = "button";
        return b;
    }

    function open() {
        if (!window.__ccModal) return;
        sh = window.__ccModal({ title: "Files this chat created", sub: "", icon: window.__ccCFIcon(), cls: "cc-cf-dialog" });
        if (window.__ccDom) window.__ccDom.own(sh.ov);
        listEl = el("div", "cc-cf-list");
        sh.box.appendChild(listEl);
        var copy = footBtn("Copy all paths", "cc-cf-copy");
        copy.onclick = function () {
            var s = window.__ccCFState.get();
            var text = s.files.map(function (f) { return f.path; }).join(String.fromCharCode(10));
            if (text && window.__ccCopyText) window.__ccCopyText(text);
        };
        var delAll = footBtn("Delete all", "cc-cf-delall");
        delAll.onclick = function () {
            var s = window.__ccCFState.get();
            if (s.files.length) sendDelete(s.files.map(function (f) { return f.path; }));
        };
        sh.foot.appendChild(copy);
        sh.foot.appendChild(delAll);
        var close = sh.close;
        sh.close = function () { window.__ccCFRender = null; sh = null; listEl = null; close(); };
        window.__ccCFRender = render;
        render();
        sh.mount();
    }

    window.__ccCFOpen = open;
})();
