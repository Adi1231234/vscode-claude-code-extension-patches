/* The file system without Electron's archive support. The extension host is an
   Electron process, whose fs takes any path ending in .asar for an archive: it
   opens the file, keeps it open, and reports it as a folder. In Adi Tools that hid
   a chat's freshly built app.asar from the list and held it so that it could
   neither be deleted nor rebuilt (measured 2026-11-19). Electron's "original-fs"
   is the plain one; outside Electron (the tests) it does not exist. */
globalThis.__ccCFFs = globalThis.__ccCFFs || (function () {
    try { return require("original-fs"); }
    catch (e) { return require("fs"); }
})();
