/* agent-tree: the app's own class names for the conversation list, filled in
   by patch.ps1 from the bundle's CSS-module map (lib/CssModules.ps1). The
   agent view wears them, so an agent's conversation is drawn on the very
   surface the main one is: its background (which the app picks by where the
   panel is open, and panel-background evens out), its 20px gutters, its
   scrolling and its sticky prompts. */
(function (A) {
    var C = {
        list: "{{messagesContainer}}",
        sticky: "{{stickyMode}}",
        fullEditor: "{{fullEditor}}"
    };

    /* The classes the app puts on the main conversation's list, with the
       editor-tab variant exactly when the app uses it. */
    A.listClasses = function (sticky) {
        return [C.list, sticky ? C.sticky : "", window.IS_FULL_EDITOR ? C.fullEditor : ""]
            .filter(Boolean).join(" ");
    };
})(window.__ccAT = window.__ccAT || {});
