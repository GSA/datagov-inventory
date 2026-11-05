# Round 3: analyst C votes

1. **Required markers: visible words (changed).** Section headings, plus "(required)" on each Mandatory label. No asterisk alone. No per-label "(recommended)", because the heading says it.
2. **Your data page: drop it (B).** Content goes to `help.html#your-data`. The footer's Clear my data link opens a modal on every page. Storage failure uses A's global `?alert=storage-failed`.
3. **About page: merge it (B)** into `help.html#about-alpha`.
4. **Loading: B's layout.** File input on `start.html` with states; separate `paste.html`. Errors stay on the page that caused them.
5. **Canonical usage table:**

| Object | Uses | Where |
|---|---|---|
| kind-help "OSS Data Help Desk" | 5 | D2, D4, D5, D7, svc-01 (4 datasets and 1 data service) |
| org-oss "Office of Sample Statistics" | 10 | publisher of D1–D9 and S1 |
| org-dea "Department of Example Affairs" | 3 | publisher of cat-01 and svc-01; parent of org-oss |
| kind-rosa "Dr. Rosa Example" | 3 | S1, D8, D9 |
| kind-bridge, kind-lib, kind-wx | 1 each | D1, D3, D6 |

Corrections:
- D: "1 data service", not "1 dataset series".
- D: the shared note counts 4 objects, not 2.
- B: OSS is used in 10 places, not 7.
- A: kind-help's places are D2, D4, D5, D7 and svc-01, not D4–D7 and S1.
- If #25 bars Organizations from Agent fields, org-oss drops to 9 and org-dea to 1.

6. **Blank catalog: neutral "Not filled in yet" (D and A; changed).** It becomes a warning only after a check runs or the last value is removed (#26).
7. **Still disagree on two points:**
   - **B's `editor/dataset-errors.html`.** The email error is on kind-bridge and the download-URL error is on dist-01a, not on D1. D1 shows Last modified and Frequency, plus "1 problem" tags on its contact and distribution rows. Add `editor/contact.html?state=errors` or a note.
   - **The download-URL error needs an `iri` format check in #27** (not in `ajv-formats` by default). Keep it in the mockup and flag the dependency.
