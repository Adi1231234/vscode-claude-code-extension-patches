# History dialog clipped under zoom

**Type:** bug fix
**Touches:** `webview/index.js`
**Guard marker:** `/* HISTDLGFIX */`

The session-history dropdown is cut off on the left: rows lose their leading
characters mid-word, with no ellipsis and no scrollbar, and widening the panel
far enough makes the text whole again.

## Proven root cause

CSS `zoom` splits the page into two coordinate systems, and the dropdown's
placement code reads one of each.

`patches/zoom` sets `document.body.style.zoom`. Measured in a live panel of a
fixed 642px width, sweeping zoom over 1 / 1.25 / 1.34 / 1.5 / 2:

- unchanged at 642 in all five: `window.innerWidth`,
  `document.documentElement.clientWidth`, `visualViewport.width`, computed `100vw`
- exactly `642 / zoom` in all five (642, 514, 479, 428, 321):
  `document.body.clientWidth` and every `getBoundingClientRect()`

Upstream places the box with

```js
R = document.documentElement.clientWidth            // unzoomed viewport
k = anchorButton.getBoundingClientRect()            // 1/zoom of it
right: Math.max(16, R - k.right)                    // subtracting across systems
```

and caps its width with `min(400px, 100vw - 32px)`, `100vw` being the unzoomed
viewport again. Both the offset and the width therefore come out inflated by the
zoom factor. The box is `position: fixed`, so whatever leaves the viewport is
clipped outright.

That the inline style comes from exactly this expression was confirmed by
identity: the emitted `right` equalled `documentElement.clientWidth -
anchorRect.right` to four decimals at every zoom level (36.6, 165.08, 199.575,
250.733), and at zoom 2 the branch itself flipped to `left` and the clipping
moved to the right-hand side, as mixing the units predicts.

The behaviour follows the closed form `left = 2R/z - R - g - min(400, R - 32)`
(`g` being the fixed ~37px gap from the button's right edge to the panel edge),
which matched measurements within 1px at panel widths 220, 642 and 818, and
correctly predicted the flip from fitting to clipped between zoom 1.30 and 1.31.

## Upstream's own share

On a clean install of the unmodified VSIX (verified: no patch artifacts, zoom 1)
the dialog still overhangs the left edge by exactly 6px, because the
`100vw - 32px` width cap assumes a left-aligned box while the placement is
right-aligned to the button. Real, but 6px - the tens of pixels users see come
from the zoom interaction above.

## The units changed under it (2026-11-24)

Chromium has since moved to standardized CSS zoom, and the two systems swapped
roles: measured in a real panel at zoom 1.2, `getBoundingClientRect()` and
`documentElement.clientWidth` are now both viewport pixels, while a length in
the box's style is the body's own pixels (`lib/js/ccPlace.js` has the
numbers). The first fix's scale then came out 1, and upstream's mix showed
again as a box 20% too far from the corner: at a 838px panel its top sat at
56 instead of 47 and its right edge 9px left of the button.

## The fix

Turn the anchor rect and the viewport into the body's pixels (dividing by the
measured scale, `__ccPlace.scale()`, which is 1 when there is no zoom), set the
width and max-height in those units, and clamp the offset so the box always
keeps a 16px margin on both sides. The clamp is what also removes upstream's
6px overhang.

Width and max-height are set inline rather than by overriding the stylesheet, so
the patch depends on no CSS-module hash and touches a single file.

Exposes a single `Invoke-Patch $Ctx` (dot-sourced and called by `../../apply.ps1`).
Idempotent and fail-safe: it replaces only when the anchor matches exactly once,
and skips instead of corrupting otherwise.
