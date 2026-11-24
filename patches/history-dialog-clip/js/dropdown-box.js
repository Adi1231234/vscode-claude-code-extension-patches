/* HISTDLGFIX */
/* Session-history dropdown: place and size it in the coordinate system it is
   actually rendered in.

   The panel runs under a CSS zoom (patches/zoom sets document.body.style.zoom),
   and CSS zoom splits the page into two coordinate systems. The anchor's
   getBoundingClientRect and document.documentElement.clientWidth are viewport
   pixels; the box's style, like any length in the body, is the body's own
   pixels (lib/js/ccPlace.js has the measurement). An older Chromium had it
   the other way round - rects at 1/zoom and the viewport unzoomed - which is
   what this file first corrected for.

   Upstream writes viewport values straight into the box - documentElement
   .clientWidth minus the anchor's right edge, and min(400px, 100vw - 32px) for
   the width - so at zoom 1.2 the box sat 20% too far from the corner, off its
   button. The box is position:fixed, so where it overflows it is simply
   clipped by the viewport: no ellipsis and no scrollbar, just missing leading
   characters in every row.

   So: turn the anchor and the viewport into the body's pixels first, and clamp
   the offset so the box keeps its 16px margin on both sides. The clamp also
   fixes the 6px overhang upstream has at zoom 1 (reproduced on a clean install
   of the unmodified VSIX): its 100vw - 32px width cap assumes a left-aligned
   box while the placement is right-aligned to the button. */
const ccPanelView = () => {
    const k = window.__ccPlace.scale();
    return {
      k: k,
      width: document.documentElement.clientWidth / k,
      height: document.documentElement.clientHeight / k,
    };
  },
  ccDropdownBox = (anchor, view) => {
    const rect = { left: anchor.left / view.k, right: anchor.right / view.k, bottom: anchor.bottom / view.k };
    const width = Math.min(400, view.width - 32);
    const limit = Math.max(16, view.width - width - 16);
    const box = {
      top: rect.bottom + 4 + "px",
      width: width + "px",
      maxHeight: Math.min(500, view.height / 2) + "px",
    };
    if (rect.left + rect.right < view.width) {
      box.left = Math.min(Math.max(16, rect.left), limit) + "px";
    } else {
      box.right = Math.min(Math.max(16, view.width - rect.right), limit) + "px";
    }
    return box;
  };
let __RECT__ = __REF__.current?.getBoundingClientRect(),
  __VIEW__ = ccPanelView(),
  __STYLE__ = __RECT__ ? ccDropdownBox(__RECT__, __VIEW__) : {};
