# Round 3: analyst D votes

1. **Required markers: visible words.**
   - Use the Required, Recommended and Optional section headings, and put "(required)" on each Mandatory label.
   - Put the USWDS explanatory sentence at the top of the form.
   - Never use an asterisk on its own.
   - I now agree with C: don't add "(recommended)" to each label, because the section heading already says it.

2. **"Your data" page: drop it** (with A and C). This changes my position.
   - #28 asks for a control, not a page.
   - The footer link "Clear my data from this browser" opens the confirm modal on every page. With no working copy, the modal says "Nothing is stored in this browser".
   - The explanation moves to `help.html#your-data`.
   - A storage failure is a global `role=alert` with a Download button, shown on whatever page the user is on.

3. **About page: merge it** into `help.html#about-alpha`, linked from the alpha site alert.

4. **Loading: B's original layout** (file input in a card on `start.html`, plus a separate `paste.html`). This changes my position.
   - It saves a click.
   - Load errors appear on the page that caused them, and focus moves to them.
   - Progress is a native `<progress>` with Cancel, shown inside the card.
   - The replace confirm comes after parsing.

5. **Usage counts: C's table is canonical.** I accept these corrections to my copy:
   - "4 datasets and 1 data service"
   - the shared-object export note counts **4 objects**

6. **Blank catalog: a neutral info-style note, "Required: not filled in yet"** (B's wording).
   - It becomes the warning or error style only after the user removes the last value (#26) or after a check runs.

7. **Other points:**
   - **B's routes must apply the two tree fixes.**
     - "Show 50 more" must be a treeitem that moves focus to item 51. A plain button inside `role=tree` is an axe failure.
     - `mock.js` must use `?focus=tree` to put focus back on the selected treeitem after a page load.
   - **I agree with B:** "Export it before deciding" on Restore is a direct download button, not a link to `export.html`.
   - **I agree with C:** add `editor/contact.html?state=errors`, and flag the `iri` format check as a dependency of #27.
