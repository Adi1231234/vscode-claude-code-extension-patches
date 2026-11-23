/* Which agent made the chat's files: a chip per agent above the tree (all, this
   chat itself, each subagent, "unclear"), each with how much it made; a chip shows
   that agent's files only. Shown only when a subagent made files. The host says
   who made each (host/agents.js); this only draws and asks. */
window.__ccCFAgents = window.__ccCFAgents || (function () {
    var P = window.__ccCFParts, el = P.el;

    /* How the dialog names an agent. */
    function name(a) {
        if (a.key === "main") return "This chat";
        if (a.key === "unclear") return "Unclear";
        return a.label || a.type || "Subagent " + a.key.slice(0, 8);
    }
    function tip(a) {
        if (a.key === "main") return "Files the chat made itself, not through a subagent";
        if (a.key === "unclear") return "Made while several agents were running commands at once: no single one can be named";
        return "Subagent" + (a.type ? " (" + a.type + ")" : "") + " - " + a.key;
    }

    /* The name to mark a file row with: a subagent's, or nothing (the chat's own, or one agent shown). */
    function markOf(s, key) {
        if (!key || key === "main" || s.agent) return "";
        var a = (s.agents || []).find(function (x) { return x.key === key; });
        return a ? name(a) : "";
    }

    function chips(send) {
        var bar = el("div", "cc-cf-agents"), made = "";
        bar.setAttribute("role", "radiogroup");
        bar.setAttribute("aria-label", "Made by");
        function chip(s, key, label, title, bytes, count) {
            var b = P.button("cc-cf-agent-chip" + (s.agent === key ? " cc-cf-on" : ""));
            b.setAttribute("role", "radio");
            b.setAttribute("aria-checked", String(s.agent === key));
            b.title = title + " - " + count.toLocaleString("en-US") + (count === 1 ? " file" : " files");
            b.appendChild(el("span", "cc-cf-agent-name", label));
            b.appendChild(el("span", "cc-cf-agent-size", window.__ccCFSize(bytes)));
            b.onclick = function () { send({ op: "agent", key: key }); };
            return b;
        }
        return {
            el: bar,
            sync: function (s) {
                var list = s.agents || [], shown = list.some(function (a) { return a.key !== "main"; });
                window.__ccDom.toggle(bar, "cc-cf-hidden", !shown);
                var key = JSON.stringify([s.agent, s.total, s.bytes, list]);
                if (!shown || key === made) return;
                made = key;   // drawn again only when what it says changed
                bar.textContent = "";
                bar.appendChild(el("span", "cc-cf-agents-label", "Made by"));
                bar.appendChild(chip(s, null, "All", "Every agent's files", s.bytes || 0, s.total || 0));
                list.forEach(function (a) { bar.appendChild(chip(s, a.key, name(a), tip(a), a.bytes, a.count)); });
            }
        };
    }

    return { chips: chips, markOf: markOf };
})();
