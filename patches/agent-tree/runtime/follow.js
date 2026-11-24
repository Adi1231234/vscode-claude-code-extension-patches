/* agent-tree: an agent's conversation opens at its newest row and stays there
   while the agent works, the way the main conversation does. The app pins its
   own list with `stuck = scrollHeight - scrollTop - clientHeight < 50`; the
   same rule here: scrolling up lets go, scrolling back to the end follows
   again. It reacts to the content growing (a ResizeObserver on it), never to a
   timer. Opening another agent mounts a fresh wrapper, so it starts at the
   end again. */
(function (A) {
    var NEAR = 50;
    var live = new Set();

    function attach(el) {
        var scroller = el.parentElement;
        var stuck = true;
        var detach = function () {
            ro.disconnect();
            scroller.removeEventListener("scroll", onScroll);
            live.delete(el);
        };
        var pin = function () {
            if (!el.isConnected) { detach(); return; }
            if (stuck) scroller.scrollTop = scroller.scrollHeight;
        };
        var onScroll = function () {
            if (!el.isConnected) { detach(); return; }
            stuck = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < NEAR;
        };
        var ro = new ResizeObserver(pin);
        ro.observe(el);
        scroller.addEventListener("scroll", onScroll, { passive: true });
        el.__ccDetach = detach;
        live.add(el);
        pin();
    }

    /* One stable function, so the app's renderer calls it only when the
       wrapper mounts (with it) and unmounts (with null). At unmount the
       element is still in the page, so the sweep waits one turn. */
    A.followRef = function (el) {
        if (el) {
            if (!live.has(el)) attach(el);
            return;
        }
        setTimeout(function () {
            live.forEach(function (e) { if (!e.isConnected) e.__ccDetach(); });
        }, 0);
    };
})(window.__ccAT = window.__ccAT || {});
