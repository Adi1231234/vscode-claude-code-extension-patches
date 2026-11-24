/* Shared webview runtime: one of the conversation's agents, in the shape of a
   session store - the part the prompt queue reads (busy, sessionId, messages,
   send, interrupt) - so the queue runs a lane for an agent exactly as it runs
   the conversation's (patches/prompt-queue/queue/lanes.js).

     of(store, agent)        the agent's store: one per conversation store and
                             agent, made on first use
     send(store, agent, t)   hand text t to the agent through the extension
                             host (patches/agent-input); resolves, or rejects
                             with the reason it did not go
     sentTo(taskId)          the texts handed to that agent, newest last: the
                             CLI wraps one that wakes an agent in words of its
                             own, and the agent's view shows the person what
                             they typed (patches/agent-tree/runtime/own-rows.js).
                             Kept in the panel's localStorage, so a reload
                             keeps them; the last SENT_MAX per agent.
     sentHere(taskId)        the ones this panel sent since it loaded: a
                             message a reload's CLI restart took with it is
                             not waited for

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
     interrupt  stops the agent; the queue decorates it to park first. */
window.__ccAgentStore = window.__ccAgentStore || (function () {
    var WAKE_MS = 10000, ANSWER_MS = 20000, SENT_KEY = "cc-agent-sent:", SENT_MAX = 20;
    var byStore = new WeakMap(), here = new Map(), stops = 0;

    function sentTo(taskId) {
        try { return JSON.parse(window.localStorage.getItem(SENT_KEY + taskId) || "[]"); } catch (e) { return []; }
    }

    function sentHere(taskId) { return here.get(taskId) || []; }

    function remember(taskId, text) {
        here.set(taskId, sentHere(taskId).concat([text]).slice(-SENT_MAX));
        try { window.localStorage.setItem(SENT_KEY + taskId, JSON.stringify(sentTo(taskId).concat([text]).slice(-SENT_MAX))); } catch (e) { /* this panel only */ }
    }

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

    function send(store, agent, text) {
        var ch = store && store.claudeChannelId;
        if (!ch) return Promise.reject(new Error("the conversation's Claude process is not running"));
        var asked = store.getConnection().then(function (c) {
            return c.sendRequest({ type: "cc_agent_send", taskId: agent.taskId, agentId: agent.agentId || agent.taskId, text: text }, ch);
        });
        /* A window whose extension host started before the patch has no
           answer for this request; say so rather than wait for good. */
        var late = new Promise(function (resolve, reject) {
            setTimeout(function () { reject(new Error("the editor did not answer - reload the window (Developer: Reload Window)")); }, ANSWER_MS);
        });
        return Promise.race([asked, late]).then(function (r) {
            if (!r || r.error) throw new Error((r && r.error) || "the editor did not answer");
            remember(agent.taskId, text);
            return r;
        });
    }

    function make(store, agent) {
        var id = agent.taskId, wakeUntil = 0, wakeTimer = 0;
        var busy = signal(false), messages = signal([]);
        var last = null;

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
            agentId: agent.agentId || id,
            taskId: id,
            busy: busy,
            messages: messages,
            sessionId: signal(id),
            send: function (text, files) {
                if (files && files.length) return Promise.reject(new Error("an agent takes text only"));
                return send(store, agent, text).then(function (r) { woke(); return r; });
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

    return { of: of, send: send, sentTo: sentTo, sentHere: sentHere };
})();
