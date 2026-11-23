/* What a tool's shell command line says about the call it runs (the recorder's
   "spawn" lines). The same as adi-tools' packages/created-files/agents/shellCall.mjs;
   change the two together. Measured on CLI 2.1.330: a Bash call runs
   bash.exe -c "... && eval '<the command>' < /dev/null ...": the script after -c is
   one Windows argument (its " written \"), and in it the command is single-quoted
   with each ' written '\''. A PowerShell call runs cmd.exe /c ... powershell ...
   $env:CLAUDE_CODE_SHELL_LAUNCHER_SCRIPT ... > "...\tasks\<id>.output": its command
   is in the environment, not on the line. */
globalThis.__ccCFAgentShell = globalThis.__ccCFAgentShell || (function () {
    var EVAL = "eval '", POWERSHELL = "CLAUDE_CODE_SHELL_LAUNCHER_SCRIPT";
    var TASK = /[\\/]tasks[\\/]([A-Za-z0-9_-]+)[.]output/;

    /* A command line split as Windows programs split it (CommandLineToArgvW's rules). */
    function windowsArgs(line) {
        var args = [], arg = "", quoted = false, any = false;
        for (var i = 0; i < line.length; i++) {
            var c = line[i];
            if (c === "\\") {
                var n = 0;
                while (line[i] === "\\") { n++; i++; }
                if (line[i] === '"') {
                    arg += "\\".repeat(n >> 1);
                    if (n % 2) arg += '"';
                    else { quoted = !quoted; any = true; }
                } else { arg += "\\".repeat(n); i--; }
            } else if (c === '"') { quoted = !quoted; any = true; }
            else if (!quoted && (c === " " || c === "\t")) {
                if (arg || any) args.push(arg);
                arg = ""; any = false;
            } else arg += c;
        }
        if (arg || any) args.push(arg);
        return args;
    }

    /* The single-quoted text from `from` (just past its opening quote), with '\'' read as '. */
    function quoted(text, from) {
        var out = "";
        for (var i = from; i < text.length;) {
            var end = text.indexOf("'", i);
            if (end < 0) return null;
            out += text.slice(i, end);
            if (!text.startsWith("'\\''", end)) return out;
            out += "'";
            i = end + 4;
        }
        return null;
    }

    function bashCommand(cmd) {
        var args = windowsArgs(cmd), c = args.indexOf("-c"), script = c >= 0 ? args[c + 1] : null;
        var at = script ? script.indexOf(EVAL) : -1;
        return at >= 0 ? quoted(script, at + EVAL.length) : null;
    }

    /* { command } for a Bash call's shell, { powershell } for a PowerShell call's, and its { task } when the line names one. */
    function call(cmd) {
        var out = {};
        if (typeof cmd !== "string") return out;
        var command = cmd.indexOf(EVAL) >= 0 ? bashCommand(cmd) : null, task = TASK.exec(cmd);
        if (command !== null) out.command = command;
        if (cmd.indexOf(POWERSHELL) >= 0) out.powershell = true;
        if (task) out.task = task[1];
        return out;
    }

    return { call: call };
})();
