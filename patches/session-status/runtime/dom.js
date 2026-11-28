/* The two element makers the dialog and its error block share. (S.button is
   the header's button, runtime/button.js.) */
(function (S) {
    S.el = function (tag, cls, text) {
        var x = document.createElement(tag);
        if (cls) x.className = cls;
        if (text) x.textContent = text;
        return x;
    };

    S.makeButton = function (cls, text) {
        var b = S.el("button", cls, text);
        b.type = "button";
        return b;
    };
})(window.__ccStatus);
