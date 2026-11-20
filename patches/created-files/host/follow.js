/* A ledger followed as it grows. The recorder only appends, so a reader that
   remembers how far it read takes in only the new lines: a chat that installs
   packages writes 20 MB of ledger, and reading all of it on every change kept the
   host busy (measured in Adi Tools, 2026-11-19). The same as adi-tools'
   packages/created-files/follow.mjs; change the two together.

   read() resolves to the lower-cased paths the new lines were about, or to null
   when the reading started over (a ledger replaced, cut short or removed, or
   rewritten in place: the bytes just before where it stopped are checked).

   A chat's transcript is followed the same way (transcript.js): `kind` says how
   whole lines become records - create() a fresh replay, take(replay, buffer)
   resolves to the paths those lines were about. A ledger by default. */
globalThis.__ccCFFollow = globalThis.__ccCFFollow || (function () {
    var fsp = globalThis.__ccCFFs.promises;
    var R = globalThis.__ccCFReplay;
    var CHUNK = 1 << 20, TAIL = 64, NEWLINE = 0x0a;
    var LEDGER = {
        create: R.create,
        take: function (replay, buf) { return R.applyLines(replay, buf.toString("utf8").split("\n")); }
    };

    function follow(file, kind) {
        var how = kind || LEDGER, me = { replay: how.create(), file: file };
        var offset = 0, rest = Buffer.alloc(0), tail = Buffer.alloc(0), identity = null;

        function restart(id) {
            me.replay = how.create();
            offset = 0; rest = Buffer.alloc(0); tail = Buffer.alloc(0); identity = id;
        }

        async function sameStart(handle) {
            if (!tail.length) return true;
            var buf = Buffer.alloc(tail.length);
            var got = await handle.read(buf, 0, buf.length, offset - tail.length);
            return got.bytesRead === tail.length && buf.equals(tail);
        }

        async function take(handle, size) {
            var touched = new Set();
            while (offset < size) {
                /* The unfinished line leads the next read, which is at least as long as
                   it: a transcript line holds a whole written file, and a 20 MB one is
                   then copied a few times, not once per chunk. */
                var want = Math.min(Math.max(CHUNK, rest.length), size - offset);
                var buf = Buffer.allocUnsafe(rest.length + want);
                rest.copy(buf, 0);
                var got = await handle.read(buf, rest.length, want, offset);
                if (!got.bytesRead) break;
                offset += got.bytesRead;
                var data = buf.subarray(0, rest.length + got.bytesRead);
                var end = data.lastIndexOf(NEWLINE) + 1;   // whole lines only: a letter never splits
                rest = Buffer.from(data.subarray(end));   // a copy: a view would hold the whole read
                if (!end) continue;
                var keys = await how.take(me.replay, data.subarray(0, end));
                keys.forEach(function (k) { touched.add(k); });
            }
            var from = Math.max(0, offset - TAIL);
            tail = Buffer.alloc(offset - from);
            if (tail.length) await handle.read(tail, 0, tail.length, from);
            return touched;
        }

        me.read = async function () {
            var s = await fsp.stat(file, { bigint: true }).catch(function () { return null; });
            var id = s ? s.ino + ":" + s.birthtimeNs : null, size = s ? Number(s.size) : 0;
            var handle = s ? await fsp.open(file, "r").catch(function () { return null; }) : null;
            try {
                var fresh = false;
                if (id !== identity || size < offset || (handle && !(await sameStart(handle)))) {
                    fresh = offset > 0 || me.replay.alive.size > 0;
                    restart(id);
                }
                var touched = handle && size > offset ? await take(handle, size) : new Set();
                return fresh ? null : touched;
            } finally {
                if (handle) await handle.close();
            }
        };
        return me;
    }

    return { follow: follow };
})();
