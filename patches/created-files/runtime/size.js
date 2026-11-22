/* A size as people read it: "512 KB", "34 MB", "1.2 GB" - one decimal under 10,
   none above. The same as adi-tools' packages/created-files/size.mjs; change the
   two together. */
window.__ccCFSize = window.__ccCFSize || (function () {
    var UNITS = ["B", "KB", "MB", "GB", "TB"];
    return function (bytes) {
        var n = Math.max(0, bytes || 0), unit = 0;
        while (n >= 1024 && unit < UNITS.length - 1) { n /= 1024; unit++; }
        return (unit > 0 && n < 10 ? Number(n.toFixed(1)) : Math.round(n)) + " " + UNITS[unit];
    };
})();
