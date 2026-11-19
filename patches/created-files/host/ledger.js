/* Reading the created-files recorder's per-chat ledgers, host side.

   The recorder (adi-tools, resources/createdFiles) writes one append-only
   <sessionId>.jsonl per chat under %LOCALAPPDATA%\claude-code-patches\
   created-files, plus a status.json. This is the same contract the Adi Tools
   package packages/created-files/ledger.mjs reads; it is re-implemented here
   because the extension bundle cannot import that package, and it is the only
   copy on this side.

   Replay: "new"/"rename" mean the file appeared (rename's path is the final
   name), "delete" removes it, "gap" warns the window was not watched. Then keep
   only paths that still exist on disk - that is what the panel shows. */
globalThis.__ccCFLedger = globalThis.__ccCFLedger || (function () {
    var fs = require("fs");
    var path = require("path");
    var os = require("os");

    var DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "claude-code-patches", "created-files");

    function ledgerPath(sessionId) { return path.join(DIR, sessionId + ".jsonl"); }

    function read(sessionId) {
        var alive = new Map(), gaps = [];
        var text;
        try { text = fs.readFileSync(ledgerPath(sessionId), "utf8"); }
        catch (e) { return { files: [], gaps: gaps }; }
        text.split("\n").forEach(function (line) {
            if (!line) return;
            var e;
            try { e = JSON.parse(line); } catch (x) { return; }
            if (e.op === "gap") gaps.push(e);
            else if (e.op === "delete") alive.delete(e.path);
            else alive.set(e.path, e);
        });
        var files = [];
        alive.forEach(function (e) {
            if (!exists(e.path)) return;
            files.push({ path: e.path, name: path.basename(e.path), t: e.t, image: e.image || "", source: e.source || "" });
        });
        files.sort(function (a, b) { return (b.t || "").localeCompare(a.t || ""); });
        return { files: files, gaps: gaps };
    }

    function exists(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }

    function status() {
        try { return JSON.parse(fs.readFileSync(path.join(DIR, "status.json"), "utf8")); }
        catch (e) { return null; }
    }

    return { DIR: DIR, read: read, status: status };
})();
