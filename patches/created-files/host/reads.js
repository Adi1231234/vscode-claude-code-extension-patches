/* One read per chat at a time. A call while one runs is folded into one more run
   after it: what each call asked for - files to look at again (paths), how many
   not looked at yet (verify), a look for files no line announces (again), news for
   the panels (extra) - adds up. Two reads at once would read the same lines twice.

   run(id, extra, opts) does one read; it may resolve to what one more run should
   ask for (more files to look at). */
globalThis.__ccCFReads = globalThis.__ccCFReads || function (run) {
    var flights = new Map();

    function fold(f, extra, o) {
        f.rerun = true;
        if (extra) f.extra = Object.assign(f.extra || {}, extra);
        f.verify = Math.max(f.verify, o.verify || 0);
        f.paths = f.paths.concat(o.paths || []);
        f.again = f.again || !!o.again;
    }

    function read(id, extra, opts) {
        var o = opts || {}, f = flights.get(id);
        if (f) { fold(f, extra, o); return; }
        f = { rerun: false, extra: null, verify: 0, paths: [], again: false };
        flights.set(id, f);
        Promise.resolve().then(function () { return run(id, extra, o); }).then(function (more) {
            if (more) fold(f, null, more);
        }, function () {}).then(function () {
            flights.delete(id);
            if (f.rerun) setImmediate(function () { read(id, f.extra, { verify: f.verify, paths: f.paths, again: f.again }); });
        });
    }

    return read;
};
