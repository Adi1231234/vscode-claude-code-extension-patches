/* What a chat's ledger says it made, and whether the file on disk is still that
   file. The same rules as adi-tools/packages/created-files (replay.mjs and
   internal.mjs), which the bundle cannot import: change the two together.

   Being mentioned is not enough: the kernel also reports a file that was merely
   saved again, so only an event the change journal confirmed counts as creating
   one. Without that a chat that saved ~/.gitconfig "created" it. */
globalThis.__ccCFReplay = globalThis.__ccCFReplay || (function () {
    var path = require("path");
    var os = require("os");
    var SLICE = 2000, CLOCK_SLACK_MS = 2000;

    function folded(p) { return p.replace(/\//g, "\\").toLowerCase(); }
    var home = folded(os.homedir());
    var claudeHome = folded(path.join(os.homedir(), ".claude")) + "\\";
    var claudeConfig = home + "\\.claude.json";
    var claudeTemp = folded(path.join(os.tmpdir(), "claude")) + "\\";
    var claudeCache = folded(path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "claude-cli-nodejs")) + "\\";

    var windowsData = [process.env.LOCALAPPDATA, process.env.APPDATA].filter(Boolean).map(function (d) {
        return folded(path.join(d, "Microsoft")) + "\\";
    });

    /* Deleting these does damage: a repository's objects, the worktree link, the
       chat's own transcript, the CLI's settings, Windows' per-user data, a file's
       hidden side stream. */
    function isInternal(p) {
        if (/[\\/]\.git(?:[\\/]|$)/i.test(p) || /[\\/]\$recycle\.bin[\\/]/i.test(p) || p.indexOf(":", 2) >= 0) return true;
        var f = folded(p);
        if (windowsData.some(function (d) { return f.indexOf(d) === 0; })) return true;
        if (f.indexOf(claudeHome) === 0 || f.indexOf(claudeConfig) === 0 || f.indexOf(claudeCache) === 0) return true;
        return f.indexOf(claudeTemp) === 0 && f.indexOf("\\scratchpad\\") < 0;
    }

    function parse(line) {
        if (!line.trim()) return null;
        try {
            var e = JSON.parse(line);
            return e && typeof e === "object" ? e : null;
        } catch (x) { return null; }
    }

    function breathe() { return new Promise(function (resolve) { setImmediate(resolve); }); }

    /* A ledger replayed one line at a time, so a reader following a growing ledger
       applies only the lines added since it last looked. alive: lower-cased path ->
       the event that made the file now there; made: the same, kept after a delete. */
    function create() {
        var r = { alive: new Map(), made: new Map(), gaps: 0, start: Infinity };
        /* Returns the lower-cased path the line was about, or null. */
        r.apply = function (line) {
            var e = parse(line);
            if (!e) return null;
            var t = Date.parse(e.t);
            if (t < r.start) r.start = t;
            if (e.op === "gap") r.gaps++;
            if (typeof e.path !== "string") return null;
            var key = e.path.toLowerCase();
            if (e.op === "delete") r.alive.delete(key);
            else if (e.op === "new" || (e.op === "rename" && e.verified)) {
                if (!r.made.has(key)) r.made.set(key, e);
                r.alive.set(key, Object.assign({}, r.made.get(key), { fid: e.fid }));
            } else if (e.op === "rewrite" && r.made.has(key)) {
                var before = r.alive.get(key);
                r.alive.set(key, Object.assign({}, r.made.get(key), { fid: e.fid || (before && before.fid) }));
            }
            return key;
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

    /* Another file saved at that path later has another identity, and a file older
       than its own creation was overwritten or moved in, not made here. */
    function stillTheChats(e, s, start) {
        if (!s.isFile()) return false;
        if (e.fid && String(s.ino) !== e.fid) return false;
        var madeAt = e.op === "new" ? Date.parse(e.t) : start;
        return !(Number(s.birthtimeMs) < madeAt - CLOCK_SLACK_MS);
    }

    return { isInternal: isInternal, create: create, applyLines: applyLines, stillTheChats: stillTheChats };
})();
