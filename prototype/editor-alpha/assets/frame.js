/*
 * Page-frame helpers shared by every page of the mockup: the polite announcer, the one
 * confirmation dialog (used only for destructive actions), and "Clear my data".
 */
(function () {
  "use strict";

  var announcer = document.getElementById("announcer");
  function announce(msg) {
    if (!announcer) return;
    announcer.textContent = "";
    window.setTimeout(function () { announcer.textContent = msg; }, 60);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  // confirm({ title, html, buttons: [{ label, value, style }] }) → Promise<value | null>
  function confirmDialog(opts) {
    var dlg = document.getElementById("confirm-dialog");
    var opener = document.activeElement;
    document.getElementById("confirm-heading").textContent = opts.title;
    document.getElementById("confirm-body").innerHTML = opts.html;
    var ul = document.getElementById("confirm-buttons");
    ul.innerHTML = "";
    var buttons = opts.buttons.concat([{ label: "Cancel", value: null, style: "unstyled" }]);
    return new Promise(function (resolve) {
      function done(v) {
        dlg.close();
        if (opener && opener.focus && document.contains(opener)) opener.focus();
        resolve(v);
      }
      buttons.forEach(function (b) {
        var li = document.createElement("li");
        li.className = "usa-button-group__item";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "usa-button" + (b.style ? " usa-button--" + b.style : "") + (b.style === "unstyled" ? " padding-105 text-center" : "");
        btn.textContent = b.label;
        btn.addEventListener("click", function () { done(b.value); });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      dlg.onclose = function () { if (dlg.returnValue !== "x") resolve(null); };
      dlg.oncancel = function (e) { e.preventDefault(); done(null); };
      dlg.showModal();
      var first = ul.querySelector("button");
      // Focus the safe choice first for destructive dialogs.
      (opts.focusCancel ? ul.querySelector("li:last-child button") : first).focus();
    });
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-clear-data]")) return;
    window.Inv.readMeta().then(function (meta) {
      var what = meta ? "your working copy of <em>" + esc(meta.title) + "</em>" : "anything the editor stored";
      return confirmDialog({
        title: "Clear your data from this browser?",
        html: "<p>This deletes " + what + " from this browser on this device. It is not backed up anywhere, so you cannot get it back. Export the catalog first if you want to keep it.</p>",
        buttons: (meta ? [{ label: "Export first", value: "export", style: "outline" }] : []).concat([{ label: "Clear my data", value: "clear", style: "secondary" }]),
        focusCancel: true
      });
    }).then(function (v) {
      if (v === "export") window.location.href = "editor.html#/export";
      if (v === "clear") window.Inv.clear().then(function () { window.location.href = "index.html?cleared=1"; });
    });
  });

  window.Frame = { announce: announce, confirm: confirmDialog, esc: esc };
})();
