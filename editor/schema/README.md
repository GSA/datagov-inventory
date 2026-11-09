# DCAT-US 3.0 schema

The editor reads the DCAT-US 3.0 JSON Schema definitions from
[GSA/dcat-us](https://github.com/GSA/dcat-us), pinned to one commit
([ADR 0010](../../docs/decisions/0010-depend-on-upstream-dcat-us-code.md)).

- `dcat-us/`: git submodule of GSA/dcat-us. Only `jsonschema/definitions/*.json` is read,
  as data. No upstream code is run. Fix definitions upstream, never here.
- `dcat-us.pin.json`: the pinned commit, its date, and the upstream licence.
- `dcat-us-document.schema.json`: the root schema for a whole document.

After cloning, run `git submodule update --init`.

## Moving the pin

```bash
cd editor
npm run schema:update -- <full commit SHA>   # or a branch, e.g. main
npm run test -- --run
git add schema/dcat-us schema/dcat-us.pin.json
```

`schema:update` checks out the commit in the submodule and rewrites `dcat-us.pin.json`
from git and the upstream `LICENSE.md`. It stops if the licence is no longer CC0 1.0.
CI runs `npm run schema:check`, which fails if the pin file doesn't match the submodule.

## The root schema

Upstream has one schema per class, each with its own `$id`
(e.g. `https://resources.data.gov/dcat-us/3.0.0/definitions/catalog`), and no single
starting point. A document is one `Catalog` at the top level, so the root schema is just a
`$ref` to the Catalog `$id`. To use it, register every definition with a 2020-12 validator
by its `$id`, then the root schema. `src/schema/validator.ts` does this with Ajv.

## Fixtures

`../fixtures/catalogs/{valid,invalid}/` hold small synthetic catalogs, named for what they
exercise, for the editor's tests. Each invalid one breaks exactly one rule, recorded in
`src/schema/fixtures.test.ts`; add an entry there when you add a fixture.
