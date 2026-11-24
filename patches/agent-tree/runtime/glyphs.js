/* agent-tree: the two glyphs it draws, on the app's 1.2px line in
   currentColor so they take the button's colour and hover like the app's own. */
(function (A) {
    function svg(h, size, paths) {
        return h("svg", {
            width: size,
            height: size,
            viewBox: "0 0 16 16",
            fill: "none",
            "aria-hidden": "true",
            className: "cc-at-glyph",
            children: paths.map(function (d, i) {
                return h("path", {
                    d: d,
                    stroke: "currentColor",
                    "stroke-width": "1.2",
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round"
                }, i);
            })
        });
    }

    /* Points to the inline end; CSS turns it down when open and mirrors it
       under RTL. */
    A.chevron = function (h) {
        return svg(h, 12, ["M6 4 L10 8 L6 12"]);
    };

    /* A speech bubble: the main conversation's icon on the rail. */
    A.chatIcon = function (h) {
        return svg(h, 16, [
            "M3 4.5 A1.5 1.5 0 0 1 4.5 3 H11.5 A1.5 1.5 0 0 1 13 4.5 V9.5 A1.5 1.5 0 0 1 11.5 11 H7 L4.5 13 V11 H4.5 A1.5 1.5 0 0 1 3 9.5 Z"
        ]);
    };

    /* A prompt and a cursor: a background task (a shell, a monitor). */
    A.terminalIcon = function (h) {
        return svg(h, 14, ["M3.5 5 L6.5 8 L3.5 11", "M8 11.5 H12.5"]);
    };

    /* A root with two branches: the tree itself, for the rail button. */
    A.treeIcon = function (h) {
        return svg(h, 16, [
            "M3 3.5 H7",
            "M5 3.5 V12.5 H9",
            "M5 8 H9",
            "M10 8 H13",
            "M10 12.5 H13"
        ]);
    };
})(window.__ccAT = window.__ccAT || {});
