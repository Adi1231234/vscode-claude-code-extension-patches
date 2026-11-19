/* A watch on one folder, made to survive the folder being removed.

   The folder is made here, so the watch can attach before the recorder's first
   run. When it is removed Windows raises no error: the watch reports its own full
   path, thousands of times a second, until it is closed. The folder stays
   half-deleted until then, so the new watch has to wait a moment. */
globalThis.__ccCFWatch = globalThis.__ccCFWatch || (function () {
    var fs = require("fs");
    var REARM_MS = 400, REARM_TRIES = 5;

    /* onName(name) for each change in the folder; onBack() once a removed folder
       is being watched again. */
    function folder(dir, onName, onBack) {
        var watcher = null, rearming = null;

        function close() {
            if (watcher) { try { watcher.close(); } catch (e) {} }
            watcher = null;
        }

        function arm() {
            try {
                fs.mkdirSync(dir, { recursive: true });
                watcher = fs.watch(dir, function (_evt, name) {
                    if (name && name.indexOf("\\\\?\\") === 0) rearm(REARM_TRIES);
                    else if (name) onName(name);
                });
                watcher.on("error", function () { rearm(REARM_TRIES); });
            } catch (e) { close(); }
        }

        function rearm(tries) {
            close();
            if (rearming) return;
            rearming = setTimeout(function () {
                rearming = null;
                arm();
                if (watcher) onBack();
                else if (tries > 1) rearm(tries - 1);
            }, REARM_MS);
        }

        return {
            ensure: function () { if (!watcher && !rearming) arm(); },
            stop: function () {
                if (rearming) clearTimeout(rearming);
                rearming = null;
                close();
            }
        };
    }

    return { folder: folder };
})();
