/* Shared webview runtime: placing a box of ours by hand, in the panel's zoom.

   patches/zoom zooms the body (CSS zoom), and the browser then counts in two
   units. Measured 2026-11-24 in a real panel at zoom 1.2: getBoundingClientRect,
   innerWidth / innerHeight and a pointer's clientX / clientY are viewport
   pixels, while a length written into the style of anything in the body is the
   body's own pixels, 1.2 of them to a viewport pixel (the message box: rect top
   785, the same spot as a fixed top 654). Written as it was read, a rect lands
   20% further from the corner: the queue's row menu opened under the message
   box. So a position is worked out in viewport pixels and turned into the
   body's only as it is written.

     scale()               viewport pixels per body pixel, measured off the body
                           itself rather than read from its zoom style
     css(px)               a viewport length, as a length for a style in the body
     near(box, anchor, o)  a position:fixed box of the body, beside anchor: under
                           it, or over it with o.above, and on the other side when
                           it does not fit there; aligned with its left edge, or
                           centred with o.center; o.gap from the anchor and
                           o.margin (6 by default) inside the viewport, both in
                           the body's pixels as a stylesheet would say them.
                           Reads every value first, then writes.

   Injected by more than one patch; the first definition wins. */
window.__ccPlace = window.__ccPlace || (function () {
    function scale() {
        var b = document.body, w = b ? b.offsetWidth : 0;
        return w ? b.getBoundingClientRect().width / w : 1;
    }

    function css(px) {
        return px / scale();
    }

    function near(box, anchor, o) {
        o = o || {};
        var k = scale(), gap = (o.gap || 0) * k, m = (o.margin == null ? 6 : o.margin) * k;
        var r = anchor.getBoundingClientRect(), b = box.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight;
        var left = o.center ? r.left + (r.width - b.width) / 2 : r.left;
        var under = r.bottom + gap, over = r.top - gap - b.height, top;
        if (o.above) top = over >= m ? over : under;
        else top = under + b.height <= vh - m ? under : Math.max(m, over);
        left = Math.max(m, Math.min(left, vw - m - b.width));
        box.style.left = left / k + "px";
        box.style.top = top / k + "px";
    }

    return { scale: scale, css: css, near: near };
})();
