## verdict

- FC-FIN01 — resolved. `Add file` now includes `busy` in its disabled condition. `busy-discovery.png` and `busy-preview.png` visibly show the button disabled with the typed `services/api/package-lock.json` retained; the preview capture also retains selected `package.json`. The ten original required captures were reopened at their original paths and remain valid.
- FC-FIN02 — resolved. DESIGN.md now describes the scoped searchable Base UI picker, shared control sizing, 16px mobile native text, exact branch entry, outer focus/checkbox offsets, and shallow control/menu elevation. It explicitly separates the remaining legacy controls pending their review.
- Fix-batch regressions — none observed in the recaptured evidence.

## remaining

Clear. This ship verdict covers the two scored fixes and their observed regressions, not the whole surface or live provider/permission behavior. Generic subagent performed the finish-reviewer role; no browser or detector pass was run.

disposition: ship
