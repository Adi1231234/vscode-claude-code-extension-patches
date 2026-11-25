/* One chat's created files, kept up to date as its ledger grows. The same as
   adi-tools' packages/created-files/chatFiles.mjs; change the two together.

   Each file is looked at on disk once: when a ledger line is about it, or, for a
   ledger read from its start, newest first as far as asked (verify), so the first
   rows show long before the 60,000th file is looked at. On Windows a look opens the
   file: 65,000 of them were 25 s of processor time (measured 2026-11-19), on the
   thread every extension shares. A file deleted outside any chat leaves no line:
   the caller looks at given files again (paths). What git tracks is filtered again
   over every file only when its answers may have changed (a commit, a repository
   the chat's git made: newRepos.js).

   What the chat made is read from `source`: its ledger, or every record of it
   (sources.js), with one followed ledger's read() and replay. */
globalThis.__ccCFFiles = globalThis.__ccCFFiles || (function () {
    var fsp = globalThis.__ccCFFs.promises;
    var R = globalThis.__ccCFReplay;
    var I = globalThis.__ccCFInternal;
    var T = globalThis.__ccCFTracked;
    var NR = globalThis.__ccCFNewRepos;
    var STAT_BATCH = 64;

    function newestFirst(a, b) { return a.t === b.t ? 0 : a.t < b.t ? 1 : -1; }

    /* The events whose file is on disk and still the one the chat made, and each such file's size now (the look reads it for free). */
    async function onDisk(events, start) {
        var found = new Map(), sizes = new Map(), wanted = events.filter(function (e) { return !I.isInternal(e.path); });
        for (var i = 0; i < wanted.length; i += STAT_BATCH) {
            var batch = wanted.slice(i, i + STAT_BATCH);
            var stats = await Promise.all(batch.map(function (e) {
                return fsp.stat(e.path, { bigint: true }).catch(function () { return null; });
            }));
            batch.forEach(function (e, j) {
                if (!stats[j] || !R.stillTheChats(e, stats[j], start)) return;
                found.set(e.path.toLowerCase(), e);
                sizes.set(e.path.toLowerCase(), Number(stats[j].size));
            });
        }
        return { found: found, sizes: sizes };
    }

    function chat(source) {
        var read = false, version = null, queue = Promise.resolve(), newRepos = NR.seen();
        /* rows: lower-cased path -> the event that made the file, for each file on
           disk, still the chat's, and not tracked by git: what is listed. (A second
           map of the files looked at always held the same files once a refresh was
           done - 169,000 entries for nothing in one chat, 2026-11-20.) */
        var unknown = [], rows = new Map(), listed = null;
        var bytes = 0;   // the listed files' size, as each was last looked at: each record keeps its own (size)
        var me = {
            /* A new array only when the list changes, so what is made from it (the tree,
               the list's name) is made once per change. */
            files: function () { return listed || (listed = Array.from(rows.values())); },
            gaps: function () { return source.replay.gaps; },
            spawns: function () { return source.replay.spawns || new Map(); },
            unrecorded: function () { return !!(source.unrecorded && source.unrecorded()); },
            pending: function () { return unknown.length; },
            bytes: function () { return bytes; }
        };

        function startOver(alive) {
            var before = new Set(rows.keys());
            unknown = Array.from(alive.entries()).sort(function (a, b) { return newestFirst(b[1], a[1]); })
                .map(function (kv) { return kv[0]; });
            return before;   // so whatever was listed is looked at again, and taken off if it went
        }

        async function refresh(paths, verify, again) {
            var touched = await source.read(again), alive = source.replay.alive;
            newRepos(source.replay.repos).forEach(function (dir) { T.forget(dir); });   // its version moves (below)
            var keys = touched && read ? touched : startOver(alive);
            read = true;
            paths.forEach(function (p) { keys.add(String(p).toLowerCase()); });
            while (verify-- > 0 && unknown.length) keys.add(unknown.pop());
            var replay = source.replay;
            var seen = await onDisk(Array.from(keys).map(function (k) { return alive.get(k); }).filter(Boolean), replay.start), looked = seen.found;
            keys.forEach(function (k) {
                if (!looked.has(k) && alive.has(k)) replay.letGo(k);   // not the chat's file any more: its record goes, once quiet
            });
            var v = await T.version();
            var scope = v === version ? keys : new Set(Array.from(keys).concat(Array.from(rows.keys())));
            version = v;
            /* On disk and still the chat's: as just looked at, or as listed for the files not looked at now. */
            function current(k) { return keys.has(k) ? looked.get(k) : rows.get(k); }
            var candidates = Array.from(scope).filter(current).map(function (k) { return current(k).path; });
            var allowed = new Set((await T.drop(candidates)).map(function (p) { return p.toLowerCase(); }));
            scope.forEach(function (k) {
                if (current(k) && !allowed.has(k)) replay.letGo(k);   // git tracks it: real work, never listed, so nothing about it is kept
            });
            var changed = false;
            scope.forEach(function (k) {
                var e = allowed.has(k) ? current(k) : undefined, before = rows.get(k), was = before ? before.size || 0 : 0;
                if (e) {
                    var size = seen.sizes.has(k) ? seen.sizes.get(k) : was;   // a file not looked at now keeps its size
                    if (before !== e || size !== was) changed = true;
                    bytes += size - (before ? was : 0);
                    e.size = size;
                    rows.set(k, e);
                } else if (before) {
                    changed = true;
                    bytes -= was;
                    rows.delete(k);
                }
            });
            if (changed) listed = null;
            return changed;
        }

        /* Calls run one after another: two at once would read the same lines twice. */
        me.refresh = function (opts) {
            var o = opts || {};
            var run = queue.then(function () { return refresh(o.paths || [], o.verify === undefined ? Infinity : o.verify, !!o.again); });
            queue = run.catch(function () {});
            return run;
        };
        return me;
    }

    return { chat: chat };
})();
