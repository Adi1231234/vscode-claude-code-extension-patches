/* ---------- Shared popup menu (lib/js/ccMenu.js) ----------
   window.__ccMenu: one popup menu at a time, in the app's own command-menu style
   (lib/css/ccMenu.css), driven the way the WAI-ARIA menu pattern says a menu is:
   it opens with the focus on its first item, the arrows and Home / End move,
   Enter or a click picks, and Escape, Tab or a click outside close it and hand
   the focus back to what opened it. Body-mounted and position:fixed, so a list
   that scrolls does not clip it.

   show(anchor, entries) opens it under the anchor; toggle() closes it instead when
   it is already open for that anchor (a menu button). entries are
   { label, hint, title, danger, onPick } items, { head, title } section headers
   and { separator: true }. A dialog that hears every key first (lib/js/ccModal.js)
   passes keys on with onKey: function (ev) { return __ccMenu.takeKey(ev); }. */
window.__ccMenu = window.__ccMenu || (function () {
    var open = null;   // the menu shown now: { anchor, close }

    function el(tag, cls, text) {
        var x = document.createElement(tag);
        x.className = cls;
        if (text != null) x.textContent = text;
        return x;
    }

    function items(box) { return Array.prototype.slice.call(box.querySelectorAll("[role=menuitem]")); }

    function move(box, to) {
        var all = items(box), at = all.indexOf(document.activeElement);
        var next = to === "first" ? 0 : to === "last" ? all.length - 1 : (at + to + all.length) % all.length;
        if (all[next]) all[next].focus();
    }

    /* The panel may be zoomed (patches/zoom): rects then come at 1/zoom of the
       viewport, so the viewport is measured the same way. Reads first, then writes. */
    function place(box, anchor) {
        var r = anchor.getBoundingClientRect(), z = parseFloat(getComputedStyle(document.body).zoom) || 1;
        var vw = window.innerWidth / z, vh = window.innerHeight / z, w = box.offsetWidth, h = box.offsetHeight, m = 6;
        var left = Math.max(m, Math.min(r.left, vw - m - w));
        var top = r.bottom + 2 + h <= vh - m ? r.bottom + 2 : Math.max(m, r.top - 2 - h);
        box.style.left = left + "px";
        box.style.top = top + "px";
    }

    function entry(e, close) {
        if (e.separator) {
            var s = el("div", "cc-menu-sep");
            s.setAttribute("role", "separator");
            return s;
        }
        if (e.head != null) {
            var h = el("div", "cc-menu-head", e.head);
            if (e.title) h.title = e.title;
            return h;
        }
        var b = el("button", "cc-menu-item" + (e.danger ? " cc-menu-danger" : ""));
        b.type = "button";
        b.tabIndex = -1;
        b.setAttribute("role", "menuitem");
        b.appendChild(el("span", "cc-menu-label", e.label));
        if (e.hint) b.appendChild(el("span", "cc-menu-hint", e.hint));
        if (e.title) b.title = e.title;
        b.onclick = function (ev) { ev.stopPropagation(); close(true); e.onPick(); };
        return b;
    }

    function hide(refocus) { if (open) open.close(refocus); }

    function show(anchor, entries) {
        hide(false);
        var box = el("div", "cc-menu"), me = { anchor: anchor };
        box.setAttribute("role", "menu");
        function outside(ev) { if (!box.contains(ev.target) && !anchor.contains(ev.target)) close(false); }
        function gone() { close(false); }
        function close(refocus) {
            if (open !== me) return;
            open = null;
            box.remove();
            document.removeEventListener("mousedown", outside, true);
            window.removeEventListener("resize", gone);
            window.removeEventListener("scroll", gone, true);
            // Focus first: an anchor shown only while its menu is open or its row holds the focus would be hidden by then.
            if (refocus && anchor.isConnected) anchor.focus();
            if (anchor.getAttribute("aria-haspopup")) anchor.setAttribute("aria-expanded", "false");
        }
        me.close = close;
        entries.forEach(function (e) { box.appendChild(entry(e, close)); });
        box.onkeydown = function (ev) {
            var to = { ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" }[ev.key];
            if (to !== undefined) { ev.preventDefault(); move(box, to); }
            else if (ev.key === "Escape" || ev.key === "Tab") { ev.preventDefault(); close(true); }
        };
        if (window.__ccDom) window.__ccDom.own(box);   // ours: wakes no observer
        document.body.appendChild(box);
        place(box, anchor);
        if (anchor.getAttribute("aria-haspopup")) anchor.setAttribute("aria-expanded", "true");
        document.addEventListener("mousedown", outside, true);
        window.addEventListener("resize", gone);
        window.addEventListener("scroll", gone, true);   // capture: a scrolling list moves the anchor away
        open = me;
        move(box, "first");
    }

    return {
        show: show,
        toggle: function (anchor, entries) { if (open && open.anchor === anchor) hide(true); else show(anchor, entries); },
        hide: hide,
        /* For a dialog's onKey: Escape or Tab while a menu is open closes the menu only. */
        takeKey: function (ev) {
            if (!open || (ev.key !== "Escape" && ev.key !== "Tab")) return false;
            ev.preventDefault();
            ev.stopPropagation();
            hide(true);
            return true;
        }
    };
})();
