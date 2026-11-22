/* The dialog's small glyphs, on the 20x20 box and 1.3px line of the panel's own
   icons; currentColor, so they follow the button's colour and hover. */
window.__ccCFGlyphs = window.__ccCFGlyphs || (function () {
    function svg(size, body) {
        return "<svg width='" + size + "' height='" + size + "' viewBox='0 0 20 20' fill='none' aria-hidden='true'>" + body + "</svg>";
    }
    var line = " stroke='currentColor' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'";
    var folder = svg(15, "<path d='M3 7 A1 1 0 0 1 4 6 H8 L9.5 7.5 H16 A1 1 0 0 1 17 8.5 V15 A1 1 0 0 1 16 16 H4 A1 1 0 0 1 3 15 Z'" + line + "/>");
    return {
        chevron: svg(12, "<path d='M8 5 L13 10 L8 15'" + line + "/>"),
        folder: folder,
        file: svg(15, "<path d='M6 3.5 H11.5 L14.5 6.5 V15.5 A1 1 0 0 1 13.5 16.5 H6 A1 1 0 0 1 5 15.5 V4.5 A1 1 0 0 1 6 3.5 Z'" + line + "/>" +
            "<path d='M11.5 3.5 V6.5 H14.5'" + line + "/>"),
        copy: svg(15, "<rect x='7' y='7' width='9' height='9' rx='1.5'" + line + "/><path d='M13 7 V5 A1 1 0 0 0 12 4 H5 A1 1 0 0 0 4 5 V12 A1 1 0 0 0 5 13 H7'" + line + "/>"),
        check: svg(15, "<path d='M5 10.5 L8.5 14 L15 6.5'" + line + "/>"),
        reveal: folder,   // the folder it opens
        trash: svg(15, "<path d='M5 6 H15 M8 6 V4.5 H12 V6 M6.5 6 V15.5 A1 1 0 0 0 7.5 16.5 H12.5 A1 1 0 0 0 13.5 15.5 V6 M9 9 V13.5 M11 9 V13.5'" + line + "/>")
    };
})();
