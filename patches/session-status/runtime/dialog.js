/* The confirm dialog the button opens: "Stop Claude?" while a process is up or
   starting, "Start Claude?" while it is down, with the error the last process
   left when there is one. It wears the shared dialog chrome (lib/js/ccModal.js),
   so overlay, head, Escape and focus trap match every other dialog this repo
   adds.

   It follows the store while it is open - a process can end, or a message can
   start one, with the question on screen - through the signals' own
   subscribe(), dropped again on close. When that turns the question around,
   the button under the pointer changes meaning, so it takes no click for a
   moment after any change of action. */
(function (S) {
    var SETTLE_MS = 600;

    /* subscribe() calls back at once with the current value; one render per
       microtask covers that and any burst of changes after it. */
    function follow(store, sessions, render, close) {
        var pending = false, offs = [];
        function soon() {
            if (pending) return;
            pending = true;
            Promise.resolve().then(function () { pending = false; render(); });
        }
        [store.claudeChannelIdSignal, store.readyChannelIdSignal, store.error, store.busy].forEach(function (sig) {
            if (sig && typeof sig.subscribe === "function") offs.push(sig.subscribe(soon));
        });
        if (sessions && sessions.activeSession) {
            offs.push(sessions.activeSession.subscribe(function (s) { if (s !== store) Promise.resolve().then(close); }));
        }
        return function () { offs.forEach(function (off) { try { off(); } catch (e) {} }); };
    }

    S.openDialog = function (store, context) {
        if (!window.__ccModal) return;
        var unfollow = null, action = "", changedAt = 0;
        var sh = window.__ccModal({
            label: "Claude process",
            icon: S.glyph(),
            cls: "cc-status-dialog",
            onClose: function () { if (unfollow) unfollow(); }
        });
        var warn = S.el("p", "cc-status-warn");
        var text = S.el("p", "cc-status-text");
        var err = S.errorBlock(context);
        var cancel = S.makeButton("__qBtnQuiet", "Cancel");
        var act = S.makeButton("", "");
        cancel.onclick = sh.close;
        act.onclick = function () {
            if (Date.now() - changedAt < SETTLE_MS) return;
            if (action === "stop") S.stop(store);
            else S.start(store);
            sh.close();
        };

        function render() {
            var v = S.view(store);
            sh.title.textContent = v.title;
            sh.sub.textContent = v.sub;
            sh.icon.className = "__qHeadIcon cc-status-" + v.state;
            err.show(v.error);
            text.textContent = v.text;
            warn.textContent = v.warn;
            warn.hidden = !v.warn;
            if (v.action === action) return;
            if (action) changedAt = Date.now();
            action = v.action;
            act.className = action === "stop" ? "__qBtnDanger" : "__qBtnPrimary";
            act.textContent = action === "stop" ? "Stop Claude" : "Start Claude";
        }

        sh.box.appendChild(err.el);
        sh.box.appendChild(text);
        sh.box.appendChild(warn);
        sh.foot.appendChild(cancel);
        sh.foot.appendChild(act);
        render();
        sh.mount();
        err.toEnd();
        unfollow = follow(store, S.sessions, render, sh.close);
        /* A stop is the one to be sure about: Enter on it cancels. */
        (action === "stop" ? cancel : act).focus();
    };
})(window.__ccStatus);
