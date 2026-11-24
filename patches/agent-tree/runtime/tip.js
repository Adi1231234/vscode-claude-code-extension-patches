/* agent-tree: the sidebar's tooltip - one box for the whole sidebar, opened
   to the right of whatever the pointer (or the keyboard focus) is on. It is
   drawn to the app's only hover tooltip, the composer's microphone hint
   (.micTooltip: menu background and border, 6px corners, its soft shadow, a
   .1s fade after .4s), and it replaces the browser's own title tooltip.
   It sits in the chat's row (position: relative there), outside the sidebar,
   so the sidebar's own scrolling never clips it. Content is a function, read
   while it shows, so a running agent's line keeps up. */
(function (A) {
    var DELAY = 400;
    var api = { set: null, timer: 0, shown: false, hidden: 0, el: null };
    /* One stable ref function, so it runs only when the box mounts or goes. */
    var ref = function (node) { api.el = node; };

    /* Rects are viewport pixels; the tip's style is in the body's, which the
       panel's zoom makes differ (lib/js/ccPlace.js). */
    function place(anchor, tip) {
        var box = tip && tip.offsetParent;
        if (!box) return null;
        var a = anchor.getBoundingClientRect(), b = box.getBoundingClientRect(), css = window.__ccPlace.css;
        var left = css(a.right - b.left) + 8;
        return { left: left, top: css(a.top - b.top + a.height / 2), max: Math.min(320, Math.max(160, css(b.width) - left - 8)) };
    }

    /* Moving from one item to the next shows the next at once, as menus and
       toolbars do; only the first hover waits. */
    var GRACE = 300;

    function open(anchor, content) {
        clearTimeout(api.timer);
        var show = function () {
            if (!anchor.isConnected || !api.set) return;
            api.shown = true;
            api.set({ anchor: anchor, content: content });
        };
        if (api.shown || Date.now() - api.hidden < GRACE) show(); else api.timer = setTimeout(show, DELAY);
    }

    function close() {
        clearTimeout(api.timer);
        if (api.shown) api.hidden = Date.now();
        api.shown = false;
        if (api.set) api.set(null);
    }

    /* Props to merge onto a control: content is () => the tooltip's children.
       A press closes it, so it never sits over what the press opened. */
    A.tipFor = function (props, content) {
        return Object.assign(props, {
            onMouseEnter: function (e) { open(e.currentTarget, content); },
            onMouseLeave: close,
            onFocus: function (e) { open(e.currentTarget, content); },
            onBlur: close,
            onMouseDown: close
        });
    };

    A.Tip = function (p) {
        var K = p.K, h = K.h;
        K.track();
        var state = K.useState(null), at = state[0];
        api.set = state[1];
        var pos = at && place(at.anchor, api.el);
        return h("div", {
            className: "cc-at-tip" + (at ? " cc-at-tip-on" : ""),
            "data-cc": "",
            "aria-hidden": "true",
            ref: ref,
            style: pos ? { left: pos.left + "px", top: pos.top + "px", maxWidth: pos.max + "px" } : undefined,
            children: at ? at.content() : null
        });
    };
})(window.__ccAT = window.__ccAT || {});
