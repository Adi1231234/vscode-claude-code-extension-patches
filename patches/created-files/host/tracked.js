/* Drops the created files git already tracks: those are real work, not leftovers,
   and "Delete all" must never reach them. The same rule as the Adi Tools package
   (adi-tools/packages/created-files/tracked.mjs), which the bundle cannot import.

   It asks git only about the candidate paths, in batches: Windows refuses a
   command line past 32,767 characters, and a refused question must not read as
   "untracked". A path git could not answer about counts as tracked. */
globalThis.__ccCFTracked = globalThis.__ccCFTracked || (function () {
    var fs = require("fs");
    var path = require("path");
    var execFile = require("child_process").execFile;

    var MAX_ARGS_CHARS = 20000;

    function norm(p) { return p.replace(/\\/g, "/").toLowerCase(); }

    /* What git itself accepts: a stray empty .git folder is not a repository, and
       taking it for one hid every file below it (a C:\.git hid the whole drive). */
    function isRepo(dir) {
        var git = path.join(dir, ".git");
        try {
            if (fs.statSync(git).isFile()) return true;   // a worktree's link file
            return fs.existsSync(path.join(git, "HEAD")) && fs.existsSync(path.join(git, "objects"));
        } catch (e) { return false; }
    }

    function repoRootOf(dir, known) {
        if (known.has(dir)) return known.get(dir);
        var up = path.dirname(dir);
        var root = isRepo(dir) ? dir : up === dir ? null : repoRootOf(up, known);
        known.set(dir, root);
        return root;
    }

    function batches(items) {
        var out = [], batch = [], chars = 0;
        items.forEach(function (item) {
            if (batch.length && chars + item.length + 3 > MAX_ARGS_CHARS) { out.push(batch); batch = []; chars = 0; }
            batch.push(item);
            chars += item.length + 3;
        });
        if (batch.length) out.push(batch);
        return out;
    }

    function lsFiles(root, rels) {
        var args = ["-C", root, "--literal-pathspecs", "ls-files", "-z", "--"].concat(rels);
        return new Promise(function (resolve, reject) {
            execFile("git", args, { maxBuffer: 1 << 24, windowsHide: true }, function (err, stdout) {
                if (err) reject(err); else resolve(stdout);
            });
        });
    }

    async function trackedIn(root, group) {
        var tracked = new Set();
        var rels = group.map(function (p) { return path.relative(root, p); });
        for (var batch of batches(rels)) {
            try {
                (await lsFiles(root, batch)).split("\0").forEach(function (rel) {
                    if (rel) tracked.add(norm(path.join(root, rel)));
                });
            } catch (e) {
                batch.forEach(function (rel) { tracked.add(norm(path.join(root, rel))); });
            }
        }
        return tracked;
    }

    /* The paths git does not track; anything outside a repository is kept. */
    async function drop(paths) {
        var roots = new Map(), byRepo = new Map(), kept = [];
        paths.forEach(function (p) {
            var root = repoRootOf(path.dirname(p), roots);
            if (!root) { kept.push(p); return; }
            if (!byRepo.has(root)) byRepo.set(root, []);
            byRepo.get(root).push(p);
        });
        for (var entry of byRepo) {
            var tracked = await trackedIn(entry[0], entry[1]);
            entry[1].forEach(function (p) { if (!tracked.has(norm(p))) kept.push(p); });
        }
        return kept;
    }

    return { drop: drop };
})();
