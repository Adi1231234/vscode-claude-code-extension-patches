/* Drops the created files that belong to a repository: what git tracks is real
   work and "Delete all" must never reach it, and a bare repository's files are its
   database. The same rule as adi-tools/packages/created-files/tracked.mjs, which
   the bundle cannot import. What git tracks is kept per repository until its index
   changes; when git cannot answer, nothing from that repository is offered. */
globalThis.__ccCFTracked = globalThis.__ccCFTracked || (function () {
    var fsp = globalThis.__ccCFFs.promises;   // the folders walked are any a chat wrote in, a *.asar one included
    var path = require("path");
    var MAX_LISTINGS = 16, MAX_FOLDERS = 100000;
    var listings = new Map();
    /* Which repository each folder is in, kept between calls: asked afresh every
       time it cost about a second for a chat's 60,000 files (measured). */
    var owners = new Map();
    var moved = 0;

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

    function lsFiles(root) { return globalThis.__ccCFGit.run(["-C", root, "ls-files", "-z"]); }

    var breathe = globalThis.__ccCFBreathe;

    /* git names a file by its path below the root with "/" between parts and no "."
       or ".." in it, so the root's own form plus the lower-cased name is the same key
       norm(path.join(root, rel)) gives. A repository cloned into a chat's scratchpad
       holds 100,000 files and more: built in one go, the keys held the thread every
       extension shares for 400 ms (measured 2026-11-20), so other work runs between
       slices of them (2,000 take about 16 ms). */
    var KEYS_PER_SLICE = 2000;
    async function keysOf(root, rels) {
        var prefix = norm(path.join(root, "x")).slice(0, -1), paths = new Set();
        for (var i = 0; i < rels.length; i++) {
            if (rels[i]) paths.add(prefix + rels[i].toLowerCase());
            if (i % KEYS_PER_SLICE === KEYS_PER_SLICE - 1) await breathe();
        }
        return paths;
    }

    async function trackedIn(root) {
        try {
            var stamp = await indexStamp(root);
            var known = listings.get(root);
            if (known && known.stamp === stamp) return known.paths;
            if (known) moved++;
            var paths = await keysOf(root, (await lsFiles(root)).split("\0"));
            if (listings.size >= MAX_LISTINGS) listings.clear();
            listings.set(root, { stamp: stamp, paths: paths });
            return paths;
        } catch (e) { return null; }
    }

    /* The paths outside any repository, and those git does not track. */
    async function drop(paths) {
        if (owners.size > MAX_FOLDERS) owners.clear();
        var byRepo = new Map(), kept = [];
        var found = await Promise.all(paths.map(function (p) { return ownerOf(path.dirname(p), owners); }));
        paths.forEach(function (p, i) {
            var owner = found[i];
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

    /* Moves whenever what git tracks may have changed: a repository's index changed
       since it was read (a commit, an add). A caller that keeps filtered paths
       filters them all again when it moves, and otherwise only its new ones. */
    async function version() {
        await Promise.all(Array.from(listings).map(async function (kv) {
            if ((await indexStamp(kv[0]).catch(function () { return null; })) === kv[1].stamp) return;
            listings.delete(kv[0]);
            moved++;
        }));
        return moved;
    }

    /* Look again at which folders are repositories (one may have been made since):
       only the paths filtered from now on see it. */
    function forget() { owners.clear(); }

    return { drop: drop, version: version, forget: forget };
})();
