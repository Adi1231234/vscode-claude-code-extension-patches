/* What the dialog says for one moment of the store, as plain data - dialog.js
   only draws it. The question is the title, as the app's own confirm dialogs
   put it; the subtitle is the state the button's colour stands for. */
(function (S) {
    var KEPT = "The conversation is kept. Start Claude here, or send a message, and it carries on where it stopped.";
    var RESUMES = "It picks up this conversation where it stopped.";

    /* The app draws a process exit as "<what happened>. stderr: <everything
       the CLI printed>" and splits it at that word for its own banner (n4e in
       2.1.332). The head is one line; the output can be hundreds. */
    var STDERR = /^([^]{0,80}?[.]) stderr: ([^]*)$/;

    S.splitError = function (text) {
        var m = STDERR.exec(text);
        return m ? { head: m[1], output: m[2].trim() } : { head: text, output: "" };
    };

    function queued() {
        try { return window.__qAuto && !window.__qAuto.paused() ? window.__qAuto.count() : 0; } catch (e) { return 0; }
    }

    S.view = function (store) {
        var state = S.state(store, S.peek);
        if (state === S.DOWN) {
            var error = S.errorOf(store, S.peek);
            return {
                state: state,
                action: "start",
                title: "Start Claude?",
                sub: error ? "Stopped with an error" : "Stopped",
                text: error ? "Start it again? " + RESUMES : "Start the Claude process for this chat? " + RESUMES,
                error: error ? S.splitError(error) : null,
                warn: ""
            };
        }
        var busy = !!(store.busy && store.busy.peek());
        return {
            state: state,
            action: "stop",
            title: "Stop Claude?",
            sub: state === S.UP ? "Running" : "Starting",
            text: (state === S.UP ? "" : "Claude is still starting up. ") + "This ends the Claude process behind this chat. " + KEPT,
            error: null,
            warn: busy ? "Claude is working on a reply right now. Stopping ends that reply" +
                (queued() ? " and pauses the queue." : ".") : ""
        };
    };
})(window.__ccStatus);
