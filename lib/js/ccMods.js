/* Shared host runtime: the folder the patches' Claude Code mods are copied to,
   beside extension.js, handed to every chat CLI as one --plugin-dir. The CLI
   loads each child of it that has a manifest (lib/Mods.ps1). Read at every
   spawn, so a folder that is not there (no patch with a mod) adds nothing. */
globalThis.__ccMods = globalThis.__ccMods || (function () {
    var fs = require("fs");
    var path = require("path");
    var dir = path.join(__dirname, "__MODSDIR__");
    return {
        args: function () { return fs.existsSync(dir) ? { "plugin-dir": dir } : {}; }
    };
})();
