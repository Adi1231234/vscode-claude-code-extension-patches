/* ---------- Lanes: the conversation's queue, and one per agent ----------
   The panel has one message box, and it talks to whatever is on screen
   (lib/js/ccTarget.js): the conversation, or one of its agents while that
   agent's view is open (patches/agent-tree). Each gets a queue of its own -
   the queue above (__ccQueueEngine) is a factory, and every call is a queue
   with its own state, as the desktop app runs one per conversation
   (desktop/patches/prompt-queue/host/engines.js).

   - The conversation's lane is the queue as it always was: its store and
     pushes are the panel's (lib/js/ccStore.js, ccSession.js), it publishes
     __qAuto / __qAdd / __qRemote for the other patches, and it keeps sending
     while an agent is on screen, through the store, as a queue with no
     composer does.
   - An agent's lane reads the agent's store (lib/js/ccAgentStore.js): busy
     while the agent's run is not over, send through the extension host, a
     stop row when the agent is stopped - so it sends one item per run of the
     agent, waking it when it has finished, and parks on its stop. It is kept
     under "<conversation id>~agent~<task id>", restored held like any other,
     and publishes nothing.
   - Only the lane on screen draws. The one leaving takes its panel and
     buttons down (queue/detach.js), and the one arriving looks again.

   An agent's lane follows the panel's store: when the panel moves to another
   conversation, it is bound to the new one, where its agent is not - and an
   agent the store does not hold reads as busy (lib/js/ccAgentStore.js), so
   the lane holds until the panel is back where its agent is. */
(function () {
    var make = window.__ccQueueEngine, T = window.__ccTarget;
    if (!make || !T || window.__ccQueueLanes) return;
    var lanes = new Map(), shown = null;

    function lane(h) {
        h.onScreen = function () { return shown === h; };
        h.engine = make(h);
        return h;
    }

    var main = lane({
        store: function () { return globalThis.__ccStore(); },
        push: function () { return window.__ccSession; },
        publish: function (name, api) { window[name] = window[name] || api; return window[name]; }
    });

    /* The agent's store, in the conversation the panel shows now: the one the
       panel's session push is bound to, which follows the app's own switch. */
    function storeFor(h) {
        var s = (window.__ccSession && window.__ccSession.store()) || globalThis.__ccStore();
        return s ? window.__ccAgentStore.of(s, h.agent) : null;
    }

    function agentLane(t) {
        var sid = main.engine.sid();
        if (!sid || !window.__ccAgentStore) return null;
        var key = sid + "~agent~" + t.taskId;
        var h = lanes.get(key);
        if (h) return h;
        var push = null, rebind = null;
        h = {
            agent: t,
            secondary: true,
            api: {},
            laneId: function () { return key; },
            store: function () { return storeFor(h); },
            push: function () {
                return push || (push = window.__ccSessionMake(function (bind) { rebind = bind; bind(storeFor(h)); }));
            },
            publish: function (name, api) { h.api[name] = api; return api; },
            rebind: function () { if (rebind) rebind(storeFor(h)); }
        };
        lanes.set(key, h);
        return lane(h);
    }

    function show(t) {
        var next = (t && agentLane(t)) || main;
        if (next === shown) return;
        if (shown) shown.engine.detach();
        shown = next;
        next.engine.pass();
        if (next !== main) main.engine.pass();
    }

    /* A conversation switch replaces the store; each agent lane follows it,
       bound only while the panel is back on its own conversation. */
    if (window.__ccSession) window.__ccSession.onStore(function () {
        lanes.forEach(function (h) { h.rebind(); });
    });

    window.__ccQueueLanes = {
        main: function () { return main; },
        shown: function () { return shown; },
        count: function () { return lanes.size; }
    };
    T.on(show);
    show(T.get());
})();
