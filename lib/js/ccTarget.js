/* Shared webview runtime: who the composer is talking to.

   The panel has one message box. While the main conversation is on screen it
   talks to the main conversation, as it always has. While one of its agents is
   on screen (patches/agent-tree opens an agent's view in the conversation's
   place), the same box talks to that agent: Enter sends to it
   (patches/agent-input), and the queue above the box is that agent's own lane
   (patches/prompt-queue). This is the one place that says which.

     get()             null for the main conversation, else { agentId, taskId, name }
     show(t) / hide(t) an agent's view came on screen / went away; hide only
                       clears the agent it names, so a view replaced by another
                       one cannot clear its successor
     on(fn)            fn(target) on every change; returns the unsubscribe
     back()            leave the agent's view (agent-tree registers it: onBack)
     note(agentId, t)  why the last send to that agent did not go, "" once one
                       went - from the box or from its queue lane, on screen
                       or not; the agent's view shows its own (noteFor), and
                       notes(fn) subscribes to every change

   Injected by more than one patch; the first definition wins. */
window.__ccTarget = window.__ccTarget || (function () {
    var cur = null, leave = null, noted = new Map();
    var subs = [], noteSubs = [];

    function emit(list) {
        list.slice().forEach(function (fn) {
            try { fn(cur); } catch (e) {}
        });
    }

    function subscribe(list, fn) {
        list.push(fn);
        return function () {
            var i = list.indexOf(fn);
            if (i >= 0) list.splice(i, 1);
        };
    }

    function set(t) {
        var same = (t ? t.agentId : null) === (cur ? cur.agentId : null);
        cur = t || null;
        if (!same) emit(subs);
    }

    return {
        get: function () { return cur; },
        show: function (t) { set(t); },
        hide: function (t) { if (cur && t && cur.agentId === t.agentId) set(null); },
        on: function (fn) { return subscribe(subs, fn); },
        onBack: function (fn) { leave = fn; },
        back: function () { if (leave) leave(); },
        note: function (agentId, text) {
            var t = text || "";
            if ((noted.get(agentId) || "") === t) return;
            if (t) noted.set(agentId, t); else noted.delete(agentId);
            emit(noteSubs);
        },
        noteFor: function (agentId) { return noted.get(agentId) || ""; },
        notes: function (fn) { return subscribe(noteSubs, fn); }
    };
})();
