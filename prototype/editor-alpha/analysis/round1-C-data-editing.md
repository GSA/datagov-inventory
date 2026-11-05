# Round 1, analyst C: catalog data and editing

Sources: the raw schema in `schema/*.json` (GSA/dcat-us @ 4996591), the digest, and #19, #20, #22, #24 to #27, ADR 0002 and ADR 0005.
Notation: **M** = Mandatory, **R** = Recommended. `[]` = list. `X|[X]` = one value or a list. `→X` = a field that holds an object of class X. date = `null | date-time | date | YYYY | YYYY-MM`.

## 1. Fields per class (from `requirementLevel`)

| Class (fields) | Mandatory | Recommended | Optional (suggested sub-groups) |
|---|---|---|---|
| **Catalog** (32) | `dataset` →Dataset[] | `themeTaxonomy` →ConceptScheme[], `conformsTo` →Standard (labelled "schema version"), `issued` date, `modified` date, `language` str\|[str] (maxLength 2), `rights` str[], `spatial` →Location[], `homepage` →Document | *Description:* title, description, keyword[], theme[], subject[], category[]. *Contents:* datasetSeries[], service[], catalog[], hasPart[], record[]. *People:* publisher →Agent, creator[], contactPoint →Kind[], rightsHolder[], qualifiedAttribution[]. *Rights:* accessRights, license. *IDs:* identifier, otherIdentifier[]. *Coverage:* temporal[] |
| **Dataset** (62) | `title` str, `description` str, `identifier` →Identifier (string or object), `contactPoint` →Kind\|[Kind] | `keyword` str[] (minLength 1), `theme` →Concept[], `distribution` →Distribution[], `describedBy` →Distribution ("data dictionary"), `landingPage` →Document, `publisher` →**Organization**, `modified` date, `inventoried` date, `license` str, `rights` str[], `accessRestriction` []/`useRestriction` []/`cuiRestriction`, `spatial` →Location\|[Location], `temporal` →PeriodOfTime[] | *Description:* subject[], category[], purpose, scopeNote, versionNotes, version, image (IRI), status →Concept. *Dates and frequency:* issued, created, accrualPeriodicity (enum), temporalResolution, spatialResolutionInMeters. *Access and rights:* accessRights, liabilityStatement, rightsHolder[], conformsTo[]. *People:* creator, contributor[], wasAttributedTo[], qualifiedAttribution[]. *Relationships:* hasPart, source, replaces, hasVersion, previousVersion, hasCurrentVersion, first, supportedSchema, qualifiedRelation, relation (IRI[]), isReferencedBy (IRI[]), page, sample, metadataDistribution. *Provenance:* provenance[], wasGeneratedBy[], wasUsedBy[], hasQualityMeasurement[]. *IDs:* otherIdentifier[] |
| **Distribution** (36) | **none** | `title`, `description`, `format` str, `accessURL` IRI, `license`, `rights` str[], `modified` date, `describedBy` →Distribution, `accessRestriction`/`useRestriction`/`cuiRestriction` | *Access:* downloadURL (IRI), accessService →DataService[], mediaType, packageFormat, compressFormat, byteSize (string), characterEncoding str[], checksum. *Description:* issued, inventoried, language, page[], image, status, availability, representationTechnique, conformsTo[]. *Resolution:* spatial/temporalResolution. *IDs, quality:* identifier, otherIdentifier[], hasQualityMeasurement[]. Plus accessRights |
| **DataService** (34) | `title`, `contactPoint` →Kind[], `endpointURL` IRI[], `publisher` →**Agent** | `endpointDescription` str[], `servesDataset` →Dataset[], `license` | Same groups as Dataset: description, keyword, theme, category; created/modified/inventoried; access/rights; creator, rightsHolder, qualifiedAttribution; spatial, temporal, resolutions; IDs; quality, wasUsedBy, conformsTo |
| **DatasetSeries** (14) | `title`, `description` | **`@id` IRI** (the only class where `@id` has a level, so it must appear as a field, "Series IRI"), `contactPoint` →Kind[], `seriesMember` →Dataset[], `publisher` →Agent, `modified`, `spatial` →Location[], `temporal` →PeriodOfTime[] | issued, accrualPeriodicity, first, last |
| **Kind** (contact) (10) | `fn` str ("formatted name"), `hasEmail` str, pattern `^mailto:…@….…$` | none | given-name, family-name, title ("position title"), organization-name, tel, address →Address[] |
| **Organization** (7) | `name` | none | prefLabel, altLabel, notation str[], subOrganizationOf →Organization[] |
| **PeriodOfTime** (helper) | none, but the object-level `anyOf` needs **startDate or endDate** | `startDate`, `endDate` (date) | none |

