/*
 * The editor: one page that switches views by hash route (huddle 2026-11-06).
 *
 *   #/                                     the catalog form
 *   #/dataset/ds5                          an object, reached through the catalog
 *   #/dataset/ds5/distribution/dist7/…     the path to an object; each id must link to the next
 *   #/contact/k12                          any object by id; the editor finds its place in the tree
 *   #/type/contact?page=2&q=help           the "By type" list for a class
 *   #/check                                advisory check results
 *   #/export                               export
 *   …?field=modified                       open the object and move to one field
 *
 * One form is open at a time. "Create new" in a class-valued field creates the object, links
 * it, and replaces the form with the new object's form; "Back to …" returns to the parent.
 * Every edit is applied at once and saved after a 500 ms pause. Nothing is ever blocked.
 */
(function () {
  "use strict";

  var I = window.Inv, F = window.Frame, esc = F.esc, INFO = I.INFO;
  var SPRITE = "vendor/uswds/img/sprite.svg#";
  function icon(name, cls) { return '<svg class="usa-icon' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false" role="img"><use href="' + SPRITE + name + '"></use></svg>'; }
  function $(id) { return document.getElementById(id); }
  function plural(n, one, many) { return n.toLocaleString() + " " + (n === 1 ? one : (many || one + "s")); }
  function lc(cls) { return INFO[cls].label.toLowerCase(); }

  var view = $("view");
  var route = null;          // the current parsed route
  var flash = [];            // one-shot alerts shown at the top of the next view
  var justCreated = null;    // id of the object created by the last "Create new"
  var firstRender = true;
  var viewMode = localStorage.getItem("inv-mock-view") === "type" ? "type" : "structure";

  /* =====================================================================
   * Boot
   * ===================================================================== */
  I.load().then(function (w) {
    if (!w) { noCatalog(); return; }
    var loaded = sessionStorage.getItem("inv-mock-loaded");
    if (loaded) {
      sessionStorage.removeItem("inv-mock-loaded");
      var s = I.summary(), c = I.counts();
      var others = Object.keys(I.w.objs).length - (c.Dataset || 0) - 1;
      flash.push(alertHtml("success", "Loaded " + esc(I.titleOf(I.get(I.w.root))),
        plural(c.Dataset || 0, "dataset") + " and " + plural(others, "other object") + ". " +
        (s.problems ? "The advisory check found " + plural(s.problems, "problem") + " in " + plural(s.objects, "object") + ". They are marked in the tree; nothing is blocked." : "The advisory check found no problems.") +
        (loaded === "url" ? " <em>Mockup: no request was made; the sample catalog stands in for the file at that address.</em>" : "")));
    }
    setViewMode(viewMode, true);
    window.addEventListener("hashchange", onRoute);
    onRoute();
  }).catch(function (e) {
    view.innerHTML = alertHtml("error", "This browser is not letting the editor read its storage", "It may be a private window, or site data may be blocked. (" + esc(e && e.message) + ")");
  });

  function noCatalog() {
    $("editor-layout").classList.add("editor-layout--empty");
    $("catalog-tree").hidden = true;
    document.querySelector(".editor-toolbar .usa-button-group").hidden = true;
    $("wc-title").textContent = "none";
    $("save-status").hidden = true;
    view.innerHTML = '<h2 id="view-heading" tabindex="-1">No catalog is open</h2><p>There is no working copy in this browser. Open a file, paste JSON, or start from scratch.</p><p><a class="usa-button" href="index.html">Open or start a catalog</a></p>';
    document.title = "No catalog open | Data.gov Inventory editor (alpha) mockup";
  }

  /* =====================================================================
   * Routing
   * ===================================================================== */
  function hashFor(ids, field) {
    return "#/" + ids.map(function (id) { return INFO[I.get(id).cls].slug + "/" + id; }).join("/") + (field ? "?field=" + encodeURIComponent(field) : "");
  }
  function parse() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    var q = {};
    var qi = h.indexOf("?");
    if (qi !== -1) { new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { q[k] = v; }); h = h.slice(0, qi); }
    var seg = h.split("/").filter(Boolean);
    if (!seg.length) return { kind: "object", ids: [], q: q };
    if (seg[0] === "check" || seg[0] === "export") return { kind: seg[0], q: q };
    if (seg[0] === "type") return { kind: "type", cls: I.SLUG[seg[1]] || "Dataset", q: q };
    if (seg.length % 2) return { kind: "notfound", q: q };
    var ids = [];
    for (var i = 1; i < seg.length; i += 2) ids.push(seg[i]);
    return { kind: "object", ids: ids, q: q };
  }

  function onRoute() {
    flushSave();
    var r = parse();
    if (r.kind === "object" && r.ids.length) {
      var last = r.ids[r.ids.length - 1];
      if (!r.ids.every(I.get)) { r = { kind: "notfound", q: r.q, missing: last }; }
      else {
        var ok = true, prev = I.w.root;
        r.ids.forEach(function (id) { if (ok && !I.isLinked(prev, id)) ok = false; prev = id; });
        if (!ok) {
          // Not a chain of links (an old link, or an id typed by hand): open the object where it lives.
          var home = I.homePath(last);
          if (home) { history.replaceState(null, "", hashFor(home, r.q.field)); r.ids = home; }
          else { r.ids = [last]; r.unlinked = true; }
        }
      }
    }
    route = r;
    render();
  }

  function render() {
    var r = route;
    var html = flash.join("");
    flash = [];
    var title, focusSel = "#view-heading", announceMsg;
    if (r.kind === "object") {
      var obj = I.get(r.ids.length ? r.ids[r.ids.length - 1] : I.w.root);
      html += objectView(obj, r);
      title = I.titleOf(obj) + " (" + INFO[obj.cls].label + ")";
      announceMsg = "Opened " + lc(obj.cls) + ": " + I.titleOf(obj) + ".";
      if (r.q.field) focusSel = '[data-field="' + r.q.field + '"] input, [data-field="' + r.q.field + '"] textarea, [data-field="' + r.q.field + '"] select, [data-field="' + r.q.field + '"] .link-combo__input, [data-field="' + r.q.field + '"] button';
    } else if (r.kind === "type") {
      html += typeView(r.cls, r.q);
      title = INFO[r.cls].plural;
      announceMsg = INFO[r.cls].plural + " list.";
    } else if (r.kind === "check") {
      html += checkView();
      title = "Check results";
      announceMsg = "Advisory check results.";
    } else if (r.kind === "export") {
      html += exportView();
      title = "Export";
      announceMsg = "Export.";
    } else {
      html += '<h2 id="view-heading" tabindex="-1">This object is not in your catalog</h2><p>It may have been deleted, or the link is from another working copy.</p><p><a class="usa-button" href="#/">Go to the catalog</a></p>';
      title = "Not found";
      announceMsg = "Object not found.";
    }
    view.innerHTML = html;
    afterRender();
    // Accessibility on route change (huddle): page title, focus to the new heading, announce.
    document.title = title + " | Data.gov Inventory editor (alpha) mockup";
    if (!firstRender || r.q.field) {
      var target = view.querySelector(focusSel) || $("view-heading");
      if (target) { target.focus({ preventScroll: false }); if (target.id === "view-heading") window.scrollTo({ top: Math.max(0, $("editor-layout").offsetTop - 8) }); }
      F.announce(announceMsg);
    }
    firstRender = false;
    renderNav();
    updateChrome();
  }

  /* =====================================================================
   * Object form view
   * ===================================================================== */
  function crumbs(ids) {
    var root = I.get(I.w.root);
    var items = [{ label: I.titleOf(root), href: "#/" }];
    if (route.unlinked) items.push({ label: "Not linked anywhere", href: "#/type/" + INFO[I.get(ids[0]).cls].slug });
    ids.forEach(function (id, i) { items.push({ label: I.titleOf(I.get(id)), type: INFO[I.get(id).cls].label, href: route.unlinked ? null : hashFor(ids.slice(0, i + 1)) }); });
    return '<nav class="usa-breadcrumb padding-top-0" aria-label="Where you are"><ol class="usa-breadcrumb__list">' + items.map(function (it, i) {
      var last = i === items.length - 1;
      var label = (it.type ? '<span class="crumb-type">' + esc(it.type) + ":</span> " : "") + esc(it.label);
      return '<li class="usa-breadcrumb__list-item"' + (last ? ' aria-current="page"' : "") + ">" + (last || !it.href ? "<span>" + label + "</span>" : '<a class="usa-breadcrumb__link" href="' + it.href + '"><span>' + label + "</span></a>") + "</li>";
    }).join("") + "</ol></nav>";
  }

  function objectView(o, r) {
    var ids = r.ids;
    var parentIds = ids.slice(0, -1);
    var parent = ids.length ? I.get(parentIds.length ? parentIds[parentIds.length - 1] : I.w.root) : null;
    var parentHash = parentIds.length ? hashFor(parentIds) : "#/";
    var html = crumbs(ids);

    if (parent && !r.unlinked) {
      var via = I.isLinked(parent.id, o.id);
      var p = I.prop(parent.cls, via);
      html += '<div class="linked-to" id="linked-to">' +
        '<p class="margin-0">' + icon("link") + " Linked to " + esc(INFO[parent.cls].label) + " “" + esc(I.titleOf(parent)) + "” › " + esc(p ? p.label : via) + "</p>" +
        '<a class="usa-button usa-button--outline usa-button--small" href="' + parentHash + '" data-back>' + icon("arrow_back") + " Back to " + esc(I.titleOf(parent)) + "</a></div>";
      if (justCreated === o.id) {
        html += alertHtml("info", null, "New " + lc(o.cls) + ". It is already linked and listed in the tree. Everything else is blank; it saves as you type, and you can leave it and come back later.", true);
      }
    } else if (r.unlinked) {
      html += alertHtml("info", null, "This " + lc(o.cls) + " is not linked anywhere yet. To use it, pick it with “Add an existing " + lc(o.cls) + "” in a field of another object.", true);
    }

    var probs = I.problemsOf(o.id);
    var users = I.usedBy(o.id);
    html += '<div class="object-header"><span class="usa-tag bg-base-dark">' + esc(INFO[o.cls].label) + "</span> " +
      '<span id="obj-status">' + statusTag(o) + "</span>" +
      '<h2 id="view-heading" tabindex="-1" data-live-title>' + esc(I.titleOf(o)) + "</h2>";
    if (o.id !== I.w.root) {
      html += '<p class="margin-y-05 text-base-dark">' + (users.length ? usedInDetails(users) : "Not linked anywhere.") + "</p>";
      if (users.length > 1 && parent && !r.unlinked) html += '<p class="margin-y-05 text-base-dark">To change it only for ' + esc(I.titleOf(parent)) + ', go back and choose “Edit a copy for this one” in its field.</p>';
      html += '<button type="button" class="usa-button usa-button--outline usa-button--small delete-btn margin-top-1" data-delete="' + o.id + '">' + icon("delete") + " Delete this " + esc(lc(o.cls)) + "</button>";
    }
    html += "</div>";
    html += formHtml(o);
    if (parent && !r.unlinked) {
      html += '<p class="margin-top-4"><a class="usa-button usa-button--outline" href="' + parentHash + '" data-back>' + icon("arrow_back") + " Back to " + esc(I.titleOf(parent)) + "</a></p>";
    }
    return html;
  }

  function statusTag(o) {
    var n = I.problemsOf(o.id).length;
    if (n) return '<span class="usa-tag bg-secondary-dark">' + icon("warning", "tag-icon") + plural(n, "problem") + "</span>";
    if (!I.hasAnyValue(o)) return '<span class="usa-tag bg-base-lighter text-ink">Nothing filled in yet</span>';
    return "";
  }

  function usedInDetails(users) {
    var list = users.map(function (u) {
      var from = I.get(u.from);
      var hp = I.homePath(u.from);
      var p = I.prop(from.cls, u.prop);
      var label = esc(INFO[from.cls].label) + " “" + esc(I.titleOf(from)) + "” › " + esc(p ? p.label : u.prop);
      return "<li>" + (hp ? '<a class="usa-link" href="' + hashFor(hp) + '">' + label + "</a>" : label) + "</li>";
    });
    if (users.length === 1) return "Used in 1 place: " + list[0].replace(/^<li>|<\/li>$/g, "");
    return '<details class="used-in"><summary>Used in ' + users.length + " places. Changes apply to all of them.</summary><ul>" + list.slice(0, 50).join("") + (users.length > 50 ? "<li>… and " + (users.length - 50) + " more</li>" : "") + "</ul></details>";
  }

  /* ---------- the generated form ---------- */
  function formHtml(o) {
    var props = I.propsOf(o.cls);
    var req = props.filter(function (p) { return p.lvl === "req"; });
    var rec = props.filter(function (p) { return p.lvl === "rec"; });
    var opt = props.filter(function (p) { return p.lvl === "opt"; });
    var optFilled = opt.filter(function (p) { return !I.isEmpty(o.data[p.n]) || o.raw[p.n] !== undefined || fieldProblems(o, p.n).length; });
    var optEmpty = opt.filter(function (p) { return optFilled.indexOf(p) === -1; });
    var h = '<form class="usa-form object-form" data-obj="' + o.id + '" onsubmit="return false" novalidate>';
    h += '<p class="usa-hint">Changes save as you type. ' + (req.length ? "Fields marked “(required)” are required by DCAT-US 3.0." : "DCAT-US 3.0 requires none of these fields for a " + esc(lc(o.cls)) + ".") + "</p>";
    function section(key, title, note, list) {
      if (!list.length) return "";
      return '<section class="form-section" aria-labelledby="sec-' + key + '"><h3 id="sec-' + key + '">' + title + ' <span class="level-note">' + note + "</span></h3>" + list.map(function (p) { return fieldHtml(o, p); }).join("") + "</section>";
    }
    h += section("req", "Required", "", req);
    h += section("rec", "Recommended", "Not required, but strongly advised.", rec);
    h += section("opt", "Optional", "Filled in.", optFilled);
    if (optEmpty.length) {
      h += '<div class="usa-accordion usa-accordion--bordered margin-top-3"><h3 class="usa-accordion__heading"><button type="button" class="usa-accordion__button" aria-expanded="false" aria-controls="more-optional">More optional fields (' + optEmpty.length + ")</button></h3>" +
        '<div id="more-optional" class="usa-accordion__content" hidden>' + optEmpty.map(function (p) { return fieldHtml(o, p); }).join("") + "</div></div>";
    }
    var extra = Object.keys(o.extra || {});
    if (extra.length) {
      h += '<section class="form-section" aria-labelledby="sec-extra"><h3 id="sec-extra">Other properties <span class="level-note">Not in DCAT-US 3.0. Shown read only and kept on export.</span></h3><dl class="extra-list">' +
        extra.map(function (k) { return "<dt>" + esc(k) + "</dt><dd><code>" + esc(JSON.stringify(o.extra[k]).slice(0, 300)) + "</code></dd>"; }).join("") + "</dl></section>";
    }
    return h + "</form>";
  }

  function fieldProblems(o, name) { return (I.problemsOf(o.id).concat(I.blanksOf(o.id))).filter(function (p) { return p.prop === name; }); }
  function levelText(p) { return p.lvl === "req" ? ' <span class="field-level">(required)</span>' : ""; }
  function hintHtml(o, p, extra) {
    var t = esc(p.help);
    if (p.kind === "date") t += " Use YYYY, YYYY-MM, YYYY-MM-DD, or a date and time.";
    if (p.kind === "iri") t += " A full web address.";
    if (extra) t += " " + extra;
    return '<div class="usa-hint" id="h-' + p.n + '">' + t + "</div>";
  }
  // Messages under a field. A required field that is simply not filled in yet gets a neutral
  // note in the form (the tree and the check still count it); wrong values get a red message.
  function msgHtml(o, p) {
    var ps = fieldProblems(o, p.n);
    var red = ps.filter(function (x) { return !x.blank && !/is required\.$|It is required\.$/.test(x.msg); });
    var neutral = ps.filter(function (x) { return red.indexOf(x) === -1; });
    return '<span class="usa-error-message" id="e-' + p.n + '"' + (red.length ? "" : " hidden") + ">" + red.map(function (x) { return esc(x.msg); }).join(" ") + "</span>" +
      '<span class="field-note" id="n-' + p.n + '"' + (neutral.length ? "" : " hidden") + ">" + neutral.map(function (x) { return esc(/required/.test(x.msg) ? "Not filled in yet." : x.msg); }).join(" ") + "</span>";
  }
  function hasRed(o, p) { return fieldProblems(o, p.n).some(function (x) { return !x.blank && !/is required\.$|It is required\.$/.test(x.msg); }); }

  function fieldHtml(o, p) {
    if (p.kind === "link") return linkFieldHtml(o, p);
    var v = o.data[p.n];
    var err = hasRed(o, p);
    var describedby = 'aria-describedby="h-' + p.n + " e-" + p.n + " n-" + p.n + '"';
    var groupCls = "usa-form-group margin-top-3" + (err ? " usa-form-group--error" : "");
    if (v !== undefined && typeof v === "object" && !Array.isArray(v) || (Array.isArray(v) && v.some(function (x) { return x && typeof x === "object"; }))) {
      // A detailed Concept/Identifier object from the file: kept as is, shown read only.
      return '<div class="' + groupCls + '" data-field="' + p.n + '"><span class="usa-label">' + esc(p.label) + levelText(p) + "</span>" + hintHtml(o, p) +
        '<p class="readonly-value"><code>' + esc(JSON.stringify(v).slice(0, 400)) + "</code></p><p class=\"usa-hint\">Detailed value from the file, kept as is.</p></div>";
    }
    if (p.multi) {
      var vals = Array.isArray(v) ? v : (I.isEmpty(v) ? [] : [v]);
      if (!vals.length) vals = [""];
      var item = p.label.replace(/\/.*$/, "");
      return '<fieldset class="usa-fieldset ' + groupCls + '" data-field="' + p.n + '" data-multi><legend class="usa-legend text-bold">' + esc(p.label) + levelText(p) + "</legend>" + hintHtml(o, p) + msgHtml(o, p) +
        '<ol class="repeat-list">' + vals.map(function (x, i) { return repeatRow(p, item, x, i); }).join("") + "</ol>" +
        '<button type="button" class="usa-button usa-button--unstyled" data-add-row="' + p.n + '">' + icon("add") + " Add another " + esc(item.toLowerCase()) + "</button></fieldset>";
    }
    var input;
    var cls = "usa-input" + (err ? " usa-input--error" : "");
    var aria = describedby + (err ? ' aria-invalid="true"' : "");
    if (p.kind === "textarea" || p.kind === "json") {
      input = '<textarea class="usa-textarea' + (err ? " usa-input--error" : "") + '" id="f-' + p.n + '" data-prop="' + p.n + '" rows="' + (p.kind === "json" ? 3 : 4) + '" ' + aria + ">" + esc(typeof v === "string" ? v : (v === undefined ? "" : JSON.stringify(v))) + "</textarea>";
    } else if (p.kind === "enum") {
      var inList = !v || p.groups.some(function (g) { return g[1].indexOf(v) !== -1; });
      var isOther = v && !inList && /^R\/P/.test(v);
      input = '<select class="usa-select' + (err ? " usa-input--error" : "") + '" id="f-' + p.n + '" data-prop="' + p.n + '" data-enum ' + aria + '><option value="">- Select -</option>' +
        (!inList && !isOther ? '<option value="' + esc(v) + '" selected>' + esc(v) + " (not in the list)</option>" : "") +
        p.groups.map(function (g) { return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (x) { return '<option value="' + esc(x) + '"' + (x === v && inList ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</optgroup>"; }).join("") +
        '<option value="__other"' + (isOther ? " selected" : "") + ">Other repeating period (R/P…)</option></select>" +
        '<div class="margin-top-1" id="other-' + p.n + '"' + (isOther ? "" : " hidden") + '><label class="usa-label" for="fo-' + p.n + '">Repeating period</label><div class="usa-hint">For example R/P2W for every two weeks, or R/PT1H for every hour.</div><input class="usa-input usa-input--md" id="fo-' + p.n + '" data-prop="' + p.n + '" data-enum-other value="' + esc(isOther ? v : "") + '"></div>';
    } else {
      input = '<input class="' + cls + (p.kind === "date" ? " usa-input--md" : "") + '" type="text" id="f-' + p.n + '" data-prop="' + p.n + '" value="' + esc(v === undefined ? "" : v) + '" ' + aria + (p.kind === "iri" ? ' inputmode="url"' : "") + ">";
    }
    return '<div class="' + groupCls + '" data-field="' + p.n + '"><label class="usa-label' + (err ? " usa-label--error" : "") + '" for="f-' + p.n + '">' + esc(p.label) + levelText(p) + "</label>" + hintHtml(o, p) + msgHtml(o, p) + input + "</div>";
  }
  var rowSeq = 0;
  function repeatRow(p, item, x, i) {
    var id = "f-" + p.n + "-" + (++rowSeq);
    return '<li><div><label class="usa-label" for="' + id + '">' + esc(item) + " " + (i + 1) + '</label><input class="usa-input" type="text" id="' + id + '" data-prop="' + p.n + '" data-row value="' + esc(x) + '" aria-describedby="h-' + p.n + " e-" + p.n + '"></div>' +
      '<span class="row-actions"><button type="button" class="usa-button usa-button--unstyled" data-move-row="up">Move up<span class="usa-sr-only"> ' + esc(item) + " " + (i + 1) + '</span></button><button type="button" class="usa-button usa-button--unstyled" data-move-row="down">Move down<span class="usa-sr-only"> ' + esc(item) + " " + (i + 1) + '</span></button>' +
      '<button type="button" class="usa-button usa-button--unstyled text-secondary-dark" data-remove-row>Remove<span class="usa-sr-only"> ' + esc(item) + " " + (i + 1) + "</span></button></span></li>";
  }

  /* ---------- class-valued fields: linked rows + inline pick/create, never a dialog ---------- */
  function linkFieldHtml(o, p) {
    var ids = I.linkIds(o, p);
    var mode = I.linkMode(o.cls, p);
    var classes = p.classes;
    var names = classes.map(lc);
    var h = '<fieldset class="usa-fieldset usa-form-group margin-top-3' + (hasRed(o, p) ? " usa-form-group--error" : "") + '" data-field="' + p.n + '" data-link-field>' +
      '<legend class="usa-legend text-bold">' + esc(p.label) + levelText(p) + "</legend>" +
      hintHtml(o, p, '<span class="display-block holds">Holds: ' + classes.map(function (c) { return INFO[c].label; }).join(" or ") + (p.multi ? " (one or more)" : " (one)") + ".</span>") + msgHtml(o, p);
    if (o.raw[p.n] !== undefined) h += '<p class="readonly-value"><code>' + esc(JSON.stringify(o.raw[p.n]).slice(0, 300)) + "</code></p>";
    var here = route.ids;
    var LIMIT = 25, total = ids.length;
    if (total > LIMIT) ids = ids.slice(0, LIMIT);
    if (ids.length) {
      h += '<ul class="linked-list">' + ids.map(function (tid) {
        var t = I.get(tid);
        var n = I.problemsOf(tid).length;
        var uses = I.usedBy(tid).length;
        var href = hashFor(here.concat([tid]));
        return '<li class="linked-obj' + (n ? " linked-obj--problem" : "") + '"><div><a class="linked-obj__title" href="' + href + '">' + esc(I.titleOf(t)) + '</a> <span class="usa-tag bg-base-dark">' + esc(INFO[t.cls].label) + "</span></div>" +
          '<div class="linked-obj__meta">' + esc(metaOf(t)) + (uses > 1 ? " · Used in " + uses + " places" : "") + (n ? ' · <span class="text-secondary-dark text-bold">' + icon("warning", "inline-icon") + plural(n, "problem") + "</span>" : (I.hasAnyValue(t) ? "" : " · Nothing filled in yet")) + "</div>" +
          '<div class="linked-obj__actions"><a class="usa-link" href="' + href + '">Edit<span class="usa-sr-only"> ' + esc(I.titleOf(t)) + "</span></a>" +
          (uses > 1 ? '<button type="button" class="usa-button usa-button--unstyled" data-copy="' + p.n + '" data-target="' + tid + '">Edit a copy for this one<span class="usa-sr-only">: ' + esc(I.titleOf(t)) + "</span></button>" : "") +
          '<button type="button" class="usa-button usa-button--unstyled" data-unlink="' + p.n + '" data-target="' + tid + '">Remove from this field<span class="usa-sr-only">: ' + esc(I.titleOf(t)) + "</span></button></div></li>";
      }).join("") + "</ul>";
      if (total > LIMIT) h += '<p class="margin-top-05">Showing the first ' + LIMIT + " of " + total.toLocaleString() + '. <a class="usa-link" href="#/type/' + INFO[classes[0]].slug + '">See all ' + total.toLocaleString() + " " + esc(INFO[classes[0]].plural.toLowerCase()) + "</a> or use the tree filter.</p>";
    } else if (p.lvl !== "req") {
      h += '<p class="usa-hint margin-y-05">None yet.</p>';
    }
    if (!p.multi && ids.length) {
      h += '<p class="usa-hint">Holds one ' + esc(names.join(" or ")) + ". To use a different one, remove this one first.</p>";
      return h + "</fieldset>";
    }
    h += '<div class="link-add">';
    if (mode !== "create") {
      var pool = 0;
      classes.forEach(function (c) { pool += I.objectsOf(c).length; });
      h += '<div class="link-combo"><label class="usa-label" for="cb-' + p.n + '">Add an existing ' + esc(names.join(" or ")) + "</label>" +
        '<div class="link-combo__box"><input class="usa-input link-combo__input" type="text" id="cb-' + p.n + '" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="cbl-' + p.n + '" autocomplete="off" data-combo="' + p.n + '" placeholder="' + (pool ? "Type to search " + plural(pool, names.length > 1 ? "object" : names[0], names.length > 1 ? "objects" : INFO[classes[0]].plural.toLowerCase()) : "None in this catalog yet") + '">' +
        '<span class="link-combo__caret">' + icon("expand_more") + "</span>" +
        '<ul class="link-combo__list" id="cbl-' + p.n + '" role="listbox" aria-label="Matching ' + esc(names.join(" or ")) + '" hidden></ul></div></div>';
    }
    if (mode !== "select") {
      h += '<div class="link-create">' + (mode === "both" ? '<span class="link-add__or">or</span>' : "") + classes.map(function (c) {
        return '<button type="button" class="usa-button usa-button--outline" data-create="' + p.n + '" data-cls="' + c + '">' + icon("add") + " Create new " + esc(lc(c)) + "</button>";
      }).join("") + "</div>";
    }
    if (mode === "select") h += '<p class="usa-hint link-add__note">' + esc(INFO[classes[0]].plural) + " belong to the catalog, so pick one that is already in it. Create new ones from the catalog or the By type view.</p>";
    return h + "</div></fieldset>";
  }
  function metaOf(t) {
    var d = t.data;
    switch (t.cls) {
      case "Kind": return d.hasEmail || "No email";
      case "Distribution": return [d.format, d.mediaType].filter(Boolean).join(" · ") || "No format";
      case "Dataset": return d.identifier ? "Identifier " + d.identifier : "No identifier";
      case "Organization": return "Organization";
      default: return INFO[t.cls].label;
    }
  }

  /* =====================================================================
   * Editing: inputs, rows, links, create, delete
   * ===================================================================== */
  function currentObj() { return route && route.kind === "object" ? I.get(route.ids.length ? route.ids[route.ids.length - 1] : I.w.root) : null; }

  function readField(form, name) {
    var group = form.querySelector('[data-field="' + name + '"]');
    if (group.hasAttribute("data-multi")) {
      return Array.prototype.map.call(group.querySelectorAll("input[data-row]"), function (i) { return i.value; }).filter(function (x) { return x.trim() !== ""; });
    }
    var sel = group.querySelector("select[data-enum]");
    if (sel) return sel.value === "__other" ? group.querySelector("[data-enum-other]").value.trim() : sel.value;
    var el = group.querySelector("[data-prop]");
    return el.value;
  }

  view.addEventListener("input", function (e) {
    var el = e.target.closest("[data-prop]");
    if (!el || el.tagName === "SELECT") return;
    commit(el);
  });
  view.addEventListener("change", function (e) {
    var sel = e.target.closest("select[data-enum]");
    if (!sel) return;
    var other = $("other-" + sel.getAttribute("data-prop"));
    other.hidden = sel.value !== "__other";
    if (!other.hidden) other.querySelector("input").focus();
    commit(sel);
  });
  function commit(el) {
    var o = currentObj();
    var form = el.closest("form[data-obj]");
    if (!o || !form) return;
    var name = el.getAttribute("data-prop");
    var val = readField(form, name);
    if (typeof val === "string" && val.trim() === "") val = "";
    I.setValue(o.id, name, val);
  }

  I.onChange(function (kind, ids) {
    scheduleSave();
    var o = currentObj();
    if (kind === "value" && o && ids[0] === o.id) {
      refreshFieldMessages(o);
      var t = I.titleOf(o);
      view.querySelectorAll("[data-live-title]").forEach(function (h) { h.textContent = t; });
      var crumb = view.querySelector('.usa-breadcrumb [aria-current="page"] span');
      if (crumb) crumb.innerHTML = '<span class="crumb-type">' + esc(INFO[o.cls].label) + ":</span> " + esc(t);
      $("obj-status").innerHTML = statusTag(o);
      updateTreeLabel(o.id);
      document.title = t + " (" + INFO[o.cls].label + ") | Data.gov Inventory editor (alpha) mockup";
      if (o.id === I.w.root) $("wc-title").textContent = t;
    }
    updateChrome();
  });

  function refreshFieldMessages(o) {
    I.propsOf(o.cls).forEach(function (p) {
      var group = view.querySelector('[data-field="' + p.n + '"]');
      if (!group) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = msgHtml(o, p);
      var e = $("e-" + p.n), n = $("n-" + p.n);
      if (e) { e.hidden = tmp.firstChild.hidden; e.innerHTML = tmp.firstChild.innerHTML; }
      if (n) { n.hidden = tmp.lastChild.hidden; n.innerHTML = tmp.lastChild.innerHTML; }
      var red = hasRed(o, p);
      group.classList.toggle("usa-form-group--error", red);
      var lab = group.querySelector(":scope > .usa-label");
      if (lab) lab.classList.toggle("usa-label--error", red);
      group.querySelectorAll(":scope > .usa-input, :scope > .usa-textarea, :scope > .usa-select").forEach(function (inp) {
        inp.classList.toggle("usa-input--error", red);
        if (red) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid");
      });
    });
  }

  // Re-render the form after a structural change, keeping the scroll position and focus target.
  function rerender(focusSelector) {
    var y = window.scrollY;
    var openMore = $("more-optional") && !$("more-optional").hidden;
    var r = route;
    var obj = currentObj();
    var html = flash.join("");
    flash = [];
    view.innerHTML = html + objectView(obj, r);
    if (openMore && $("more-optional")) { $("more-optional").hidden = false; view.querySelector('[aria-controls="more-optional"]').setAttribute("aria-expanded", "true"); }
    afterRender();
    window.scrollTo(0, y);
    var f = focusSelector && view.querySelector(focusSelector);
    if (f) f.focus({ preventScroll: true });
    renderNav();
  }

  view.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-add-row]"))) {
      var group = t.closest("[data-field]");
      var p = I.prop(currentObj().cls, t.getAttribute("data-add-row"));
      var ol = group.querySelector("ol");
      var tmp = document.createElement("ol");
      tmp.innerHTML = repeatRow(p, p.label.replace(/\/.*$/, ""), "", ol.children.length);
      ol.appendChild(tmp.firstChild);
      ol.lastChild.querySelector("input").focus();
      return;
    }
    if ((t = e.target.closest("[data-move-row]"))) {
      var row = t.closest("li"), grp = t.closest("[data-field]"), up = t.getAttribute("data-move-row") === "up";
      var sib = up ? row.previousElementSibling : row.nextElementSibling;
      if (!sib) return;
      row.parentElement.insertBefore(row, up ? sib : sib.nextElementSibling);
      renumberRows(row.parentElement);
      I.setValue(currentObj().id, grp.getAttribute("data-field"), readField(grp.closest("form"), grp.getAttribute("data-field")));
      t.focus();
      F.announce("Moved to position " + (Array.prototype.indexOf.call(row.parentElement.children, row) + 1) + " of " + row.parentElement.children.length + ".");
      return;
    }
    if ((t = e.target.closest("[data-copy]"))) {
      var po = currentObj(), orig = I.get(t.getAttribute("data-target")), fld = t.getAttribute("data-copy");
      var others = I.usedBy(orig.id).length - 1;
      var copy = I.copyFor(po.id, fld, orig.id);
      flash.push(alertHtml("success", null, "Made a copy of “" + esc(I.titleOf(orig)) + "” for this " + esc(lc(po.cls)) + " only. The other " + plural(others, "place") + " still use the original. You are now editing the copy.", true));
      location.hash = hashFor(route.ids.concat([copy.id]));
      return;
    }
    if ((t = e.target.closest("[data-undo]"))) {
      if (!undoState) return;
      I.restore(undoState.snap);
      flash.push(alertHtml("success", null, "Undone: " + esc(undoState.label) + " is back.", true));
      var back = undoState.hash;
      undoState = null;
      F.announce("Undone.");
      if (location.hash === back) render(); else location.hash = back;
      return;
    }
    if ((t = e.target.closest("[data-remove-row]"))) {
      var li = t.closest("li"), g = t.closest("[data-field]");
      var list = li.parentElement;
      var next = li.nextElementSibling || li.previousElementSibling;
      li.remove();
      renumberRows(list);
      I.setValue(currentObj().id, g.getAttribute("data-field"), readField(g.closest("form"), g.getAttribute("data-field")));
      F.announce("Removed.");
      if (next) next.querySelector("input").focus(); else g.querySelector("[data-add-row]").focus();
      return;
    }
    if ((t = e.target.closest("[data-unlink]"))) {
      var o = currentObj(), target = I.get(t.getAttribute("data-target")), field = t.getAttribute("data-unlink");
      undoState = { snap: I.snapshot([o.id]), label: "the link to “" + I.titleOf(target) + "”", hash: location.hash || "#/" };
      I.removeLink(o.id, field, target.id);
      var left = I.usedBy(target.id).length;
      F.announce("Removed " + I.titleOf(target) + " from " + I.prop(o.cls, field).label + ".");
      flash.push(alertHtml("success", null, "Removed “" + esc(I.titleOf(target)) + "” from " + esc(I.prop(o.cls, field).label) + ". " +
        (left ? "It is still used in " + plural(left, "other place") + "." : "It is not linked anywhere now; it stays in the catalog under “Not linked anywhere” and in the By type view until you delete it.") + undoButton(), true));
      rerender('[data-field="' + field + '"] .link-combo__input, [data-field="' + field + '"] [data-create]');
      return;
    }
    if ((t = e.target.closest("[data-create]"))) {
      var parent = currentObj();
      var created = I.createLinked(parent.id, t.getAttribute("data-create"), t.getAttribute("data-cls"));
      justCreated = created.id;
      location.hash = hashFor(route.ids.concat([created.id]));
      return;
    }
    if ((t = e.target.closest("[data-delete]"))) { askDelete(t.getAttribute("data-delete")); return; }
    if ((t = e.target.closest("[data-download]"))) { doDownload(); return; }
    if ((t = e.target.closest("[data-type-new]"))) {
      var made = I.createUnlinked(t.getAttribute("data-type-new"));
      justCreated = made.id;
      var hp = I.homePath(made.id);
      location.hash = hp ? hashFor(hp) : "#/" + INFO[made.cls].slug + "/" + made.id;
      return;
    }
  });

  function renumberRows(list) {
    list.querySelectorAll("li").forEach(function (row, i) {
      var lab = row.querySelector(".usa-label");
      lab.textContent = lab.textContent.replace(/\d+$/, i + 1);
      row.querySelectorAll(".usa-sr-only").forEach(function (sr) { sr.textContent = sr.textContent.replace(/\d+$/, i + 1); });
    });
  }
  // Undo of the last removal only, in this session (#26).
  var undoState = null;
  function undoButton() { return ' <button type="button" class="usa-button usa-button--unstyled" data-undo>Undo</button>'; }

  function askDelete(id) {
    var o = I.get(id);
    var plan = I.deletePlan(id);
    var refs = plan.refs.map(function (u) {
      var from = I.get(u.from), p = I.prop(from.cls, u.prop);
      return "<li>" + esc(INFO[from.cls].label) + " “" + esc(I.titleOf(from)) + "” › " + esc(p ? p.label : u.prop) + "</li>";
    });
    var html = "<p>" + (refs.length ? "It is referenced in " + plural(refs.length, "place") + ". Deleting it removes it from all of them:</p><ul>" + refs.slice(0, 12).join("") + (refs.length > 12 ? "<li>… and " + (refs.length - 12) + " more</li>" : "") + "</ul>" : "It is not referenced anywhere.</p>");
    if (plan.cascade.length) {
      html += "<p>These are only used inside it, so they are deleted too:</p><ul>" + plan.cascade.slice(0, 8).map(function (k) { var x = I.get(k); return "<li>" + esc(INFO[x.cls].label) + " “" + esc(I.titleOf(x)) + "”</li>"; }).join("") + (plan.cascade.length > 8 ? "<li>… and " + (plan.cascade.length - 8) + " more</li>" : "") + "</ul>";
    }
    html += "<p>You cannot undo this. Export the catalog first if you want a copy.</p>";
    F.confirm({ title: "Delete " + lc(o.cls) + " “" + I.titleOf(o) + "”?", html: html, buttons: [{ label: "Delete " + lc(o.cls), value: "delete", style: "secondary" }], focusCancel: true }).then(function (v) {
      if (v !== "delete") return;
      var title = I.titleOf(o), cls = o.cls;
      var snap = I.snapshot([id].concat(plan.cascade, plan.refs.map(function (u) { return u.from; })));
      var n = I.deleteObject(id);
      undoState = { snap: snap, label: INFO[cls].label + " “" + title + "”", hash: location.hash || "#/" };
      flash.push(alertHtml("success", null, "Deleted " + esc(lc(cls)) + " “" + esc(title) + "”" + (refs.length ? " and removed it from " + plural(refs.length, "place") : "") + (n > 1 ? ", with " + plural(n - 1, "object") + " only used inside it" : "") + "." + undoButton(), true));
      if (route.kind === "object" && route.ids.indexOf(id) !== -1) {
        var keep = route.ids.slice(0, route.ids.indexOf(id));
        location.hash = keep.length ? hashFor(keep) : "#/";
      } else render();
    });
  }

  /* ---------- inline combobox (APG combobox with listbox popup) ---------- */
  var combo = null; // { input, list, field, items, active }
  function comboMatches(field, q) {
    var o = currentObj();
    var p = I.prop(o.cls, field);
    var taken = I.linkIds(o, p);
    var all = [];
    p.classes.forEach(function (c) { all = all.concat(I.objectsOf(c)); });
    all = all.filter(function (x) { return x.id !== o.id && taken.indexOf(x.id) === -1; });
    q = q.trim().toLowerCase();
    var hits = q ? all.filter(function (x) { return (I.titleOf(x) + " " + metaOf(x)).toLowerCase().indexOf(q) !== -1; }) : all;
    return { total: hits.length, items: I.sortObjects(hits).slice(0, 25) };
  }
  function openCombo(input) {
    var field = input.getAttribute("data-combo");
    var list = $("cbl-" + field);
    var m = comboMatches(field, input.value);
    combo = { input: input, list: list, field: field, items: m.items, active: -1 };
    list.innerHTML = m.items.map(function (x, i) {
      var uses = I.usedBy(x.id).length;
      return '<li role="option" id="cbo-' + field + "-" + i + '" class="link-combo__option" data-pick="' + x.id + '" aria-selected="false"><span class="text-bold">' + esc(I.titleOf(x)) + "</span>" +
        '<span class="link-combo__meta">' + esc(INFO[x.cls].label) + " · " + esc(metaOf(x)) + " · " + (uses ? "used in " + plural(uses, "place") : "not linked anywhere") + (I.problemsOf(x.id).length ? " · has problems" : "") + "</span></li>";
    }).join("") + (m.total > m.items.length ? '<li role="presentation" class="link-combo__more">Showing ' + m.items.length + " of " + m.total.toLocaleString() + ". Keep typing to narrow down.</li>" : "") +
      (!m.total ? '<li role="presentation" class="link-combo__more">No matches.' + (view.querySelector('[data-create="' + field + '"]') ? " Use “Create new” instead." : "") + "</li>" : "");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
    F.announce(m.total ? plural(m.total, "result") + " available. Use Up and Down to choose." : "No matches.");
  }
  function closeCombo() {
    if (!combo) return;
    combo.list.hidden = true;
    combo.input.setAttribute("aria-expanded", "false");
    combo.input.removeAttribute("aria-activedescendant");
    combo = null;
  }
  function setActive(i) {
    if (!combo || !combo.items.length) return;
    combo.active = (i + combo.items.length) % combo.items.length;
    combo.list.querySelectorAll("[role=option]").forEach(function (li, k) { li.setAttribute("aria-selected", String(k === combo.active)); li.classList.toggle("is-active", k === combo.active); });
    var li = $("cbo-" + combo.field + "-" + combo.active);
    combo.input.setAttribute("aria-activedescendant", li.id);
    li.scrollIntoView({ block: "nearest" });
  }
  function pick(id) {
    var o = currentObj(), field = combo.field;
    closeCombo();
    I.addLink(o.id, field, id);
    var t = I.get(id), n = I.usedBy(id).length;
    flash.push(alertHtml("success", null, "Added “" + esc(I.titleOf(t)) + "” to " + esc(I.prop(o.cls, field).label) + "." + (n > 1 ? " It is now used in " + n + " places." : ""), true));
    F.announce("Added " + I.titleOf(t) + ".");
    rerender('[data-field="' + field + '"] .linked-obj:last-child .linked-obj__title');
  }
  view.addEventListener("focusin", function (e) { if (e.target.matches("[data-combo]")) openCombo(e.target); });
  view.addEventListener("input", function (e) { if (e.target.matches("[data-combo]")) openCombo(e.target); });
  view.addEventListener("keydown", function (e) {
    if (!e.target.matches("[data-combo]")) return;
    if (!combo) { if (e.key === "ArrowDown") { openCombo(e.target); e.preventDefault(); } return; }
    if (e.key === "ArrowDown") { setActive(combo.active + 1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setActive(combo.active - 1); e.preventDefault(); }
    else if (e.key === "Enter") { if (combo.active >= 0) pick(combo.items[combo.active].id); e.preventDefault(); }
    else if (e.key === "Escape") { closeCombo(); e.preventDefault(); }
  });
  view.addEventListener("mousedown", function (e) {
    var li = e.target.closest("[data-pick]");
    if (li) { e.preventDefault(); pick(li.getAttribute("data-pick")); }
  });
  view.addEventListener("focusout", function (e) { if (e.target.matches("[data-combo]")) window.setTimeout(function () { if (combo && document.activeElement !== combo.input) closeCombo(); }, 150); });

  /* =====================================================================
   * Autosave: apply at once, save after a 500 ms pause (huddle)
   * ===================================================================== */
  var saveTimer = null, saving = false;
  function setStatus(state, text) {
    var s = $("save-status");
    s.className = "save-status save-status--" + state;
    s.querySelector("use").setAttribute("href", SPRITE + (state === "saving" ? "autorenew" : state === "failed" ? "error" : "check_circle"));
    $("save-text").textContent = text;
  }
  function scheduleSave() {
    if (!saving) { saving = true; setStatus("saving", "Saving…"); }
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flushSave, 500);
  }
  function flushSave() {
    window.clearTimeout(saveTimer);
    if (!I.w || !I.hasPending()) { if (saving) { saving = false; setStatus("saved", "Saved"); } return; }
    I.saveDirty().then(function (t) {
      if (saveTimer && I.hasPending()) return;
      saving = false;
      setStatus("saved", "Saved " + new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }).catch(function () {
      saving = false;
      setStatus("failed", "Not saved");
      $("page-alerts").innerHTML = alertHtml("error", "Your changes are not being saved", "This browser is not letting the editor save your work. It may be a private window, or storage may be full. Your work exists only in this tab until it is saved. <a class=\"usa-link\" href=\"#/export\">Export the catalog</a> to keep a copy.");
    });
  }
  window.addEventListener("pagehide", flushSave);
  window.addEventListener("beforeunload", flushSave);

  // Another tab saved changes to the same working copy (deep links open new tabs).
  if (I.channel) I.channel.onmessage = function (e) {
    var msg = e.data || {};
    var text = msg.type === "cleared" ? "The working copy was cleared in another tab." : "This catalog was changed in another tab.";
    $("page-alerts").innerHTML = '<div class="usa-alert usa-alert--warning usa-alert--slim" role="status"><div class="usa-alert__body"><p class="usa-alert__text">' + text +
      ' <button type="button" class="usa-button usa-button--unstyled" onclick="location.reload()">Reload this tab to see the changes</button></p></div></div>';
  };

  /* =====================================================================
   * Chrome: working-copy title, problem count, mobile disclosure
   * ===================================================================== */
  function updateChrome() {
    if (!I.w) return;
    $("wc-title").textContent = I.titleOf(I.get(I.w.root));
    var s = I.summary();
    var chip = $("problem-chip");
    chip.hidden = !s.problems;
    chip.innerHTML = icon("warning") + " " + plural(s.problems, "problem") + " in " + plural(s.objects, "object");
    $("btn-check").classList.toggle("is-current", route && route.kind === "check");
    $("btn-export").classList.toggle("is-current", route && route.kind === "export");
  }
  document.querySelector("[data-tree-disclosure]").addEventListener("click", function () {
    var open = this.getAttribute("aria-expanded") !== "true";
    this.setAttribute("aria-expanded", String(open));
    $("catalog-tree").classList.toggle("is-open", open);
  });
  function alertHtml(type, heading, text, slim) {
    return '<div class="usa-alert usa-alert--' + type + (slim || !heading ? " usa-alert--slim" : "") + ' margin-bottom-2"' + (type === "error" ? ' role="alert"' : "") + '><div class="usa-alert__body">' +
      (heading ? '<h3 class="usa-alert__heading">' + heading + "</h3>" : "") + '<p class="usa-alert__text">' + text + "</p></div></div>";
  }
  var ADVISORY = '<div class="usa-alert usa-alert--info usa-alert--slim margin-y-2"><div class="usa-alert__body"><p class="usa-alert__text">This is an advisory check, not the official Data.gov validator. It compares your catalog with the DCAT-US 3.0 schema (GSA/dcat-us, version of October 7, 2026, commit 4996591), in your browser. Passing this check does not mean Data.gov will accept your catalog.</p></div></div>';

  /* =====================================================================
   * Left pane: tree (structure) or type list
   * ===================================================================== */
  document.querySelectorAll("[data-view-mode]").forEach(function (b) {
    b.addEventListener("click", function () { setViewMode(b.getAttribute("data-view-mode")); F.announce(b.textContent + " view."); });
  });
  function setViewMode(mode, quiet) {
    viewMode = mode;
    localStorage.setItem("inv-mock-view", mode);
    document.querySelectorAll("[data-view-mode]").forEach(function (b) {
      var on = b.getAttribute("data-view-mode") === mode;
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("usa-button--outline", !on);
    });
    $("structure-pane").hidden = mode !== "structure";
    $("type-pane").hidden = mode !== "type";
    if (!quiet) renderNav();
  }
  function renderNav() {
    if (!I.w) return;
    if (viewMode === "type") renderTypeNav(); else renderTree();
  }

  function renderTypeNav() {
    var c = I.counts();
    var current = route.kind === "type" ? route.cls : (route.kind === "object" ? currentObj().cls : null);
    var types = I.TYPE_ORDER.concat(Object.keys(c).filter(function (k) { return I.TYPE_ORDER.indexOf(k) === -1 && k !== "Catalog"; }).sort());
    $("type-nav").innerHTML = types.map(function (cls) {
      var on = cls === current;
      var sub = "";
      if (on && route.kind === "object") {
        var o = currentObj();
        sub = '<ul class="usa-sidenav__sublist"><li class="usa-sidenav__item"><a href="' + location.hash + '" class="usa-current" aria-current="page">' + esc(I.titleOf(o)) + "</a></li></ul>";
      }
      return '<li class="usa-sidenav__item"><a href="#/type/' + INFO[cls].slug + '"' + (on ? ' class="usa-current"' + (route.kind === "type" ? ' aria-current="page"' : "") : "") + ">" + esc(INFO[cls].plural) + ' <span class="type-count">' + (c[cls] || 0).toLocaleString() + "</span></a>" + sub + "</li>";
    }).join("");
  }

  /* ---------- the structure tree (WAI-ARIA treeview), rendered from the model ---------- */
  var expanded = { "": 1, "g:dataset": 1 };
  var CATALOG_GROUPS = ["dataset", "datasetSeries", "service", "catalog", "hasPart", "record"];
  var MAX_GROUP = 400; // render at most this many rows per group, then "Show more"
  var groupLimit = {};
  var treeFocusKey = null;

  function childrenOf(id, pathIds) {
    var o = I.get(id), out = [];
    I.linkProps(o.cls).forEach(function (p) {
      if (id === I.w.root && CATALOG_GROUPS.indexOf(p.n) !== -1) return;
      I.linkIds(o, p).forEach(function (t) { if (pathIds.indexOf(t) === -1 && t !== I.w.root) out.push({ id: t, prop: p.n }); });
    });
    return out;
  }
  function hasChildren(id, pathIds) { return childrenOf(id, pathIds).length > 0; }

  function selectedKey() {
    if (!route || route.kind !== "object") return null;
    return route.unlinked ? "u/" + route.ids[0] : route.ids.join("/");
  }
  function expandToSelection() {
    if (!route || route.kind !== "object") return;
    if (route.unlinked) { expanded["g:unlinked"] = 1; return; }
    var ids = route.ids;
    if (ids.length) {
      var p = I.isLinked(I.w.root, ids[0]);
      if (CATALOG_GROUPS.indexOf(p) !== -1) expanded["g:" + p] = 1;
      // keep the selected row rendered even in a long group
      var list = I.linkIds(I.get(I.w.root), I.prop("Catalog", p) || { n: p });
      var pos = list.indexOf(ids[0]);
      if (pos >= (groupLimit[p] || MAX_GROUP)) groupLimit[p] = Math.ceil((pos + 1) / MAX_GROUP) * MAX_GROUP;
    }
    for (var i = 1; i < ids.length; i++) expanded[ids.slice(0, i).join("/")] = 1;
  }

  function renderTree() {
    var tree = $("tree");
    var pane = $("catalog-tree");
    var scroll = pane.scrollTop;
    var q = $("tree-filter").value.trim().toLowerCase();
    expandToSelection();
    var sel = selectedKey();
    var count = { n: 0 };
    var root = I.get(I.w.root);
    var html = item(root, [], "", 1, "", q, count, true);
    tree.innerHTML = html;
    // roving tabindex
    var items = tree.querySelectorAll('[role="treeitem"]');
    items.forEach(function (x) { x.tabIndex = -1; });
    var selEl = sel !== null ? tree.querySelector('[data-key="' + cssEsc(sel) + '"]') : null;
    var focusEl = (treeFocusKey !== null && tree.querySelector('[data-key="' + cssEsc(treeFocusKey) + '"]')) || selEl || items[0];
    if (focusEl) focusEl.tabIndex = 0;
    pane.scrollTop = scroll;
    if (treeFocusKey !== null && focusEl) { focusEl.focus(); treeFocusKey = null; }
    else if (selEl) {
      var row = selEl.querySelector(".tree__row");
      var pr = pane.getBoundingClientRect(), rr = row.getBoundingClientRect();
      if (rr.top < pr.top || rr.bottom > pr.bottom) pane.scrollTop += rr.top - pr.top - pane.clientHeight / 3;
    }
    $("tree-filter-count").textContent = q ? plural(count.n, "object matches", "objects match") + " “" + $("tree-filter").value.trim() + "”" : "";
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  function matchesDeep(id, q, pathIds, depth) {
    if (I.titleOf(I.get(id)).toLowerCase().indexOf(q) !== -1) return true;
    if (depth >= 3) return false;
    return childrenOf(id, pathIds).some(function (c) { return matchesDeep(c.id, q, pathIds.concat([c.id]), depth + 1); });
  }

  // One treeitem. key = path of ids ("" for the catalog), so the same shared object can appear
  // under several parents and each copy knows its own route.
  function item(o, pathIds, key, level, viaProp, q, count, isRoot) {
    var sel = selectedKey();
    var kids = isRoot ? null : childrenOf(o.id, pathIds);
    var expandable = isRoot || kids.length > 0;
    // While filtering, open only the items that lead to a match.
    var open = expandable && (q ? (isRoot || kids.some(function (c) { return matchesDeep(c.id, q, pathIds.concat([c.id]), 1); })) : !!expanded[key]);
    var n = I.problemsOf(o.id).length;
    var label = I.titleOf(o);
    var hit = q && label.toLowerCase().indexOf(q) !== -1;
    if (hit) count.n++;
    var p = viaProp && I.prop(I.get(pathIds.length > 1 ? pathIds[pathIds.length - 2] : I.w.root).cls, viaProp);
    var href = isRoot ? "#/" : (key.indexOf("u/") === 0 ? "#/" + INFO[o.cls].slug + "/" + o.id : hashFor(pathIds));
    var h = '<li role="treeitem" aria-level="' + level + '" data-key="' + esc(key) + '" data-oid="' + o.id + '"' + (expandable ? ' aria-expanded="' + open + '"' : "") + ' aria-selected="' + (sel === key) + '">' +
      '<div class="tree__row' + (sel === key ? " is-current" : "") + '">' + (expandable ? '<span class="tree__twisty" aria-hidden="true">' + icon("navigate_next") + "</span>" : '<span class="tree__spacer"></span>') +
      '<span class="tree__content"><a href="' + href + '" tabindex="-1" class="tree__label' + (hit ? " tree__hit" : "") + '">' + esc(label) + "</a>" +
      (!isRoot && o.cls !== "Dataset" ? ' <span class="tree__meta">' + esc(p ? p.label : INFO[o.cls].label) + "</span>" : "") +
      '<span class="tree__marker">' + markerHtml(o, n) + "</span></span></div>";
    if (open) {
      var inner = "";
      if (isRoot) inner = rootChildren(o, q, count);
      else kids.forEach(function (c) {
        var cp = pathIds.concat([c.id]);
        if (q && !matchesDeep(c.id, q, cp, 0)) return;
        inner += item(I.get(c.id), cp, cp.join("/"), level + 1, c.prop, q, count);
      });
      h += '<ul role="group">' + inner + "</ul>";
    }
    return h + "</li>";
  }
  function markerHtml(o, n) {
    if (n) return '<span class="tree__problem">' + icon("warning", "inline-icon") + n + '<span class="usa-sr-only"> ' + (n === 1 ? "problem" : "problems") + "</span></span>";
    if (!I.hasAnyValue(o)) return '<span class="tree__empty">empty</span>';
    return "";
  }
  function rootChildren(root, q, count) {
    var h = "";
    CATALOG_GROUPS.forEach(function (g) {
      var p = I.prop("Catalog", g);
      var ids = I.linkIds(root, p);
      if (!ids.length && g !== "dataset") return;
      h += groupItem("g:" + g, INFO[p.classes[0]].plural + (g === "hasPart" ? " (parts)" : ""), ids.map(function (id) { return { id: id, prop: g }; }), q, count, g);
    });
    childrenOf(root.id, []).forEach(function (c) {
      if (q && !matchesDeep(c.id, q, [c.id], 0)) return;
      h += item(I.get(c.id), [c.id], c.id, 2, c.prop, q, count);
    });
    var unlinked = Object.keys(I.w.objs).filter(function (k) { return !I.isReachable(k); });
    if (unlinked.length) h += groupItem("g:unlinked", "Not linked anywhere", I.sortObjects(unlinked.map(I.get)).map(function (o) { return { id: o.id, unlinked: true }; }), q, count, "unlinked");
    return h;
  }
  function groupItem(key, label, children, q, count, limitKey) {
    var open = !!expanded[key] || !!q;
    var inner = "";
    if (open) {
      var shown = 0, limit = q ? 200 : (groupLimit[limitKey] || MAX_GROUP), more = 0;
      children.forEach(function (c) {
        var path = c.unlinked ? [c.id] : [c.id];
        if (q && !matchesDeep(c.id, q, path, 0)) return;
        if (shown >= limit) { more++; return; }
        shown++;
        inner += item(I.get(c.id), path, c.unlinked ? "u/" + c.id : c.id, 3, c.prop, q, count);
      });
      if (more) inner += '<li role="treeitem" aria-level="3" data-key="more:' + limitKey + '" data-more="' + limitKey + '"><div class="tree__row"><span class="tree__spacer"></span><span class="tree__more">' + (q ? more.toLocaleString() + " more match. Narrow the filter to see them." : "Show " + Math.min(MAX_GROUP, more) + " more (" + more.toLocaleString() + " not shown)") + "</span></div></li>";
      if (!children.length) inner += '<li role="treeitem" aria-level="3" data-key="none:' + limitKey + '"><div class="tree__row"><span class="tree__spacer"></span><span class="tree__group-label">None yet</span></div></li>';
    }
    return '<li role="treeitem" aria-level="2" data-key="' + key + '" aria-expanded="' + open + '" aria-selected="false" class="tree__group"><div class="tree__row"><span class="tree__twisty" aria-hidden="true">' + icon("navigate_next") + '</span><span class="tree__content"><span class="tree__group-label">' + esc(label) + " (" + children.length.toLocaleString() + ")</span></span></div>" +
      (open ? '<ul role="group">' + inner + "</ul>" : "") + "</li>";
  }
  function updateTreeLabel(id) {
    var o = I.get(id), n = I.problemsOf(id).length, t = I.titleOf(o);
    document.querySelectorAll('#tree [data-oid="' + id + '"] > .tree__row').forEach(function (row) {
      row.querySelector(".tree__label").textContent = t;
      row.querySelector(".tree__marker").innerHTML = markerHtml(o, n);
    });
  }

  // tree interaction: click twisty / row, keyboard (APG treeview)
  var tree = $("tree");
  function toggleKey(key, open) {
    if (open) expanded[key] = 1; else delete expanded[key];
    treeFocusKey = key;
    renderTree();
  }
  tree.addEventListener("click", function (e) {
    var it = e.target.closest('[role="treeitem"]');
    if (!it) return;
    var key = it.getAttribute("data-key");
    if (it.hasAttribute("data-more")) { var g = it.getAttribute("data-more"); groupLimit[g] = (groupLimit[g] || MAX_GROUP) + MAX_GROUP; treeFocusKey = key; renderTree(); return; }
    if (e.target.closest(".tree__twisty") || (!e.target.closest("a") && it.classList.contains("tree__group"))) {
      e.preventDefault();
      toggleKey(key, it.getAttribute("aria-expanded") !== "true");
    }
  });
  tree.addEventListener("keydown", function (e) {
    var it = e.target.closest('[role="treeitem"]');
    if (!it) return;
    var vis = Array.prototype.slice.call(tree.querySelectorAll('[role="treeitem"]')).filter(function (x) { return x.offsetParent !== null; });
    var i = vis.indexOf(it);
    var ex = it.getAttribute("aria-expanded");
    function go(x) { if (!x) return; vis.forEach(function (v) { v.tabIndex = -1; }); x.tabIndex = 0; x.focus(); }
    switch (e.key) {
      case "ArrowDown": go(vis[i + 1]); break;
      case "ArrowUp": go(vis[i - 1]); break;
      case "Home": go(vis[0]); break;
      case "End": go(vis[vis.length - 1]); break;
      case "ArrowRight": if (ex === "false") toggleKey(it.getAttribute("data-key"), true); else if (ex === "true") go(vis[i + 1]); break;
      case "ArrowLeft":
        if (ex === "true") toggleKey(it.getAttribute("data-key"), false);
        else { var par = it.parentElement.closest('[role="treeitem"]'); go(par); }
        break;
      case "Enter": case " ":
        if (it.hasAttribute("data-more")) { it.click(); break; }
        var a = it.querySelector(":scope > .tree__row a");
        if (a) { location.hash = a.getAttribute("href"); } else if (ex) toggleKey(it.getAttribute("data-key"), ex !== "true");
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          var ch = e.key.toLowerCase();
          for (var k = 1; k <= vis.length; k++) {
            var c = vis[(i + k) % vis.length];
            var lab = c.querySelector(":scope > .tree__row .tree__label, :scope > .tree__row .tree__group-label");
            if (lab && lab.textContent.trim().toLowerCase().indexOf(ch) === 0) { go(c); break; }
          }
        }
        return;
    }
    e.preventDefault();
  });
  var filterTimer;
  $("tree-filter").addEventListener("input", function () {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(renderTree, 200);
  });

  /* =====================================================================
   * By type: list, New, Edit, Delete
   * ===================================================================== */
  var PAGE = 50;
  function typeView(cls, q) {
    var all = I.sortObjects(I.objectsOf(cls));
    var filter = (q.q || "").trim().toLowerCase();
    var rows = filter ? all.filter(function (o) { return (I.titleOf(o) + " " + metaOf(o)).toLowerCase().indexOf(filter) !== -1; }) : all;
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    var page = Math.min(pages, Math.max(1, +q.page || 1));
    var slice = rows.slice((page - 1) * PAGE, page * PAGE);
    var slug = INFO[cls].slug;
    var h = '<nav class="usa-breadcrumb padding-top-0" aria-label="Where you are"><ol class="usa-breadcrumb__list"><li class="usa-breadcrumb__list-item"><a class="usa-breadcrumb__link" href="#/"><span>' + esc(I.titleOf(I.get(I.w.root))) + '</span></a></li><li class="usa-breadcrumb__list-item" aria-current="page"><span>' + esc(INFO[cls].plural) + "</span></li></ol></nav>";
    h += '<div class="type-head"><h2 id="view-heading" tabindex="-1">' + esc(INFO[cls].plural) + ' <span class="type-count">' + all.length.toLocaleString() + "</span></h2>" +
      '<button type="button" class="usa-button" data-type-new="' + cls + '">' + icon("add") + " New " + esc(lc(cls)) + "</button></div>";
    h += '<p class="usa-hint">Sorted by name (A to Z), unnamed ones last. ' + (I.CATALOG_MEMBER[cls] ? "A new " + esc(lc(cls)) + " is added to the catalog." : "A new " + esc(lc(cls)) + " is not linked anywhere until you pick it in a field.") + "</p>";
    h += '<form class="usa-search usa-search--small margin-bottom-2" role="search" onsubmit="return false"><label class="usa-sr-only" for="type-filter">Filter ' + esc(INFO[cls].plural.toLowerCase()) + '</label><input class="usa-input" id="type-filter" type="search" value="' + esc(q.q || "") + '" placeholder="Filter ' + esc(INFO[cls].plural.toLowerCase()) + '" data-type-filter="' + slug + '"></form>';
    if (!all.length) return h + "<p>There are no " + esc(INFO[cls].plural.toLowerCase()) + " in this catalog yet.</p>";
    h += '<p class="usa-hint" role="status">' + (filter ? rows.length.toLocaleString() + " of " + all.length.toLocaleString() + " match. " : "") + (rows.length > PAGE ? "Showing " + ((page - 1) * PAGE + 1).toLocaleString() + "–" + Math.min(page * PAGE, rows.length).toLocaleString() + "." : "") + "</p>";
    h += '<div class="usa-table-container--scrollable" tabindex="0"><table class="usa-table usa-table--borderless usa-table--compact type-table"><caption class="usa-sr-only">' + esc(INFO[cls].plural) + '</caption><thead><tr><th scope="col">Name</th><th scope="col">Used in</th><th scope="col">Check</th><th scope="col"><span class="usa-sr-only">Actions</span></th></tr></thead><tbody>' +
      slice.map(function (o) {
        var hp = I.homePath(o.id);
        var href = hp ? hashFor(hp) : "#/" + slug + "/" + o.id;
        var uses = I.usedBy(o.id).length, n = I.problemsOf(o.id).length;
        return '<tr><th scope="row"><a class="usa-link" href="' + href + '">' + esc(I.titleOf(o)) + '</a><div class="linked-obj__meta">' + esc(metaOf(o)) + "</div></th>" +
          "<td>" + (uses ? plural(uses, "place") : '<span class="text-base">Not linked</span>') + "</td>" +
          "<td>" + (n ? '<span class="text-secondary-dark text-bold">' + icon("warning", "inline-icon") + plural(n, "problem") + "</span>" : (I.hasAnyValue(o) ? "No problems" : "Empty")) + "</td>" +
          '<td class="row-actions-cell"><a class="usa-button usa-button--unstyled" href="' + href + '">' + icon("edit", "inline-icon") + 'Edit<span class="usa-sr-only"> ' + esc(I.titleOf(o)) + "</span></a> " +
          '<button type="button" class="usa-button usa-button--unstyled text-secondary-dark icon-button" data-delete="' + o.id + '" aria-label="Delete ' + esc(I.titleOf(o)) + '">' + icon("delete") + "</button></td></tr>";
      }).join("") + "</tbody></table></div>";
    if (pages > 1) h += pagination(slug, page, pages, q.q);
    return h;
  }
  function pagination(slug, page, pages, qq) {
    function link(p, label, cls) { return '<li class="usa-pagination__item ' + (cls || "usa-pagination__page-no") + '"><a href="#/type/' + slug + "?page=" + p + (qq ? "&q=" + encodeURIComponent(qq) : "") + '" class="' + (cls ? "usa-pagination__link usa-pagination__" + (label === "Previous" ? "previous" : "next") + "-page" : "usa-pagination__button" + (p === page ? " usa-current" : "")) + '"' + (p === page && !cls ? ' aria-current="page"' : "") + ' aria-label="' + (cls ? label + " page" : "Page " + p) + '">' + (cls ? '<span class="usa-pagination__link-text">' + label + "</span>" : p) + "</a></li>"; }
    var nums = [1, page - 1, page, page + 1, pages].filter(function (p, i, a) { return p >= 1 && p <= pages && a.indexOf(p) === i; }).sort(function (a, b) { return a - b; });
    var h = '<nav aria-label="Pagination" class="usa-pagination"><ul class="usa-pagination__list">';
    if (page > 1) h += link(page - 1, "Previous", "usa-pagination__arrow");
    nums.forEach(function (p, i) {
      if (i && p - nums[i - 1] > 1) h += '<li class="usa-pagination__item usa-pagination__overflow" aria-label="ellipsis indicating non-visible pages"><span>…</span></li>';
      h += link(p, p);
    });
    if (page < pages) h += link(page + 1, "Next", "usa-pagination__arrow");
    return h + "</ul></nav>";
  }
  var typeFilterTimer;
  view.addEventListener("input", function (e) {
    var inp = e.target.closest("[data-type-filter]");
    if (!inp) return;
    window.clearTimeout(typeFilterTimer);
    typeFilterTimer = window.setTimeout(function () {
      var pos = inp.selectionStart;
      history.replaceState(null, "", "#/type/" + inp.getAttribute("data-type-filter") + (inp.value ? "?q=" + encodeURIComponent(inp.value) : ""));
      route = parse();
      view.innerHTML = typeView(route.cls, route.q);
      var again = $("type-filter");
      again.focus();
      again.setSelectionRange(pos, pos);
    }, 250);
  });

  /* =====================================================================
   * Check results and Export (views on this page, not separate pages)
   * ===================================================================== */
  function problemRows(ids, blanks) {
    var byType = {};
    ids.forEach(function (id) {
      var list = blanks ? I.blanksOf(id) : I.problemsOf(id);
      if (!list.length) return;
      var cls = I.get(id).cls;
      (byType[cls] = byType[cls] || []).push({ id: id, list: list });
    });
    return Object.keys(byType).sort(function (a, b) { return I.TYPE_ORDER.indexOf(a) - I.TYPE_ORDER.indexOf(b); }).map(function (cls) {
      var objs = byType[cls], n = 0;
      objs.forEach(function (x) { n += x.list.length; });
      return "<h4>" + esc(INFO[cls].plural) + ": " + plural(objs.length, "object") + ", " + plural(n, blanks ? "note" : "problem") + "</h4>" +
        '<div class="usa-table-container--scrollable" tabindex="0"><table class="usa-table usa-table--borderless usa-table--compact"><thead><tr><th scope="col">Object</th><th scope="col">Field</th><th scope="col">' + (blanks ? "Note" : "Problem") + "</th></tr></thead><tbody>" +
        objs.slice(0, 200).map(function (x) {
          var o = I.get(x.id), hp = I.homePath(x.id);
          return x.list.map(function (pr) {
            var href = (hp ? hashFor(hp, pr.prop) : "#/" + INFO[o.cls].slug + "/" + o.id + "?field=" + pr.prop);
            var used = I.usedBy(x.id).length;
            return '<tr><th scope="row"><a class="usa-link" href="' + href + '">' + esc(I.titleOf(o)) + "</a>" + (used > 1 ? '<div class="linked-obj__meta">Affects ' + used + " places</div>" : "") + "</th><td>" + esc((I.prop(o.cls, pr.prop) || {}).label || pr.prop) + "</td><td>" + esc(pr.msg) + "</td></tr>";
          }).join("");
        }).join("") + "</tbody></table></div>" + (objs.length > 200 ? '<p class="usa-hint">… and ' + (objs.length - 200) + " more objects.</p>" : "");
    }).join("");
  }
  function checkView() {
    var s = I.summary();
    var h = '<h2 id="view-heading" tabindex="-1">Check results</h2>' + ADVISORY;
    h += '<p>The check runs again after every change, so these results are always current. Checked ' + plural(Object.keys(I.w.objs).length, "object") + " just now. Each problem is listed once per object, even if the object is used in several places.</p>";
    if (!s.problems) h += alertHtml("success", null, "The advisory check found no problems.", true);
    else h += '<div class="usa-summary-box margin-y-2" role="region" aria-labelledby="sum-h"><div class="usa-summary-box__body"><h3 class="usa-summary-box__heading" id="sum-h">' + plural(s.problems, "problem") + " in " + plural(s.objects, "object") + '</h3><div class="usa-summary-box__text">Select an object to go to the field. Nothing is blocked: you can keep editing and export at any time.</div></div></div>' + problemRows(s.ids, false);
    if (s.blanks) h += '<h3 class="margin-top-4">Not checked by the schema</h3><p>These are blank or empty. The schema allows them, so they are not problems, but Data.gov may expect a value.</p>' + problemRows(s.ids, true);
    return h + '<p class="margin-top-4"><a class="usa-button" href="#/export">Continue to export</a></p>';
  }
  var lastDownload = null;
  function exportView() {
    var s = I.summary();
    var h = '<h2 id="view-heading" tabindex="-1">Export your catalog</h2><p class="usa-intro">Build a DCAT-US 3.0 JSON file from your working copy and save it to your computer. The file is made in this browser.</p>';
    var loop = null;
    try { I.exportCatalog(); } catch (e) { if (e instanceof I.LoopError) loop = e.path; else throw e; }
    if (loop) {
      return h + alertHtml("error", "We could not build the file", "These objects link back to each other in a loop: " + loop.map(function (id) { return "<em>" + esc(I.titleOf(I.get(id))) + "</em>"; }).join(" → ") +
        ". DCAT-US 3.0 JSON writes linked objects out in full, so a loop has no end. No file was downloaded. Open one of them and remove the link that closes the loop.") + '<p><a class="usa-button" href="' + hashFor(I.homePath(loop[0]) || [loop[0]]) + '">Open ' + esc(I.titleOf(I.get(loop[0]))) + "</a></p>";
    }
    if (lastDownload) h += alertHtml("success", null, "Downloaded <strong>" + esc(lastDownload.name) + "</strong> (" + (lastDownload.size / 1048576).toFixed(1) + " MB). Check your Downloads folder.", true);
    if (s.problems) {
      var ids = s.ids.filter(function (id) { return I.problemsOf(id).length; });
      h += '<div class="usa-alert usa-alert--warning"><div class="usa-alert__body"><h3 class="usa-alert__heading">This catalog did not pass the advisory check</h3><p class="usa-alert__text">The check found ' + plural(s.problems, "problem") + " in " + plural(s.objects, "object") + ". You can still download the file. The file itself is not marked.</p><ul>" +
        ids.slice(0, 8).map(function (id) { var o = I.get(id); return "<li>" + esc(I.titleOf(o)) + ": " + esc(I.problemsOf(id).map(function (p) { return (I.prop(o.cls, p.prop) || {}).label || p.prop; }).join(", ")) + "</li>"; }).join("") + (ids.length > 8 ? "<li>… and " + (ids.length - 8) + " more</li>" : "") + "</ul></div></div>";
    } else h += alertHtml("success", null, "The advisory check found no problems.", true);
    h += ADVISORY;
    var shared = Object.keys(I.w.objs).filter(function (k) { return I.usedBy(k).length > 1; }).length;
    if (shared) h += "<h3>About shared objects</h3><p>" + plural(shared, "object is", "objects are") + " used in more than one place. DCAT-US 3.0 JSON writes each one out in full wherever it is used. Objects that have an <code>@id</code> are joined up again when you open the file; the others come back as separate copies.</p>";
    h += "<h3>File</h3><p>File name: <strong>" + esc(I.fileName()) + "</strong><br><span class=\"usa-hint\">Named after the catalog title and today’s date.</span></p>";
    h += '<ul class="usa-button-group">' + (s.problems ? '<li class="usa-button-group__item"><a class="usa-button usa-button--outline" href="#/check">Review problems</a></li>' : "") +
      '<li class="usa-button-group__item"><button type="button" class="usa-button" data-download>' + icon("file_download") + (s.problems ? " Download anyway" : " Download catalog") + "</button></li></ul>";
    return h;
  }
  function doDownload() {
    flushSave();
    var name = I.fileName();
    var size = I.downloadJson(I.exportCatalog(), name);
    lastDownload = { name: name, size: size };
    render();
    F.announce("Downloaded " + name + ".");
  }

  /* ---------- after every render: USWDS accordion state, back links ---------- */
  function afterRender() {
    view.querySelectorAll("[data-back]").forEach(function (a) { a.addEventListener("click", function () { justCreated = null; }); });
  }
})();
