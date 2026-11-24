/* Shared webview runtime: messages to the conversation's agents.

     send(store, agent, text)  hands text to the agent ({ taskId, agentId })
                               through the extension host (patches/agent-input),
                               on the conversation's own request channel.
                               Resolves, or rejects with why it did not go,
                               marked parks - trying again will not make it go,
                               so a queue holds for the person - and noted for
                               the agent's view (lib/js/ccTarget.js note)
     sentTo(taskId)            the texts handed to that agent, newest last, the
                               last SENT_MAX: the CLI wraps one that wakes an
                               agent in words of its own, and the agent's view
                               shows the person what they typed
                               (patches/agent-tree/runtime/typed-rows.js). Kept
                               in the panel's localStorage, so a reload keeps them
     sentHere(taskId)          the ones this panel sent since it loaded: a
                               message a reload's CLI restart took with it is
                               not waited for

   Injected by more than one patch; the first definition wins. */
window.__ccOutbox = window.__ccOutbox || (function () {
    var ANSWER_MS = 20000, SENT_KEY = "cc-agent-sent:", SENT_MAX = 20;
    var here = new Map();

    function sentTo(taskId) {
        try { return JSON.parse(window.localStorage.getItem(SENT_KEY + taskId) || "[]"); } catch (e) { return []; }
    }

    function sentHere(taskId) { return here.get(taskId) || []; }

    function remember(taskId, text) {
        here.set(taskId, sentHere(taskId).concat([text]).slice(-SENT_MAX));
        try { window.localStorage.setItem(SENT_KEY + taskId, JSON.stringify(sentTo(taskId).concat([text]).slice(-SENT_MAX))); } catch (e) { /* this panel only */ }
    }

    function note(agent, text) {
        if (window.__ccTarget) window.__ccTarget.note(agent.agentId, text);
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
        return new Promise(function (resolve, reject) {
            var late = setTimeout(function () { reject(refused(agent, "the editor did not answer - reload the window (Developer: Reload Window)")); }, ANSWER_MS);
            store.getConnection().then(function (c) {
                return c.sendRequest({ type: "cc_agent_send", taskId: agent.taskId, agentId: agent.agentId, text: text }, ch);
            }).then(function (r) {
                if (!r || r.error) throw refused(agent, (r && r.error) || "the editor did not answer");
                remember(agent.taskId, text);
                note(agent, "");
                return r;
            }, function (err) {
                throw refused(agent, (err && err.message) || String(err));
            }).then(resolve, reject).then(function () { clearTimeout(late); });
        });
    }

    return { send: send, refused: refused, sentTo: sentTo, sentHere: sentHere };
})();
