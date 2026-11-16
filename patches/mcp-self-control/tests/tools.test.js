/* host/tools.js against a fake server and a fake extension, no editor:
 *     node patches/mcp-self-control/tests/tools.test.js
 * The real path (CLI + Agent SDK, a failed server reconnected mid-turn) was
 * measured end to end; see the README. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

new Function(fs.readFileSync(path.join(__dirname, "..", "host", "tools.js"), "utf8"))();

function zodString() {
    const s = { optional: () => s, describe: () => s };
    return s;
}

function setup(list, failOn) {
    const tools = {};
    const calls = [];
    const server = { registerTool: (name, spec, fn) => { tools[name] = { spec, fn }; } };
    const comms = {
        withChannel: async (ch, fn) => {
            if (ch !== "ch") throw new Error("Channel not found: " + ch);
            return fn({ query: { mcpServerStatus: async () => list } });
        },
        reconnectMcpServer: async (ch, name) => {
            calls.push(ch + "/" + name);
            if (name === failOn) throw new Error("boom");
            const s = list.find((x) => x.name === name);
            s.status = "connected";
            s.error = undefined;
        }
    };
    globalThis.__ccMcpTools(server, comms, "ch");
    const run = async (name, args) => {
        const r = await tools[name].fn(args);
        return { isError: !!r.isError, text: r.content[0].text, json: r.isError ? null : JSON.parse(r.content[0].text) };
    };
    return { tools, calls, run };
}

const servers = () => [
    { name: "claude-vscode", status: "connected", tools: [{}, {}] },
    { name: "chrome", status: "failed", error: "ECONNREFUSED", scope: "user", config: { type: "http", url: "x" } },
    { name: "sms", status: "needs-auth", config: { command: "sms.exe" } },
    { name: "mesh", status: "connected", tools: [{}] },
    { name: "linear", status: "disabled" }
];

(async () => {
    /* Before host/zod.js has run (or where the schema is gone): nothing is
       registered and nothing throws - this runs inside the chat's launch. */
    const none = {};
    globalThis.__ccMcpTools({ registerTool: (n) => { none[n] = 1; } }, {}, "ch");
    assert.deepStrictEqual(Object.keys(none), [], "no zod, no tools, no throw");
    globalThis.__ccMcpTools({ registerTool: () => { throw new Error("schema refused"); } }, {}, "ch");
    globalThis.__ccZodString = zodString;

    let t = setup(servers());
    assert.deepStrictEqual(Object.keys(t.tools).sort(), ["mcp_server_status", "reconnect_mcp_server"]);
    assert.strictEqual(t.tools.mcp_server_status.spec.annotations.readOnlyHint, true);

    const st = await t.run("mcp_server_status", {});
    assert.deepStrictEqual(st.json[1], { name: "chrome", status: "failed", error: "ECONNREFUSED", scope: "user", transport: "http" });
    assert.deepStrictEqual(st.json[2], { name: "sms", status: "needs-auth", transport: "stdio" });
    assert.strictEqual(st.json[0].tools, 2);

    const one = await t.run("reconnect_mcp_server", { server: "chrome" });
    assert.deepStrictEqual(t.calls, ["ch/chrome"]);
    assert.deepStrictEqual(one.json.reconnected, ["chrome"]);
    assert.strictEqual(one.json.servers[0].status, "connected");

    t = setup(servers());
    const all = await t.run("reconnect_mcp_server", {});
    assert.deepStrictEqual(t.calls.sort(), ["ch/chrome", "ch/sms"], "all = not connected and not disabled, never itself");

    const again = await t.run("reconnect_mcp_server", {});
    assert.deepStrictEqual(again.json.reconnected, []);
    assert.strictEqual(again.json.servers.length, 5, "nothing to do still reports every server");
    assert.ok(again.json.note);

    const unknown = await t.run("reconnect_mcp_server", { server: "nope" });
    assert.ok(unknown.isError && unknown.text.includes("chrome"), "an unknown name lists the real ones");
    const self = await t.run("reconnect_mcp_server", { server: "claude-vscode" });
    assert.ok(self.isError, "never reconnects the server answering the call");
    assert.strictEqual(all.json.reconnected.length, 2);

    t = setup(servers(), "chrome");
    const failed = await t.run("reconnect_mcp_server", {});
    assert.strictEqual(failed.json.errors.chrome, "boom", "one failure is reported, the rest still run");
    assert.deepStrictEqual(t.calls.sort(), ["ch/chrome", "ch/sms"]);

    const tools = {};
    globalThis.__ccMcpTools({ registerTool: (n, s, fn) => { tools[n] = fn; } },
        { withChannel: async () => { throw new Error("Channel not found: gone"); } }, "gone");
    const gone = await tools.mcp_server_status({});
    assert.ok(gone.isError && gone.content[0].text.includes("gone"), "a closed chat answers an error, never throws");

    console.log("mcp-self-control tools: ok");
})().catch((e) => { console.error(e); process.exit(1); });
