# Round 3, analyst B: votes

1. **Required markers.** I vote for **visible words**: "(required)" or "(recommended)" in each label, under the section headings "Required", "Recommended" and "Optional fields". Put the USWDS explanatory sentence at the top of the form. Never use an asterisk on its own. The level is then readable without colour or symbols, which is better for #30.

2. **"Your data" page.** **Keep `data.html`. I'm changing my position.** The footer link, the save-status link, the clear action (J15) and storage failure (J16) all need a destination that works with or without a loaded catalog. A storage failure should still also raise A's global alert on whichever page the user is on.

3. **About page.** **Merge it into `help.html#about-alpha`, which keeps my position.** The out-of-scope list is short and belongs next to "Known limits". A's J18 links can point to that anchor, so we avoid one thin page.

4. **Loading.** **Use separate `load-file.html` and `load-paste.html`, and `start.html` only offers the three choices. I'm changing my position.** This gives the file and paste paths the same structure, with the same error, progress and replace states. It costs one extra file, for 22 in total. I accept D's point that the replace confirm comes after parsing (A §5).

5. **Usage counts.** **Make C's table the single source of truth:**
   - kind-help: 5 places (D2, D4, D5, D7, svc-01)
   - org-oss: 10 places
   - org-dea: 3 places

   Two fixes follow. In D's delete copy, "1 dataset series" becomes "**1 data service**". My "OSS in 7" becomes 10.

6. **Blank catalog with an empty required `dataset`.** **Show a neutral hint, "Required: not filled in yet", using words and the info style.** On a blank catalog the user hasn't done anything wrong yet. Use the warning style "Required: no value" only after the user removes the last value (that is the case #26 covers) or after a check has run. C's "Not checked by the schema" group in the check summary stays as proposed.

7. **Other items:**
   - **Restore page.** I agree with A and D's "Export it before deciding" link, but only as a direct download button. It must not lead to the Export page, because that page needs a catalog loaded in memory.
   - **Check timing.** I agree with D: recheck when the user leaves a field, not on a typing timer.
