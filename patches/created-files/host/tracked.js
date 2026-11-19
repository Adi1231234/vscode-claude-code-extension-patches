/* Drops the created files git already tracks: those are real work, not leftovers,
   and "Delete all" must never reach them. The same rule as the Adi Tools package
   (adi-tools/packages/created-files/tracked.mjs), which the bundle cannot import.

   It asks git once per repository, about the candidate paths when they fit on a
   command line: Windows refuses one past 32,767 characters, so beyond that git
   lists the whole repository. A path git could not answer about counts as tracked. */
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

    function lsFiles(root, rels) {
        var chars = rels.reduce(function (n, rel) { return n + rel.length + 3; }, 0);
        var args = ["-C", root, "--literal-pathspecs", "ls-files", "-z"];
        if (chars <= MAX_ARGS_CHARS) args = args.concat(["--"], rels);
        return new Promise(function (resolve, reject) {
            execFile("git", args, { maxBuffer: 1 << 28, windowsHide: true }, function (err, stdout) {
                if (err) reject(err); else resolve(stdout);
            });
        });
    }

    async function trackedIn(root, group) {
        var rels = group.map(function (p) { return path.relative(root, p); });
        try {
            var listed = (await lsFiles(root, rels)).split("\0").filter(Boolean);
            return new Set(listed.map(function (rel) { return norm(path.join(root, rel)); }));
        } catch (e) {
            return new Set(group.map(norm));
        }
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
