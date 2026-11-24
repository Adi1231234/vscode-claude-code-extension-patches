/* agent-tree: the agent's view ends at the top of the message box, so the box
   stays in reach under it - it talks to the agent on screen
   (lib/js/ccTarget.js) - and so do the permission cards drawn in its place.

   The box's container is the chat column's last row, and its height changes:
   a permission card, a longer draft, the queue panel above it. A
   ResizeObserver on it and on the row keeps the view's bottom on the box's
   top, as a CSS variable on the view - a push, no timer. It is read in the
   observer's callback, where layout is already done, and written only when it
   changes. It is measured in layout offsets, the CSS pixels the variable is
   applied in: under patches/zoom a rect is in screen pixels, and at zoom 1.25
   a rect-based value left the view ending 45px above the box. */
(function (A) {
    /* patch.ps1 leaves it empty when the class no longer resolves: then the
       view covers the box again, as it did before. */
    var INPUT_CLASS = "{{inputContainer@sessionLayout}}";
    var INPUT = INPUT_CLASS ? "." + INPUT_CLASS : null;
    var VAR = "--cc-at-input";

    /* How far above the row's bottom the box starts: its offset down the
       chain of positioned parents up to the row, which holds the view. */
    function inset(row, input) {
        var y = 0, n = input;
        while (n && n !== row) { y += n.offsetTop; n = n.offsetParent; }
        return n === row ? Math.max(0, row.clientHeight - y) : 0;
    }

    function fit(over) {
        var row = over.parentElement;
        var input = row && INPUT && row.querySelector(INPUT);
        var v = (input ? inset(row, input) : 0) + "px";
        if (over.style.getPropertyValue(VAR) !== v) over.style.setProperty(VAR, v);
    }

    A.insetRef = (function () {
        var ro = null;
        return function (el) {
            if (ro) { ro.disconnect(); ro = null; }
            if (!el || !el.parentElement || !INPUT || !A.talksToAgents() || typeof ResizeObserver !== "function") return;
            ro = new ResizeObserver(function () { if (el.isConnected) fit(el); });
            ro.observe(el.parentElement);
            var input = el.parentElement.querySelector(INPUT);
            /* An observer reports each element once on its own: that first
               report fits the view, after layout rather than in the commit. */
            if (input) ro.observe(input);
        };
    })();
})(window.__ccAT = window.__ccAT || {});