Where schema `required` and `requirementLevel` differ:
- For every class that has levels, `required` and Mandatory match exactly.
- **Concept**: the object form requires `prefLabel`, but no Concept property has a level. Concept and **Identifier** are both "string *or* object" (`anyOf`), and Identifier has no levels and no required fields.
- **PeriodOfTime** has the "one of start or end" rule shown above.
- `Dataset.hasVersion`, and `@id`/`@type` on every class, have no level. The generator must default them to Optional (and hide `@type`).
- **Mandatory does not mean non-empty.** Mandatory strings have no `minLength`, so `"title": ""` passes. Mandatory lists have no `minItems`, so `"dataset": []` and `"endpointURL": []` pass. The advisory check will not catch these.
- Surprises for the UI:
  - `Catalog.title` is only Optional, but #22 names the export file after it and the tree root needs a label.
  - Distribution has no Mandatory fields and its title is only Recommended.
  - Both need a fallback label, for example "Distribution: CSV (bridges.csv)" or "Untitled distribution 3".
  - `Dataset.publisher` must be an Organization, while Catalog, DataService and DatasetSeries publishers are Agents. So "select existing" offers different classes depending on the field (#25).
- Upstream labels are lower-case and uneven ("keyword/tag", "spatial/geographic coverage", "Spatial resolution (meters)", and Distribution's typo "termporal resolution"). Show them in sentence case. The typo will show unless upstream fixes it.

## 2. Splitting the form into sections

What the schema gives us (#19):
- requirementLevel
- cardinality
- type, enum, pattern, format, and the allowed classes
- title and description (used as label and help text)

The **level-based split works with no extra data**:
1. A header strip: class, display label, "Used in N places" with a list of those places (#25), and the check status (#27).
2. **Required**, open: required markers on each field, using USWDS's "Required fields are marked with an asterisk (*)" pattern.
3. **Recommended**, open, with a short "not required but strongly advised" intro.
4. **Optional**, in a USWDS accordion, collapsed. The heading shows a count, e.g. "Optional fields (40, 3 filled)". It opens automatically when a field inside is filled or has an error.
5. **Other properties (not in DCAT-US 3.0)**: read-only key/value list with values shown as escaped JSON, plus the note "kept unchanged on export" (#24). Hidden when empty.

The theme groups in the table above (Description / Dates / Access and rights / Coverage / People / Relationships / IDs) are **not derivable** from the schema. They would need a small override file kept next to the generator (a `property → group` map), not an edit to the schema copy. Unmapped new properties would fall into "Other fields", which keeps the #19 rule that new properties appear with no code change.
- Recommendation for the mockups: level-based sections, with theme sub-headings only inside the long Dataset Optional accordion.

The #19 question (simple or expanded text box) also **needs a hint**. Every free-text field is plain `type: string`, and `title` looks exactly like `description`. Proposed solution: the same override file carries `multiline: true` for these fields:
- description
- purpose
- versionNotes
- liabilityStatement
- scopeNote
- restrictionNote
- each item of provenance and rights

All other strings get a single-line input.

## 3. Field widgets

| Schema shape | Widget |
|---|---|
| `string` | USWDS text input. A textarea where the override says multiline |
| date (anyOf date-time / date / YYYY / YYYY-MM) | **Plain text input with a hint** ("YYYY, YYYY-MM, YYYY-MM-DD, or date and time"), not the USWDS date picker, which only accepts full dates and would reject "2025" |
| `format: iri` (35 places: downloadURL, accessURL, endpointURL items, image, relation, isReferencedBy, @id) | `type="url"` input with an "https://…" hint. No live link-following (no network, per the CSP) |
| Kind `hasEmail` | Text input with the hint "mailto:name@example.gov". Optionally a "Add mailto: for me" link that shows when the value is a bare email |
| enum: only `accrualPeriodicity` (Dataset, DatasetSeries) | **USWDS combo box** with ISO 19115 and Dublin Core values. Some values are in both lists ("daily", "weekly"), so remove duplicates. A free-text "Other (ISO 8601 repeat, e.g. R/P1M)" option is needed for the `^R/P.+$` branch |
| `str[]` (keyword, rights, provenance, endpointURL, notation, characterEncoding) | Repeatable rows: input, Move up / Move down buttons (no drag-only), Remove, and "Add another keyword" (#24) |
| `str\|[str]` (language) | Treat as a list in the UI, but keep the original shape on export if the field was not edited, because #22 requires exact round-trip |
| `→X` single (publisher, describedBy, landingPage, identifier) | A card that shows the linked object's label and "Used in N places", with Open, Change (select existing), Remove link, and "Create new X" (#25) |
| `→X[]` / `→X\|[X]` (contactPoint, distribution, theme, spatial, temporal) | Ordered list of those cards with Move up/down and "Add: select existing or create new". "Edit a copy for this one" appears when N > 1 (#25). "Remove link" only unlinks the object (#26) |
| Concept / Identifier (string or object) | Default to a plain string input. A "Use detailed form" toggle switches to the object's form (Concept prefLabel/definition/inScheme; Identifier notation/schemaAgency/…) |
| `string\|object` geometry (Location bbox/centroid/geometry) | Textarea for WKT/GeoJSON text; object values stay read-only in the alpha (open question) |

Select-existing dialog (#25):
- Keyword search over objects of the allowed class held in memory.
- Each result shows its label, its class, and "used in N places".
- "Create new Contact (Kind)" swaps the dialog content and adds a breadcrumb "Contact point › New contact". A dialog never opens a second dialog.

## 4. Validation (#27)

The check validates the assembled document, so a shared object produces one error per place that uses it (5 errors for a contact used 5 times). **Group by object identity**: show the error once, on the object, with "affects 5 places".

Plain wording uses a readable path built from labels, never `/dataset/3/contactPoint/0/hasEmail`:

| Raw Ajv error | Message |
|---|---|
| `required: title` | "**Dataset "Untitled dataset 3" › Title**: Title is required." |
| `required: contactPoint` | "Dataset "Regional Bridge Condition Ratings" › **Contact point**: add at least one contact." |
| `pattern` on hasEmail = `bridges@example.gov` | "Contact "Bridge Program Office" › **Email**: must start with `mailto:`, for example `mailto:bridges@example.gov`." |
| date anyOf ×5 sub-errors for `03/14/2025` | Collapse into one: "› **Last modified**: use YYYY, YYYY-MM, YYYY-MM-DD or a date and time (you entered 03/14/2025)." |
| `format: iri` for `data.example.gov/bridges.csv` | "Distribution "Bridge ratings (CSV)" › **Download URL**: must be a full web address starting with https://." |
| enum/anyOf on `Monthly` | "› **Frequency**: choose a value from the list (for example "monthly"), or an ISO 8601 repeat such as R/P1M." |
| type: keyword is a string | "› **Keywords**: must be a list; each keyword is a separate entry." |
| PeriodOfTime anyOf | "› **Temporal coverage 1**: give a start date, an end date, or both." |

How results are shown:
- **Summary.** A USWDS alert (error variant with a text heading, so it is not colour-only):
  - Heading: "Advisory check: 7 problems in 4 objects."
  - Body: "Checked against the DCAT-US 3.0 schema copy (GSA/dcat-us 4996591, 2026-10-07). This is not the official Data.gov validator."
  - Problems are grouped by class (Datasets 2, Contacts 1 (used in 5 places), Distributions 1). Each entry links to the object and the field.
- **Next to the field.** The USWDS `usa-form-group--error` style plus an error message tied to the input with `aria-describedby`.
- **In the tree.** An icon plus the text "2 problems" on the node (#23).
- **Stale results.** After an edit the object's badge becomes "Changed since last check". It is re-checked about 1 s after typing stops. Any whole-catalog summary keeps its rows but adds "Results may be out of date. Check again."
- **Export with errors.** The export step shows the summary first. Buttons: "Download anyway" and "Go back and fix". Text: "This file did not pass the advisory check." (#27).
- **Recommended fields** are never schema errors. The mockup could show a neutral "3 recommended fields are empty" note (open question).

## 5. Bulk actions

The epic has **no bulk editing**: no multi-select, no bulk find/replace, no batch delete, no merging of duplicates (merging on load is explicitly out of scope).

The only things that act on many items are:
- check the whole catalog (#27)
- delete a shared object, which removes it from every place after a confirmation listing those places (#26)
- edit a shared object once, which changes it everywhere (#25)
- export the whole file (#22)

Undo covers only the last removal (#26); full undo/redo is out. The mockups should not show bulk controls.

## 6. Sample catalog for the mockup

**Catalog** "Department of Example Affairs Data Catalog"
- `@id` https://data.example.gov/catalog
- `conformsTo` → Standard "DCAT-US 3.0"
- `language` ["en"], `modified` 2026-09-30
- `homepage` https://data.example.gov/
- `publisher` → Organization "Department of Example Affairs" (notation ["DEA"])

**Shared objects:**
- **Org "Office of Sample Statistics" (OSS)**, subOrganizationOf DEA. Used in 7 places (publisher of D1-D7).
- **Contact "OSS Data Help Desk"**, `mailto:data-help@example.gov`, tel +1-555-0100. **Used in 5 places**: D4, D5, D6, D7 and S1's contactPoint.
- Contact "Bridge Program Office", `hasEmail: "bridges@example.gov"` (**error**: no mailto). Used in 1 place.
- Contact "Dr. Rosa Example", `mailto:r.example@example.gov`, used by the series.

**Datasets** (identifiers `DEA-OSS-00n`, keywords, theme strings, temporal PeriodOfTime, spatial "State of Example"):
1. **D1 Regional Bridge Condition Ratings** (**errors**). Description is `""`, which is not a schema error; show it as a hint. `modified: "03/14/2025"`, `accrualPeriodicity: "Monthly"`, contact = Bridge Program Office. Distribution "Bridge ratings (CSV)" with `downloadURL: "data.example.gov/bridges.csv"`. Keywords bridges, infrastructure, inspections.
2. **D2 Community Garden Plot Registry**: CSV + GeoJSON (`application/geo+json`). Keywords gardens, land use.
3. **D3 Public Library Visits by Branch**: XLSX + describedBy PDF data dictionary. Frequency monthly.
4. **D4 Fleet Vehicle Fuel Use, FY2025**. Has unknown properties `bureauCode: ["010:04"]` and `programCode: ["010:001"]` left over from DCAT-US 1.1, which show in the **Other properties** section.
5. **D5 Grants to Local Partners**: CSV + JSON. License https://creativecommons.org/publicdomain/zero/1.0/
6. **D6 Hourly Weather Station Readings**. Distribution with accessURL + accessService → the API. Frequency R/PT1H.
7. **D7 Sample Business Registry Extract**: ZIP (packageFormat application/zip, mediaType text/csv).
8. **D8 / D9 Sample Household Survey, 2024 / 2025**: series members only, not in `Catalog.dataset`. CSV + SAS (`application/x-sas-data`) each.

**Series S1 "Sample Household Survey (annual)"**
- `@id` https://data.example.gov/series/household-survey
- seriesMember [D8, D9], first D8, last D9
- accrualPeriodicity annual, publisher OSS

**DataService "Example Affairs Open Data API"**
- endpointURL [https://api.example.gov/v1/]
- endpointDescription [https://api.example.gov/v1/openapi.json]
- servesDataset [D3, D6], contactPoint Data Help Desk, publisher DEA, license CC0

Totals for the tree: 9 datasets, 1 series, 1 service, about 14 distributions, 4 contacts, 2 organizations. The check should report 4 errors in 3 objects (D1: date and frequency; Bridge contact: email; D1 CSV: download URL, but only if the IRI format is checked, see open question 2).

## Open questions

1. **Shared contact in the sample.** #20 and the epic say identical objects in a loaded file stay separate. So "used in 5 places" can only come from the user linking objects in the editor. Should the mockup tell this as a restored working copy (#28)?
2. Will Ajv actually check `format: "iri"`? It is not in ajv-formats by default. If it isn't checked, bad URLs give no error.
3. Should empty Mandatory values (`""`, `[]`) and empty Recommended fields show as non-schema hints, given the rule that the check is advisory and based only on the schema?
4. Who owns the override file (field grouping and multiline hints), and does CI check that it is current with the schema, as #19 does for form models?
5. What label should be used for untitled Catalogs and Distributions, and what file name does #22 use when there is no catalog title?
6. How should object-valued Location geometry (GeoJSON) be edited in the alpha: read-only or a raw JSON textarea?
