# Repository security baseline and project context

This extends Wisesama's selected response desk inside the existing Satoshi, charcoal, purple/pink, and light-theme system. It adds an operational surface at `/app/projects/:id/security`; it does not reopen the visual identity or imply a security certification.

## References inspected

Searches were separated into the configuration review screen and the project settings form. The returned screenshots were inspected visually. No reference asset is shipped in the app.

| Reference | Visible pattern | Wisesama decision |
| --- | --- | --- |
| [Supabase Security Advisor](https://mobbin.com/screens/e3ac7f2c-bdd0-42a4-ac13-76fb893fd06d) | Compact issue rows with entity and explanation columns, plus refresh and documentation actions. | Keep checks as scanable rows with explicit written states. A baseline is four inspectable observations, without a grade or safety score. |
| [Base44 security review](https://mobbin.com/screens/5eaa299b-10fb-4978-a7ac-2a19085bf68a) | An expanded security issue exposes rule evidence and a recommended change in place. | Use native disclosures for source paths, a bounded explanation, next step, and official documentation. Do not borrow its automatic fix action or severity system. |
| [Browserbase project settings](https://mobbin.com/screens/5d413cb6-bca7-4587-b403-a713201c9962) | Label and helper text sit with the corresponding field, within persistent project navigation. | Keep three context answers in a separate, labelled form with explicit save and self-reported provenance. Do not borrow its keys or credentials UI. |
| [Plane project settings](https://mobbin.com/screens/8f81fd02-0583-4289-bd01-873581c46a5e) | A project-specific settings view pairs form labels, fields, and a direct update action. | Keep project identity and environment visible before editing. On narrow screens, the form follows configuration evidence in reading order. |

GitLab's returned dashboard uses A–F project grading and a historical severity chart. Those patterns are unsuitable for this bounded static configuration check and were deliberately excluded. The Replit result concerned deployment controls and secrets; it did not establish Wisesama's permissions or features.

## Information and interaction

Project identity comes first, followed by project navigation, then two independent sections. Repository baseline shows the read commit, collection time, latest attempt, checked inventory paths, source state, and different inventory/latest observed commits where present. A changed path selection is shown beside the checked paths, even when the commit has not changed; missing older path provenance remains explicit. Static observation never stands in for successful CI, deployed policy, or a verified remediation. Observed, Needs attention, and Unknown use text as well as icons; Observed uses the brand accent rather than a green success grade.

Each check exposes its evidence and next step in place. A fresh read can still produce unknowns or actions. Failed reads retain prior evidence and identify the failure. A stale snapshot, paused/disconnected source, and newer observed revision each have their own written notice. Recheck reads the imported commit; repository synchronization remains a separate action in Connections.

Uploaded inventories have a useful advisory workflow but no fabricated repository checks. Their baseline displays the repository requirement and a route to connect a new repository project. Project context remains available to manual projects.

The context form uses Yes, No, and Not sure yet. Hosting is an optional bounded name, with guidance to keep secrets and private URLs out. A successful save records self-reported provenance and its time. These answers do not dismiss vulnerability findings or imply that Wisesama tested public reachability. Save failures preserve entered values.

Projects, repository import completion, and continuing Connections management expose the baseline route. Finding detail links are integrated by the parent build. Response playbooks are grouped below the baseline via the shared PlaybookPicker; the detailed response route retains the selected project.

## Responsive and verification contract

At wide desktop sizes the form sits beside the checks. At 1180px and below it moves after the baseline, avoiding narrow evidence columns; below 600px check states occupy their own row and long hashes/paths wrap. Existing theme roles and keyboard focus are retained. The surface uses no new raster illustration: operational source evidence carries this task.

The parent integration owns the bounded desktop, mobile, light-theme, and persisted-flow browser review. Source checking and API test evidence belong to `BASELINE-CONTRACT.md`; a rendered static check does not certify enforcement or provider setup.
