/* What the dialog's buttons do to a chat's files. Only what that chat's ledger lists
   right now, looked at afresh, can be acted on. Made by live.js, which hands over
   how to send the chat's panels a fresh list (refresh) or one extra fact (deliver). */
globalThis.__ccCFActing = globalThis.__ccCFActing || function (refresh, deliver) {
    var L = globalThis.__ccCFLedger;
    var A = globalThis.__ccCFActions;

    /* wanted: the paths the user picked, or null for every listed file. */
    function act(id, wanted, run) {
        L.read(id, { paths: wanted === null ? "all" : wanted }).then(function (data) {
            var listed = new Map(data.files.map(function (f) { return [f.path.toLowerCase(), f.path]; }));
            var paths = wanted === null ? Array.from(listed.values()) :
                wanted.map(function (p) { return listed.get(String(p).toLowerCase()); }).filter(Boolean);
            return paths.length ? run(paths) : undefined;
        }).catch(function () {});
    }

    /* After a move the moved files are looked at again: no ledger line says they went. */
    function moved(id, paths) {
        return function (failed) { refresh(id, { failed: failed }, { paths: paths }); };
    }

    function remove(id, wanted) {
        act(id, wanted, function (paths) { return A.trash(paths).then(moved(id, paths)); });
    }

    /* The user confirmed one exact list. If the chat has changed it since, nothing is
       moved: the fresh list goes back to the dialog, which asks again. What is moved
       is that same fresh list, so a file the chat makes in between is never in it. */
    function removeAll(id, confirmed) {
        L.read(id, { paths: "all" }).then(function (data) {
            if (data.list !== confirmed || data.checking > 0) { refresh(id, { failed: 0 }); return; }
            var paths = data.files.map(function (f) { return f.path; });
            return A.trash(paths).then(moved(id, paths));
        }).catch(function () { refresh(id, { failed: 0 }); });
    }

    /* The paths directly in one folder of the tree the dialog shows (paths: null when it
       has none). Only the panel that asked hears, and only once the clipboard took them. */
    function copyItems(id, paths, key, wv) {
        if (!paths) { deliver(id, { copiedFor: key, copyFailed: true }, wv); return; }
        A.copy(paths).then(function () { deliver(id, { copiedFor: key, copiedItems: paths.length }, wv); },
            function () { deliver(id, { copiedFor: key, copyFailed: true }, wv); });
    }

    return {
        copyItems: copyItems,
        reveal: function (id, p) { act(id, [p], function (paths) { A.reveal(paths[0]); }); },
        copyAll: function (id) {
            act(id, null, function (paths) {
                return A.copy(paths).then(function () { deliver(id, { copied: paths.length }); });
            });
        },
        remove: function (id, p) { remove(id, [p]); },
        removeAll: removeAll
    };
};
