/* Stop and start, both through the store's own methods - nothing here talks to
   the host or to the process.

   Stop is the pair restartClaude() runs before it relaunches: interrupt()
   first, then endProcess(), the store's own way to end this chat's process
   (upstream's "stop the /loop" uses it). interrupt() matters even though the
   process is about to go: it is the funnel every stop passes through, and the
   prompt queue parks itself there (patches/prompt-queue/queue/stop-pause.js).
   Without it, ending a run looks to the queue like a run that finished, it
   sends the next item, and that send launches Claude straight back up.
   interrupt() returns at once when no turn is running.

   Start is launchClaude(), the call the panel itself makes when it opens: it
   resumes this conversation and clears the error the last process left. */
(function (S) {
    function quiet(p) {
        if (p && typeof p.catch === "function") p.catch(function (e) { S.log("call failed", e && e.message); });
    }

    S.stop = function (store) {
        try { quiet(store.interrupt()); } catch (e) { S.log("interrupt threw", e && e.message); }
        var ended = false;
        try { ended = store.endProcess() === true; } catch (e) { S.log("endProcess threw", e && e.message); }
        /* false: the launch is not even posted yet, so there is no process to end. */
        S.log(ended ? "stopped by the status button" : "stop asked, but no launched process to end");
        return ended;
    };

    S.start = function (store) {
        S.log("started by the status button");
        try { quiet(store.launchClaude()); } catch (e) { S.log("launchClaude threw", e && e.message); }
    };
})(window.__ccStatus);
