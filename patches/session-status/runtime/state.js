/* Which state this chat's Claude process is in, read off the session store's
   own signals - nothing here keeps a state of its own.

   claudeChannelIdSignal  set the moment the store posts a launch, and cleared by
                          its resetPerProcessState() when that process's stream
                          ends: an exit, a crash, or a stop.
   readyChannelIdSignal   set to that same channel when the CLI's first system
                          frame arrives (init, or a status with launchTiming).

   So no channel is "down", a channel the CLI has answered on is "up", and a
   channel still waiting for that answer is "starting". The three words match
   the app's own MCP status dots (connected / failed / pending), which are what
   the colours copy (session-status.css).

   Releases up to about 2.1.294 keep the ready channel in a plain field
   (readyChannelId), which nothing can be told about. There a launched process
   reads as "up" straight away: the button is right about green and red, and
   only has no amber to show.

   Every read takes a reader: S.value inside a render, so the component that
   renders subscribes to what it read, and S.peek anywhere else. */
(function (S) {
    S.UP = "up";
    S.STARTING = "starting";
    S.DOWN = "down";

    S.value = function (sig) { return sig.value; };
    S.peek = function (sig) { return sig.peek(); };

    /* A store without the channel signal (a release that renamed it) gets no
       button at all, rather than one that says something it cannot know. */
    S.canRead = function (store) {
        return !!(store && store.claudeChannelIdSignal && store.error);
    };

    S.state = function (store, read) {
        var channel = read(store.claudeChannelIdSignal);
        if (channel === undefined) return S.DOWN;
        if (!store.readyChannelIdSignal) return S.UP;
        return read(store.readyChannelIdSignal) === channel ? S.UP : S.STARTING;
    };

    /* What the last process left behind, if it ended badly. The store keeps it
       as a plain string until the next launch clears it. */
    S.errorOf = function (store, read) {
        var e = read(store.error);
        return typeof e === "string" && e ? e : "";
    };

    S.activeStore = function () {
        var sessions = S.sessions;
        return sessions && sessions.activeSession ? sessions.activeSession.peek() : undefined;
    };

    S.log = function () {
        if (!window.__ccLog) return;
        var args = ["status"].concat([].slice.call(arguments));
        try { window.__ccLog.apply(null, args); } catch (e) {}
    };
})(window.__ccStatus = window.__ccStatus || {});
