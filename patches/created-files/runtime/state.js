/* The live state behind the header icon: how many files this chat has created
   that still exist, and the newest of them for the dialog.

   State is a push, never a poll. __ccSession hands us the session id and the
   connection (and re-does both when the conversation changes), we tell the host,
   and the host sends a fresh list whenever that chat's ledger changes. apply()
   writes the badge and the icon's visibility through __ccDom, so an unchanged
   value is not a mutation and never wakes the shared observer; __ccWatch re-applies
   after the app re-renders the header, since a remount would drop our live edits. */
window.__ccCFState = window.__ccCFState || (function () {
    var state = { sid: null, store: null };

    /* Nothing of the previous chat may survive a switch: "Delete all" acts on what
       the dialog shows. */
    function clear() {
        state.rows = [];
        state.total = 0;
        state.checking = 0;
        state.incomplete = false;
        state.unrecorded = false;
        state.running = false;
        state.failed = 0;
        state.copied = 0;
        state.list = "";
        state.reports = 0;
    }

    function shown() { return state.running || state.total > 0; }

    /* A window whose host was loaded before the tree (extension.js loads once per
       window) still sends the newest files as a list: shown as rows of files. */
    function flat(files) {
        return files.map(function (f) { return { kind: "file", key: f.path.toLowerCase(), path: f.path, name: f.name, depth: 0 }; });
    }

    function apply() {
        var dom = window.__ccDom;
        var wrap = document.getElementById("cc-cf");
        if (!wrap || !dom) return;
        dom.toggle(wrap, "cc-cf-hidden", !shown());
        var badge = document.getElementById("cc-cf-badge");
        if (badge) {
            var n = state.total;
            dom.setText(badge, n > 0 ? String(n > 999 ? "999+" : n) : "");
            dom.toggle(badge, "cc-cf-empty", n === 0);
        }
    }

    function redraw() {
        apply();
        if (window.__ccCFRender) window.__ccCFRender();
    }

    function send(msg) {
        msg.type = "ccCF";
        return window.__ccCFLink.send(state.store, msg);
    }

    function subscribe() {
        if (state.sid) send({ op: "subscribe", sessionId: state.sid });
    }

    function onSid(sid, store) {
        var next = sid || null;
        state.store = store || state.store;
        if (next !== state.sid) {
            state.sid = next;
            clear();
            redraw();
        }
        subscribe();
    }

    /* The session id can be known before the line to the host is up. */
    function onConnection(_connection, store) {
        state.store = store || state.store;
        subscribe();
    }

    function onData(d) {
        if (!d || d.sessionId !== state.sid) return;
        if (d.rows) state.rows = d.rows;   // only while the dialog is open, and only the newest
        else if (d.files) state.rows = flat(d.files);
        state.total = d.total || 0;
        state.checking = d.checking || 0;   // files not looked at on disk yet: total may still grow
        state.incomplete = !!d.incomplete;
        state.unrecorded = !!d.unrecorded;   // part of the chat ran before recording: only what Claude wrote and its scratchpad
        state.running = !!d.running;
        state.list = d.list || "";
        if ("failed" in d) {   // stays until the next delete reports
            state.failed = d.failed;
            state.reports++;
        }
        state.copied = d.copied || 0;
        redraw();
    }

    clear();
    if (window.__ccSession) {
        window.__ccSession.on("sessionId", onSid);
        window.__ccSession.on("connection", onConnection);
    }
    window.__ccCFLink.onData(onData);
    if (window.__ccWatch) window.__ccWatch.on(apply);

    return { get: function () { return state; }, send: send };
})();
