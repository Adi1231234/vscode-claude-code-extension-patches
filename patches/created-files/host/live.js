/* The panel's back end for created files: it answers the webview's messages and
   pushes a fresh list whenever that chat's ledger changes.

   One directory watcher for the whole host, fanned out to the panels that asked
   about each session id, and open only while a panel is listening. A panel
   leaves when its view is disposed. One read per chat runs at a time (reads.js),
   and a panel hears only of a change. It gets the counts always, and the rows of
   the tree its dialog shows only while
   the dialog is open (views.js): a single npm install is tens of thousands of
   files. A chat read for the first time answers with its newest files looked at,
   and the rest are looked at a batch at a time behind that answer. A file the
   dialog shows is looked at again the first time it shows it (a file deleted
   outside any chat leaves no line). Acting on a path is checked against a fresh
   look at that path. */
globalThis.__ccCF = globalThis.__ccCF || (function () {
    var L = globalThis.__ccCFLedger, V = globalThis.__ccCFViews;
    var SETTLE_MS = 500, FIRST_LOOK = 600, BATCH = 2000;
    var byId = new Map(), ofView = new Map(), known = new WeakSet();
    var timers = new Map(), latest = new Map();
    var wasRecording = false;

    function post(wv, msg) {
        try { Promise.resolve(wv.postMessage(msg)).catch(function () {}); } catch (e) {}
    }

    /* To every panel of the chat, or to `only` that one. */
    function deliver(id, extra, only) {
        var data = latest.get(id), views = byId.get(id);
        if (!data || !views) return;
        var msg = Object.assign({
            type: "ccCFData", sessionId: id, total: data.files.length, bytes: data.bytes,
            checking: data.checking, incomplete: data.incomplete, unrecorded: data.unrecorded, running: wasRecording, list: data.list
        }, extra);
        (only ? [only] : views).forEach(function (wv) {
            V.rowsFor(id, wv, data.files).then(function (shown) {
                post(wv, shown ? Object.assign({ rows: shown.rows }, msg) : msg);   // none: closed, or newer rows on the way
                if (shown && shown.unlooked.length) refresh(id, null, { paths: shown.unlooked });
            }, function () { post(wv, msg); });
        });
    }

    /* Nothing a panel shows differs: the list is the same array while it stays the same. */
    function same(a, b) {
        return !!a && a.files === b.files && a.bytes === b.bytes && a.checking === b.checking && a.incomplete === b.incomplete && a.unrecorded === b.unrecorded;
    }

    /* opts.verify: files not looked at yet to look at now; opts.paths: files to look
       at again (just acted on, or just shown); opts.again: look for files no line
       announces as well (the dialog opened). The panels hear of it when something
       changed, or when there is news for them (extra). */
    var refresh = globalThis.__ccCFReads(function (id, extra, o) {
        if (!byId.has(id)) return null;   // its last panel left meanwhile
        syncRecording();
        var first = !latest.has(id);
        return L.read(id, { verify: first ? FIRST_LOOK : o.verify, paths: o.paths || [], again: !!o.again }).then(function (data) {
            if (!byId.has(id)) return null;
            var before = latest.get(id);
            latest.set(id, data);
            if (extra || !same(before, data)) deliver(id, extra);
            return data.checking > 0 ? { verify: BATCH } : null;   // the next batch, behind this answer
        });
    });

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
        V.forget(id);
        if (!byId.size) folder.stop();
    }

    function subscribe(view, id) {
        var wv = view.webview;
        if (!known.has(view)) {
            known.add(view);
            view.onDidDispose(function () { leave(wv); });
        }
        if (ofView.get(wv) !== id) { leave(wv); V.forgetShown(wv); }   // another chat: its own folders open
        if (typeof id !== "string" || !/^[\w-]{1,80}$/.test(id)) return;
        ofView.set(wv, id);
        if (!byId.has(id)) byId.set(id, new Set());
        byId.get(id).add(wv);
        folder.ensure();
        deliver(id, null, wv);   // a chat another panel follows already has an answer
        refresh(id);
    }

    var acting = globalThis.__ccCFActing(refresh, deliver);

    function handle(msg, view) {
        if (!msg || msg.type !== "ccCF" || !view) return false;
        var id = ofView.get(view.webview);
        if (msg.op === "subscribe") subscribe(view, msg.sessionId);
        else if (!id) return true;
        else if (msg.op === "refresh") refresh(id, null, { again: true });
        else if (msg.op === "view") { V.setOpen(view.webview, msg.open); if (msg.open) deliver(id, null, view.webview); }
        else if (msg.op === "toggle") { V.toggle(view.webview, msg.key); deliver(id, null, view.webview); }
        else if (msg.op === "more") { V.more(view.webview, msg.key); deliver(id, null, view.webview); }
        else if (msg.op === "reveal") acting.reveal(id, msg.path);
        else if (msg.op === "copyAll") acting.copyAll(id);
        else if (msg.op === "copyItems") acting.copyItems(id, V.itemsOf(id, msg.path), String(msg.key), view.webview);
        else if (msg.op === "delete") acting.remove(id, msg.path);
        else if (msg.op === "deleteAll") acting.removeAll(id, msg.list);
        return true;
    }

    return { handle: handle };
})();
