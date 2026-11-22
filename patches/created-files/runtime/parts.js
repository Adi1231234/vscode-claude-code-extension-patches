/* The dialog's building blocks - an element, a text button, a row's glyph button -
   so the rows (rows.js), a folder's copy button (copyLevels.js) and the dialog
   (dialog.js) make their controls one way. */
window.__ccCFParts = window.__ccCFParts || (function () {
    function el(tag, cls, text) {
        var x = document.createElement(tag);
        if (cls) x.className = cls;
        if (text != null) x.textContent = text;
        return x;
    }

    function button(cls, text) {
        var b = el("button", cls, text);
        b.type = "button";
        return b;
    }

    /* A borderless glyph button on a row; a click on it is not a click on the row. */
    function iconButton(cls, label, svg, onClick) {
        var b = button("cc-cf-act " + cls);
        b.title = label;
        b.setAttribute("aria-label", label);
        b.innerHTML = svg;
        b.onclick = function (ev) { ev.stopPropagation(); onClick(); };
        return b;
    }

    return { el: el, button: button, iconButton: iconButton };
})();
