# DCAT-US 3.0 schema

The editor reads the official DCAT-US 3.0 JSON Schema definitions from
[GSA/dcat-us](https://github.com/GSA/dcat-us), pinned to one commit.

| Path | What it is |
|------|------------|
| `dcat-us/` | Git submodule of GSA/dcat-us at the pinned commit. Only `jsonschema/definitions/*.json` is read. |
| `dcat-us.pin.json` | The pinned commit, its date, and the upstream licence (CC0 1.0). Written by the update script. |
| `dcat-us-document.schema.json` | The root schema for a whole DCAT-US 3.0 document. |

After cloning, fetch the submodule:

```bash
git submodule update --init
```

## Rules

- **Schema definitions only.** The editor reads the JSON definition files as data. It runs
  no code from the submodule (no Python, no npm scripts) and installs none of its
  dependencies. See [ADR 0010](../../docs/decisions/0010-depend-on-upstream-dcat-us-code.md).
- **Never edit the definitions here.** Fix them upstream in GSA/dcat-us, then move the pin.

## Moving the pin

```bash
cd editor
npm run schema:update -- <full commit SHA>   # or a branch, e.g. main
npm run schema:check
npm run test -- --run
git add schema/dcat-us schema/dcat-us.pin.json
```

`schema:update` fetches the commit into the submodule, checks it out, and rewrites
`dcat-us.pin.json` from git (commit, committer date) and the upstream `LICENSE.md`. It
stops if the licence is no longer CC0 1.0, so a licence change is reviewed by a person.
A point release is a pin move, not a code change.

`schema:check` runs in CI. It fails if `dcat-us.pin.json`, the submodule's checked-out
commit, and the commit the repository records for the submodule disagree.

## The root schema

Upstream has one schema per class (`Catalog.json`, `Dataset.json`, and so on), each with
its own `$id` such as `https://resources.data.gov/dcat-us/3.0.0/definitions/catalog`,
and no single starting point for a document. A DCAT-US 3.0 document is one `Catalog`
object at the top level, so `dcat-us-document.schema.json` is a 2020-12 schema whose
only rule is a `$ref` to the Catalog definition. Its `$id` is a URN because it is
Inventory's, not upstream's.

To validate with it, register every definition with the validator by its `$id`, then
the root schema; cross-class `$ref`s such as `/dcat-us/3.0.0/definitions/dataset`
resolve against those `$id`s. `src/schema/validator.ts` does this with Ajv (draft
2020-12), checking the `date`, `date-time` and `iri` formats as upstream's own tests do.
The upstream keywords `requirementLevel` and `_oldDocs` are documentation and are
registered as annotations.

## Code

- `src/schema/index.ts`: `getClassSchema('Dataset')` returns the schema for a class by
  name; `classNames`, `rootSchema` and `schemaPin` are exported too.
- `src/schema/validator.ts`: `validateDocument(catalog)` and `validateClass(name, value)`.
  Tests use it. Product validation goes through the Data.gov validator API (ADR 0010).

## Fixtures

`../fixtures/catalogs/valid/` and `../fixtures/catalogs/invalid/` hold small synthetic
catalogs, named for what they exercise, and shared by the editor's tests. Each invalid
catalog is invalid in exactly one way, recorded in `src/schema/fixtures.test.ts`; add an
entry there when you add one. The same test also checks upstream's own
`jsonschema/examples` (read as data) so a pin move that changes their results is caught.
