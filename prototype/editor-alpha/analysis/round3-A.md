# Round 3: analyst A votes

1. **Required markers: visible words.** Each Mandatory label carries "(required)" in words, inside the Required/Recommended/Optional section headings, with the USWDS required-fields note at the top of the form. Never show an asterisk on its own. Words are read out with the label and are not a symbol (#30), and B and D already agree on this.

2. **"Your data" page: drop `data.html` (I change my position).** #28 asks for a visible control, not a page.
   - The footer link "Clear my data from this browser" opens the clear-data modal on **every** page, not only on the Overview.
   - The explanation lives at `help#your-data`.
   - J15: footer → modal → `start` with a "cleared" alert.
   - J16: the storage-failure alert is shown on the editor page where the user is working.

3. **About page: merge into `help#about-alpha` (I change my position).** The out-of-scope table also goes there. My only concern was that the table be findable, and a Help anchor linked from the alpha banner covers that.

4. **Loading: use B's layout (I change my position).** The file input sits in a card on `start`, with JS states for progress and errors. Paste JSON is its own page, `paste.html`, so the textarea has room. This saves a click and a page. "Open another catalog" on the Overview goes to `start`, and the replace modal appears only after the new file parses.

5. **Usage counts: C's table is canonical.**
   - kind-help is used in 5 places: D2, D4, D5, D7 and svc-01.
   - org-oss is used in 10 places; org-dea in 3.
   - D's delete wording should say "4 datasets and 1 data service". B's OSS count changes from 7 to 10, and my round-2 "D4–D7 + S1" is also corrected.

6. **Blank catalog: neutral "Not filled in yet".** #26's "shows as missing" applies when the user removes the last value. It does not apply to a catalog the user has only just started. Warning styling on the first screen would be noise. I accept C's separate "Not checked by the schema" group in the check summary for empty required values.

7. **Other points:**
   - I support D's change to the delete-shared modal: show a summary by class and the first 10 places, plus "See all places", because a large count would be too long for a modal.
   - The `dcat-11` refusal state (B) must keep D's wording that the alpha opens DCAT-US 3.0 only.
