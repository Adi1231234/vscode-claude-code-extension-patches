# session-status

The panel header's "Learn Claude Code" button (the graduation cap) is replaced by
a power button that shows whether the Claude process behind this chat is alive:

- green: running
- amber: starting (launched, the CLI has not said it is ready yet)
- red: stopped, with or without an error

Clicking it opens a confirm dialog, "Stop Claude?" or "Start Claude?", in the
shared dialog chrome (`lib/js/ccModal.js`). While the process is down, the red
error banner it left ("Claude Code process exited with code 1. stderr: ...")
is not drawn; the dialog shows that error instead, the stderr in a scrolling box
and the app's own "View output logs".

## How the state is read

From the session store's own signals, no polling:

- `claudeChannelIdSignal` is set when a process is launched and cleared by
  `resetPerProcessState()` when its stream ends (a stop, a crash, a restart).
- `readyChannelIdSignal` is set on the CLI's `system`/`init` frame, or on a
  status frame carrying `launchTiming` / `connectSnapshot`. Measured in the lab:
  it arrives on panel open with no prompt sent.

No channel is stopped; ready equal to the channel is running; anything else is
starting. 2.1.294 (the version the perf check pins) keeps the ready channel in a
plain field (`readyChannelId`) that cannot be subscribed to; there a launched
process reads as running at once, so the button has green and red and no amber. The header component already calls the app's `useSignals`, so reading
`.value` in the button re-renders the header on every change. The dialog
follows the same signals with `.subscribe()` while it is open and drops them on
close.

## Stop and start

- Stop is `interrupt()` then `endProcess()`, the same two steps as the app's
  own `teardownProcess(true)`. `interrupt()` first so a running reply is ended
  the normal way, and the queue's stop hook (`prompt-queue/queue/stop-pause.js`)
  parks the queue instead of sending its next item into a new process.
  `endProcess()` returns false when nothing was launched; that is logged.
- Start is `launchClaude()`, which resumes the same session id. It is what the
  app runs on panel open and before a message when no process is up, so sending a
  message after a stop works too.

The action button takes no click for 600 ms after the question turns around
(a process ended or started with the dialog open), so a click aimed at "Stop"
never lands on "Start".

## Which banners stay

The guard runs at the top of the banner component, after it has worked out what
the error offers, and only hides it when the process is down and the error is
only about that. Kept:

- a conversation that failed to load (`onRetryLoad`, "Retry")
- a resume that failed (`not_found` / `load_failed`, "Start new conversation")
- a startup the CLI refused for a reason it named (`startupFailureReason`: an
  organisation setting refused or not reachable). The app words these as advice
  with "Sign in again" or "Retry". Only a CLI result frame carrying
  `startup_failure_reason` sets it (the host's `lastStartupFailureReason`),
  never a crash, and 2.1.294 has no such prop at all.
- any panel in the app's full-editor mode (`window.IS_FULL_EDITOR`), whose
  header draws none of these buttons, so its error still has somewhere to show

Reading the store with `.peek()` there is enough: a dying process sets the error
and clears the channel in the same update, and a launch clears the error.

## Anchors

- the Learn button's whole expression, from
  `<gate>(<ctx>.isOnboardingEnabled.value)&&...ariaLabel:"Learn Claude Code"` to
  the sibling `<sessions>.activeSession.value&&` after it. Its onboarding and
  milestone popups render nothing without the button's ref, exactly as with
  onboarding turned off.
- the banner's `function <x>({error:<e>,...}){let <resume>=<f>(<e>)...;` right
  before its `return <h>("div",{className:<m>.errorBanner,`. 2.1.332 has a
  second value in that `let` and 2.1.294 none; the anchor takes either.

Both are found before anything is written; either missing writes nothing.

The empty chat's "Learn Claude Code" checklist card is a different component,
with its own X to dismiss it, and is left alone.

## Measured (lab, 2.1.332)

- header: power, Bookmarks, Restart Claude, Files this chat created, Session
  history, New session; no "Learn Claude Code"
- Stop: the glyph went red, no `claude.exe` left under the editor
- Start: a new `claude.exe`, the glyph went green
- killing `claude.exe` from outside while idle: no banner, red glyph, the
  dialog showed "Stopped with an error", the error's first sentence and 2,046
  characters of stderr scrolled to the end
- killing it from outside mid-turn, with a Bash command running: the same, the
  tool row marked failed by the app. In the store the error and the cleared
  channel are written in one synchronous run (`catch` then `finally` of the
  stream reader), so no render ever sees the error with the process still up
- `apply.ps1` on 2.1.294 (the perf check's version) and on 2.1.332: `[ok]`, and
  `perf.mjs` within budget
