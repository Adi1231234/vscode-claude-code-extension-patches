/* Shared webview runtime: one of the conversation's agents, in the shape of a
   session store - the part the prompt queue reads (busy, messages, send,
   interrupt) - so the queue runs a lane for an agent exactly as it runs the
   conversation's (patches/prompt-queue/queue/lanes.js). The lane's own key
   comes from its host, not from here.

     of(store, agent)   the agent's store: one per conversation store and agent
                        ({ taskId, agentId }), made on first use

   What the fields mean for an agent (its raw status is working, finished,
   failed or stopped - the app's agentMapAgents, keyed by task id):
     busy       its run is not over. Also true from a send that wakes a
                finished agent until the app sees the new run start, for at
                most WAKE_MS: the host answers once the CLI has woken it, but
                the store hears of it in a frame of its own. And true while
                the store does not hold the agent at all (another conversation
                is on screen, or it has not loaded yet): nothing is sent to it.
     messages   none, but a "[Request interrupted by user]" row each time the
                agent is stopped - the row lib/js/ccReply.js reads a stop off.
                So the queue parks an agent's lane on its stop, whoever stopped
                it, the way it parks the conversation's.
     send       text only, through lib/js/ccOutbox.js.
     interrupt  stops the agent; the queue decorates it to park first. */
window.__ccAgentStore = window.__ccAgentStore || (function () {
    var WAKE_MS = 10000;
    var byStore = new WeakMap(), stops = 0;

    function signal(v) {
        var subs = [];
        return {
            get value() { return v; },
            set value(n) {
                if (n === v) return;
                v = n;
                subs.slice().forEach(function (fn) { try { fn(v); } catch (e) {} });
            },
            peek: function () { return v; },
            subscribe: function (fn) {
                subs.push(fn);
                fn(v);
                return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
            }
        };
    }

    function make(store, agent) {
        var id = agent.taskId, wakeUntil = 0, wakeTimer = 0, last = null;
        var busy = signal(false), messages = signal([]);
        var out = window.__ccOutbox;

        function status() {
            var a = store.agentMapAgents && store.agentMapAgents.peek().get(id);
            return a ? a.status : null;
        }

        function update() {
            var st = status(), running = st === "working";
            if (running) wakeUntil = 0;
            if (last === "working" && st === "stopped") {
                messages.value = messages.peek().concat([{
                    type: "user", uuid: "cc-agent-stop-" + (++stops),
                    content: [{ content: { text: "[Request interrupted by user]" } }]
                }]);
            }
            last = st;
            busy.value = st === null || running || Date.now() < wakeUntil;
        }

        function woke() {
            if (status() === "working") return;
            wakeUntil = Date.now() + WAKE_MS;
            clearTimeout(wakeTimer);
            wakeTimer = setTimeout(update, WAKE_MS + 10);
            update();
        }

        if (store.agentMapAgents && typeof store.agentMapAgents.subscribe === "function") store.agentMapAgents.subscribe(update);
        else update();

        return {
            busy: busy,
            messages: messages,
            /* A stopped agent is refused by SendMessage in words meant for a
               model, and not always the same ones ("was not resumed", "won't
               be resumed"); the store knows it was stopped, and says so. */
            send: function (text, files) {
                if (files && files.length) return Promise.reject(out.refused(agent, "an agent takes text only"));
                return out.send(store, agent, text).then(function (r) { woke(); return r; }, function (err) {
                    if (status() !== "stopped") throw err;
                    throw out.refused(agent, "this agent was stopped, and a stopped agent cannot be woken from here - ask the main conversation to run it again");
                });
            },
            interrupt: function () { return store.stopSubagent(id); }
        };
    }

    function of(store, agent) {
        var mine = byStore.get(store);
        if (!mine) { mine = new Map(); byStore.set(store, mine); }
        var a = mine.get(agent.taskId);
        if (!a) { a = make(store, agent); mine.set(agent.taskId, a); }
        return a;
    }

    return { of: of };
})();
