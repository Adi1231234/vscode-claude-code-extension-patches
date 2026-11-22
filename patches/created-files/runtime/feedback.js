/* What a copy did, said where it was asked for. A copy is confirmed only once the
   clipboard took it, and a refusal is said too, never left silent: the row it was
   asked on shows a short note for a moment, and a live region says the same to a
   screen reader. A copy of a folder's first level is made by the host, which
   answers with copiedFor (the row's key) and copiedItems, or copyFailed. */
window.__ccCFFeedback = window.__ccCFFeedback || (function () {
    var P = window.__ccCFParts, SHOWN_MS = 2500, live = null;

    function plural(n, one, many) { return n.toLocaleString("en-US") + " " + (n === 1 ? one : many); }

    function say(text) {
        if (!live || !live.isConnected) {
            live = P.el("div", "cc-cf-live");
            live.setAttribute("aria-live", "polite");
            window.__ccDom.own(live);
            document.body.appendChild(live);
        }
        live.textContent = text;
    }

    /* A note on a row's line, in place of its count, for a moment. */
    function note(line, text, ok) {
        var n = line.querySelector(".cc-cf-note");
        if (!n) {
            n = P.el("span", "cc-cf-note");
            line.insertBefore(n, line.querySelector(".cc-cf-act"));
        }
        n.textContent = text;
        n.classList.toggle("cc-cf-note-bad", !ok);
        line.classList.add("cc-cf-noted");
        clearTimeout(n.hideAt);
        n.hideAt = setTimeout(function () { n.remove(); line.classList.remove("cc-cf-noted"); }, SHOWN_MS);
        say(text);
    }

    /* Copies one path (or any text) and says so on the row's line. */
    function copy(line, text) {
        Promise.resolve(window.__ccCopyText(text)).then(function () { note(line, "Copied", true); },
            function () { note(line, "Could not copy", false); });
    }

    function lineOf(key) {
        var node = document.querySelector('.cc-cf-node[data-key="' + CSS.escape(key) + '"]');
        return node && node.querySelector(".cc-cf-row");
    }

    window.__ccCFLink.onData(function (d) {
        if (!d.copiedFor) return;
        var line = lineOf(d.copiedFor);
        if (!line) return;
        if (d.copyFailed) note(line, "Could not copy", false);
        else note(line, "Copied " + plural(d.copiedItems, "path", "paths"), true);
    });

    return { copy: copy, plural: plural };
})();
