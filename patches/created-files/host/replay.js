/* What a chat's ledger says it made, and whether the file on disk is still that
   file. The same rules as adi-tools/packages/created-files/replay.mjs, which the
   bundle cannot import: change the two together. (What is never listed is
   internal.js.)

   Being mentioned is not enough: the kernel also reports a file that was merely
   saved again, so only an event the change journal confirmed counts as creating
   one. Without that a chat that saved ~/.gitconfig "created" it. */
globalThis.__ccCFReplay = globalThis.__ccCFReplay || (function () {
    var SLICE = 2000, CLOCK_SLACK_MS = 2000;

    function parse(line) {
        if (!line.trim()) return null;
        try {
            var e = JSON.parse(line);
            return e && typeof e === "object" ? e : null;
        } catch (x) { return null; }
    }

    var breathe = globalThis.__ccCFBreathe;

    /* A deleted file the chat made is remembered this long, in ledger time, for a
       rewrite that brings it back (the recorder writes one only when the old file
       left moments before); a file found gone is let go of once no line has named
       it for as long. `at` (when a line last named a file) is seconds since 2020,
       a small integer in every record. */
    var FORGET_S = 600, EPOCH_S = 1577836800;
    function seconds(t) { return isFinite(t) ? Math.floor(t / 1000) - EPOCH_S : 0; }
    /* Only what a reader needs of a line: one of these is kept per file a chat made. */
    function record(e, at) {
        return { path: e.path, t: e.t, op: e.op, image: e.image, source: e.source, fid: e.fid, at: at };
    }
    function withFid(base, fid) { return base.fid === fid ? base : Object.assign({}, base, { fid: fid }); }

    /* A ledger replayed one line at a time, so a reader following a growing ledger
       applies only the lines added since it last looked. alive: lower-cased path ->
       the record of the file now there; made: how the chat first made each file,
       kept a while after a delete. The same as adi-tools' replay.mjs. */
    function create() {
        var r = { alive: new Map(), made: new Map(), gaps: 0, start: Infinity };
        var deleted = [], next = 0, latest = 0;

        function forget(now) {
            while (next < deleted.length && now - deleted[next][0] > FORGET_S) {
                var key = deleted[next++][1];
                if (!r.alive.has(key)) r.made.delete(key);
            }
            if (next > 1024 && next * 2 > deleted.length) { deleted = deleted.slice(next); next = 0; }
        }

        /* Returns the lower-cased path the line was about, or null. */
        r.apply = function (line) {
            var e = parse(line);
            if (!e) return null;
            var t = Date.parse(e.t), at = seconds(t);
            if (t < r.start) r.start = t;
            if (at > latest) latest = at;
            forget(at);
            if (e.op === "gap") r.gaps++;
            if (typeof e.path !== "string") return null;
            var key = e.path.toLowerCase();
            if (e.op === "delete") {
                if (r.alive.delete(key) && r.made.has(key)) deleted.push([at, key]);
            } else if (e.op === "new" || (e.op === "rename" && e.verified)) {
                if (!r.made.has(key)) r.made.set(key, record(e, at));
                r.alive.set(key, withFid(r.made.get(key), e.fid));
            } else if (e.op === "rewrite" && r.made.has(key)) {
                var before = r.alive.get(key);
                r.alive.set(key, withFid(r.made.get(key), e.fid || (before && before.fid)));
            }
            [r.alive.get(key), r.made.get(key)].forEach(function (x) { if (x) x.at = at; });
            return key;
        };

        /* Lets go of a path found not to be the chat's file any more, once no line
           has named it for a while (a line not written yet may bring it back). */
        r.letGo = function (key) {
            var x = r.alive.get(key) || r.made.get(key);
            if (x && latest - x.at <= FORGET_S) return false;
            r.alive.delete(key);
            r.made.delete(key);
            return true;
        };
        return r;
    }

    /* Applies lines, letting other work run every few thousand of them (this thread
       is every extension's). Resolves to the paths they were about. */
    async function applyLines(r, lines) {
        var touched = new Set();
        for (var i = 0; i < lines.length; i++) {
            if (i % SLICE === SLICE - 1) await breathe();
            var key = r.apply(lines[i]);
            if (key) touched.add(key);
        }
        return touched;
    }

    /* A file Claude wrote itself (transcript.js) is born again at each of its own
       edits, which replace the file whole: it is still the chat's while it was born
       as the chat wrote it. The transcript line comes after the write, by up to 77 s
       in 6,973 files on disk (2026-11-20). */
    var WRITTEN_BEFORE_MS = 120000;
    function bornWhileWriting(e, born) {
        return e.writes.some(function (w) { return born >= w - WRITTEN_BEFORE_MS && born <= w + CLOCK_SLACK_MS; });
    }

    /* Another file saved at that path later has another identity, and a file older
       than its own creation was overwritten or moved in, not made here. A file in
       the chat's own scratchpad (scratch.js) is the chat's by where it is. */
    function stillTheChats(e, s, start) {
        if (!s.isFile()) return false;
        if (e.op === "scratch") return true;
        if (e.op === "write") return bornWhileWriting(e, Number(s.birthtimeMs));
        if (e.fid && String(s.ino) !== e.fid) return false;
        var madeAt = e.op === "new" ? Date.parse(e.t) : start;
        return !(Number(s.birthtimeMs) < madeAt - CLOCK_SLACK_MS);
    }

    /* A file found by its place has no time until it is looked at: then its birth
       is its time. The same record comes back while the birth stays the same. */
    var dates = new WeakMap();
    function dated(e, s) {
        if (e.t) return e;
        var t = new Date(Number(s.birthtimeMs)).toISOString(), d = dates.get(e);
        if (!d || d.t !== t) dates.set(e, (d = Object.assign({}, e, { t: t })));
        return d;
    }

    return { create: create, applyLines: applyLines, stillTheChats: stillTheChats, dated: dated };
})();
