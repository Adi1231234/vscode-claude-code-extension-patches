/* Two tools Claude can call on its own MCP servers: see each one's status, and
   reconnect one by name (or every one that is not connected).

   They are registered on "claude-vscode", the in-process MCP server the
   extension builds for every chat when it launches that chat's CLI. So each
   tool only ever sees and touches its own chat's servers: `comms` and
   `channel` are the chat that built the server.

   Both go through what the MCP servers dialog itself uses: the session's
   mcpServerStatus(), and the extension's own reconnectMcpServer(channel, name),
   which sends the CLI the SDK's mcp_reconnect request - the same call as the
   dialog's Reconnect button. Nothing here reimplements a connection. */
globalThis.__ccMcpTools = globalThis.__ccMcpTools || (function () {
    /* This server. Reconnecting it would cut the call that asked for it. */
    var SELF = "claude-vscode";
    /* Left alone by a reconnect without a name: up already, or off on purpose. */
    var SETTLED = { connected: true, disabled: true };

    function answer(value) {
        return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
    }

    function refuse(message) {
        return { content: [{ type: "text", text: message }], isError: true };
    }

    function row(s) {
        var out = { name: s.name, status: s.status };
        if (s.error) out.error = s.error;
        if (s.scope) out.scope = s.scope;
        var config = s.config || {};
        var transport = config.type || (config.command ? "stdio" : "");
        if (transport) out.transport = transport;
        if (Array.isArray(s.tools)) out.tools = s.tools.length;
        return out;
    }

    function status(comms, channel) {
        return comms.withChannel(channel, function (c) { return c.query.mcpServerStatus(); });
    }

    function pick(list, server) {
        if (server) return [server];
        return list.filter(function (s) { return s.name !== SELF && !SETTLED[s.status]; })
            .map(function (s) { return s.name; });
    }

    async function reconnect(comms, channel, server) {
        var before = await status(comms, channel);
        if (server === SELF) return refuse('"' + SELF + '" is the server answering this call; it cannot reconnect itself.');
        if (server && !before.some(function (s) { return s.name === server; })) {
            return refuse('No MCP server named "' + server + '". Servers: ' +
                before.map(function (s) { return s.name; }).join(", "));
        }
        var names = pick(before, server);
        var errors = {};
        await Promise.all(names.map(function (name) {
            return comms.reconnectMcpServer(channel, name).catch(function (e) {
                errors[name] = e instanceof Error ? e.message : String(e);
            });
        }));
        var after = await status(comms, channel);
        var touched = after.filter(function (s) { return names.indexOf(s.name) >= 0; });
        var result = { reconnected: names, servers: (names.length ? touched : after).map(row) };
        if (!names.length) result.note = "Every server is connected or disabled; nothing was reconnected.";
        if (Object.keys(errors).length) result.errors = errors;
        return answer(result);
    }

    function guarded(fn) {
        return async function (args) {
            try {
                return await fn(args || {});
            } catch (e) {
                return refuse(e instanceof Error ? e.message : String(e));
            }
        };
    }

    function define(server, comms, channel, string) {
        server.registerTool("mcp_server_status", {
            description: "List every MCP server of this chat with its status (connected, failed, needs-auth, " +
                "pending, disabled), its connection error and how many tools it has. Use it when an MCP tool " +
                "is missing or fails, before asking the user to open /mcp.",
            inputSchema: {},
            annotations: { title: "MCP server status", readOnlyHint: true }
        }, guarded(function () {
            return status(comms, channel).then(function (list) { return answer(list.map(row)); });
        }));
        server.registerTool("reconnect_mcp_server", {
            description: "Reconnect one of this chat's MCP servers by name, the way Reconnect in /mcp does, " +
                "and return its status afterwards. Leave `server` out to reconnect every server that is not " +
                "connected (disabled ones are left alone). Use this yourself instead of asking the user to " +
                "run /mcp. A server that needs sign-in stays needs-auth: only the user can sign in.",
            inputSchema: {
                server: string().optional().describe("The server's name as mcp_server_status lists it. " +
                    "Omit to reconnect every server that is not connected.")
            },
            annotations: { title: "Reconnect MCP server", readOnlyHint: false, destructiveHint: false, idempotentHint: true }
        }, guarded(function (args) { return reconnect(comms, channel, args.server); }));
    }

    /* `string` is the bundle's own z.string, left by host/zod.js at the app's
       getDiagnostics schema - read there, where the name is in scope, never at
       the launch, where a short minified name can be a different local. This
       runs inside the chat's launch, so it never throws: without zod, or if
       registering fails, the chat starts with the app's tools alone. */
    return function register(server, comms, channel) {
        var string = globalThis.__ccZodString;
        if (typeof string !== "function") return;
        try {
            define(server, comms, channel, string);
        } catch (e) {}
    };
})();
