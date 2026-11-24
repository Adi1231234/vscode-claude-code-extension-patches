/* Shared webview runtime: messages to the conversation's agents.

     send(store, agent, text)  hands text to the agent ({ taskId, agentId })
                               through the extension host (patches/agent-input),
                               on the conversation's own request channel.
                               Resolves, or rejects with why it did not go,
                               marked parks - trying again will not make it go,
                               so a queue holds for the person - and noted for
                               the agent's view (lib/js/ccTarget.js note)
     waiting(taskId)           what this panel sent that agent and its
                               transcript does not show yet, oldest first:
                               { id, text, at }. A message reaches a working
                               agent only at its next step, so the agent's view
                               draws these at its end as the app draws a message
                               sent while Claude works
                               (patches/agent-tree/runtime/held-rows.js). Not
                               kept over a reload: the CLI restart it brings
                               takes the messages with it
     arrived(taskId, rows)     the agent's transcript holds these rows from the
                               box ({ text, at }): each waiting message is
                               matched to the first one with its text, written
                               since it was sent
     lost(agent, why)          the agent will not read what still waits (it was
                               stopped): dropped, and why is noted
     on(fn)                    fn() after any change to what waits; returns the
                               unsubscribe
     sentTo(taskId)            the texts handed to that agent, newest last, the
                               last SENT_MAX: the CLI wraps one that wakes an
                               agent in words of its own, and the agent's view
                               shows the person what they typed
                               (patches/agent-tree/runtime/typed-rows.js). Kept
                               in the panel's localStorage, so a reload keeps them

   Injected by more than one patch; the first definition wins. */
window.__ccOutbox = window.__ccOutbox || (function () {
    var ANSWER_MS = 20000, SENT_KEY = "cc-agent-sent:", SENT_MAX = 20, CLOCK_MS = 2000;
    var waits = new Map(), subs = [], ids = 0;

    function sentTo(taskId) {
        try { return JSON.parse(window.localStorage.getItem(SENT_KEY + taskId) || "[]"); } catch (e) { return []; }
    }

    function remember(taskId, text) {
        try { window.localStorage.setItem(SENT_KEY + taskId, JSON.stringify(sentTo(taskId).concat([text]).slice(-SENT_MAX))); } catch (e) { /* this panel only */ }
    }

    function waiting(taskId) { return (waits.get(taskId) || []).slice(); }

    function on(fn) {
        subs.push(fn);
        return function () { subs = subs.filter(function (f) { return f !== fn; }); };
    }

    function changed() {
        subs.slice().forEach(function (fn) { try { fn(); } catch (e) { /* the others still hear */ } });
    }

    function hold(taskId, text) {
        var w = { id: ++ids, text: text, at: Date.now() };
        waits.set(taskId, waiting(taskId).concat([w]));
        changed();
        return w;
    }

    function settle(taskId, done) {
        var all = waiting(taskId), left = all.filter(function (w) { return done.indexOf(w) < 0; });
        if (left.length === all.length) return;
        if (left.length) waits.set(taskId, left); else waits.delete(taskId);
        changed();
    }

    function arrived(taskId, rows) {
        var used = new Set(), done = [];
        waiting(taskId).forEach(function (w) {
            for (var i = 0; i < rows.length; i++) {
                if (used.has(i) || rows[i].text !== w.text || rows[i].at < w.at - CLOCK_MS) continue;
                used.add(i);
                done.push(w);
                return;
            }
        });
        settle(taskId, done);
    }

    function note(agent, text) {
        if (window.__ccTarget) window.__ccTarget.note(agent.agentId, text);
    }

    function lost(agent, why) {
        var all = waiting(agent.taskId);
        if (!all.length) return;
        settle(agent.taskId, all);
        note(agent, "Not read: " + why);
    }

    function refused(agent, why) {
        note(agent, "Not sent: " + why);
        var err = new Error(why);
        err.parks = true;
        return err;
    }

    /* A window whose extension host started before the patch has no answer
       for this request: say so rather than wait for good. */
    function send(store, agent, text) {
        var ch = store.claudeChannelId;
        if (!ch) return Promise.reject(refused(agent, "the conversation's Claude process is not running"));
        var w = hold(agent.taskId, text);
        var fail = function (why) { settle(agent.taskId, [w]); return refused(agent, why); };
        return new Promise(function (resolve, reject) {
            var late = setTimeout(function () { reject(fail("the editor did not answer - reload the window (Developer: Reload Window)")); }, ANSWER_MS);
            store.getConnection().then(function (c) {
                return c.sendRequest({ type: "cc_agent_send", taskId: agent.taskId, agentId: agent.agentId, text: text }, ch);
            }).then(function (r) {
                if (!r || r.error) throw fail((r && r.error) || "the editor did not answer");
                remember(agent.taskId, text);
                note(agent, "");
                return r;
            }, function (err) {
                throw fail((err && err.message) || String(err));
            }).then(resolve, reject).then(function () { clearTimeout(late); });
        });
    }

    return { send: send, refused: refused, waiting: waiting, arrived: arrived, lost: lost, on: on, sentTo: sentTo };
})();
