/*
 * Mock data for the editor alpha mockup. All of it is fictional (Department of Example
 * Affairs, example.gov). Both samples are plain DCAT-US 3.0 JSON and are loaded through
 * the same import path as a real file.
 *
 *   InvSamples.small()        the detailed 9-dataset sample, with 4 prepared problems
 *   InvSamples.large(n)       n generated datasets (default 2,000), about the size of the
 *                             Department of Justice catalog (about 1,800 datasets, 2.4 MB).
 *                             Generated in the browser so nothing large is committed.
 *   InvSamples.blank()        the "Start from scratch" catalog
 */
(function () {
  "use strict";

  var DEA = { "@id": "https://example.gov/org/dea", "@type": "Organization", name: "Department of Example Affairs" };
  var OSS = { "@id": "https://example.gov/org/oss", "@type": "Organization", name: "Office of Sample Statistics", subOrganizationOf: [DEA] };
  var HELP = { "@id": "https://example.gov/contact/oss-help", "@type": "Kind", fn: "OSS Data Help Desk", hasEmail: "mailto:data-help@example.gov" };
  var ROSA = { "@id": "https://example.gov/contact/rosa", "@type": "Kind", fn: "Dr. Rosa Example", hasEmail: "mailto:rosa.example@example.gov", title: "Survey methodologist" };

  function dist(title, format, mediaType, url, extra) {
    var d = { "@type": "Distribution", title: title, format: format, mediaType: mediaType, downloadURL: url };
    Object.keys(extra || {}).forEach(function (k) { d[k] = extra[k]; });
    return d;
  }

  function small() {
    var grants = {
      "@id": "https://example.gov/dataset/grants", "@type": "Dataset", identifier: "DEA-OSS-0005", title: "Grants to Local Partners",
      description: "Grants awarded by the Office of Sample Statistics to local partner organizations, by fiscal year, program and recipient city. Amounts are in U.S. dollars.",
      keyword: ["grants", "awards", "local government"], theme: ["Finance", "Community development"], modified: "2026-08-15", inventoried: "2021-02-10",
      accrualPeriodicity: "quarterly", publisher: OSS, contactPoint: [HELP],
      landingPage: { "@type": "Document", title: "Grants to Local Partners", accessURL: "https://data.example.gov/grants" },
      distribution: [
        dist("Grants (CSV)", "CSV", "text/csv", "https://data.example.gov/grants/grants.csv"),
        dist("Grants (JSON)", "JSON", "application/json", "https://data.example.gov/grants/grants.json")
      ]
    };
    var bridges = {
      "@id": "https://example.gov/dataset/bridges", "@type": "Dataset", identifier: "DEA-OSS-0002", title: "Regional Bridge Condition Ratings",
      description: "", keyword: ["bridges", "infrastructure", "inspections"], modified: "03/14/2025", accrualPeriodicity: "Monthly",
      publisher: OSS, contactPoint: [{ "@type": "Kind", fn: "Bridge Program Office", hasEmail: "bridges@example.gov" }],
      distribution: [dist("Bridge ratings (CSV)", "CSV", "text/csv", "data.example.gov/bridges/ratings.csv")]
    };
    var api = {
      "@id": "https://example.gov/service/open-data-api", "@type": "DataService", title: "Example Affairs Open Data API",
      description: "A read-only JSON API for several Department of Example Affairs datasets.",
      endpointURL: ["https://api.example.gov/v1/"], contactPoint: [HELP], publisher: DEA, license: "https://creativecommons.org/publicdomain/zero/1.0/"
    };
    var weather = {
      "@id": "https://example.gov/dataset/weather", "@type": "Dataset", identifier: "DEA-OSS-0003", title: "Hourly Weather Station Readings",
      description: "Hourly temperature, wind and precipitation readings from 42 department weather stations.", keyword: ["weather", "climate"], theme: ["Environment"],
      modified: "2026-11-01", accrualPeriodicity: "R/PT1H", publisher: OSS,
      contactPoint: [{ "@type": "Kind", fn: "Weather Network Operations", hasEmail: "mailto:weather-ops@example.gov" }],
      distribution: [
        { "@type": "Distribution", title: "Readings via API", accessURL: "https://api.example.gov/v1/weather", accessService: [api] },
        dist("Readings (CSV, last 30 days)", "CSV", "text/csv", "https://data.example.gov/weather/last30.csv")
      ]
    };
    // Not the weather dataset: its distribution already points at this service, and DCAT-US
    // JSON writes linked objects out in full, so that would be a loop the export cannot write.
    api.servesDataset = [{ "@id": "https://example.gov/dataset/grants" }, { "@id": "https://example.gov/dataset/library" }];
    var library = {
      "@id": "https://example.gov/dataset/library", "@type": "Dataset", identifier: "DEA-OSS-0004", title: "Public Library Visits by Branch",
      description: "Monthly visitor counts at each public library branch in the City of Example.", keyword: ["libraries", "visits"], modified: "2026-10-03",
      accrualPeriodicity: "monthly", publisher: OSS,
      contactPoint: [{ "@type": "Kind", fn: "Library Statistics Team", hasEmail: "mailto:library-stats@example.gov" }],
      spatial: [{ "@type": "Location", prefLabel: "City of Example" }],
      distribution: [dist("Library visits (XLSX)", "XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "https://data.example.gov/library/visits.xlsx")]
    };
    var dictionary = { "@type": "Distribution", title: "Data dictionary (PDF)", format: "PDF", mediaType: "application/pdf", downloadURL: "https://data.example.gov/survey/dictionary.pdf" };
    function survey(year) {
      return {
        "@id": "https://example.gov/dataset/survey-" + year, "@type": "Dataset", identifier: "DEA-OSS-HHS-" + year, title: "Sample Household Survey, " + year,
        description: "Weighted responses from the " + year + " Sample Household Survey. Personal information has been removed.",
        keyword: ["survey", "households"], modified: year + "-12-01", accrualPeriodicity: "annual", publisher: OSS, contactPoint: [ROSA],
        describedBy: dictionary,
        distribution: [dist("Survey " + year + " (CSV)", "CSV", "text/csv", "https://data.example.gov/survey/" + year + ".csv"),
          dist("Survey " + year + " (SAS)", "SAS", "application/x-sas", "https://data.example.gov/survey/" + year + ".sas7bdat")]
      };
    }
    var s24 = survey(2024), s25 = survey(2025);
    var series = {
      "@type": "DatasetSeries", title: "Sample Household Survey (annual series)", description: "The Sample Household Survey, one dataset per year.",
      accrualPeriodicity: "annual", contactPoint: [ROSA], publisher: OSS,
      seriesMember: [{ "@id": s24["@id"] }, { "@id": s25["@id"] }], first: { "@id": s24["@id"] }, last: { "@id": s25["@id"] }
    };
    var registry = {
      "@id": "https://example.gov/dataset/registry", "@type": "Dataset", identifier: "DEA-OSS-0007", title: "Sample Business Registry Extract",
      description: "Registered businesses by industry code and city.", keyword: ["businesses"], publisher: OSS, contactPoint: [HELP],
      distribution: [{ "@type": "Distribution", format: "ZIP", mediaType: "application/zip", downloadURL: "https://data.example.gov/registry/extract.zip" }]
    };
    var fleet = {
      "@id": "https://example.gov/dataset/fleet", "@type": "Dataset", identifier: "DEA-OSS-0008", title: "Fleet Vehicle Fuel Use, FY2025",
      description: "Fuel purchased for department fleet vehicles in fiscal year 2025, by vehicle class and month.", keyword: ["fleet", "fuel"], publisher: OSS,
      contactPoint: [HELP], temporal: [{ "@type": "PeriodOfTime", startDate: "2024-10-01", endDate: "2025-09-30" }],
      distribution: [dist("Fleet fuel use (CSV)", "CSV", "text/csv", "https://data.example.gov/fleet/fuel-fy2025.csv")]
    };
    var garden = {
      "@id": "https://example.gov/dataset/garden", "@type": "Dataset", identifier: "DEA-OSS-0009", title: "Community Garden Plot Registry",
      description: "Community garden plots, their size and whether they are available.", keyword: ["gardens", "parks"], publisher: OSS, contactPoint: [HELP],
      spatial: [{ "@type": "Location", prefLabel: "Example County" }],
      distribution: [dist("Garden plots (CSV)", "CSV", "text/csv", "https://data.example.gov/garden/plots.csv"),
        dist("Garden plots (GeoJSON)", "GeoJSON", "application/geo+json", "https://data.example.gov/garden/plots.geojson")]
    };
    return {
      "@type": "Catalog", title: "Department of Example Affairs Data Catalog",
      description: "Public datasets from the Department of Example Affairs.", publisher: DEA, modified: "2026-11-01",
      homepage: { "@type": "Document", title: "Example Affairs open data", accessURL: "https://data.example.gov/" },
      dataset: [grants, bridges, weather, library, s24, s25, registry, fleet, garden],
      datasetSeries: [series], service: [api]
    };
  }

  /* ---------- the large catalog: deterministic, so every tab builds the same one ---------- */
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  var COMPONENTS = ["Bureau of Example Statistics", "Office of Example Programs", "Example Investigation Service", "Office of Example Grants",
    "Example Corrections Bureau", "Office of Example Victims Services", "Example Marshals Service", "Office of Example Policy",
    "Example Enforcement Administration", "Office of the Example Inspector", "Example Community Relations Service", "Office of Example Records"];
  var SUBJECTS = ["Arrests", "Grant Awards", "Case Filings", "Victimization Survey", "Prison Population", "Juvenile Court Referrals", "Firearm Checks",
    "Asset Forfeiture", "Civil Rights Complaints", "Drug Seizures", "Probation Caseloads", "Jail Admissions", "Court Dispositions", "Body-Worn Camera Use",
    "Hate Crime Reports", "Use of Force Incidents", "Recidivism", "Reentry Programs", "Tribal Justice Grants", "Language Access Requests"];
  var BY = ["by State", "by County", "by Month", "by Offense Type", "by Age Group", "by Agency", "by District", "by Program", "by Facility", "Nationwide"];
  var WORDS = ("collection reporting agencies voluntary submitted counts records estimates includes excludes methodology revised annual " +
    "national state local federal tribal program office data series survey sample weighted response population incidents facility " +
    "jurisdiction quarterly published preliminary final adjusted definitions summary detailed tables respondents coverage").split(" ");

  function large(n) {
    n = n || 2000;
    var r = rng(20261106);
    function pick(a) { return a[Math.floor(r() * a.length)]; }
    function sentence(k) { var s = []; for (var i = 0; i < k; i++) s.push(pick(WORDS)); s[0] = s[0][0].toUpperCase() + s[0].slice(1); return s.join(" ") + "."; }
    var top = { "@id": "https://example.gov/org/dej", "@type": "Organization", name: "Department of Example Justice" };
    var orgs = COMPONENTS.map(function (name, i) { return { "@id": "https://example.gov/org/dej-" + i, "@type": "Organization", name: name, subOrganizationOf: [top] }; });
    var datasets = [];
    for (var i = 0; i < n; i++) {
      var org = pick(orgs);
      var year = 2005 + Math.floor(r() * 21);
      var title = pick(SUBJECTS) + " " + pick(BY) + ", " + year + (r() < 0.3 ? " (" + org.name.replace(/^(Office of |Bureau of )/, "") + ")" : "");
      var slug = "dej-" + (100000 + i);
      var desc = [];
      for (var s = 0; s < 2 + Math.floor(r() * 3); s++) desc.push(sentence(8 + Math.floor(r() * 7)));
      var email = "mailto:" + org.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@example.gov";
      var d = {
        "@id": "https://example.gov/dataset/" + slug, "@type": "Dataset", identifier: slug.toUpperCase(), title: title,
        description: desc.join(" "),
        keyword: [pick(SUBJECTS).toLowerCase(), pick(WORDS), pick(WORDS), "justice"],
        modified: (year + 1) + "-0" + (1 + Math.floor(r() * 9)) + "-1" + Math.floor(r() * 9),
        accrualPeriodicity: pick(["annual", "monthly", "quarterly", "irregular", "notPlanned"]),
        publisher: org,
        // Like the real export: the contact is written out again in every dataset, with no @id.
        contactPoint: [{ "@type": "Kind", fn: org.name + " Data Team", hasEmail: email }],
        landingPage: { "@type": "Document", title: "Landing page", accessURL: "https://www.example.gov/data/" + slug },
        distribution: []
      };
      var k = 1 + Math.floor(r() * 3);
      for (var j = 0; j < k; j++) {
        var f = [["CSV", "text/csv"], ["JSON", "application/json"], ["PDF", "application/pdf"], ["XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]][j % 4];
        d.distribution.push({ "@type": "Distribution", title: "Data (" + f[0] + ")", format: f[0], mediaType: f[1], downloadURL: "https://www.example.gov/data/" + slug + "/data." + f[0].toLowerCase() });
      }
      // a few realistic problems, so the check has something to find at scale
      if (i % 97 === 5) d.modified = "0" + (1 + i % 9) + "/15/" + year;
      if (i % 131 === 7) d.contactPoint[0].hasEmail = email.replace("mailto:", "");
      if (i % 173 === 11) delete d.description;
      datasets.push(d);
    }
    return { "@type": "Catalog", title: "Department of Example Justice Data Catalog (generated, " + n.toLocaleString() + " datasets)", publisher: top, dataset: datasets };
  }

  function blank() { return { "@type": "Catalog", dataset: [] }; }

  window.InvSamples = { small: small, large: large, blank: blank };
})();
