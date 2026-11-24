/* agent-tree: a message on its way to the agent, drawn at the end of its view
   the moment it is sent - the way the app draws one sent while Claude works.

   A working agent reads a message only at its next step, and the view shows it
   only once the agent's transcript holds it, so the person used to look at
   nothing for up to that whole step. The app's own chat answers this with its
   held prompts: measured in a real panel, a message sent mid-turn is drawn at
   once after the turn, as the person's message, labelled "You, queued", its
   text a shade dimmer - the row renderer given held: true. This draws what
   the outbox still holds for this agent (lib/js/ccOutbox.js waiting) through
   that same renderer, until the transcript shows it
   (runtime/transcript-session.js) or the agent is stopped. */
(function (A) {
    /* The app's message and content-block classes, taken off a row the store
       already holds. */
    function kinds(s) {
        var l = s.messages && s.messages.peek ? s.messages.peek() : [];
        for (var i = l.length - 1; i >= 0; i--) {
            if (l[i].content && l[i].content[0]) return { Row: l[i].constructor, Block: l[i].content[0].constructor };
        }
        return null;
    }

    function heldRow(k, w) {
        return new k.Row("user", [new k.Block({ type: "text", text: w.text })], { uuid: "cc-held-" + w.id, timestamp: w.at });
    }

    /* The box stays mounted, empty or not, so it hears every change. */
    A.HeldRows = function (p) {
        var K = p.K, h = K.h, taskId = p.taskId;
        var tick = K.useState(0);
        var ref = K.useMemo(function () {
            var off = null;
            return function (el) {
                if (off) { off(); off = null; }
                if (el) off = window.__ccOutbox.on(function () { tick[1](function (n) { return n + 1; }); });
            };
        }, [taskId]);
        var held = window.__ccOutbox.waiting(taskId), k = held.length ? kinds(p.session) : null;
        var rows = k && typeof p.renderRow === "function"
            ? held.map(function (w) { return p.renderRow(heldRow(k, w), "held-" + w.id, { readOnly: true, held: true }); })
            : null;
        return h("div", {
            ref: ref,
            className: "cc-at-held",
            children: rows ? h("div", { className: A.turnClasses(), children: rows }) : null
        });
    };
})(window.__ccAT = window.__ccAT || {});
