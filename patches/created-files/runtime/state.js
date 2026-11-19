/* The live state behind the header icon: how many files this chat has created
   that still exist, and the list itself for the dialog.

   State is a push, never a poll. __ccSession hands us the session id (and re-does
   it when the conversation changes), we tell the host once, and the host sends a
   fresh list whenever that chat's ledger changes. apply() writes the badge and
   the icon's visibility through __ccDom, so an unchanged value is not a mutation
   and never wakes the shared observer; __ccWatch re-applies after the app
   re-renders the header, since React would otherwise drop our live edits. */
window.__ccCFState = window.__ccCFState || (function () {
    var state = { sid: null, store: null, files: [], gaps: [], status: null };

    function shown() {
        return (state.status && state.status.running) || state.files.length > 0;
    }

    function apply() {
        var dom = window.__ccDom;
        var wrap = document.getElementById("cc-cf");
        if (!wrap || !dom) return;
        dom.toggle(wrap, "cc-cf-hidden", !shown());
        var badge = document.getElementById("cc-cf-badge");
        if (badge) {
            var n = state.files.length;
            dom.setText(badge, n > 0 ? String(n > 999 ? "999+" : n) : "");
            dom.toggle(badge, "cc-cf-empty", n === 0);
        }
    }

    function send(msg) { return window.__ccCFLink.send(state.store, msg); }

    function onSid(sid, store) {
        state.sid = sid || null;
        state.store = store || state.store;
        if (state.sid) send({ type: "ccCF", op: "subscribe", sessionId: state.sid });
        apply();
    }

    function onData(d) {
        if (!d || d.sessionId !== state.sid) return;
        state.files = d.files || [];
        state.gaps = d.gaps || [];
        state.status = d.status || null;
        apply();
        if (window.__ccCFRender) window.__ccCFRender();
    }

    if (window.__ccSession) window.__ccSession.on("sessionId", onSid);
    window.__ccCFLink.onData(onData);
    if (window.__ccWatch) window.__ccWatch.on(apply, { scope: function () { return document.body; } });

    return {
        get: function () { return state; },
        apply: apply,
        send: send,
        refresh: function () { if (state.sid) send({ type: "ccCF", op: "refresh", sessionId: state.sid }); }
    };
})();
