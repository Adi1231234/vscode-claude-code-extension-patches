/* Drops the created files that belong to a repository: what git tracks is real
   work and "Delete all" must never reach it, and a bare repository's files are its
   database. The same rule as adi-tools/packages/created-files/tracked.mjs, which
   the bundle cannot import. What git tracks is kept per repository until its index
   changes; when git cannot answer, nothing from that repository is offered. */
globalThis.__ccCFTracked = globalThis.__ccCFTracked || (function () {
    var fsp = require("fs").promises;
    var path = require("path");
    var execFile = require("child_process").execFile;
    var MAX_LISTINGS = 16;
    var listings = new Map();

    /* Windows ignores case in a path and git does not. */
    function norm(p) { return p.replace(/\\/g, "/").toLowerCase(); }
    function statOf(p) { return fsp.stat(p).catch(function () { return null; }); }

    /* What git itself accepts: a stray empty .git folder is not a repository, and
       taking it for one hid every file below it (a C:\.git hid the whole drive). */
    async function kindOf(dir) {
        var git = await statOf(path.join(dir, ".git"));
        if (git && git.isFile()) return "repository";   // a worktree's link file
        if (git && (await statOf(path.join(dir, ".git", "HEAD"))) && (await statOf(path.join(dir, ".git", "objects")))) return "repository";
        var parts = await Promise.all(["HEAD", "objects", "refs"].map(function (n) { return statOf(path.join(dir, n)); }));
        return parts.every(Boolean) ? "bare" : null;
    }

    function ownerOf(dir, known) {
        if (known.has(dir)) return known.get(dir);
        var found = kindOf(dir).then(function (kind) {
            if (kind) return { root: dir, kind: kind };
            var up = path.dirname(dir);
            return up === dir ? null : ownerOf(up, known);
        });
        known.set(dir, found);
        return found;
    }

    async function indexStamp(root) {
        var gitDir = path.join(root, ".git");
        if ((await fsp.stat(gitDir)).isFile()) {
            gitDir = path.resolve(root, /^gitdir:\s*(.+)$/m.exec(await fsp.readFile(gitDir, "utf8"))[1].trim());
        }
        var index = await statOf(path.join(gitDir, "index"));
        return index ? index.size + ":" + index.mtimeMs : "empty";
    }

    function lsFiles(root) {
        return new Promise(function (resolve, reject) {
            execFile("git", ["-C", root, "ls-files", "-z"], { maxBuffer: 1 << 28, windowsHide: true }, function (err, stdout) {
                if (err) reject(err); else resolve(stdout);
            });
        });
    }

    async function trackedIn(root) {
        try {
            var stamp = await indexStamp(root);
            var known = listings.get(root);
            if (known && known.stamp === stamp) return known.paths;
            var rels = (await lsFiles(root)).split("\0").filter(Boolean);
            var paths = new Set(rels.map(function (rel) { return norm(path.join(root, rel)); }));
            if (listings.size >= MAX_LISTINGS) listings.clear();
            listings.set(root, { stamp: stamp, paths: paths });
            return paths;
        } catch (e) { return null; }
    }

    /* The paths outside any repository, and those git does not track. */
    async function drop(paths) {
        var known = new Map(), byRepo = new Map(), kept = [];
        var owners = await Promise.all(paths.map(function (p) { return ownerOf(path.dirname(p), known); }));
        paths.forEach(function (p, i) {
            var owner = owners[i];
            if (!owner) { kept.push(p); return; }
            if (owner.kind !== "repository") return;
            if (!byRepo.has(owner.root)) byRepo.set(owner.root, []);
            byRepo.get(owner.root).push(p);
        });
        for (var entry of byRepo) {
            var tracked = await trackedIn(entry[0]);
            if (tracked) entry[1].forEach(function (p) { if (!tracked.has(norm(p))) kept.push(p); });
        }
        return kept;
    }

    return { drop: drop };
})();
