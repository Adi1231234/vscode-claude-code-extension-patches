/* The repositories a chat's git made since a follower last looked (replay.js `repos`,
   from the recorder's `repo` lines): its filter forgets what it knew of those
   folders, so the files there are filtered again. Without it a `git init` and a
   commit over files already listed changed nothing the filter watches, and they
   stayed listed for as long as the window ran. The same as adi-tools'
   packages/created-files/newRepos.mjs; change the two together. */
globalThis.__ccCFNewRepos = globalThis.__ccCFNewRepos || (function () {
    /* A follower's own count: since(repos) gives the folders of the `repo` lines not
       handed out yet, and all of them again when the ledger was read anew (a new list). */
    function seen() {
        var list = null, handed = 0;
        return function since(repos) {
            var now = repos || [];
            if (now !== list) { list = now; handed = 0; }
            var out = now.slice(handed);
            handed = now.length;
            return out;
        };
    }

    return { seen: seen };
})();
