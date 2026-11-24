/* agent-tree: the app's own class names for the conversation, filled in by
   patch.ps1 from the bundle's CSS-module map (lib/CssModules.ps1). The agent
   view wears them, so an agent's conversation is drawn exactly as the main
   one: the chat column's type (its 1.5 line height and every rule scoped
   under it), and the list's background (which the app picks by where the
   panel is open, and panel-background evens out), 20px gutters, scrolling,
   sticky prompts and the rtl patch's message direction. Measured against the
   main conversation in a real editor before this: every row differed in line
   height, gutter and direction. */
(function (A) {
    var C = {
        column: "{{chatContainer}}",
        list: "{{messagesContainer}}",
        turn: "{{turn}}",
        sticky: "{{stickyMode}}",
        fullEditor: "{{fullEditor}}"
    };
    var editor = function () { return window.IS_FULL_EDITOR ? C.fullEditor : ""; };
    var join = function (parts) { return parts.filter(Boolean).join(" "); };

    /* The view as a whole: the chat column, on the list's surface. */
    A.columnClasses = function () {
        return join([C.column, C.list, editor()]);
    };

    /* The view's scrolling body: the main conversation's list, as the app
       draws it. */
    A.listClasses = function () {
        return join([C.list, C.sticky, editor()]);
    };

    /* A run of rows after the transcript's own, wrapped as the app wraps a
       turn (runtime/held-rows.js); inside the view's list, so the list's
       gutters are already there. */
    A.turnClasses = function () {
        return C.turn;
    };
})(window.__ccAT = window.__ccAT || {});
