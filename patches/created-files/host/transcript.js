/* What a chat's own transcript says it wrote: every file Claude's Write tool made,
   and each later edit of it. That record exists for every chat, also one older
   than the recorder; commands leave no such line, so it is never the whole story.

   A transcript is followed like a ledger (follow.js), but most of its lines are
   messages: only a line naming "structuredPatch" (a Write or an Edit result) is
   parsed, or one of a subagent's Write or Edit calls and their results
   (toolPairs.js). A chat of 505 MB was read in 1.8 s, 7 GB of transcripts in 32 s
   (measured 2026-11-20). A subagent writes in a transcript of its own. */
globalThis.__ccCFTranscript = globalThis.__ccCFTranscript || (function () {
    var fsp = globalThis.__ccCFFs.promises;
    var path = require("path");
    var os = require("os");
    var NEEDLE = Buffer.from('"structuredPatch"'), STAMP = Buffer.from('"timestamp":"'), NEWLINE = 0x0a;
    var PER_BREATH = 64;
    var pairs = globalThis.__ccCFToolPairs;

    function projects() { return path.join(os.homedir(), ".claude", "projects"); }
    var breathe = globalThis.__ccCFBreathe;

    /* alive: lower-cased path -> the file Claude made there, with the times it wrote it
       (`writes`, milliseconds). first: when the transcript began. */
    function create() {
        var r = { alive: new Map(), pending: new Map(), start: Infinity, gaps: 0, first: Infinity };
        r.letGo = function (key) { r.alive.delete(key); return true; };
        return r;
    }

    function apply(r, line) {
        var o;
        try { o = JSON.parse(line); } catch (e) { return null; }
        var res = o && o.toolUseResult, t = Date.parse(o && o.timestamp);
        if (!isFinite(t)) return null;
        var paired = pairs.pairedWrite(r.pending, o);   /* always, so a chat's own calls leave nothing pending */
        var write = res && typeof res.filePath === "string" && res.structuredPatch
            ? { path: res.filePath, created: res.type === "create" } : res ? null : paired;
        if (!write) return null;
        var file = path.normalize(write.path), key = file.toLowerCase(), had = r.alive.get(key);
        if (write.created) r.alive.set(key, { path: file, t: o.timestamp, op: "write", writes: [t] });
        else if (had) r.alive.set(key, Object.assign({}, had, { writes: had.writes.concat(t) }));
        else return null;   // an edit of a file the chat did not make
        return key;
    }

    function firstTime(r, buf) {
        var i = buf.indexOf(STAMP);
        if (i < 0) return;
        var t = Date.parse(buf.toString("utf8", i + STAMP.length, i + STAMP.length + 40).split('"')[0]);
        if (isFinite(t)) r.first = t;
    }

    async function take(r, buf) {
        var touched = new Set(), hits = 0;
        if (r.first === Infinity) firstTime(r, buf);
        var lines = linesWith(buf, [NEEDLE].concat(pairs.NEEDLES));
        for (var n = 0; n < lines.length; n++) {
            var key = apply(r, buf.toString("utf8", lines[n][0], lines[n][1]));
            if (key) touched.add(key);
            if (++hits % PER_BREATH === 0) await breathe();
        }
        return touched;
    }

    /* Each line of `buf` naming any of `needles`, once, in order: [start, end). */
    function linesWith(buf, needles) {
        var starts = new Map();
        needles.forEach(function (needle) {
            for (var i = buf.indexOf(needle); i >= 0; ) {
                var from = buf.lastIndexOf(NEWLINE, i) + 1, to = buf.indexOf(NEWLINE, i);
                if (to < 0) to = buf.length;
                starts.set(from, to);
                i = buf.indexOf(needle, to);
            }
        });
        return Array.from(starts).sort(function (a, b) { return a[0] - b[0]; });
    }

    /* When the earliest of these transcripts began, reading no more of each than it
       takes to meet its first time (a first message can be long). */
    var HEAD = 1 << 16, HEAD_MAX = 1 << 20;
    async function began(files) {
        var times = await Promise.all(files.map(async function (file) {
            var h = await fsp.open(file, "r").catch(function () { return null; }), r = create();
            if (!h) return Infinity;
            try {
                for (var size = HEAD; r.first === Infinity && size <= HEAD_MAX; size *= 4) {
                    var buf = Buffer.alloc(size), got = await h.read(buf, 0, size, 0);
                    firstTime(r, buf.subarray(0, got.bytesRead));
                    if (got.bytesRead < size) break;
                }
                return r.first;
            } finally { await h.close(); }
        }));
        return Math.min.apply(null, [Infinity].concat(times));
    }

    function exists(p) { return fsp.stat(p).then(function (s) { return s.isFile(); }, function () { return false; }); }

    /* The chat's transcript and its subagents' wherever its project folder is: it
       moves with the chat (entering a worktree moves it). */
    async function find(sessionId) {
        var root = projects(), found = [];
        var dirs = await fsp.readdir(root).catch(function () { return []; });
        await Promise.all(dirs.map(async function (d) {
            var main = path.join(root, d, sessionId + ".jsonl"), sub = path.join(root, d, sessionId, "subagents");
            if (await exists(main)) found.push(main);
            var agents = await fsp.readdir(sub).catch(function () { return []; });
            agents.forEach(function (n) { if (/[.]jsonl$/i.test(n)) found.push(path.join(sub, n)); });
        }));
        return found;
    }

    return { kind: { create: create, take: take }, find: find, began: began };
})();
