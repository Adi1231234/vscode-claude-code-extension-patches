/* Reading the created-files recorder's per-chat ledgers, host side.

   The recorder (adi-tools, resources/createdFiles) writes one append-only
   <sessionId>.jsonl per chat under %LOCALAPPDATA%\claude-code-patches\
   created-files, plus a status.json. What is listed is narrow on purpose (see
   replay.js): regular files the chat really made, still the same file on disk,
   not git's or the CLI's own, and not tracked by git. A chat a panel shows is
   followed (files.js), so a change costs only its new lines. Every step that
   touches the disk is async: this runs on the thread every other extension shares. */
globalThis.__ccCFLedger = globalThis.__ccCFLedger || (function () {
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var crypto = require("crypto");
    var Files = globalThis.__ccCFFiles;
    var Sources = globalThis.__ccCFSources;

    var DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "claude-code-patches", "created-files");
    var chats = new Map(), named = new WeakMap();

    /* Names exactly this list, so a confirmation can be tied to what it showed. Made
       once per list: a chat's list is a new array only when it changes. */
    function listId(files) {
        var id = named.get(files);
        if (!id) {
            var all = files.map(function (f) { return f.path; }).join("\n");
            named.set(files, (id = crypto.createHash("sha1").update(all).digest("hex").slice(0, 16)));
        }
        return id;
    }

    function chatOf(id) {
        var c = chats.get(id);
        if (!c) chats.set(id, (c = Files.chat(Sources.of(id, path.join(DIR, id + ".jsonl"), DIR))));
        return c;
    }

    /* opts.verify: how many files the ledger names but nobody looked at yet to look
       at now (newest first); opts.paths: files to look at again, or "all" for every
       listed one (before acting on all of them); opts.again: look for files no line
       announces, in the chat's scratchpad (the dialog was opened). */
    async function read(sessionId, opts) {
        var c = chatOf(sessionId), o = opts || {};
        var again = o.paths === "all" ? c.files().map(function (e) { return e.path; }) : o.paths;
        await c.refresh({ paths: again || [], verify: o.verify || 0, again: !!o.again });
        var files = c.files();
        return { files: files, list: listId(files), incomplete: c.gaps() > 0, unrecorded: c.unrecorded(), checking: c.pending() };
    }

    /* No panel shows this chat any more: what was kept about it goes. */
    function forget(sessionId) { chats.delete(sessionId); }

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

    return { DIR: DIR, read: read, forget: forget, recording: recording };
})();
