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
    /* A menu the box opened (the / commands, the @ mentions) takes Escape
       first. The box names the list it drives in aria-controls (measured on
       2.1.331: "command-menu-list" while the / menu is up), and the menu's own
       classes are not the ones a class search would guess. The list itself
       draws no box of its own, so it is open when an option in it is drawn. */
    function menuOpen(e) {
        var id = e.getAttribute("aria-controls");
        var list = id && document.getElementById(id);
        if (!list) return false;
        var options = list.querySelectorAll('[role="option"]');
        for (var i = 0; i < options.length; i++) if (options[i].getClientRects().length) return true;
        return false;
    }

    function putBack(text) {
        var e = globalThis.__ccInput();
        if (!e || (e.textContent || "").trim()) return;
        e.textContent = text;
        e.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }

    function refuse(t, text, why) {
        putBack(text);
        window.__ccTarget.note(t.agentId, "Not sent: " + why);
        return Promise.reject(new Error(why));
    }

    /* A command for the CLI, as the chat's handler decided it: its third
       argument is true for plain text and for a command the CLI advertises,
       false for /word that is neither. So a "/" text with it true is a
       command unless its first word holds another "/", which is a path. */
    function isCommand(text, isCliText) {
        var m = /^[ ]*[/]([^ ]*)/.exec(text);
        return !!m && isCliText === true && m[1] !== "" && m[1].indexOf("/") < 0;
    }

    function toAgent(store, t) {
        return {
            send: function (text, attachments, isCliText) {
                if (attachments && attachments.length) return refuse(t, text, "an agent takes text only. Remove the attachment, or send it from the main conversation.");
                if (isCommand(text, isCliText)) return refuse(t, text, "slash commands run in the main conversation.");
                /* The agent's store notes its own refusals. */
                return window.__ccAgentStore.of(store, t).send(text).catch(function (err) {
                    putBack(text);
                    throw err;
                });
            }
        };
    }

    function onKey(ev) {
        if (ev.key !== "Escape" || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.isComposing) return;
        if (!window.__ccTarget.get()) return;
        var e = globalThis.__ccInput();
        if (!e || ev.target !== e || menuOpen(e)) return;
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
