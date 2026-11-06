/*
 * Start page: import from a file, paste JSON, import from a web address (mocked), or start
 * from scratch. Every path runs the same import (Inv.importCatalog), saves the working copy
 * to this browser, and goes straight into the editor.
 */
(function () {
  "use strict";

  var I = window.Inv, F = window.Frame, esc = F.esc;
  var MAX = 50 * 1024 * 1024;
  function $(id) { return document.getElementById(id); }
  var existing = null;

  function showError(heading, text) {
    $("start-alerts").innerHTML = '<div class="usa-alert usa-alert--error margin-bottom-3" role="alert" tabindex="-1" id="start-error"><div class="usa-alert__body"><h2 class="usa-alert__heading">' + esc(heading) + '</h2><p class="usa-alert__text">' + esc(text) + " " + (existing ? "Your working copy has not changed." : "") + "</p></div></div>";
    $("start-error").focus();
    $("progress-box").hidden = true;
  }
  var HEADINGS = { "not-json": "This is not valid JSON", "no-dcat": "No DCAT-US 3.0 catalog found", "dcat-11": "This looks like a data.json file (DCAT-US 1.1)", "too-large": "This file is too large" };

  if (/[?&]cleared=1/.test(location.search)) {
    $("start-alerts").innerHTML = '<div class="usa-alert usa-alert--success usa-alert--slim margin-bottom-3" role="status"><div class="usa-alert__body"><p class="usa-alert__text">Your data has been cleared from this browser.</p></div></div>';
  }

  I.readMeta().then(function (meta) {
    if (!meta) return;
    existing = meta;
    $("resume").hidden = false;
    $("resume-title").textContent = meta.title;
    $("resume-saved").textContent = meta.savedAt ? new Date(meta.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "not yet";
    $("resume-counts").textContent = "opened from " + ({ file: "a file", paste: "pasted JSON", url: "a web address", blank: "scratch", sample: "the sample", large: "the generated large sample" }[meta.source] || "a file") + (meta.fileName ? " (" + meta.fileName + ")" : "");
  });

  $("resume-download").addEventListener("click", function () {
    I.load().then(function () { I.downloadJson(I.exportCatalog(), I.fileName()); F.announce("Downloaded."); })
      .catch(function (e) { showError("We could not build the file", e instanceof I.LoopError ? "Some objects link back to each other in a loop. Open the editor to fix it." : String(e)); });
  });
  $("resume-discard").addEventListener("click", function () {
    F.confirm({ title: "Discard your working copy?", html: "<p>This deletes <em>" + esc(existing.title) + "</em> from this browser. You cannot get it back.</p>", buttons: [{ label: "Discard working copy", value: "x", style: "secondary" }], focusCancel: true })
      .then(function (v) { if (v) I.clear().then(function () { location.href = "index.html?cleared=1"; }); });
  });

  // The one import path. `getJson` returns the parsed JSON (or throws an ImportError).
  function run(source, name, getJson) {
    $("start-alerts").innerHTML = "";
    var go = existing
      ? F.confirm({
        title: "Replace your working copy?",
        html: "<p>Opening " + (name ? "<strong>" + esc(name) + "</strong>" : "this catalog") + " replaces your working copy of <em>" + esc(existing.title) + "</em> in this browser. Export it first if you want to keep it.</p>",
        buttons: [{ label: "Export current copy first", value: "export", style: "outline" }, { label: "Replace", value: "replace", style: "secondary" }],
        focusCancel: true
      })
      : Promise.resolve("replace");
    go.then(function (v) {
      if (v === "export") { location.href = "editor.html#/export"; return; }
      if (v !== "replace") return;
      progress(10, "Reading…");
      window.setTimeout(function () {
        try {
          var json = getJson();
          progress(40, "Building objects…");
          I.importCatalog(json, source, name);
        } catch (e) {
          if (e instanceof I.ImportError) { showError(HEADINGS[e.kind] || "We could not open this", e.message); return; }
          throw e;
        }
        progress(70, "Saving your working copy in this browser…");
        I.saveAll().then(function () {
          progress(100, "Opening the editor…");
          sessionStorage.setItem("inv-mock-loaded", source);
          location.href = "editor.html#/";
        }).catch(function (e) { showError("This browser is not letting the editor save your work", "It may be a private window, storage may be full, or site data may be blocked. (" + (e && e.message) + ")"); });
      }, 30);
    });
  }
  function progress(v, text) {
    $("progress-box").hidden = false;
    $("progress").value = v;
    $("progress-text").textContent = text;
  }

  $("open-file").addEventListener("click", function () {
    var f = $("file-input").files[0];
    if (!f) { showError("Choose a file first", "Use “Choose a .json file” to pick a DCAT-US 3.0 JSON file from your computer."); return; }
    if (f.size > MAX) { showError(HEADINGS["too-large"], f.name + " is " + Math.round(f.size / 1048576) + " MB. The editor can open files up to 50 MB."); return; }
    f.text().then(function (text) { run("file", f.name, function () { return I.parseText(text, f.name); }); });
  });
  $("open-paste").addEventListener("click", function () {
    var text = $("paste-input").value;
    if (!text.trim()) { showError("Paste some JSON first", "Paste the text of a DCAT-US 3.0 catalog into the box."); return; }
    run("paste", "", function () { return I.parseText(text, "The pasted text"); });
  });
  $("open-url").addEventListener("click", function () {
    var u = $("url-input").value.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) { showError("Enter a full web address", "Start with https:// or http://, for example https://www.example.gov/data.json."); return; }
    // Mockup: nothing is fetched. The sample stands in for the file at that address.
    run("url", u, function () { return window.InvSamples.small(); });
  });
  $("open-blank").addEventListener("click", function () { run("blank", "", function () { return window.InvSamples.blank(); }); });

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-sample]");
    if (b) {
      var kind = b.getAttribute("data-sample");
      run(kind === "large" ? "large" : "sample", kind === "large" ? "generated-2000-datasets.json" : "department-of-example-affairs.json", function () {
        // Round-trip through text so the large sample is parsed like a real 2–3 MB file.
        var text = JSON.stringify(kind === "large" ? window.InvSamples.large(2000) : window.InvSamples.small());
        return I.parseText(text);
      });
      return;
    }
    if (e.target.closest("[data-download-large]")) {
      var size = I.downloadJson(window.InvSamples.large(2000), "generated-2000-datasets.json");
      F.announce("Downloaded, " + (size / 1048576).toFixed(1) + " MB.");
      return;
    }
    var p = e.target.closest("[data-paste-example]");
    if (p) {
      var ex = {
        "bad-json": '{\n  "@type": "Catalog",\n  "title": "Broken catalog",\n  "dataset": [\n    { "title": "Missing a comma" "description": "…" }\n  ]\n}',
        dcat11: JSON.stringify({ conformsTo: "https://project-open-data.cio.gov/v1.1/schema", describedBy: "https://project-open-data.cio.gov/v1.1/schema/catalog.json", "@type": "dcat:Catalog", dataset: [{ title: "A 1.1 dataset", accessLevel: "public" }] }, null, 2),
        broken: JSON.stringify({ "@type": "Catalog", title: "A catalog with problems", dataset: [{ "@type": "Dataset", title: "No description, no contact, odd date", modified: "last Tuesday", keyword: ["test"], bureauCode: ["015:11"] }, { "@type": "Dataset", description: "Untitled dataset" }] }, null, 2)
      }[p.getAttribute("data-paste-example")];
      $("paste-input").value = ex;
      $("paste-input").focus();
    }
  });
})();
