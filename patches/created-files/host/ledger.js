/* Reading the created-files recorder's per-chat ledgers, host side.

   The recorder (adi-tools, resources/createdFiles) writes one append-only
   <sessionId>.jsonl per chat under %LOCALAPPDATA%\claude-code-patches\
   created-files, plus a status.json. This is the same contract the Adi Tools
   package packages/created-files reads; it is re-implemented here because the
   extension bundle cannot import that package. Change the two together.

   Replay: "new"/"rename" mean the file appeared (rename's path is the final
   name), "delete" removes it, "gap" warns the window was not watched. A ledger
   holds more than leftovers, so what is listed is narrower: regular files still
   on disk, not git's or the CLI's own, not tracked by git. Every step is async:
   this runs on the extension host, the thread every other extension shares. */
globalThis.__ccCFLedger = globalThis.__ccCFLedger || (function () {
    var fs = require("fs");
    var path = require("path");
    var os = require("os");

    var DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "claude-code-patches", "created-files");
    var STAT_BATCH = 64;

    function folded(p) { return p.replace(/\//g, "\\").toLowerCase(); }
    var claudeHome = folded(path.join(os.homedir(), ".claude")) + "\\";
    var claudeTemp = folded(path.join(os.tmpdir(), "claude")) + "\\";

    /* Deleting these does damage: a repository's objects, the worktree link, the
       chat's own transcript, its live task logs. A chat's scratchpad is its work. */
    function isInternal(p) {
        if (/[\\/]\.git(?:[\\/]|$)/i.test(p)) return true;
        var f = folded(p);
        if (f.indexOf(claudeHome) === 0) return true;
        return f.indexOf(claudeTemp) === 0 && f.indexOf("\\scratchpad\\") < 0;
    }

    function parse(line) {
        try {
            var e = JSON.parse(line);
            return e && typeof e === "object" ? e : null;
        } catch (x) { return null; }
    }

    function replay(text) {
        var alive = new Map(), gaps = 0;   // lower-cased path (Windows ignores case) -> event
        text.split("\n").forEach(function (line) {
            var e = line.trim() ? parse(line) : null;
            if (!e) return;
            if (e.op === "gap") gaps++;
            else if (typeof e.path !== "string") return;
            else if (e.op === "delete") alive.delete(e.path.toLowerCase());
            else alive.set(e.path.toLowerCase(), e);
        });
        return { alive: alive, gaps: gaps };
    }

    function isFile(e) {
        return fs.promises.stat(e.path).then(function (s) { return s.isFile(); }, function () { return false; });
    }

    async function onDisk(events) {
        var kept = [];
        for (var i = 0; i < events.length; i += STAT_BATCH) {
            var batch = events.slice(i, i + STAT_BATCH);
            var flags = await Promise.all(batch.map(isFile));
            batch.forEach(function (e, j) { if (flags[j]) kept.push(e); });
        }
        return kept;
    }

    function newestFirst(a, b) { return a.t === b.t ? 0 : a.t < b.t ? 1 : -1; }

    async function read(sessionId) {
        var text;
        try { text = await fs.promises.readFile(path.join(DIR, sessionId + ".jsonl"), "utf8"); }
        catch (e) { return { files: [], incomplete: false }; }
        var r = replay(text);
        var events = await onDisk(Array.from(r.alive.values()).filter(function (e) { return !isInternal(e.path); }));
        var kept = new Set(await globalThis.__ccCFTracked.drop(events.map(function (e) { return e.path; })));
        var files = events.filter(function (e) { return kept.has(e.path); }).map(function (e) {
            return { path: e.path, name: path.basename(e.path), t: e.t || "" };
        });
        return { files: files.sort(newestFirst), incomplete: r.gaps > 0 };
    }

    /* Refused for an elevated process, and being refused means it exists. */
    function alive(pid) {
        if (!pid) return false;
        try { process.kill(pid, 0); return true; }
        catch (e) { return e.code === "EPERM"; }
    }

    /* A recorder that crashed leaves running:true behind. */
    function recording() {
        try {
            var s = JSON.parse(fs.readFileSync(path.join(DIR, "status.json"), "utf8"));
            return !!s.running && alive(s.pid);
        } catch (e) { return false; }
    }

    return { DIR: DIR, read: read, recording: recording };
})();
