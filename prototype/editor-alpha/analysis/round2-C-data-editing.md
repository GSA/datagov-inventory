# Round 2, analyst C: catalog data and editing

Schema facts checked against `schema/*.json`. A, B and D were messaged.

## 1. Critique

### A (users and journeys)

- **Sharing that cannot exist on load.** "Kind 112" alongside 3,214 datasets (J3), and contacts "used by 47 datasets" (J10, J11). Loading never merges objects (#20, #15), DCAT-US 3.0 has no references, and `Dataset.contactPoint` is Mandatory. So a freshly loaded 3,214-dataset file has **at least 3,214 Kinds, each used in 1 place**. Shares exist only after the user links an object in the editor (#25).
- **J8 "allowed-values field".** Only `accrualPeriodicity` has enums, and it also accepts free text matching `^R/P.+$`.
- **J9 Distribution form.** Distribution has **no Mandatory fields**. `downloadURL` and `mediaType` are Optional, so they need a "promote" hint (section 2).
- **J10 publisher.** `Dataset.publisher` is an **Organization**. The publisher of Catalog, DataService and DatasetSeries is an **Agent** (conflict 4).
- **J2 blank catalog.** "Datasets missing" in the form is right (#26). But `"dataset": []` passes the schema, so the check does not report it (conflict 3).

### B (IA and routes)

- **Workspace counts.** "Kind 41, Organization 6, shared 2,906 uses" alongside "Dataset 3,214" has the same problem: Kind and Organization would each be about 3,214.
- **`catalog.html`.** Title, description, publisher and contactPoint are all **Optional**; only `dataset` is Mandatory. Without a promote hint the title is hidden in the accordion.
- **Allowed values.** There is one enum field (Frequency), not several.
- **Tree group labels.** Use schema titles in sentence case ("Datasets", "Contact point"), not `dataset`, `contactPoint`.
- **Export file name.** Build it from the catalog *title* (#22): `department-of-example-affairs-data-catalog-2026-11-05.json`. With no title, use `catalog-2026-11-05.json`.
- **B open question 3.** Concept and Identifier are often plain strings. Treat string values as field values; only object-form instances appear in by-class lists. Confirm in #20.
- **Agreed:** internal ids in deep links, the generic Location page, the series note.

### D (USWDS, content, a11y)

- **Agreed:**
  - text inputs for dates
  - Optional fields in an accordion that opens when it contains an error
  - no stacked modals
  - radio tiles in the select dialog
  - error styling for schema failures; warning style only for non-schema hints (D open question 5)
  - Create is never blocked by missing Mandatory fields; they are flagged inline (D open question 7)
- **Frequency widget.** D's rule "combo box above 15 values" fails here, because the combo box cannot take free text such as `R/P1M`. Use a `usa-select` with optgroups "ISO 19115" and "Dublin Core", with duplicates removed, and a last option "Other repeating period (ISO 8601)" that reveals a separate text input. D agreed.
- **Settled by message with D:**
  - Section headings plus the USWDS asterisk and its explanatory sentence, instead of a level tag on every label.
  - Field messages are instructions with no path ("Start the email with mailto:, for example mailto:bridges@example.gov."). The path appears only in summaries.
  - "Enter a full web address, starting with https:// or http://".
  - "Enter each keyword separately".
  - Recheck **on blur**, not while the user is typing.
- **Copy to align with the sample.** "OSS Data Help Desk", 5 places; "4 problems in 3 objects"; 3,214 only on the large-catalog variant.
- **Gap.** The "Download catalog" offered when storage fails is an export, so it needs the shared-copies note too.

## 2. Refined form layouts (match B's pages)

Every page: an object header (class, label, "Used in N places", check status, Delete), then Required, Recommended, "Optional fields (n, k filled)" in an accordion, and "Other properties" (read-only). Sections come from `requirementLevel`; fields with no level count as Optional. A small override file (#19) adds `promote` (show in Recommended), `multiline` and `group` hints.

| Page | Required | Recommended (+ promoted) | Optional accordion (sub-groups) |
|---|---|---|---|
| `editor/catalog.html` | Datasets (list of Dataset cards; "Add dataset") | **+title, +description, +publisher** (Agent), Homepage, Schema version (conformsTo), Release date, Last modified, Language, Rights, Spatial coverage, Theme taxonomy | Contents · People · Description · Access · IDs · Temporal |
| `editor/dataset.html` | Title, Description (multiline), Identifier, Contact point (list) | Keywords, Theme, Distributions, Data dictionary, Landing page, Publisher (Organization), Last modified, Inventoried date, License, Rights, Access / Use / CUI restriction, Spatial coverage, Temporal coverage | Description · Dates and frequency (**Frequency** select) · Access and rights · People · Relationships · Provenance · IDs |
| `editor/distribution.html` | none. Note: "This class has no required fields." | Title, Description, Format, Access URL, **+Download URL, +Media type**, License, Rights, Last modified, Data dictionary, restrictions | Access (service, package, size, checksum) · Description · Resolution · IDs |
| `editor/dataservice.html` | Title, Endpoint URL (list), Contact point (list), Publisher (Agent) | Endpoint description (list), Serves dataset (list), License | Description · Dates · Access and rights · People · Coverage · IDs |
| `editor/dataset-series.html` | Title, Description | Series IRI (`@id`), Series members (ordered list), Contact point, Publisher (Agent), Last modified, Spatial, Temporal | Release date, Frequency, First, Last |
| `editor/contact.html` (Kind) | Formatted name, Email (`mailto:` hint) | none | Given name, Family name, Position title, Organization name, Telephone, Address |
| `editor/organization.html` | Name | none | Preferred label, Alternative label, Notation (list), Sub-organization of |
| `editor/object.html` (Location) | none | Preferred label, Bounding box (multiline) | Alternative label, Centroid, Geometry, Identifier, Gazetteer |

PeriodOfTime shows as a card ("1 Oct 2024 – 30 Sep 2025"); its form hint is "Give a start date, an end date, or both".

## 3. Final sample catalog ("restored working copy" story)

- **Catalog** `cat-01`: "Department of Example Affairs Data Catalog"
  - `@id` https://data.example.gov/catalog
  - language `en`, modified 2026-09-30, homepage https://data.example.gov/
  - conformsTo "DCAT-US 3.0"
  - publisher `org-dea`
  - `dataset` = D1–D7. D8 and D9 are listed only via the series.
- Identifiers are strings `DEA-OSS-0001`… Keywords are strings. Themes are Concept strings.
- File base: https://data.example.gov/files/

**Shared objects**

| id | Class | Name | Key values | Used in |
|---|---|---|---|---|
| org-dea | Organization | Department of Example Affairs | notation [DEA] | 3: cat-01 publisher, svc-01 publisher, org-oss parent |
| org-oss | Organization | Office of Sample Statistics | subOrganizationOf org-dea; notation [OSS] | 10: D1–D9 publisher, S1 publisher |
| kind-help | Kind | OSS Data Help Desk | mailto:data-help@example.gov, +1-555-0100 | **5**: D2, D4, D5, D7, svc-01 |
| kind-bridge | Kind | Bridge Program Office | **`bridges@example.gov`** (error) | 1: D1 |
| kind-lib | Kind | Library Statistics Team | mailto:library-stats@example.gov | 1: D3 |
| kind-wx | Kind | Weather Network Operations | mailto:wx-ops@example.gov | 1: D6 |
| kind-rosa | Kind | Dr. Rosa Example | mailto:r.example@example.gov | 3: S1, D8, D9 |

**Datasets**

| id | Title | Keywords | Freq. | Distributions (format, mediaType, URL) | Notes |
|---|---|---|---|---|---|
| D1 | Regional Bridge Condition Ratings | bridges, infrastructure, inspections | **`Monthly`** (error) | dist-01a "Bridge ratings (CSV)", CSV, text/csv, **`data.example.gov/files/bridge-ratings.csv`** (error: not a full URL) | **modified `03/14/2025`** (error); description `""` (hint only) |
| D2 | Community Garden Plot Registry | gardens, land use, parks | annual | CSV …/garden-plots.csv; GeoJSON application/geo+json …/garden-plots.geojson | spatial "City of Example" |
| D3 | Public Library Visits by Branch | libraries, visits | monthly | XLSX …/library-visits.xlsx; describedBy PDF …/library-visits-dictionary.pdf | temporal 2020–2025 |
| D4 | Fleet Vehicle Fuel Use, FY2025 | fleet, fuel, vehicles | annual | CSV …/fleet-fuel-fy2025.csv | **Other properties**: `bureauCode ["010:04"]`, `programCode ["010:001"]` |
| D5 | Grants to Local Partners | grants, awards | quarterly | CSV …/grants.csv; JSON application/json …/grants.json | license CC0 https://creativecommons.org/publicdomain/zero/1.0/ |
| D6 | Hourly Weather Station Readings | weather, temperature | `R/PT1H` | "Readings via API": accessURL https://api.example.gov/v1/readings, accessService svc-01 | temporalResolution PT1H |
| D7 | Sample Business Registry Extract | businesses, licensing | weekly | dist-07a (no title; label fallback "Distribution: ZIP"), packageFormat application/zip, mediaType text/csv …/business-registry.zip | |
| D8 | Sample Household Survey, 2024 | households, survey, income | none | CSV …/hhs-2024.csv; SAS application/x-sas-data …/hhs-2024.sas7bdat | series member only |
| D9 | Sample Household Survey, 2025 | households, survey, income | none | CSV …/hhs-2025.csv; SAS …/hhs-2025.sas7bdat | series member only |

**Series and service**

- **S1** "Sample Household Survey (annual series)"
  - `@id` https://data.example.gov/series/household-survey
  - seriesMember [D8, D9]; first D8; last D9
  - frequency annual; publisher org-oss; contact kind-rosa
- **svc-01** "Example Affairs Open Data API"
  - endpointURL [https://api.example.gov/v1/]
  - endpointDescription [https://api.example.gov/v1/openapi.json]
  - servesDataset [D3, D6]; contact kind-help; publisher org-dea; license CC0

**Totals:** 9 datasets, 1 series, 1 service, 14 distributions, 5 Kinds, 2 Organizations.

**Advisory check result: 4 problems in 3 objects.**
- D1: Last modified, Frequency
- kind-bridge: Email
- dist-01a: Download URL

**Large-catalog variant** (`workspace.html?state=large`, `editor/datasets.html`). This is a different, synthetic file, shown as **just loaded**:
- Dataset 3,214; Distribution 9,870; DatasetSeries 12; DataService 4
- Kind 3,230 and Organization 3,226, all "used in 1 place"
- PeriodOfTime 3,050; Location 2,980
- No shared badges

## 4. Conflicts and recommended resolutions

1. **Sample size (A versus C).** Settled: a detailed sample of 9 datasets for every editing screen, plus the synthetic large-catalog variant above for the scale story (#23, #29). Never mix the two sets of numbers on one screen.
2. **How a contact comes to be "used in 5 places".** Settled:
   The user linked kind-help into 5 places with "select existing" (#25), and the change was autosaved. #28 stores **the object graph, one object per record**, so the **restored working copy keeps the shares**. They become copies only in an exported file, including the storage-failure download (#22, ADR 0005). The mockup presents the sample as "your working copy from earlier".
3. **Empty Mandatory values** (`""`, `[]`) pass the schema. Recommended: the form marks them "Required: no value" (#26) as a warning-style hint. The check summary lists them in a separate group, "Not checked by the schema", so the advisory check itself stays schema-only.
4. **Agent versus Organization fields.** No class sets `additionalProperties: false`, so an Organization with `name` validates as an Agent. Recommended: Agent-typed fields (Catalog, DataService and DatasetSeries publisher) offer both Agents and Organizations. Organization-typed fields offer only Organizations. This lets org-oss and org-dea be shared as above. Confirm in #25.
5. **`format: "iri"` checking.** `ajv-formats` does not include `iri` by default. Without a custom format, D1's download-URL error would not appear. Recommended: #27 adds an `iri` format check, and the mockup shows the error.
6. **Override file** (#19). Recommended: CI checks that every key exists in the schema copy; new properties fall into "Other fields".

