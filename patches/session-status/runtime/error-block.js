/* What the last process left behind, inside the dialog: the error's first
   sentence, what the CLI printed on stderr in a scrolling box, and the app's
   own "View output logs" (context.openOutputPanel). This is everything the
   app's red banner showed, which the button now carries instead. */
(function (S) {
    S.errorBlock = function (context) {
        var box = S.el("div", "cc-status-error");
        var head = S.el("p", "cc-status-error-head");
        var output = S.el("pre", "cc-status-output");
        var logs = S.makeButton("cc-status-logs", "View output logs");
        logs.onclick = function () { if (context && context.openOutputPanel) context.openOutputPanel(); };
        box.appendChild(head);
        box.appendChild(output);
        box.appendChild(logs);
        /* The cause is usually the last thing the CLI printed. Only a box on
           screen has a height to scroll by, so this runs again after mount. */
        function toEnd() { if (output.isConnected) output.scrollTop = output.scrollHeight; }
        return {
            el: box,
            toEnd: toEnd,
            show: function (error) {
                box.hidden = !error;
                if (!error || head.textContent === error.head && output.textContent === error.output) return;
                head.textContent = error.head;
                output.textContent = error.output;
                output.hidden = !error.output;
                toEnd();
            }
        };
    };
})(window.__ccStatus);
