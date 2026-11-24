/* agent-tree: a yes/no preference kept in the panel's localStorage. Every
   Claude panel of a window shares that storage, so a choice made in one is
   what the next panel opens with. Storage that cannot be read or written
   (blocked, full) falls back to the default and the choice lasts this panel. */
(function (A) {
    function read(key, fallback) {
        try {
            var v = window.localStorage.getItem(key);
            return v === null ? fallback : v === "1";
        } catch (e) {
            return fallback;
        }
    }

    A.usePref = function (K, key, fallback) {
        var state = K.useState(function () { return read(key, fallback); });
        return [state[0], function (value) {
            state[1](value);
            try { window.localStorage.setItem(key, value ? "1" : "0"); } catch (e) { /* this panel only */ }
        }];
    };
})(window.__ccAT = window.__ccAT || {});
