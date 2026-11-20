/* Runs git off the thread every extension shares. Starting a process is one
   blocking call on Windows: it searches the PATH for git (45 entries here) and
   then waits while the system looks at the new process. Idle that took 19-75 ms;
   while or just after files were being looked at it took up to 835 ms (measured
   2026-11-20), and the whole host stood still for it. So git is started from a
   worker thread of its own, made on first use and let go once idle. Where a
   worker cannot be made or dies, git runs here, as it always did. */
globalThis.__ccCFGit = globalThis.__ccCFGit || (function () {
    var execFile = require("child_process").execFile;
    var OPTIONS = { maxBuffer: 1 << 28, windowsHide: true }, IDLE_MS = 60000;
    var worker = null, broken = false, waiting = new Map(), next = 0, idle = null;

    /* The worker's own code, handed to it as its source. */
    function workerMain() {
        var port = require("worker_threads").parentPort;
        var run = require("child_process").execFile;
        port.on("message", function (m) {
            run(m.file, m.args, m.options, function (err, stdout) {
                port.postMessage({ id: m.id, error: err ? String(err.message || err) : null, stdout: err ? "" : stdout });
            });
        });
    }

    function here(args) {
        return new Promise(function (resolve, reject) {
            execFile("git", args, OPTIONS, function (err, stdout) { if (err) reject(err); else resolve(stdout); });
        });
    }

    function stop() {
        idle = null;
        if (worker && !waiting.size) { var w = worker; worker = null; w.terminate(); }
    }

    function settle(m) {
        var w = waiting.get(m.id);
        if (!w) return;
        waiting.delete(m.id);
        if (m.error) w.reject(new Error(m.error)); else w.resolve(m.stdout);
        if (!waiting.size && !idle) { idle = setTimeout(stop, IDLE_MS); idle.unref(); }
    }

    /* The worker is gone without answering: what it was asked runs here instead. */
    function lost(w) {
        if (worker !== w) return;
        worker = null;
        broken = true;
        waiting.forEach(function (x) { here(x.args).then(x.resolve, x.reject); });
        waiting.clear();
    }

    function start() {
        var W = require("worker_threads").Worker;
        var w = new W("(" + workerMain.toString() + ")()", { eval: true });
        w.on("message", settle);
        w.on("error", function () { lost(w); });
        w.on("exit", function () { lost(w); });
        w.unref();
        return w;
    }

    /* git's output for these arguments, or a rejection when it fails. */
    function run(args) {
        if (!broken && !worker) { try { worker = start(); } catch (e) { broken = true; } }
        if (broken) return here(args);
        if (idle) { clearTimeout(idle); idle = null; }
        var id = ++next;
        return new Promise(function (resolve, reject) {
            waiting.set(id, { args: args, resolve: resolve, reject: reject });
            worker.postMessage({ id: id, file: "git", args: args, options: OPTIONS });
        });
    }

    return { run: run };
})();
