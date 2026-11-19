/* Reading the created-files recorder's per-chat ledgers, host side.

   The recorder (adi-tools, resources/createdFiles) writes one append-only
   <sessionId>.jsonl per chat under %LOCALAPPDATA%\claude-code-patches\
   created-files, plus a status.json. What is listed is narrow on purpose (see
   replay.js): regular files the chat really made, still the same file on disk,
   not git's or the CLI's own, and not tracked by git. Every step that touches the
   disk is async: this runs on the thread every other extension shares. */
globalThis.__ccCFLedger = globalThis.__ccCFLedger || (function () {
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var crypto = require("crypto");
    var R = globalThis.__ccCFReplay;

    var DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "claude-code-patches", "created-files");
    var STAT_BATCH = 64;

    function statOf(e) {
        return fs.promises.stat(e.path, { bigint: true }).catch(function () { return null; });
    }

    async function onDisk(events, start) {
        var kept = [];
        for (var i = 0; i < events.length; i += STAT_BATCH) {
            var batch = events.slice(i, i + STAT_BATCH);
            var stats = await Promise.all(batch.map(statOf));
            batch.forEach(function (e, j) { if (stats[j] && R.stillTheChats(e, stats[j], start)) kept.push(e); });
        }
        return kept;
    }

    function newestFirst(a, b) { return a.t === b.t ? 0 : a.t < b.t ? 1 : -1; }

    /* Names exactly this list, so a confirmation can be tied to what it showed. */
    function listId(files) {
        var all = files.map(function (f) { return f.path; }).join("\n");
        return crypto.createHash("sha1").update(all).digest("hex").slice(0, 16);
    }

    async function read(sessionId) {
        var text;
        try { text = await fs.promises.readFile(path.join(DIR, sessionId + ".jsonl"), "utf8"); }
        catch (e) { return { files: [], incomplete: false, list: listId([]) }; }
        var r = await R.replay(text);
        var candidates = r.alive.filter(function (e) { return !R.isInternal(e.path); });
        var events = await onDisk(candidates, r.start);
        var kept = new Set(await globalThis.__ccCFTracked.drop(events.map(function (e) { return e.path; })));
        var files = events.filter(function (e) { return kept.has(e.path); }).map(function (e) {
            return { path: e.path, name: path.basename(e.path), t: e.t || "" };
        }).sort(newestFirst);
        return { files: files, incomplete: r.gaps > 0, list: listId(files) };
    }

    /* Refused for an elevated process, and being refused means it exists. */
    function alive(pid) {
        if (!pid) return false;
        try { process.kill(pid, 0); return true; }
        catch (e) { return e.code === "EPERM"; }
    }

    /* A crash or a reboot leaves running:true behind, and after a reboot its process
       id may belong to another program. */
    function recording() {
        try {
            var s = JSON.parse(fs.readFileSync(path.join(DIR, "status.json"), "utf8"));
            if (Date.parse(s.startedAt) < Date.now() - os.uptime() * 1000 - 5000) return false;
            return !!s.running && alive(s.pid);
        } catch (e) { return false; }
    }

    return { DIR: DIR, read: read, recording: recording };
})();
