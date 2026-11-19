/* The panel's line to the host: send a message down the app's own channel, and
   hear the host's replies. The same back-channel every patch here uses
   (session.connection.value.send), so nothing goes near acquireVsCodeApi.

   The host answers with window 'message' events of type "ccCFData"; one listener
   fans them out to whoever asked. */
window.__ccCFLink = window.__ccCFLink || (function () {
    var cbs = [];
    var listening = false;

    function listen() {
        if (listening) return;
        listening = true;
        window.addEventListener("message", function (ev) {
            var m = ev && ev.data;
            if (!m || m.type !== "ccCFData") return;
            for (var i = 0; i < cbs.length; i++) { try { cbs[i](m); } catch (e) {} }
        });
    }

    function send(store, msg) {
        listen();
        try {
            var c = store && store.connection && store.connection.value;
            if (!c || typeof c.send !== "function") return false;
            c.send(msg);
            return true;
        } catch (e) { return false; }
    }

    function onData(cb) { listen(); cbs.push(cb); }

    return { send: send, onData: onData };
})();
