/* The list dialog the header icon opens: every file this chat created that still
   exists, name over full path, with reveal and delete per row and copy-all /
   delete-all below. It wears the shared dialog chrome (__ccModal), so its
   overlay, head, Escape and focus trap match every other dialog this repo adds.

   Deletes and reveals go to the host; after a delete the host pushes a fresh
   list and __ccCFRender re-draws the open dialog, so the row leaves on its own
   rather than being removed by hand. */
(function () {
    var el = window.__ccCFRows.el;
    var COPY = "Copy all paths", DELETE_ALL = "Delete all", ANSWER_AFTER_MS = 600;

    function state() { return window.__ccCFState.get(); }
    function send(msg) { window.__ccCFState.send(msg); }
    function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

    function footBtn(label, cls) {
        var b = el("button", "cc-cf-foot-btn " + cls, label);
        b.type = "button";
        return b;
    }

    /* The first press only asks: it can move thousands of files at once. The question
       is about one exact list, so it lapses the moment that list changes, and a double
       click is one press, not a question and its answer. */
    function deleteAllButton() {
        var b = footBtn(DELETE_ALL, "cc-cf-delall"), armedFor = "", armedAt = 0, sentAt = -1;
        function disarm() {
            if (sentAt >= 0) return;
            armedFor = "";
            b.textContent = DELETE_ALL;
            b.classList.remove("cc-cf-armed");
        }
        b.onclick = function () {
            var s = state();
            if (!s.total || sentAt >= 0) return;
            if (armedFor !== s.list) {
                armedFor = s.list;
                armedAt = Date.now();
                b.textContent = "Delete " + plural(s.total, "file", "files") + "?";
                b.classList.add("cc-cf-armed");
                return;
            }
            if (Date.now() - armedAt < ANSWER_AFTER_MS) return;
            disarm();
            sentAt = s.reports;
            b.disabled = true;
            b.textContent = "Moving to the Recycle Bin...";
            send({ op: "deleteAll", list: s.list });
        };
        b.onblur = disarm;
        b.onmouseleave = disarm;
        return {
            el: b,
            sync: function (s) {
                if (sentAt >= 0 && s.reports !== sentAt) {
                    sentAt = -1;
                    b.disabled = false;
                    b.textContent = DELETE_ALL;
                }
                if (armedFor && armedFor !== s.list) disarm();
            }
        };
    }

    function note(s) {
        if (s.failed) return plural(s.failed, "file", "files") + " could not be moved to the Recycle Bin.";
        if (s.incomplete) return "Recording was off for a while - this list may be incomplete.";
        return "";
    }

    function open() {
        if (!window.__ccModal) return;
        var scroll = el("div", "cc-cf-list");
        var warn = el("div", "cc-cf-warn");
        var rowsEl = el("div", "cc-cf-rows");
        var info = el("div", "cc-cf-empty-note");
        scroll.appendChild(warn);
        scroll.appendChild(rowsEl);
        scroll.appendChild(info);
        var sync = window.__ccCFRows.list(rowsEl, send);
        var copy = footBtn(COPY, "cc-cf-copy");
        copy.onclick = function () { if (state().total) send({ op: "copyAll" }); };
        copy.onmouseleave = copy.onblur = function () { copy.textContent = COPY; };
        var deleteAll = deleteAllButton();

        var sh = window.__ccModal({
            title: "Files this chat created",
            icon: window.__ccCFIcon(),
            cls: "cc-cf-dialog",
            onClose: function () { window.__ccCFRender = null; }
        });

        function render() {
            var s = state();
            var focusInRow = rowsEl.contains(document.activeElement);
            sync(s.files);
            if (focusInRow && !rowsEl.contains(document.activeElement)) copy.focus();   // its row just left
            deleteAll.sync(s);
            warn.textContent = note(s);
            info.textContent = !s.total ? "No files from this chat are still on disk." :
                s.total > s.files.length ? "Showing the newest " + s.files.length + ". Copy all and Delete all cover every file." : "";
            sh.sub.textContent = plural(s.total, "file", "files") + " still on disk";
            if (s.copied) copy.textContent = "Copied " + plural(s.copied, "path", "paths");
        }

        sh.box.appendChild(scroll);
        sh.foot.appendChild(copy);
        sh.foot.appendChild(deleteAll.el);
        window.__ccCFRender = render;
        render();
        sh.mount();
        copy.focus();
        send({ op: "refresh" });   // a file may have gone without its ledger changing
    }

    window.__ccCFOpen = open;
})();
