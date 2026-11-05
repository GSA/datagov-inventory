/*
 * Mock interactions for the datagov-inventory alpha mockups.
 * Nothing here is real functionality: no data is read, stored or sent.
 * It only shows and hides prepared markup so the screens can be clicked through.
 *
 * Conventions used in the HTML:
 *   ?state=<name>               the page's active state (several allowed: ?state=a,b)
 *   data-state="a b"            element is shown only when one of these states is active
 *   data-state-default          element is shown only when no state is given
 *   data-open-on-state="x"      on a modal opener (hidden or visible): click it when state x is active
 *   data-open-panel="id"        on a modal opener: show that panel of the modal when it opens
 *   data-show="id" / data-hide="id"   buttons that reveal / hide an element (by id)
 *   data-swap="panel-id"        inside a modal: show that panel, hide its siblings, focus its heading
 *   data-fake-save              inputs: changing them flips the save status to Saving… then Saved
 *   data-toggle-errors          button: show / hide the prepared [data-error] messages on the page
 *   data-fake-progress="id"     button: animate the <progress> inside #id, then go to data-then (URL)
 *   data-repeat                 multi-value rows: Move up / Move down / Remove / Add another
 */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var states = (params.get("state") || "").split(",").filter(Boolean);
  var announcer = document.getElementById("mock-status");

  function announce(msg) {
    if (!announcer) return;
    announcer.textContent = "";
    window.setTimeout(function () { announcer.textContent = msg; }, 50);
  }

  function now() {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  /* ---------- 1. ?state= toggling ---------- */
  function applyStates() {
    // visible when one of its states is active; elements marked data-state-default are also visible with no state
    document.querySelectorAll("[data-state], [data-state-default]").forEach(function (el) {
      var wanted = (el.getAttribute("data-state") || "").split(/\s+/).filter(Boolean);
      var match = wanted.some(function (s) { return states.indexOf(s) !== -1; });
      el.hidden = !(match || (el.hasAttribute("data-state-default") && states.length === 0));
    });
    // highlight the current state in the mockup state switcher
    document.querySelectorAll(".mock-states a").forEach(function (a) {
      var s = new URL(a.href).searchParams.get("state") || "";
      if ((s === "" && states.length === 0) || states.indexOf(s) !== -1) {
        a.setAttribute("aria-current", "true");
      }
    });
  }
  applyStates();

  /* ---------- 2. show / hide helpers ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-show],[data-hide]");
    if (!btn) return;
    (btn.getAttribute("data-hide") || "").split(/\s+/).filter(Boolean).forEach(function (id) {
      var el = document.getElementById(id); if (el) el.hidden = true;
    });
    (btn.getAttribute("data-show") || "").split(/\s+/).filter(Boolean).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = false;
      var msg = el.getAttribute("data-announce");
      if (msg) announce(msg);
      var focusTarget = el.querySelector("[data-autofocus]") || (el.hasAttribute("tabindex") ? el : null);
      if (focusTarget) focusTarget.focus();
    });
    if (btn.tagName === "A" && btn.getAttribute("href") === "#") e.preventDefault();
  });

  /* ---------- 3. single-level dialog: swap panels, never stack (#25) ---------- */
  function swapTo(id) {
    var panel = document.getElementById(id);
    if (!panel) return;
    Array.prototype.forEach.call(panel.parentElement.children, function (sib) {
      if (sib.classList.contains("mock-panel")) sib.hidden = sib !== panel;
    });
    var heading = panel.querySelector("h2, h3");
    if (heading) { heading.setAttribute("tabindex", "-1"); window.setTimeout(function () { heading.focus(); }, 30); }
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-swap]");
    if (btn) { e.preventDefault(); swapTo(btn.getAttribute("data-swap")); return; }
    var opener = e.target.closest("[data-open-modal][data-open-panel]");
    if (opener) swapTo(opener.getAttribute("data-open-panel"));
  });

  /* ---------- 4. open a modal when the page is loaded with its ?state= ---------- */
  window.addEventListener("load", function () {
    document.querySelectorAll("[data-open-on-state]").forEach(function (opener) {
      var wanted = opener.getAttribute("data-open-on-state").split(/\s+/);
      if (!wanted.some(function (s) { return states.indexOf(s) !== -1; })) return;
      opener.click();
    });
  });

  /* ---------- 5. fake autosave status ---------- */
  var saveTimer;
  function setSave(text, cls) {
    document.querySelectorAll("[data-save-status]").forEach(function (el) {
      el.querySelector("[data-save-text]").textContent = text;
      el.className = el.className.replace(/save-status--\w+/g, "") + " save-status--" + cls;
    });
  }
  document.addEventListener("input", function (e) {
    if (!e.target.closest("[data-fake-save]")) return;
    setSave("Saving…", "saving");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      setSave("Saved in this browser at " + now(), "saved");
      announce("Saved");
    }, 900);
    // live-update the tree label and heading when a title field changes (#24)
    if (e.target.hasAttribute("data-title-field")) {
      var v = e.target.value || "Untitled";
      document.querySelectorAll("[data-live-title]").forEach(function (el) { el.textContent = v; });
    }
  });

  /* ---------- 6. toggle prepared validation errors (#27) ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-toggle-errors]");
    if (!btn) return;
    var on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    setErrors(on);
    announce(on ? btn.getAttribute("data-on-msg") || "Advisory check finished." : "Problems hidden.");
  });
  function setErrors(on) {
    document.querySelectorAll("[data-error]").forEach(function (msg) {
      msg.hidden = !on;
      var group = msg.closest(".usa-form-group");
      if (group) group.classList.toggle("usa-form-group--error", on);
      var input = group && group.querySelector(".usa-input, .usa-select, .usa-textarea");
      if (input) {
        input.classList.toggle("usa-input--error", on);
        if (on) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
      }
      var label = group && group.querySelector(".usa-label");
      if (label) label.classList.toggle("usa-label--error", on);
    });
    document.querySelectorAll("[data-error-summary]").forEach(function (el) { el.hidden = !on; });
    // open the optional-fields accordion if it holds an error
    if (on) {
      document.querySelectorAll(".usa-accordion__content [data-error]").forEach(function (msg) {
        var content = msg.closest(".usa-accordion__content");
        var b = document.querySelector('[aria-controls="' + content.id + '"]');
        if (b && b.getAttribute("aria-expanded") === "false") b.click();
      });
    }
  }
  if (states.indexOf("errors") !== -1) window.addEventListener("load", function () { setErrors(true); });

  /* ---------- 7. fake progress ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-fake-progress]");
    if (!btn) return;
    e.preventDefault();
    var box = document.getElementById(btn.getAttribute("data-fake-progress"));
    if (!box) return;
    box.hidden = false;
    var bar = box.querySelector("progress");
    var text = box.querySelector("[data-progress-text]");
    var tpl = text ? text.getAttribute("data-progress-text") : "";
    var then = btn.getAttribute("data-then");
    var v = 0;
    var t = window.setInterval(function () {
      v = Math.min(100, v + 9);
      bar.value = v;
      if (text) text.textContent = tpl.replace("{n}", v);
      if (v >= 100) {
        window.clearInterval(t);
        if (then) window.location.href = then;
        else { var done = btn.getAttribute("data-done"); if (done) { box.hidden = true; document.getElementById(done).hidden = false; announce(document.getElementById(done).textContent.trim().slice(0, 140)); } }
      }
    }, 140);
  });

  /* ---------- 8. multi-value rows (#24) ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-row-action]");
    if (!btn) return;
    var list = btn.closest("[data-repeat]");
    var row = btn.closest("li");
    var action = btn.getAttribute("data-row-action");
    var label = list.getAttribute("data-item-label") || "Item";
    if (action === "up" && row.previousElementSibling) list.querySelector("ol").insertBefore(row, row.previousElementSibling);
    if (action === "down" && row.nextElementSibling) list.querySelector("ol").insertBefore(row.nextElementSibling, row);
    if (action === "remove") { row.remove(); announce(label + " removed."); }
    if (action === "add") {
      var ol = list.querySelector("ol");
      var tpl = list.querySelector("template");
      var clone = tpl.content.firstElementChild.cloneNode(true);
      var n = ol.children.length + 1;
      clone.querySelectorAll("[id]").forEach(function (el) { el.id = el.id + "-" + n + "-" + Date.now(); });
      clone.querySelectorAll("label[for]").forEach(function (el) { el.htmlFor = clone.querySelector("input").id; });
      ol.appendChild(clone);
      clone.querySelector("input").focus();
      announce(label + " " + n + " added.");
      return;
    }
    renumber(list, label);
    if (action === "up" || action === "down") {
      btn.focus();
      var pos = Array.prototype.indexOf.call(row.parentElement.children, row) + 1;
      announce("Moved to position " + pos + " of " + row.parentElement.children.length + ".");
    }
  });
  function renumber(list, label) {
    list.querySelectorAll("ol > li").forEach(function (li, i) {
      var l = li.querySelector(".usa-label");
      if (l) l.textContent = label + " " + (i + 1);
    });
  }

  /* ---------- 9. select "Other" reveals a free-text input (frequency) ---------- */
  document.addEventListener("change", function (e) {
    var sel = e.target.closest("[data-other-reveal]");
    if (!sel) return;
    var box = document.getElementById(sel.getAttribute("data-other-reveal"));
    box.hidden = sel.value !== "other";
    if (!box.hidden) box.querySelector("input").focus();
  });

  /* ---------- 10. tree: WAI-ARIA APG treeview keyboard model (#23, #30) ---------- */
  document.querySelectorAll('[role="tree"]').forEach(initTree);

  function initTree(tree) {
    function visibleItems() {
      return Array.prototype.filter.call(tree.querySelectorAll('[role="treeitem"]'), function (it) {
        if (it.closest("[hidden]")) return false;
        var p = it.parentElement.closest('[role="group"]');
        while (p) {
          var owner = p.parentElement.closest('[role="treeitem"]');
          if (owner && owner.getAttribute("aria-expanded") === "false") return false;
          p = owner ? owner.parentElement.closest('[role="group"]') : null;
        }
        return true;
      });
    }
    function focusItem(it) {
      tree.querySelectorAll('[role="treeitem"]').forEach(function (x) { x.tabIndex = -1; });
      it.tabIndex = 0;
      it.focus();
    }
    function toggle(it, open) {
      if (!it.hasAttribute("aria-expanded")) return;
      it.setAttribute("aria-expanded", String(open));
    }
    // initial roving tabindex: the selected item, or the first
    var items = tree.querySelectorAll('[role="treeitem"]');
    items.forEach(function (x) { x.tabIndex = -1; });
    var sel = tree.querySelector('[aria-selected="true"]') || items[0];
    if (sel) sel.tabIndex = 0;

    tree.addEventListener("click", function (e) {
      var tw = e.target.closest(".tree__twisty");
      if (tw) {
        e.preventDefault(); e.stopPropagation();
        var it = tw.closest('[role="treeitem"]');
        toggle(it, it.getAttribute("aria-expanded") !== "true");
        focusItem(it);
      }
    });

    tree.addEventListener("keydown", function (e) {
      var it = e.target.closest('[role="treeitem"]');
      if (!it) return;
      var vis = visibleItems();
      var i = vis.indexOf(it);
      var expanded = it.getAttribute("aria-expanded");
      switch (e.key) {
        case "ArrowDown": if (vis[i + 1]) focusItem(vis[i + 1]); break;
        case "ArrowUp": if (vis[i - 1]) focusItem(vis[i - 1]); break;
        case "Home": focusItem(vis[0]); break;
        case "End": focusItem(vis[vis.length - 1]); break;
        case "ArrowRight":
          if (expanded === "false") toggle(it, true);
          else if (expanded === "true" && vis[i + 1]) focusItem(vis[i + 1]);
          break;
        case "ArrowLeft":
          if (expanded === "true") toggle(it, false);
          else {
            var parent = it.parentElement.closest('[role="group"]');
            parent = parent && parent.parentElement.closest('[role="treeitem"]');
            if (parent) focusItem(parent);
          }
          break;
        case "Enter":
        case " ":
          var link = it.querySelector(":scope > .tree__row a, :scope > a");
          if (link) { link.click(); }
          else if (it.hasAttribute("data-load-more")) { loadMore(it); }
          else if (expanded) toggle(it, expanded !== "true");
          break;
        default:
          if (e.key.length === 1 && /\S/.test(e.key)) {
            var ch = e.key.toLowerCase();
            for (var k = 1; k <= vis.length; k++) {
              var cand = vis[(i + k) % vis.length];
              if ((cand.getAttribute("data-label") || cand.textContent).trim().toLowerCase().indexOf(ch) === 0) { focusItem(cand); break; }
            }
            return;
          }
          return;
      }
      e.preventDefault();
    });

    // "Show 50 more" treeitem (mock): reveal a hidden batch, focus its first item
    tree.addEventListener("click", function (e) {
      var more = e.target.closest("[data-load-more]");
      if (more) { e.preventDefault(); loadMore(more); }
    });
    function loadMore(more) {
      var batch = tree.querySelectorAll('[data-batch="' + more.getAttribute("data-load-more") + '"]');
      if (!batch.length) { announce("Mockup: only one extra batch is drawn."); return; }
      batch.forEach(function (x) { x.hidden = false; });
      var first = batch[0];
      more.hidden = true;
      if (first) focusItem(first);
      announce("Showing 50 more datasets.");
    }

    // return focus to the selected treeitem after a page load from the tree (?focus=tree)
    if (params.get("focus") === "tree" && sel) {
      window.addEventListener("load", function () { focusItem(sel); });
    }
  }

  /* ---------- 11. tree view switch + filter ---------- */
  document.querySelectorAll("[data-view-switch] button").forEach(function (b) {
    b.addEventListener("click", function () {
      var group = b.closest("[data-view-switch]");
      group.querySelectorAll("button").forEach(function (x) {
        var on = x === b;
        x.setAttribute("aria-pressed", String(on));
        x.classList.toggle("usa-button--outline", !on);
        document.getElementById(x.getAttribute("data-view")).hidden = !on;
      });
      announce(b.textContent.trim() + " view.");
    });
  });

  document.querySelectorAll("[data-tree-filter]").forEach(function (input) {
    var out = document.getElementById(input.getAttribute("aria-describedby").split(" ").pop());
    var timer;
    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        var q = input.value.trim().toLowerCase();
        var trees = document.querySelectorAll('[role="tree"]');
        var count = 0;
        trees.forEach(function (tree) {
          if (tree.closest("[hidden]")) return;
          tree.querySelectorAll('[role="treeitem"]').forEach(function (it) {
            var label = (it.getAttribute("data-label") || "").toLowerCase();
            if (!q) { it.classList.remove("tree--filtered-out"); return; }
            var hit = label && label.indexOf(q) !== -1;
            var childHit = Array.prototype.some.call(it.querySelectorAll('[role="treeitem"]'), function (c) {
              return (c.getAttribute("data-label") || "").toLowerCase().indexOf(q) !== -1;
            });
            it.classList.toggle("tree--filtered-out", !(hit || childHit));
            if (childHit && it.hasAttribute("aria-expanded")) it.setAttribute("aria-expanded", "true");
            if (hit) count++;
          });
        });
        var empty = document.getElementById("tree-filter-empty");
        if (empty) empty.hidden = !q || count > 0;
        out.textContent = q ? count + (count === 1 ? " object matches" : " objects match") + " “" + input.value.trim() + "”" : "";
      }, 250);
    });
  });

  /* ---------- 12. narrow screens: tree disclosure ---------- */
  document.querySelectorAll("[data-tree-disclosure]").forEach(function (b) {
    b.addEventListener("click", function () {
      var panel = document.getElementById(b.getAttribute("aria-controls"));
      var open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      panel.classList.toggle("is-open", open);
    });
  });

  /* ---------- 13. mock "download": confirmation only, no file is produced ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-fake-download]");
    if (!btn) return;
    e.preventDefault();
    var done = document.getElementById(btn.getAttribute("data-fake-download"));
    if (done) { done.hidden = false; done.focus(); announce(done.textContent.trim().slice(0, 160)); }
  });

  /* ---------- 14. simple in-page table filter (class list) ---------- */
  document.querySelectorAll("[data-table-filter]").forEach(function (input) {
    var table = document.getElementById(input.getAttribute("data-table-filter"));
    var out = document.getElementById(input.getAttribute("data-count"));
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var n = 0;
      table.querySelectorAll("tbody tr").forEach(function (tr) {
        var hit = !q || tr.textContent.toLowerCase().indexOf(q) !== -1;
        tr.hidden = !hit; if (hit) n++;
      });
      if (out) out.textContent = q ? n + " of the rows on this page match." : "";
    });
  });

  /* ---------- 15. leave-page warning is real-app only; noted, not mocked ---------- */
})();
