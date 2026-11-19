/* The panel's back end for created files: it answers the webview's messages and
   pushes a fresh list whenever that chat's ledger changes.

   One directory watcher for the whole host, fanned out to the panels that asked
   about each session id, and open only while a panel is listening. A panel
   leaves when its view is disposed. One read per chat runs at a time, and the
   list a panel receives is capped: a single npm install is tens of thousands of
   files. A chat read for the first time answers with its newest files looked at,
   and the rest are looked at a batch at a time behind that answer. Acting on a
   path is checked against a fresh look at that path. */
globalThis.__ccCF = globalThis.__ccCF || (function () {
    var L = globalThis.__ccCFLedger;
    var LIST_CAP = 300, SETTLE_MS = 500, FIRST_LOOK = 2 * LIST_CAP, BATCH = 2000;
    var byId = new Map(), ofView = new Map(), known = new WeakSet();
    var flights = new Map(), timers = new Map(), latest = new Map();
    var wasRecording = false;

    function deliver(id, extra) {
        var data = latest.get(id), views = byId.get(id);
        if (!data || !views) return;
        var msg = Object.assign({
            type: "ccCFData", sessionId: id, files: data.files.slice(0, LIST_CAP), total: data.files.length,
            checking: data.checking, incomplete: data.incomplete, running: wasRecording, list: data.list
        }, extra);
        views.forEach(function (wv) {
            try { Promise.resolve(wv.postMessage(msg)).catch(function () {}); } catch (e) {}
        });
    }

    /* opts.verify: files not looked at yet to look at now; opts.paths: files to look
       at again (just acted on); opts.shown: the rows the panel shows, as well (a file
       may have gone without its ledger changing). */
    function refresh(id, extra, opts) {
        var o = opts || {}, f = flights.get(id);
        if (f) {
            f.again = true;
            f.extra = Object.assign(f.extra || {}, extra);
            f.verify = Math.max(f.verify, o.verify || 0);
            f.paths = f.paths.concat(o.paths || []);
            f.shown = f.shown || !!o.shown;
            return;
        }
        f = { again: false, extra: null, verify: 0, paths: [], shown: false };
        flights.set(id, f);
        syncRecording();
        var before = latest.get(id);
        var paths = (o.paths || []).concat(o.shown && before ? before.files.slice(0, LIST_CAP).map(function (x) { return x.path; }) : []);
        L.read(id, { verify: before ? o.verify : FIRST_LOOK, paths: paths }).then(function (data) {
            if (!byId.has(id)) return;   // its last panel left while this was reading
            latest.set(id, data);
            deliver(id, extra);
            if (data.checking > 0) { f.again = true; f.verify = Math.max(f.verify, BATCH); }
        }, function () {}).then(function () {
            flights.delete(id);
            if (f.again) setImmediate(function () {
                if (byId.has(id)) refresh(id, f.extra, { verify: f.verify, paths: f.paths, shown: f.shown });
            });
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
        L.forget(id);
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

    var acting = globalThis.__ccCFActing(refresh, deliver);

    function handle(msg, view) {
        if (!msg || msg.type !== "ccCF" || !view) return false;
        var id = ofView.get(view.webview);
        if (msg.op === "subscribe") subscribe(view, msg.sessionId);
        else if (!id) return true;
        else if (msg.op === "refresh") refresh(id, null, { shown: true });
        else if (msg.op === "reveal") acting.reveal(id, msg.path);
        else if (msg.op === "copyAll") acting.copyAll(id);
        else if (msg.op === "delete") acting.remove(id, msg.path);
        else if (msg.op === "deleteAll") acting.removeAll(id, msg.list);
        return true;
    }

    return { handle: handle };
})();
