/* The panel's back end for created files: it answers the webview's messages and
   pushes a fresh list whenever that chat's ledger changes.

   One directory watcher for the whole host, fanned out to the panels that asked
   about each session id, and open only while a panel is listening. A panel
   leaves when its view is disposed. One read per chat runs at a time, and the
   list a panel receives is capped: a single npm install is tens of thousands of
   files. Acting on a path is checked against a fresh read of that chat's ledger. */
globalThis.__ccCF = globalThis.__ccCF || (function () {
    var L = globalThis.__ccCFLedger;
    var A = globalThis.__ccCFActions;
    var LIST_CAP = 300, SETTLE_MS = 500;
    var byId = new Map(), ofView = new Map(), known = new WeakSet();
    var flights = new Map(), timers = new Map(), latest = new Map();
    var wasRecording = false;

    function deliver(id, extra) {
        var data = latest.get(id), views = byId.get(id);
        if (!data || !views) return;
        var msg = Object.assign({
            type: "ccCFData", sessionId: id, files: data.files.slice(0, LIST_CAP), total: data.files.length,
            incomplete: data.incomplete, running: wasRecording
        }, extra);
        views.forEach(function (wv) {
            try { Promise.resolve(wv.postMessage(msg)).catch(function () {}); } catch (e) {}
        });
    }

    function refresh(id, extra) {
        var f = flights.get(id);
        if (f) { f.again = true; f.extra = Object.assign(f.extra || {}, extra); return; }
        f = { again: false, extra: null };
        flights.set(id, f);
        syncRecording();
        L.read(id).then(function (data) {
            if (!byId.has(id)) return;   // its last panel left while this was reading
            latest.set(id, data);
            deliver(id, extra);
        }, function () {}).then(function () {
            flights.delete(id);
            if (f.again && byId.has(id)) refresh(id, f.extra);
        });
    }

    function settle(id) {
        if (timers.has(id) || !byId.has(id)) return;
        timers.set(id, setTimeout(function () { timers.delete(id); if (byId.has(id)) refresh(id); }, SETTLE_MS));
    }

    /* Whether the recorder runs is one fact for every chat, so a change goes to all. */
    function syncRecording() {
        var now = L.recording();
        if (now === wasRecording) return;
        wasRecording = now;
        byId.forEach(function (_v, id) { deliver(id); });
    }

    var folder = globalThis.__ccCFWatch.folder(L.DIR, function (name) {
        if (name === "status.json") syncRecording();
        else if (name.slice(-6) === ".jsonl") settle(name.slice(0, -6));
    }, function () {
        byId.forEach(function (_v, id) { refresh(id); });
    });

    function leave(wv) {
        var id = ofView.get(wv);
        ofView.delete(wv);
        var views = id && byId.get(id);
        if (!views) return;
        views.delete(wv);
        if (views.size) return;
        byId.delete(id);
        latest.delete(id);
        if (!byId.size) folder.stop();
    }

    function subscribe(view, id) {
        var wv = view.webview;
        if (!known.has(view)) {
            known.add(view);
            view.onDidDispose(function () { leave(wv); });
        }
        if (ofView.get(wv) !== id) leave(wv);
        if (typeof id !== "string" || !/^[\w-]{1,80}$/.test(id)) return;
        ofView.set(wv, id);
        if (!byId.has(id)) byId.set(id, new Set());
        byId.get(id).add(wv);
        folder.ensure();
        refresh(id);
    }

    /* Only what this chat's ledger lists right now can be acted on. */
    function act(id, wanted, run) {
        L.read(id).then(function (data) {
            var listed = new Map(data.files.map(function (f) { return [f.path.toLowerCase(), f.path]; }));
            var paths = wanted === null ? Array.from(listed.values()) :
                wanted.map(function (p) { return listed.get(String(p).toLowerCase()); }).filter(Boolean);
            return paths.length ? run(paths) : undefined;
        }).catch(function () {});
    }

    function remove(id, wanted) {
        act(id, wanted, function (paths) {
            return A.trash(paths).then(function (failed) { refresh(id, { failed: failed }); });
        });
    }

    function handle(msg, view) {
        if (!msg || msg.type !== "ccCF" || !view) return false;
        var id = ofView.get(view.webview);
        if (msg.op === "subscribe") subscribe(view, msg.sessionId);
        else if (!id) return true;
        else if (msg.op === "refresh") refresh(id);
        else if (msg.op === "reveal") act(id, [msg.path], function (paths) { A.reveal(paths[0]); });
        else if (msg.op === "copyAll") act(id, null, function (paths) {
            return A.copy(paths).then(function () { deliver(id, { copied: paths.length }); });
        });
        else if (msg.op === "delete") remove(id, [msg.path]);
        else if (msg.op === "deleteAll") remove(id, null);
        return true;
    }

    return { handle: handle };
})();
