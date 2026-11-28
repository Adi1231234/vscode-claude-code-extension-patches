/* Whether the app's red error banner stands down, asked by the banner itself
   just before it draws (js/banner-guard.js passes its props and whether the
   error is about a session that cannot be resumed).

   It stands down only when the status button already says everything the
   banner would, and offers what the banner would:
   - the button is on screen: only the header that draws it sets S.sessions,
     and a panel without it (an editor opened in full-editor mode) keeps the
     banner as it was;
   - this chat's process is down - the button is red and its dialog shows this
     very error;
   - the error is a plain one. Kept as the app draws them: a history that did
     not load ("Retry"), a session the CLI cannot resume ("resume" is set,
     "Start a new conversation"), and a startup the CLI refused for a reason
     it named (props.startupFailureReason, an organisation setting: the banner
     words it as advice, with "Sign in again" or "Retry"). Only a CLI result
     frame that names the reason sets it, never a crash, and releases before
     it simply never pass it.

   Reading the store here with peek is enough: everything that flips the answer
   also changes the error the banner is drawn from. A process that dies sets
   the error and clears its channel in one go, before anything renders, and a
   launch clears the error itself. */
(function (S) {
    S.ownsBanner = function (props, resume) {
        if (!props || props.onRetryLoad || resume !== undefined) return false;
        if (props.startupFailureReason !== undefined) return false;
        var store = S.activeStore();
        var owned = S.canRead(store) && S.state(store, S.peek) === S.DOWN;
        if (owned && S.lastOwned !== props.error) {
            S.lastOwned = props.error;
            S.log("error banner left to the status button", String(props.error).slice(0, 120));
        }
        return owned;
    };
})(window.__ccStatus);
