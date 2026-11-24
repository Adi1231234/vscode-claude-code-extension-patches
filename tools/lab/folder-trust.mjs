/* The lab's project folder, trusted by Claude Code the way a person's folder
   is once they have answered its trust dialog.

   Without this every lab conversation started untrusted and hung: the
   extension asks `claude workspace-trust --json` in the folder, starts the
   CLI in `untrusted-start` when it says no, and the prompt never gets a reply.
   Two facts behind it, measured 2026-11-24 on 2.1.331:
   - the CLI keys a folder's trust by the folder's git root (the `root` that
     command reports), read from `projects[<root>].hasTrustDialogAccepted` in
     `~/.claude.json`;
   - a folder with no repo of its own takes the nearest `.git` above it. On a
     machine with a stray `C:\.git` (an empty folder git itself does not
     accept) that root was `C:\`, so the entry written for the folder itself
     was never read.
   So the folder becomes its own repo, and the entry is written for it in
   every drive-letter spelling (the editor hands paths over as `c:\`, git as
   `C:/`). */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function ownRepo(proj) {
    if (!existsSync(join(proj, '.git'))) execFileSync('git', ['init', '-q', proj], { windowsHide: true });
}

export function trustEntries(proj) {
    const key = proj.split('\\').join('/');
    const out = {};
    for (const k of [key, key.charAt(0).toLowerCase() + key.slice(1), key.charAt(0).toUpperCase() + key.slice(1)]) {
        out[k] = { hasTrustDialogAccepted: true };
    }
    return out;
}
