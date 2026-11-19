/* The panel's back end for created files: it answers the webview's messages and
   pushes a fresh list whenever that chat's ledger changes.

   One directory watcher for the whole host, fanned out to the panels that asked
   about each session id - so opening ten panels does not open ten watchers.
   Reveal and delete go through the editor's own APIs (revealFileInOS, trash
   delete), so nothing is shelled out and neither editor is branched on. */
globalThis.__ccCF = globalThis.__ccCF || (function () {
    var fs = require("fs");
    var path = require("path");
    var L = globalThis.__ccCFLedger;
    var byId = new Map();     // sessionId -> Set<webview>
    var ofView = new Map();   // webview -> sessionId
    var timers = new Map();   // sessionId -> debounce timer
    var watcher = null, rearm = null;

    function vscode() { try { return require("vscode"); } catch (e) { return null; } }

    function push(sessionId) {
        var views = byId.get(sessionId);
        if (!views || !views.size) return;
        var data = L.read(sessionId);
        var msg = { type: "ccCFData", sessionId: sessionId, files: data.files, gaps: data.gaps, status: L.status() };
        views.forEach(function (wv) { try { wv.postMessage(msg); } catch (e) { drop(wv); } });
    }

    function bump(sessionId) {
        if (timers.has(sessionId)) return;
        timers.set(sessionId, setTimeout(function () { timers.delete(sessionId); push(sessionId); }, 200));
    }

    function ensureWatch() {
        if (watcher) return;
        try {
            watcher = fs.watch(L.DIR, function (_evt, name) {
                if (name && name.slice(-6) === ".jsonl") bump(name.slice(0, -6));
                else if (name === "status.json") byId.forEach(function (_v, id) { bump(id); });
            });
            watcher.on("error", reWatchLater);
        } catch (e) { reWatchLater(); }
    }

    // The ledger dir appears only once the recorder has run; until then, retry.
    function reWatchLater() {
        if (watcher) { try { watcher.close(); } catch (e) {} watcher = null; }
        if (rearm) return;
        rearm = setTimeout(function () { rearm = null; if (byId.size) { ensureWatch(); byId.forEach(function (_v, id) { push(id); }); } }, 4000);
    }

    function drop(wv) {
        var id = ofView.get(wv);
        ofView.delete(wv);
        if (id && byId.has(id)) { byId.get(id).delete(wv); if (!byId.get(id).size) byId.delete(id); }
    }

    function subscribe(wv, sessionId) {
        var prev = ofView.get(wv);
        if (prev === sessionId) { push(sessionId); return; }
        if (prev && byId.has(prev)) { byId.get(prev).delete(wv); if (!byId.get(prev).size) byId.delete(prev); }
        if (!sessionId) { ofView.delete(wv); return; }
        ofView.set(wv, sessionId);
        if (!byId.has(sessionId)) byId.set(sessionId, new Set());
        byId.get(sessionId).add(wv);
        ensureWatch();
        push(sessionId);
    }

    function reveal(p) { var v = vscode(); if (v) v.commands.executeCommand("revealFileInOS", v.Uri.file(p)); }

    function trash(paths, sessionId) {
        var v = vscode();
        if (!v) return;
        var next = paths.slice();
        (function one() {
            if (!next.length) { push(sessionId); return; }
            var p = next.shift();
            Promise.resolve(v.workspace.fs.delete(v.Uri.file(p), { useTrash: true }))
                .then(function () {}, function () {})
                .then(one);
        })();
    }

    function handle(msg, webview) {
        if (!msg || msg.type !== "ccCF" || !webview) return false;
        if (msg.op === "subscribe") subscribe(webview, msg.sessionId);
        else if (msg.op === "refresh") push(msg.sessionId || ofView.get(webview));
        else if (msg.op === "reveal") reveal(msg.path);
        else if (msg.op === "delete") trash(msg.paths || [], msg.sessionId || ofView.get(webview));
        else return false;
        return true;
    }

    return { handle: handle };
})();
