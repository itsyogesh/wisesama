# Security workspace mockup decision

Mode: Operate. Audience: small software teams. Product truth: `PRODUCT.md`. Identity: `DESIGN.md` and original Wisesama assets.

The user requested image mockups first, preservation of the dark pink/purple identity, and a corresponding light mode. No interface direction has been approved yet.

| Concept | Structure | Mockup |
| --- | --- | --- |
| A: Response desk | Side navigation, triage list, adjacent evidence and response inspector | `.impeccable/mocks/concept-a.png` |
| B: Projects first | Horizontal navigation, project table, selected project's findings | `.impeccable/mocks/concept-b.png` |
| C: Briefing to action | Side navigation, expanded relevant briefing, response context rail | `.impeccable/mocks/concept-c.png` |

Each image contains both dark and light versions. Every populated account, project, count, and inventory is demonstration content. The original public site's screenshot supplied brand reference only. Prompts are stored in matching JSON sidecars and embedded in the PNG files.

Recommendation: A, because a small team can inspect the matching version and record its next action without losing the queue. The pending user question allows selection, combination, or revision. Do not begin interface implementation until a selection or delegated choice arrives.

The provider currently checks exact npm/PyPI package inventories; runtime details are only context. Runtime findings in the mockups are illustrative and cannot be presented as live coverage without implementing the appropriate matching.

The user rejected these three concepts and requested a revision grounded in Mobbin flow references. They remain baselines only. See `.impeccable/references/workflow-research.md` for the source-backed moves and the connected review prototype.

Approved comp: none; previous concepts rejected.

Revision 2 is ready for review at `.impeccable/prototype-v2/review.html`, pairing inspected Mobbin screens with the connected Wisesama prototype. Both themes and the first-project-to-resolution path were checked in the browser. Approval remains pending.

Current selection (2026-11-04): the user selected A — Response desk as the functional build foundation. The later requested Mobbin flow corrections carry forward. The actual interface is in `apps/intel`; runtime placeholders from the original comp are replaced by supported live package-matching data. The independent finish review scored its two listed mobile corrections resolved. This records selection of the base and the implemented corrections, not blanket approval of every new screen.
