# Editor performance on large catalogs

How responsive the browser-only editor is with catalogs of 300 to 6,000 datasets, measured for
[#29](https://github.com/GSA/datagov-inventory/issues/29) in November 2026. This is the evidence for
[ADR 0014](decisions/0014-browser-only-metadata-editor.md) ("measurements with catalogs through at least 3,000 datasets
establish and disclose the supported browser limit") and for the condition in
[ADR 0002](decisions/0002-ui-rendering-architecture-for-inventory-v2.md#conditions-that-reverse-this-decision) that a
3,000-dataset catalog must load and edit responsively in the browser.

**In short:** a catalog of 3,000 datasets loads in under 2 seconds. On a fast laptop, every action measured responds
within about 100 ms. The one exception is opening the catalog itself, which takes about 160 ms because its form lists
every dataset. A catalog of 6,000 datasets loads in under 4 seconds and responds just as well. Apart from that one
action, no budget fails, so the alpha states no smaller supported size.

## Budgets

There are no agreed targets. The aim is that the editor never feels laggy. The 100 ms input-to-next-paint limit comes
from [RAIL](https://web.dev/articles/rail) and [DESIGN.md](../DESIGN.md#performance). The other budgets are proposals
sized to what a person waits for without losing track. `e2e/catalog-performance.spec.ts` fails if a 3,000-dataset run
misses one.

| Action on 3,000 datasets (full CPU speed) | Budget | Measured (worst run) | |
|---|---|---|---|
| Any input to the next paint (keys, clicks, scroll frames) | 100 ms | 80 ms | ✅ |
| Opening the catalog's form (lists all 3,000 datasets) | 100 ms | 160 ms | ❌ see [Findings](#findings) |
| Load: choose the file to the tree painted | 3 s | 1.75 s | ✅ |
| Restore: reload to the tree painted | 2 s | 0.37 s | ✅ |
| Autosave: leave a field to "Saved" | 1 s | 0.31 s | ✅ |
| Check: Validate catalog to the result | 1 s | 0.08 s | ✅ |
| Export: click to the file offered | 1 s | 0.07 s | ✅ |
| JavaScript heap after load | 150 MB | 44 MB | ✅ |

## Method

- **Catalogs:** `editor/fixtures/largeCatalog.ts` generates them. Each dataset has a contact, the shared publisher and
  3 distributions: 5 objects per dataset once the publisher merges on import, so 15,002 objects for 3,000 datasets.
  `npm run generate:catalogs` writes the 300, 1,000, 3,000 and 6,000 versions to `editor/generated-catalogs/` for
  importing by hand.
- **Build:** the production build (`npm run build && npm run preview`).
- **Timing:** interactions are timed from input to the next paint with the Event Timing API, as INP is. Longer jobs
  are timed from the input until their result is painted. Every wait happens inside the page (MutationObserver), and
  clicks use `page.mouse`, because Playwright's locator polling slows the page it is timing. Each action runs at least
  3 times, and the tables show the slowest run.
- **Browser profile:** each run uses a new profile on disk, as people have. Playwright's usual browser contexts keep
  IndexedDB in memory, where storing a catalog is 7 times slower (see [Findings](#findings)).
- **Machine:** Apple M3 Pro (12 cores, 36 GB), macOS 26.6. Browsers: Playwright's Chromium (HeadlessChrome 149),
  Google Chrome 149 and Microsoft Edge 158. `CPU_THROTTLE=4` emulates a slower laptop by slowing the page's CPU 4 times.
  No one has measured on a typical government laptop in a managed browser yet.

Run again:

```bash
cd editor
PERF=1 npx playwright test catalog-performance          # the whole loop at 300, 1,000, 3,000 and 6,000 datasets
PERF=1 npx playwright test tree-performance validation-performance
CPU_THROTTLE=4 PERF=1 npx playwright test catalog-performance        # a slower laptop
CHANNEL=msedge PERF=1 npx playwright test catalog-performance -g 3,000  # installed Edge (or chrome)
```

## Results

### The whole loop, by catalog size (Chromium, full CPU speed, worst of 6 runs)

| | 300 | 1,000 | 3,000 | 6,000 |
|---|---|---|---|---|
| File size | 0.3 MB | 0.8 MB | 2.5 MB | 5.1 MB |
| Load: choose the file to the tree painted | 0.34 s | 0.65 s | 1.75 s | 3.8 s |
| JavaScript heap after load | 9 MB | 17 MB | 44 MB | 55 MB |
| DOM nodes after load | 6,085 | 17,988 | 51,988 | 102,985 |
| Scroll the tree: longest frame | 16 ms | 16 ms | 16 ms | 16 ms |
| Filter: type a key | 16 ms | 16 ms | 16 ms | 32 ms |
| Filter: key to the tree painted | 19 ms | 34 ms | 69 ms | 132 ms |
| Edit: type a key in a field | 24 ms | 40 ms | 80 ms | 16 ms |
| Save: leave the field (Tab) | 16 ms | 16 ms | 24 ms | 40 ms |
| Save: leave the field to "Saved" | 44 ms | 112 ms | 307 ms | 773 ms |
| Restore: reload to the tree painted | 92 ms | 162 ms | 374 ms | 958 ms |
| Check: click | 16 ms | 16 ms | 32 ms | 56 ms |
| Check: click to the result | 26 ms | 39 ms | 82 ms | 200 ms |
| Export: click | 16 ms | 16 ms | 24 ms | 56 ms |
| Export: click to the file offered | 29 ms | 33 ms | 74 ms | 142 ms |

Times of 16 ms mean one frame or less. The filter keeps the input responsive and lets the tree catch up
(`useDeferredValue`), so "key to the tree painted" is not an input-to-next-paint time.

### A slower laptop (CPU 4× slower, worst of 3 runs)

| | 3,000 | 6,000 |
|---|---|---|
| Load: choose the file to the tree painted | 2.8 s | 5.5 s |
| Scroll the tree: longest frame | 64 ms | 106 ms |
| Filter: type a key | 40 ms | 80 ms |
| Filter: key to the tree painted | 205 ms | 390 ms |
| Edit: type a key in a field | 48 ms | 80 ms |
| Save: leave the field (Tab) | 96 ms | 160 ms |
| Save: leave the field to "Saved" | 0.57 s | 1.08 s |
| Restore: reload to the tree painted | 0.92 s | 1.69 s |
| Check: click | 128 ms | 248 ms |
| Check: click to the result | 183 ms | 374 ms |
| Export: click | 104 ms | 208 ms |
| Export: click to the file offered | 280 ms | 644 ms |

### Chrome and Edge (3,000 datasets, full CPU speed)

| | Chrome 149 (3 runs) | Edge 158 (6 runs) |
|---|---|---|
| Load: choose the file to the tree painted | 1.9 s | 1.9 s |
| JavaScript heap after load | 44 MB | 43 MB |
| Scroll the tree: longest frame | 84 ms | 16 ms |
| Filter: type a key | 48 ms | 48 ms |
| Edit: type a key in a field | 80 ms | 368 ms once, otherwise ≤ 88 ms |
| Save: leave the field to "Saved" | 319 ms | 314 ms |
| Restore: reload to the tree painted | 380 ms | 380 ms |
| Check: click / to the result | 48 ms / 159 ms | 48 ms / 100 ms |
| Export: click / to the file offered | 24 ms / 80 ms | 24 ms / 84 ms |

### The tree and the pickers (`tree-performance`, 3,000 datasets, worst of 3 runs)

All are input to the next paint. Selecting a dataset takes 72 ms, and expanding or collapsing one takes 32 ms.
Expanding and collapsing the catalog's 3,000 rows takes 96 ms and 24 ms. A filter key takes 24 ms. In the
"Add an existing" picker, opening the list of 3,000 contacts takes 80 ms and Enter takes 56 ms. Opening a copy or a new
distribution takes 72 ms, and Back takes 40 ms. Selecting the catalog itself takes 160 ms (see [Findings](#findings)).

### Validate catalog (`validation-performance`, worst of 3 runs)

| | 3,000 datasets | 10,000 datasets |
|---|---|---|
| Click to the result painted | 120 ms | 423 ms |
| Click: input to next paint | 64 ms | 248 ms |

## Findings

1. **Responsive at 3,000 and at 6,000 datasets.** On a fast laptop, every input paints within 100 ms at both sizes,
   except opening the catalog's own form. The longer jobs stay under a second, except a 3.8 s load at 6,000. Memory is
   small: 44 MB of JavaScript heap at 3,000.
2. **Opening the catalog's form is the one clear miss: 160 ms.** Its Dataset field lists every dataset, 3,000 link
   rows, and they all render. `content-visibility: auto` on the rows brought it to 96–120 ms with nothing visible
   changed, but it was reverted. Together with the tree's rows, which already use it, it sometimes caused a single
   frame of about 4 s of style and layout after the next filter, which broke an e2e test 2 times in 10. Showing only
   the first rows with a "Show all" button would fix the miss, but that is a UI change, left as an option.
3. **Storing the catalog dominates load time.** Parsing in the worker takes about 60 ms for 3,000 datasets. The rest
   is writing about 33,000 IndexedDB records (one per object and one per link) in one transaction: about 1.5 s on a
   profile on disk. Writing the same data as 66 records of 500 objects each took 37 ms, so storing the catalog in chunks
   is the option if load ever needs to be faster. It would change the storage layout from #28, so it is not done here.
4. **Playwright's default contexts overstate load time 7 times.** They keep IndexedDB in memory, where the same write
   takes about 10 s, so `tree-performance` reports a 12 s load. That load time is not what people see.
   `catalog-performance` uses a profile on disk.
5. **On a slower laptop (CPU 4× slower), the clicks that build a whole-catalog job go over 100 ms.** The Validate
   catalog click takes 128 ms and the Export click 104 ms at 3,000. At 6,000, scroll frames reach 106 ms and leaving a
   field takes 160 ms. Everything else at 3,000 stays under 100 ms.
6. **The generated catalogs are small for their size.** 3,000 generated datasets come to 2.5 MB, while v1's largest
   catalogs are described as tens of MB. Richer datasets would cost more to parse, store and check. The import limit is
   25 MB (`DEFAULT_LIMITS`), so a catalog over that size is refused with an explanation.
7. **Not yet checked:** a typical government laptop in a managed browser (the CPU 4× runs stand in for one).
