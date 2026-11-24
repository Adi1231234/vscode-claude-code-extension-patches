/* AGENTINPUT host: a message from the panel's agent view, handed to that agent.

   The panel asks with { type: "cc_agent_send", taskId, agentId, text } on the
   chat's own request channel (lib/js/ccAgentStore.js); host/case.js routes it
   here, ahead of the app's own requests, and this answers
   { type: "cc_agent_send_response", via } or { ..., error }.

   Two ways to the agent, through the conversation's own CLI (`ch.query`, the
   SDK query every request of the panel's goes through):
     1. send_task_message - the CLI's own request for exactly this. 2.1.331
        lists it but answers "Unsupported control request subtype"; the day it
        does not, this is the only way used.
     2. the agent-input mod's SendToAgent (mod/hooks/register.js), by mcp_call.
        A call a hook answered comes back as "The tool did not run: The result
        went to the host that asked for this call." - which here means it was
        handed over - and the mod's own refusals as "The tool did not run:
        agent-input: <reason>". */
globalThis.__ccAgentSend = globalThis.__ccAgentSend || (function () {
    var TOOL = "mcp__agent-input__SendToAgent";
    var NOT_RUN = "The tool did not run: ";
    var DELIVERED = NOT_RUN + "The result went to the host that asked for this call.";
    var MINE = NOT_RUN + "agent-input: ";
    var NO_MOD = "MCP server not connected: agent-input";

    function text(err) {
        return String((err && err.message) || err || "");
    }

    function unsupported(err) {
        return !!err && (err.errorCode === "unsupported_request" || text(err).indexOf("Unsupported control request subtype") === 0);
    }

    /* What the person reads under the agent's transcript. */
    function reason(err) {
        var m = text(err);
        if (m.indexOf(MINE) === 0) return m.slice(MINE.length);
        if (m.indexOf(NO_MOD) === 0) return "this conversation's Claude process started without the agent-input mod - restart the conversation, or reload the window";
        return m || "it could not be handed over";
    }

    async function viaMod(query, req) {
        try {
            await query.request({ subtype: "mcp_call", tool: TOOL, check_permissions: true, arguments: { agent: req.agentId, text: req.text } });
        } catch (err) {
            if (text(err) !== DELIVERED) throw err;
        }
        return "mod";
    }

    /* Any refusal of the CLI's own request falls through to the mod: once
       upstream fills it in, its shape may not be the one guessed here, and
       the mod still reaches the agent. A real refusal (no such agent) is
       refused there too, and then the CLI's own words are the ones shown. */
    async function deliver(query, req) {
        var first;
        try {
            await query.request({ subtype: "send_task_message", task_id: req.taskId, message: req.text });
            return "official";
        } catch (err) {
            first = err;
        }
        try {
            return await viaMod(query, req);
        } catch (err) {
            throw unsupported(first) ? err : first;
        }
    }

    function valid(req) {
        return !!req && typeof req.taskId === "string" && !!req.taskId &&
            typeof req.text === "string" && !!req.text.trim();
    }

    return async function (comms, channelId, req) {
        try {
            if (!valid(req)) throw new Error("nothing to send");
            var r = Object.assign({}, req, { agentId: req.agentId || req.taskId });
            var via = await comms.withChannel(channelId, function (ch) { return deliver(ch.query, r); });
            return { type: "cc_agent_send_response", via: via };
        } catch (err) {
            return { type: "cc_agent_send_response", error: reason(err) };
        }
    };
})();
