/* Paths a chat rightly made that are never listed, because deleting them does
   damage: a repository's objects, the worktree link, the chat's own transcript,
   the CLI's settings, Windows' per-user data, a file's hidden side stream. The same
   rule as adi-tools/packages/created-files/internal.mjs; change the two together. */
globalThis.__ccCFInternal = globalThis.__ccCFInternal || (function () {
    var path = require("path");
    var os = require("os");

    function folded(p) { return p.replace(/\//g, "\\").toLowerCase(); }
    var home = folded(os.homedir());
    var claudeHome = folded(path.join(os.homedir(), ".claude")) + "\\";
    var claudeConfig = home + "\\.claude.json";
    var claudeTemp = folded(path.join(os.tmpdir(), "claude")) + "\\";
    var claudeCache = folded(path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "claude-cli-nodejs")) + "\\";

    var windowsData = [process.env.LOCALAPPDATA, process.env.APPDATA].filter(Boolean).map(function (d) {
        return folded(path.join(d, "Microsoft")) + "\\";
    });

    function isInternal(p) {
        if (/[\\/]\.git(?:[\\/]|$)/i.test(p) || /[\\/]\$recycle\.bin[\\/]/i.test(p) || p.indexOf(":", 2) >= 0) return true;
        var f = folded(p);
        if (windowsData.some(function (d) { return f.indexOf(d) === 0; })) return true;
        if (f.indexOf(claudeHome) === 0 || f.indexOf(claudeConfig) === 0 || f.indexOf(claudeCache) === 0) return true;
        return f.indexOf(claudeTemp) === 0 && f.indexOf("\\scratchpad\\") < 0;
    }

    return { isInternal: isInternal };
})();
