/* The glyph: a power symbol, drawn on the same 20x20 box as its neighbours in
   the header (Session history's clock is a 1px ring between r=6.5 and r=7.5
   around 10,10). Here a 1.2px stroke, the weight the created-files icon uses,
   on a ring of r=6.5 around 10,10.5 that opens 40 degrees either side of the
   top, and a stem from y=3 down to the centre. Its extent, 3.5-16.5 by 3-17,
   is the clock's within half a pixel.

   currentColor, so the colour comes from the state class on whatever holds it:
   the header button and the dialog's medallion both. No backslash anywhere
   (see lib/js/ccModal.js). */
(function (S) {
    var MARKUP = [
        "<svg width='20' height='20' viewBox='0 0 20 20' fill='none' aria-hidden='true' style='display:block'>",
        "<path d='M14.18 5.52 A6.5 6.5 0 1 1 5.82 5.52' stroke='currentColor' stroke-width='1.2' stroke-linecap='round'/>",
        "<path d='M10 3 V10' stroke='currentColor' stroke-width='1.2' stroke-linecap='round'/>",
        "</svg>"
    ].join("");

    S.glyph = function () { return MARKUP; };
})(window.__ccStatus);
