/* The files in a chat's own scratchpad (%TEMP%\claude\<project>\<id>\scratchpad):
   every one of them is the chat's, whatever made it, because the folder carries
   the chat's id. That holds for a chat older than the recorder too, and it is where
   most of what a chat leaves behind sits: 204,000 files in 103 old chats
   (2026-11-20).

   Found by walking the folder, which opens no file (on Windows a look does, so
   files.js looks at them a batch at a time). The walk keeps to the folder - a link
   is not followed - and skips a repository's .git. No line says when a file lands
   there, so the folder is walked again whenever the dialog opens. */
globalThis.__ccCFScratch = globalThis.__ccCFScratch || (function () {
    var fsp = globalThis.__ccCFFs.promises;
    var path = require("path");
    var os = require("os");
    var breathe = globalThis.__ccCFBreathe, PER_SLICE = 5000;

    async function folders(sessionId) {
        var root = path.join(os.tmpdir(), "claude");
        var names = await fsp.readdir(root).catch(function () { return []; });
        var found = await Promise.all(names.map(function (n) {
            var p = path.join(root, n, sessionId, "scratchpad");
            return fsp.stat(p).then(function (s) { return s.isDirectory() ? p : null; }, function () { return null; });
        }));
        return found.filter(Boolean);
    }

    async function walk(dir, out) {
        var list = await fsp.readdir(dir, { withFileTypes: true }).catch(function () { return []; });
        for (var e of list) {
            var p = path.join(dir, e.name);
            if (e.isDirectory()) { if (e.name.toLowerCase() !== ".git") await walk(p, out); }
            else if (e.isFile()) out.push(p);
        }
    }

    /* Read like a followed file: read(again) resolves to the paths that came or went
       since the last walk. A file found not to be the chat's to list (git tracks it)
       is let go of and not taken back by the next walk. */
    function source(sessionId) {
        var me = {}, walked = false, dropped = new Set();
        var r = me.replay = { alive: new Map(), start: Infinity, gaps: 0 };
        r.letGo = function (key) { r.alive.delete(key); dropped.add(key); return true; };
        me.read = async function (again) {
            if (walked && !again) return new Set();
            walked = true;
            var paths = [], before = r.alive, next = new Map(), touched = new Set();
            for (var dir of await folders(sessionId)) await walk(dir, paths);
            for (var i = 0; i < paths.length; i++) {
                if (i % PER_SLICE === PER_SLICE - 1) await breathe();   // the thread is every extension's
                var p = paths[i], key = p.toLowerCase();
                if (dropped.has(key)) continue;
                next.set(key, before.get(key) || { path: p, t: "", op: "scratch" });
                if (!before.has(key)) touched.add(key);
            }
            before.forEach(function (_v, key) { if (!next.has(key)) touched.add(key); });
            r.alive = next;
            return touched;
        };
        return me;
    }

    return { source: source };
})();
