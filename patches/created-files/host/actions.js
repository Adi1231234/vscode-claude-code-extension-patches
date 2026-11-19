/* What the dialog's buttons do, through the editor's own APIs (revealFileInOS,
   the clipboard, a trash delete), so nothing is shelled out and neither editor is
   branched on. The caller passes only paths it has just read from the ledger. */
globalThis.__ccCFActions = globalThis.__ccCFActions || (function () {
    function vscode() { try { return require("vscode"); } catch (e) { return null; } }

    function reveal(p) {
        var v = vscode();
        if (v) Promise.resolve(v.commands.executeCommand("revealFileInOS", v.Uri.file(p))).catch(function () {});
    }

    function copy(paths) {
        var v = vscode();
        return v ? Promise.resolve(v.env.clipboard.writeText(paths.join("\n"))) : Promise.resolve();
    }

    /* One at a time, and resolves to how many could not be moved. */
    async function trash(paths) {
        var v = vscode(), failed = 0;
        if (!v) return paths.length;
        for (var p of paths) {
            try { await v.workspace.fs.delete(v.Uri.file(p), { useTrash: true }); }
            catch (e) { failed++; }
        }
        return failed;
    }

    return { reveal: reveal, copy: copy, trash: trash };
})();
