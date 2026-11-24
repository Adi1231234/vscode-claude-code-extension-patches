/* AGENTINPUT: the message box's Enter, sent to the agent on screen.

   The chat's submit handler ends in session.send(text, attachments, ...);
   patch.ps1 points that one call at __ccAgentInput.route(session). That is
   the session itself while the main conversation is on screen, and while an
   agent's view is open (lib/js/ccTarget.js) the agent's own store
   (lib/js/ccAgentStore.js), whose send hands the text to the agent through
   the extension host. Commands the panel runs itself (/status and the like)
   are handled before that call and never get here.

   The box is already empty when the handler sends, so a message that cannot
   go is put back, and why is shown under the agent's transcript:
   attachments (an agent takes text only) and slash commands (they run in
   the main conversation).

   Escape in the box goes back to the main conversation. The app's own Escape
   stops the main conversation's turn - with a foreground agent running, that
   would stop the agent too - and the agent's view has a Stop of its own. */
window.__ccAgentInput = window.__ccAgentInput || (function () {
    var MENU = ".{{popupVisible}}, .{{suggestions}}";

    function putBack(text) {
        var e = globalThis.__ccInput();
        if (!e || (e.textContent || "").trim()) return;
        e.textContent = text;
        e.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }

    function refuse(text, why) {
        putBack(text);
        window.__ccTarget.note("Not sent: " + why);
        return Promise.reject(new Error(why));
    }

    function toAgent(store, t) {
        return {
            send: function (text, attachments) {
                if (attachments && attachments.length) return refuse(text, "an agent takes text only. Remove the attachment, or send it from the main conversation.");
                if (/^[ ]*[/]/.test(text)) return refuse(text, "slash commands run in the main conversation.");
                window.__ccTarget.note("");
                return window.__ccAgentStore.of(store, t).send(text).catch(function (err) {
                    return refuse(text, (err && err.message) || String(err));
                });
            }
        };
    }

    function onKey(ev) {
        if (ev.key !== "Escape" || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.isComposing) return;
        if (!window.__ccTarget.get()) return;
        var e = globalThis.__ccInput();
        if (!e || ev.target !== e || document.querySelector(MENU)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        window.__ccTarget.back();
    }

    window.addEventListener("keydown", onKey, true);

    return {
        route: function (store) {
            var t = window.__ccTarget.get();
            return t ? toAgent(store, t) : store;
        }
    };
})();
