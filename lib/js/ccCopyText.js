  /* ---------- Shared clipboard helper (lib/js/ccCopyText.js) ----------
     window.__ccCopyText(text) -> Promise. Defined once, then reused by every
     injected webview script that copies something; pulled into a patch's
     fragment list with Get-LibJsPath (see lib/Patch.ps1).
     clipboard.writeText is granted in the webview, but it rejects when the
     document is not focused - hence the execCommand fallback. The promise
     rejects when both refuse, so a caller says "copied" only for a real copy. */
  if (!window.__ccCopyText) {
    window.__ccCopyText = function (text) {
      function legacy() {
        var ta = document.createElement("textarea"), ok = false;
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { ok = document.execCommand("copy"); } finally { document.body.removeChild(ta); }
        return ok ? Promise.resolve() : Promise.reject(new Error("the clipboard refused the copy"));
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(legacy);
      }
      return legacy();
    };
  }
