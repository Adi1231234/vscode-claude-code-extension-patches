/* The header button, in the place the "Learn Claude Code" button had.

   The header calls this from its own render (js/button-call.js) with the app's
   jsx factory, its icon-button component - the one Session history and New
   session are drawn with, so size, hover, focus and the aria/title wiring are
   upstream's - and the header's sessions and context.

   The signals are read with S.value here, inside that render, on purpose: the
   header component subscribes to every signal its render reads, so it redraws
   by itself when a process starts, becomes ready or ends. No observer, no
   timer. */
(function (S) {
    var LABEL = {
        up: "Claude is running. Click to stop it.",
        starting: "Claude is starting. Click to stop it.",
        down: "Claude is stopped. Click to start it.",
        downWithError: "Claude stopped with an error. Click to see it and start Claude again."
    };

    S.label = function (state, error) {
        return state === S.DOWN && error ? LABEL.downWithError : LABEL[state];
    };

    S.button = function (h, Button, sessions, context) {
        /* Remembered for the error banner's question (banner.js) and the
           dialog: only a header that draws this button sets them. */
        S.sessions = sessions;
        S.context = context;
        var store = sessions && sessions.activeSession ? sessions.activeSession.value : undefined;
        if (!S.canRead(store)) return null;
        var state = S.state(store, S.value);
        var error = S.errorOf(store, S.value);
        return h(Button, {
            ariaLabel: S.label(state, error),
            iconSize: 20,
            onClick: function () {
                var now = S.activeStore();
                if (S.canRead(now)) S.openDialog(now, S.context);
            },
            children: h("span", {
                className: "cc-status-glyph cc-status-" + state,
                dangerouslySetInnerHTML: { __html: S.glyph() }
            })
        });
    };
})(window.__ccStatus);
