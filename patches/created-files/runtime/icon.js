/* The header glyph: a sheet with a folded corner and two content lines, drawn on
   the same 20x20 box and 1px line weight as its neighbours in the panel header
   (Session history, New session), so it reads as one of the app's own icons
   rather than something bolted on. currentColor, so it inherits the button's
   colour and hover like the others. No backslash anywhere (see ccModal's note). */
window.__ccCFIcon = window.__ccCFIcon || function () {
    return [
        "<svg width='20' height='20' viewBox='0 0 20 20' fill='none' aria-hidden='true' style='display:block'>",
        "<path d='M6 3.5 H11.5 L14.5 6.5 V15.5 A1 1 0 0 1 13.5 16.5 H6 A1 1 0 0 1 5 15.5 V4.5 A1 1 0 0 1 6 3.5 Z'",
        " stroke='currentColor' stroke-width='1.2' stroke-linejoin='round' fill='none'/>",
        "<path d='M11.5 3.5 V6 A0.5 0.5 0 0 0 12 6.5 H14.5' stroke='currentColor' stroke-width='1.2' stroke-linejoin='round' fill='none'/>",
        "<path d='M7.6 10.5 H12 M7.6 13 H12' stroke='currentColor' stroke-width='1.2' stroke-linecap='round'/>",
        "</svg>"
    ].join("");
};
