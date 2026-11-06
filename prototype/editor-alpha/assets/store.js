/*
 * Working-copy model for the editor alpha mockup. Prototype only.
 *
 * - The catalog is held as flat objects ({id, cls, data}) linked by id, as #28 plans
 *   ("one object per record"). Class-valued fields hold ids.
 * - Loading goes through one path (importCatalog) for files, pasted JSON, the mocked
 *   URL import, the samples and "Start from scratch".
 * - The working copy is kept in this browser's IndexedDB. Nothing is sent anywhere.
 * - The advisory check is a small hand-written check against assets/schema.js (required
 *   fields, dates, web addresses, email, frequency). It is not the official validator.
 */
(function () {
  "use strict";

  var SCHEMA = window.DCATUS;
  var C = SCHEMA.classes;

  /* ---------- class metadata the editor needs on top of the schema ---------- */
  var INFO = {
    Catalog: { label: "Catalog", plural: "Catalogs", slug: "catalog", title: ["title"] },
    Dataset: { label: "Dataset", plural: "Datasets", slug: "dataset", title: ["title"] },
    DatasetSeries: { label: "Dataset series", plural: "Dataset series", slug: "series", title: ["title"] },
    DataService: { label: "Data service", plural: "Data services", slug: "service", title: ["title"] },
    Distribution: { label: "Distribution", plural: "Distributions", slug: "distribution", title: ["title"] },
    Kind: { label: "Contact", plural: "Contacts", slug: "contact", title: ["fn", "organization-name", "hasEmail"] },
    Organization: { label: "Organization", plural: "Organizations", slug: "organization", title: ["name", "prefLabel", "altLabel"] },
    Agent: { label: "Agent", plural: "Agents", slug: "agent", title: ["name"] },
    AccessRestriction: { label: "Access restriction", plural: "Access restrictions", slug: "access-restriction", title: ["restrictionStatus", "restrictionNote"] },
    UseRestriction: { label: "Use restriction", plural: "Use restrictions", slug: "use-restriction", title: ["restrictionStatus", "restrictionNote"] },
    CUIRestriction: { label: "CUI restriction", plural: "CUI restrictions", slug: "cui-restriction", title: ["cuiBannerMarking"] },
    Document: { label: "Document", plural: "Documents", slug: "document", title: ["title", "accessURL"] },
    Standard: { label: "Standard", plural: "Standards", slug: "standard", title: ["title", "identifier"] },
    Location: { label: "Location", plural: "Locations", slug: "location", title: ["prefLabel", "altLabel"] },
    PeriodOfTime: { label: "Period of time", plural: "Periods of time", slug: "period", title: [] },
    Address: { label: "Address", plural: "Addresses", slug: "address", title: ["street-address", "locality"] },
    Attribution: { label: "Attribution", plural: "Attributions", slug: "attribution", title: ["hadRole"] },
    Relationship: { label: "Relationship", plural: "Relationships", slug: "relationship", title: ["hadRole", "relation"] },
    Activity: { label: "Activity", plural: "Activities", slug: "activity", title: ["label"] },
    QualityMeasurement: { label: "Quality measurement", plural: "Quality measurements", slug: "quality-measurement", title: ["value"] },
    Metric: { label: "Metric", plural: "Metrics", slug: "metric", title: ["inDimension", "definition"] },
    Checksum: { label: "Checksum", plural: "Checksums", slug: "checksum", title: ["algorithm"] },
    CatalogRecord: { label: "Catalog record", plural: "Catalog records", slug: "record", title: ["title", "primaryTopic"] },
    ConceptScheme: { label: "Concept scheme", plural: "Concept schemes", slug: "concept-scheme", title: ["title"] },
    Concept: { label: "Concept", plural: "Concepts", slug: "concept", title: ["prefLabel"] },
    Identifier: { label: "Identifier", plural: "Identifiers", slug: "identifier", title: ["notation"] }
  };
  var SLUG = {};
  Object.keys(INFO).forEach(function (k) { SLUG[INFO[k].slug] = k; });

  // The order types are listed in the "By type" view.
  var TYPE_ORDER = ["Dataset", "DatasetSeries", "DataService", "Distribution", "Kind", "Organization", "Agent",
    "AccessRestriction", "UseRestriction", "CUIRestriction", "Document", "Standard", "Location", "PeriodOfTime"];
  // Types that live directly in the catalog: "New" from the By type view adds them to it.
  var CATALOG_MEMBER = { Dataset: "dataset", DatasetSeries: "datasetSeries", DataService: "service" };

  function propsOf(cls) { return (C[cls] && C[cls].props) || []; }
  function prop(cls, name) {
    var ps = propsOf(cls);
    for (var i = 0; i < ps.length; i++) if (ps[i].n === name) return ps[i];
    return null;
  }

  /*
   * How a class-valued field offers objects (#25, huddle 2026-11-06):
   *   "create"  only "Create new": the object belongs to this parent (a catalog's datasets,
   *             a dataset's distributions, value-like objects such as a period of time).
   *   "select"  only "Add an existing …": the object belongs to the catalog's own lists
   *             (a series member is a dataset that is already in the catalog).
   *   "both"    pick an existing object or create a new one (contacts, publishers, …).
   */
  var CREATE_ONLY_FIELDS = {
    "Catalog.dataset": 1, "Catalog.datasetSeries": 1, "Catalog.service": 1, "Catalog.catalog": 1,
    "Catalog.hasPart": 1, "Catalog.record": 1,
    "Dataset.distribution": 1, "Dataset.sample": 1, "Dataset.metadataDistribution": 1
  };
  var CREATE_ONLY_CLASSES = { PeriodOfTime: 1, Checksum: 1, Address: 1, Relationship: 1, Attribution: 1, QualityMeasurement: 1, CatalogRecord: 1 };
  function linkMode(cls, p) {
    if (CREATE_ONLY_FIELDS[cls + "." + p.n]) return "create";
    if (p.classes.some(function (c) { return CREATE_ONLY_CLASSES[c]; })) return "create";
    if (p.classes.some(function (c) { return CATALOG_MEMBER[c]; })) return "select";
    return "both";
  }

  /* ---------- the working copy ---------- */
  var W = null; // { meta, root, objs: {id: obj}, dirty: {id:1}, removed: {id:1} }

  function blankMeta(source, name) {
    return { key: "meta", source: source, fileName: name || "", loadedAt: Date.now(), savedAt: null, seq: 0 };
  }
  var ID_PREFIX = { Catalog: "cat", Dataset: "ds", Distribution: "dist", Kind: "k", Organization: "org", Agent: "agent",
    DatasetSeries: "ser", DataService: "svc", Document: "doc", Location: "loc", Standard: "std" };
  function newId(cls) {
    W.meta.seq++;
    return (ID_PREFIX[cls] || INFO[cls].slug.split("-").map(function (s) { return s[0]; }).join("")) + W.meta.seq;
  }
  function makeObj(cls, data) {
    var o = { id: newId(cls), cls: cls, seq: W.meta.seq, data: data || {}, extra: {}, raw: {}, iri: null };
    W.objs[o.id] = o;
    W.dirty[o.id] = 1;
    structureChanged();
    return o;
  }
  function get(id) { return W && W.objs[id]; }
  function isEmpty(v) { return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0); }

  function titleOf(o) {
    if (!o) return "(missing object)";
    var t = INFO[o.cls].title;
    for (var i = 0; i < t.length; i++) {
      var v = o.data[t[i]];
      if (Array.isArray(v)) v = v[0];
      if (v && typeof v === "object") v = v.prefLabel || v.notation || "";
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    if (o.cls === "PeriodOfTime" && (o.data.startDate || o.data.endDate)) return (o.data.startDate || "…") + " – " + (o.data.endDate || "…");
    if (o.cls === "Distribution" && o.data.format) return "Unnamed distribution (" + o.data.format + ")";
    return "Unnamed " + INFO[o.cls].label.toLowerCase();
  }
  function hasAnyValue(o) {
    return Object.keys(o.data).some(function (k) { return !isEmpty(o.data[k]); });
  }

  /* ---------- links, usage and reachability (recomputed after structural changes) ---------- */
  var index = null; // { usedBy: {id: [{from, prop}]}, parent: {id: {from, prop}}, reachable: {id:1} }
  function structureChanged() { index = null; }
  function linkIds(o, p) {
    var v = o.data[p.n];
    if (isEmpty(v)) return [];
    return (Array.isArray(v) ? v : [v]).filter(function (x) { return typeof x === "string" && W.objs[x]; });
  }
  function linkProps(cls) { return propsOf(cls).filter(function (p) { return p.kind === "link"; }); }
  function buildIndex() {
    if (index) return index;
    var usedBy = {}, parent = {}, reachable = {};
    Object.keys(W.objs).forEach(function (id) {
      var o = W.objs[id];
      linkProps(o.cls).forEach(function (p) {
        linkIds(o, p).forEach(function (t) { (usedBy[t] = usedBy[t] || []).push({ from: id, prop: p.n }); });
      });
    });
    // breadth-first from the catalog: the first route found to each object is its "home" path
    var queue = [W.root];
    reachable[W.root] = 1;
    while (queue.length) {
      var id = queue.shift();
      var o = W.objs[id];
      linkProps(o.cls).forEach(function (p) {
        linkIds(o, p).forEach(function (t) {
          if (reachable[t]) return;
          reachable[t] = 1;
          parent[t] = { from: id, prop: p.n };
          queue.push(t);
        });
      });
    }
    index = { usedBy: usedBy, parent: parent, reachable: reachable };
    return index;
  }
  function usedBy(id) { return buildIndex().usedBy[id] || []; }
  function isReachable(id) { return !!buildIndex().reachable[id]; }
  function homePath(id) {
    var ix = buildIndex();
    if (id === W.root) return [];
    if (!ix.reachable[id]) return null;
    var path = [];
    var cur = id;
    while (cur && cur !== W.root) { path.unshift(cur); cur = ix.parent[cur] && ix.parent[cur].from; }
    return path;
  }
  function isLinked(fromId, toId) {
    var o = W.objs[fromId];
    if (!o) return null;
    var hit = null;
    linkProps(o.cls).some(function (p) { if (linkIds(o, p).indexOf(toId) !== -1) { hit = p.n; return true; } return false; });
    return hit;
  }
  function objectsOf(cls) {
    return Object.keys(W.objs).map(function (k) { return W.objs[k]; }).filter(function (o) { return o.cls === cls; });
  }
  function sortObjects(list) {
    // Consistent order everywhere (huddle): alphabetical by name, unnamed ones last, then creation order.
    return list.slice().sort(function (a, b) {
      var an = /^Unnamed /.test(titleOf(a)), bn = /^Unnamed /.test(titleOf(b));
      if (an !== bn) return an ? 1 : -1;
      var c = titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: "base", numeric: true });
      return c || a.seq - b.seq;
    });
  }

  /* ---------- edits ---------- */
  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit(kind, ids) { listeners.forEach(function (fn) { fn(kind, ids); }); }

  function setValue(id, name, value) {
    var o = W.objs[id];
    if (isEmpty(value) || (Array.isArray(value) && value.every(function (x) { return x === ""; }))) delete o.data[name];
    else o.data[name] = value;
    W.dirty[id] = 1;
    validate(o);
    emit("value", [id]);
  }
  function addLink(fromId, name, toId) {
    var o = W.objs[fromId];
    var p = prop(o.cls, name);
    if (p.multi) {
      var cur = Array.isArray(o.data[name]) ? o.data[name].slice() : (isEmpty(o.data[name]) ? [] : [o.data[name]]);
      if (cur.indexOf(toId) === -1) cur.push(toId);
      o.data[name] = cur;
    } else {
      o.data[name] = toId;
    }
    W.dirty[fromId] = 1;
    structureChanged();
    validate(o);
    emit("structure", [fromId, toId]);
  }
  function removeLink(fromId, name, toId) {
    var o = W.objs[fromId];
    var v = o.data[name];
    if (Array.isArray(v)) { v = v.filter(function (x) { return x !== toId; }); if (v.length) o.data[name] = v; else delete o.data[name]; }
    else if (v === toId) delete o.data[name];
    W.dirty[fromId] = 1;
    structureChanged();
    validate(o);
    emit("structure", [fromId, toId]);
  }
  function createLinked(fromId, name, cls) {
    var o = makeObj(cls, {});
    validate(o);
    addLink(fromId, name, o.id);
    return o;
  }
  function createUnlinked(cls) {
    if (CATALOG_MEMBER[cls]) return createLinked(W.root, CATALOG_MEMBER[cls], cls);
    var o = makeObj(cls, {});
    validate(o);
    emit("structure", [o.id]);
    return o;
  }
  // What deleting an object would do: where it is linked, and which objects would be left
  // with no links at all (only used inside it), which are deleted with it.
  function deletePlan(id) {
    var refs = usedBy(id).slice();
    var gone = {}; gone[id] = 1;
    var changed = true;
    while (changed) {
      changed = false;
      Object.keys(W.objs).forEach(function (k) {
        if (gone[k] || k === W.root) return;
        var users = usedBy(k);
        if (!users.length) return;
        if (users.every(function (u) { return gone[u.from]; })) { gone[k] = 1; changed = true; }
      });
    }
    delete gone[id];
    return { refs: refs, cascade: Object.keys(gone) };
  }
  function deleteObject(id) {
    var plan = deletePlan(id);
    var all = [id].concat(plan.cascade);
    plan.refs.forEach(function (r) {
      if (all.indexOf(r.from) !== -1) return;
      var o = W.objs[r.from];
      var v = o.data[r.prop];
      if (Array.isArray(v)) { v = v.filter(function (x) { return x !== id; }); if (v.length) o.data[r.prop] = v; else delete o.data[r.prop]; }
      else delete o.data[r.prop];
      W.dirty[r.from] = 1;
    });
    all.forEach(function (k) { delete W.objs[k]; delete problems[k]; delete W.dirty[k]; W.removed[k] = 1; });
    structureChanged();
    plan.refs.forEach(function (r) { if (W.objs[r.from]) validate(W.objs[r.from]); });
    emit("structure", all);
    return all.length;
  }

  // "Edit a copy for this one" (#25, ADR 0005): the copy keeps the original's values and links,
  // and takes its place in this one field only.
  function copyFor(fromId, name, targetId) {
    var src = W.objs[targetId];
    var o = makeObj(src.cls, JSON.parse(JSON.stringify(src.data)));
    o.extra = JSON.parse(JSON.stringify(src.extra || {}));
    var from = W.objs[fromId];
    var v = from.data[name];
    from.data[name] = Array.isArray(v) ? v.map(function (x) { return x === targetId ? o.id : x; }) : o.id;
    W.dirty[fromId] = 1;
    structureChanged();
    validate(o); validate(from);
    emit("structure", [fromId, o.id]);
    return o;
  }

  // Undo of the last removal (#26): a snapshot of the objects a removal or delete touches.
  function snapshot(ids) {
    return ids.filter(function (k) { return W.objs[k]; }).map(function (k) { return JSON.parse(JSON.stringify(W.objs[k])); });
  }
  function restore(snap) {
    snap.forEach(function (o) { W.objs[o.id] = o; W.dirty[o.id] = 1; delete W.removed[o.id]; });
    structureChanged();
    snap.forEach(function (o) { validate(W.objs[o.id]); });
    emit("structure", snap.map(function (o) { return o.id; }));
  }

  /* ---------- the advisory check ---------- */
  var problems = {}; // id -> [{prop, msg, blank}]
  var DATE_RE = /^(\d{4}|\d{4}-\d{2}|\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)$/;
  var IRI_RE = /^[a-z][a-z0-9+.-]*:[^\s]+$/i;
  function checkValue(p, v) {
    if (typeof v !== "string") return null;
    if (p.kind === "date" && !DATE_RE.test(v)) return "Use YYYY, YYYY-MM, YYYY-MM-DD, or a date and time. You entered " + v + ".";
    if (p.kind === "iri" && !IRI_RE.test(v)) return "Enter a full web address, starting with https:// or http://.";
    if (p.kind === "email" && !new RegExp(p.pattern).test(v)) return "Start the email with mailto:, for example mailto:help@example.gov.";
    if (p.kind === "enum") {
      var ok = p.groups.some(function (g) { return g[1].indexOf(v) !== -1; }) || (p.patterns || []).some(function (re) { return new RegExp(re).test(v); });
      if (!ok) {
        var lower = v.toLowerCase();
        var hint = p.groups.some(function (g) { return g[1].indexOf(lower) !== -1; }) ? " Values are lower case: “" + lower + "”, not “" + v + "”." : "";
        return "Choose a frequency from the list." + hint;
      }
    }
    return null;
  }
  function validate(o) {
    var out = [];
    var req = C[o.cls].required || [];
    propsOf(o.cls).forEach(function (p) {
      var v = o.data[p.n];
      if (o.raw[p.n] !== undefined) {
        out.push({ prop: p.n, msg: "This value is not a " + p.classes.map(function (c) { return INFO[c].label.toLowerCase(); }).join(" or ") + ". The form cannot show it; it is kept as it was in the file." });
        return;
      }
      if (req.indexOf(p.n) !== -1) {
        if (v === undefined || v === null) { out.push({ prop: p.n, msg: requiredMsg(p) }); return; }
        if (isEmpty(v)) { out.push({ prop: p.n, msg: p.label + " is blank. The schema allows that, but Data.gov may expect a value.", blank: true }); return; }
      }
      if (isEmpty(v)) return;
      if (p.kind === "link" && !p.multi && Array.isArray(v) && v.length > 1) out.push({ prop: p.n, msg: "Holds only one " + INFO[p.classes[0]].label.toLowerCase() + ". Remove the extra ones." });
      (Array.isArray(v) ? v : [v]).forEach(function (x) {
        var m = checkValue(p, x);
        if (m) out.push({ prop: p.n, msg: m });
      });
    });
    if (out.length) problems[o.id] = out; else delete problems[o.id];
    return out;
  }
  function requiredMsg(p) {
    if (p.kind === "link") return "Add a " + INFO[p.classes[0]].label.toLowerCase() + ". " + p.label + " is required.";
    return "Enter " + p.label.toLowerCase() + ". It is required.";
  }
  function validateAll() {
    problems = {};
    Object.keys(W.objs).forEach(function (k) { validate(W.objs[k]); });
  }
  function problemsOf(id) { return (problems[id] || []).filter(function (p) { return !p.blank; }); }
  function blanksOf(id) { return (problems[id] || []).filter(function (p) { return p.blank; }); }
  function summary() {
    var n = 0, objs = 0, blanks = 0;
    Object.keys(problems).forEach(function (k) {
      var real = problemsOf(k).length;
      if (real) { n += real; objs++; }
      blanks += blanksOf(k).length;
    });
    return { problems: n, objects: objs, blanks: blanks, ids: Object.keys(problems) };
  }

  /* ---------- import: DCAT-US 3.0 JSON → working copy ---------- */
  function ImportError(kind, msg) { this.kind = kind; this.message = msg; }
  function parseText(text, name) {
    try { return JSON.parse(text); }
    catch (e) {
      var m = /position (\d+)/.exec(e.message);
      var where = "";
      if (m) where = " (problem near line " + (text.slice(0, +m[1]).split("\n").length) + ")";
      throw new ImportError("not-json", (name || "The text") + " could not be read because it is not valid JSON" + where + ".");
    }
  }
  function pickClass(p, v) {
    if (p.classes.length === 1) return p.classes[0];
    var t = String(v["@type"] || "").replace(/^.*[:#/]/, "");
    if (p.classes.indexOf(t) !== -1) return t;
    if (t === "Organization" || (p.classes.indexOf("Organization") !== -1 && (v.subOrganizationOf || v.prefLabel || v.notation))) return "Organization";
    return p.classes[0];
  }
  function importCatalog(json, source, name) {
    if (Array.isArray(json) || typeof json !== "object" || json === null) throw new ImportError("no-dcat", "This is JSON, but the editor could not find a DCAT-US 3.0 catalog in it.");
    var conforms = JSON.stringify(json.conformsTo || "") + JSON.stringify(json["@context"] || "");
    if (/project-open-data\.cio\.gov\/v1\.1/.test(conforms)) throw new ImportError("dcat-11", "The editor opens DCAT-US 3.0 JSON only and does not translate DCAT-US 1.1. If your catalog is in the current inventory, export it from there as DCAT-US 3.0 and open that file.");
    var t = String(json["@type"] || "").replace(/^.*[:#/]/, "");
    if (t && t !== "Catalog") throw new ImportError("no-dcat", "This is JSON, but its top level is a " + t + ", not a DCAT-US 3.0 catalog.");
    if (!t && !("dataset" in json)) throw new ImportError("no-dcat", "This is JSON, but the editor could not find a DCAT-US 3.0 catalog in it (no “dataset” list at the top level).");

    W = { meta: blankMeta(source, name), root: null, objs: {}, dirty: {}, removed: {} };
    problems = {};
    var byIri = {};
    function build(cls, src) {
      // The same @id is the same object. A later, fuller copy fills in what an earlier
      // reference left out; it never overwrites.
      var o = src["@id"] && byIri[src["@id"]];
      if (!o) {
        o = makeObj(cls, {});
        if (src["@id"]) { o.iri = src["@id"]; byIri[src["@id"]] = o; }
      }
      Object.keys(src).forEach(function (k) {
        if (k === "@id" || k === "@type") return;
        if (k in o.data || k in o.extra || k in o.raw) return;
        var p = prop(cls, k);
        var v = src[k];
        if (!p) { o.extra[k] = v; return; }
        if (p.kind === "link") {
          if (v === null) return;
          var list = Array.isArray(v) ? v : [v];
          if (list.some(function (x) { return !x || typeof x !== "object" || Array.isArray(x); })) { o.raw[k] = v; return; }
          var ids = list.map(function (x) { return build(pickClass(p, x), x); });
          o.data[k] = Array.isArray(v) ? ids : ids[0];
        } else {
          o.data[k] = v;
        }
      });
      return o.id;
    }
    W.root = build("Catalog", json);
    W.meta.title = titleOf(W.objs[W.root]);
    validateAll();
    return W;
  }

  /* ---------- export: working copy → DCAT-US 3.0 JSON ---------- */
  function LoopError(path) { this.path = path; }
  function toJson(id, stack) {
    var o = W.objs[id];
    stack = stack || [];
    if (stack.indexOf(id) !== -1) throw new LoopError(stack.slice(stack.indexOf(id)).concat([id]));
    stack = stack.concat([id]);
    var out = {};
    if (o.iri) out["@id"] = o.iri;
    out["@type"] = o.cls;
    propsOf(o.cls).forEach(function (p) {
      if (o.raw[p.n] !== undefined) { out[p.n] = o.raw[p.n]; return; }
      var v = o.data[p.n];
      if (v === undefined) return;
      if (p.kind === "link") {
        out[p.n] = Array.isArray(v) ? v.filter(get).map(function (x) { return toJson(x, stack); }) : (get(v) ? toJson(v, stack) : null);
      } else if (p.kind === "json" && typeof v === "string" && /^\s*[[{]/.test(v)) {
        try { out[p.n] = JSON.parse(v); } catch (e) { out[p.n] = v; }
      } else out[p.n] = v;
    });
    Object.keys(o.extra).forEach(function (k) { out[k] = o.extra[k]; });
    return out;
  }
  function exportCatalog() { return toJson(W.root); }
  function fileName() {
    var t = (titleOf(W.objs[W.root]) || "catalog").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (/^unnamed-/.test(t)) t = "catalog";
    return t + "-" + new Date().toISOString().slice(0, 10) + ".json";
  }
  function downloadJson(obj, name) {
    var text = JSON.stringify(obj, null, 2);
    var blob = new Blob([text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return blob.size;
  }

  /* ---------- persistence: IndexedDB, one record per object (#28) ---------- */
  var DB_NAME = "inventory-editor-alpha-mockup";
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("no indexedDB")); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore("objects", { keyPath: "id" });
        req.result.createObjectStore("meta", { keyPath: "key" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }
  function txDone(tx) { return new Promise(function (res, rej) { tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; tx.onabort = function () { rej(tx.error); }; }); }
  function record(o) { return { id: o.id, cls: o.cls, seq: o.seq, data: o.data, extra: o.extra, raw: o.raw, iri: o.iri }; }
  var channel = window.BroadcastChannel ? new BroadcastChannel(DB_NAME) : null;
  function saveAll() {
    return db().then(function (d) {
      var tx = d.transaction(["objects", "meta"], "readwrite");
      tx.objectStore("objects").clear();
      Object.keys(W.objs).forEach(function (k) { tx.objectStore("objects").put(record(W.objs[k])); });
      W.meta.root = W.root;
      W.meta.title = titleOf(W.objs[W.root]);
      W.meta.savedAt = Date.now();
      tx.objectStore("meta").put(W.meta);
      W.dirty = {}; W.removed = {};
      return txDone(tx);
    });
  }
  function saveDirty() {
    var dirty = Object.keys(W.dirty), removed = Object.keys(W.removed);
    W.dirty = {}; W.removed = {};
    return db().then(function (d) {
      var tx = d.transaction(["objects", "meta"], "readwrite");
      dirty.forEach(function (k) { if (W.objs[k]) tx.objectStore("objects").put(record(W.objs[k])); });
      removed.forEach(function (k) { tx.objectStore("objects").delete(k); });
      W.meta.title = titleOf(W.objs[W.root]);
      W.meta.savedAt = Date.now();
      tx.objectStore("meta").put(W.meta);
      return txDone(tx).then(function () {
        if (channel) channel.postMessage({ type: "saved", ids: dirty.concat(removed) });
        return W.meta.savedAt;
      });
    }, function (e) {
      dirty.forEach(function (k) { W.dirty[k] = 1; });
      removed.forEach(function (k) { W.removed[k] = 1; });
      throw e;
    });
  }
  function hasPending() { return W && (Object.keys(W.dirty).length || Object.keys(W.removed).length); }
  function readMeta() {
    return db().then(function (d) {
      var tx = d.transaction("meta");
      var r = tx.objectStore("meta").get("meta");
      return new Promise(function (res) { r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; });
    }).catch(function () { return null; });
  }
  function load() {
    return db().then(function (d) {
      var tx = d.transaction(["objects", "meta"]);
      var m = tx.objectStore("meta").get("meta");
      var all = tx.objectStore("objects").getAll();
      return txDone(tx).then(function () {
        if (!m.result) return null;
        W = { meta: m.result, root: m.result.root, objs: {}, dirty: {}, removed: {} };
        all.result.forEach(function (r) { W.objs[r.id] = r; });
        structureChanged();
        validateAll();
        return W;
      });
    });
  }
  function clear() {
    return db().then(function (d) {
      var tx = d.transaction(["objects", "meta"], "readwrite");
      tx.objectStore("objects").clear();
      tx.objectStore("meta").clear();
      return txDone(tx);
    }).then(function () { W = null; if (channel) channel.postMessage({ type: "cleared" }); });
  }
  function counts() {
    var c = {};
    Object.keys(W.objs).forEach(function (k) { var cls = W.objs[k].cls; c[cls] = (c[cls] || 0) + 1; });
    return c;
  }

  window.Inv = {
    SCHEMA: SCHEMA, INFO: INFO, SLUG: SLUG, TYPE_ORDER: TYPE_ORDER, CATALOG_MEMBER: CATALOG_MEMBER,
    propsOf: propsOf, prop: prop, linkMode: linkMode, linkProps: linkProps, linkIds: linkIds,
    get w() { return W; }, get: get, titleOf: titleOf, hasAnyValue: hasAnyValue, isEmpty: isEmpty,
    usedBy: usedBy, isReachable: isReachable, homePath: homePath, isLinked: isLinked,
    objectsOf: objectsOf, sortObjects: sortObjects, counts: counts,
    onChange: onChange, setValue: setValue, addLink: addLink, removeLink: removeLink,
    createLinked: createLinked, createUnlinked: createUnlinked, copyFor: copyFor, snapshot: snapshot, restore: restore, deletePlan: deletePlan, deleteObject: deleteObject,
    validate: validate, validateAll: validateAll, problemsOf: problemsOf, blanksOf: blanksOf, summary: summary,
    ImportError: ImportError, LoopError: LoopError, parseText: parseText, importCatalog: importCatalog,
    exportCatalog: exportCatalog, fileName: fileName, downloadJson: downloadJson,
    saveAll: saveAll, saveDirty: saveDirty, hasPending: hasPending, load: load, readMeta: readMeta, clear: clear,
    channel: channel
  };
})();
