/* Everything that says what one chat made, read as one followed ledger, which is
   what files.js takes: read() and a replay.

   The chat's ledger is the exact record, and where it names a path its word
   stands. Only 41 of 278 chats had one (2026-11-20): every chat older than the
   recorder had none. For a chat whose transcript began before its ledger (or that
   has no ledger), two more records are read: the files in its own scratchpad,
   which are its by place (scratch.js), and the files its transcripts say Claude
   wrote (transcript.js). Commands left no line then, so such a chat says its list
   covers only those (unrecorded) - when it began before recording on this machine did. */
globalThis.__ccCFSources = globalThis.__ccCFSources || (function () {
    var fsp = globalThis.__ccCFFs.promises;
    var path = require("path");
    var F = globalThis.__ccCFFollow, T = globalThis.__ccCFTranscript, S = globalThis.__ccCFScratch;
    var SLACK_MS = 60000, LINE = 1024;
    var since = null;

    async function firstTime(file) {
        var h = await fsp.open(file, "r").catch(function () { return null; });
        if (!h) return Infinity;
        try {
            var buf = Buffer.alloc(LINE), got = await h.read(buf, 0, LINE, 0);
            var t = Date.parse(JSON.parse(buf.toString("utf8", 0, got.bytesRead).split("\n")[0]).t);
            return isFinite(t) ? t : Infinity;
        } catch (e) { return Infinity; } finally { await h.close(); }
    }

    /* When recording began here: the earliest first line of any ledger (a shrunk one
       keeps its first time there). Kept once known. */
    async function recordingSince(dir) {
        if (since !== null) return since;
        var names = (await fsp.readdir(dir).catch(function () { return []; })).filter(function (n) { return /[.]jsonl$/i.test(n); });
        var t = Math.min.apply(null, [Infinity].concat(await Promise.all(names.map(function (n) { return firstTime(path.join(dir, n)); }))));
        if (isFinite(t)) since = t;
        return t;
    }

    function of(sessionId, ledgerFile, dir) {
        var ledger = F.follow(ledgerFile), scratch = null, transcripts = [];
        var decided = false, wide = false, unrecorded = false;
        function all() { return [ledger].concat(scratch ? [scratch] : [], transcripts); }

        var alive = {
            get: function (key) {
                for (var s of all()) { var e = s.replay.alive.get(key); if (e) return e; }
                return undefined;
            },
            has: function (key) { return alive.get(key) !== undefined; },
            entries: function* () {
                var seen = new Set();
                for (var s of all()) for (var kv of s.replay.alive) if (!seen.has(kv[0])) { seen.add(kv[0]); yield kv; }
            }
        };
        var replay = {
            alive: alive,
            get start() { return ledger.replay.start; },
            get gaps() { return ledger.replay.gaps; },
            letGo: function (key) {
                var done = true;
                all().forEach(function (s) { if (s.replay.alive.has(key)) done = s.replay.letGo(key) && done; });
                return done;
            }
        };

        /* The transcripts as they are now: a transcript moves with its chat. */
        function place(files) {
            var had = new Map(transcripts.map(function (f) { return [f.file.toLowerCase(), f]; }));
            transcripts = files.map(function (p) { return had.get(p.toLowerCase()) || F.follow(p, T.kind); });
        }

        async function decide() {
            decided = true;
            var files = await T.find(sessionId), began = await T.began(files);
            wide = began < ledger.replay.start - SLACK_MS;
            if (!wide) return;
            scratch = S.source(sessionId);
            place(files);
            unrecorded = began < (await recordingSince(dir)) - SLACK_MS;
        }

        async function readOthers(again) {
            var got = [await scratch.read(again)], moved = false;
            if (again) place(await T.find(sessionId));
            for (var f of transcripts) { var r = await f.read(); moved = moved || r === null; got.push(r); }
            if (moved) {   // gone from where it was: read it where it is now
                place(await T.find(sessionId));
                for (var g of transcripts) got.push(await g.read());
            }
            return got;
        }

        /* again: look for what no line announces (the dialog was opened). */
        async function read(again) {
            var got = [await ledger.read()];
            if (!decided) await decide();
            if (wide) got = got.concat(await readOthers(again));
            if (got.some(function (x) { return x === null; })) return null;
            /* Each read hands back a set of its own: the smaller ones go into the largest
               (a scratchpad's first walk alone names 38,000 files). */
            var touched = got.reduce(function (a, b) { return b.size > a.size ? b : a; });
            got.forEach(function (keys) { if (keys !== touched) keys.forEach(function (k) { touched.add(k); }); });
            return touched;
        }

        return { replay: replay, read: read, unrecorded: function () { return unrecorded; } };
    }

    return { of: of };
})();
