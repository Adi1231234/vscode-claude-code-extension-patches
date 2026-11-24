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
     note(text)        why the last send to the agent did not go, or "" - shown
                       by the agent's view under its transcript; notes(fn)
                       subscribes to it

   Injected by more than one patch; the first definition wins. */
window.__ccTarget = window.__ccTarget || (function () {
    var cur = null, noteText = "", leave = null;
    var subs = [], noteSubs = [];

    function emit(list, value) {
        list.slice().forEach(function (fn) {
            try { fn(value); } catch (e) {}
        });
    }

    function same(a, b) {
        return (a ? a.agentId : null) === (b ? b.agentId : null);
    }

    function set(t) {
        if (same(t, cur)) {
            cur = t || null;
            return;
        }
        cur = t || null;
        noteText = "";
        emit(subs, cur);
        emit(noteSubs, noteText);
    }

    function subscribe(list, fn) {
        list.push(fn);
        return function () {
            var i = list.indexOf(fn);
            if (i >= 0) list.splice(i, 1);
        };
    }

    return {
        get: function () { return cur; },
        show: function (t) { set(t); },
        hide: function (t) { if (cur && t && cur.agentId === t.agentId) set(null); },
        on: function (fn) { return subscribe(subs, fn); },
        onBack: function (fn) { leave = fn; },
        back: function () { if (leave) leave(); },
        note: function (text) {
            var t = text || "";
            if (t === noteText) return;
            noteText = t;
            emit(noteSubs, noteText);
        },
        noteText: function () { return noteText; },
        notes: function (fn) { return subscribe(noteSubs, fn); }
    };
})();
