/* A folder move as a reader takes it: the recorder writes one line with the
   folder's old path (`from`) and its new one (`path`), because every file in it
   took a new path with no event of its own. Without it a renamed folder's files
   stayed known under the old name forever: Claude Code removes a worktree by
   renaming it and then deleting it, so its deletes named paths no reader held,
   and one chat's reader went on looking for 825,000 files that were gone
   (measured 2026-11-24). The same as adi-tools/packages/created-files/moves.mjs,
   which the bundle cannot import: change the two together. */
globalThis.__ccCFMoves = globalThis.__ccCFMoves || (function () {
    /* Moves every record in `held` under the folder `from` to the same place
       under `to`, as last named at `at`; `touched` gets each old and new path.
       Returns the new paths. */
    function moveUnder(held, from, to, at, touched) {
        var prefix = from.toLowerCase() + "\\", moving = [], moved = [];
        held.forEach(function (r, key) { if (key.startsWith(prefix)) moving.push([key, r]); });
        moving.forEach(function (entry) {
            var key = entry[0], r = entry[1];
            var rest = key.slice(prefix.length - 1);   // from the separator on, lower-cased
            /* The file's own spelling of the rest, unless folding changed its length. */
            var path = to + (r.path.length === key.length ? r.path.slice(r.path.length - rest.length) : rest);
            var next = path.toLowerCase();
            held.delete(key);
            held.set(next, Object.assign({}, r, { path: path, at: at }));
            moved.push(next);
            if (touched) { touched.add(key); touched.add(next); }
        });
        return moved;
    }

    return { moveUnder: moveUnder };
})();
