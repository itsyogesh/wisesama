# Public-page research and design

Date: November 4, 2026. Implementation: `apps/intel/src/components/public-site.tsx`, `public-site.css`, and `src/lib/public-content.ts`. Parent integration owns feed, account, subscription, and workspace routing. This document records research and design decisions, not production release approval.

## The established direction

Keep Wisesama’s Satoshi typography, original purple logo, charcoal surfaces, purple actions, and the corresponding light theme. The user selected Response desk and asked to build the researched expansion; this work extends that decision. It does not reopen a visual-identity choice.

Public marketing answers “does this help me respond to issues in my software?” Reading surfaces answer a specific task with prose, steps, source links, and a narrow measure. Neither borrows the app’s dense sidebar layout wholesale.

The home hero leads with a response question beside one inspectable product record. The record uses expressly synthetic package and project data. It is evidence of the interface’s mechanism, not a real incident, customer screenshot, or verified vulnerability. One original generated illustration supports the continuing-evidence section. It is decorative and does not replace operational UI or imply a security guarantee.

## Inspected references

Mobbin searches were divided by concrete page problem. Results were inspected as images rather than interpreted from metadata. Search context was implementation in code, not a request to save to a user collection. The pre-existing full-resolution hero references were also reopened locally.

| Reference | What was visible | Decision for Wisesama |
| --- | --- | --- |
| [GitHub security hero](https://mobbin.com/sites/sections/e13b3db1-e2f8-454a-ad67-dc3516dbcd45) | An outcome statement with code-scanning interface evidence; multiple floating panels and sales actions. | Put an intelligible product record in the first viewport. Use Wisesama’s self-service action, flat composition, and restrained palette rather than floating panels or sales copy. |
| [1Password Developer hero](https://mobbin.com/sites/sections/9e2a1671-1d4d-4b23-bf11-476ae27af70d) | Developer task entry, explicit integration context, and a nearby quickstart. | Put working reference access close to the Agents introduction. Guides and exact setup live in different destinations. |
| [1Password developer documentation section](https://mobbin.com/sites/sections/a89e05aa-c41c-4cf8-b196-9af59035b98d) | Named developer interfaces with short explanations of their jobs; a documentation-led hierarchy. | Documentation overview separates API, RSS, and MCP by the reader’s task. Use linked rows rather than generic feature tiles. |
| [Base44 API documentation](https://mobbin.com/screens/67828c1b-90e1-4e8d-89a1-9e6f6cec99b4) | A persistent reference navigation, runnable code blocks, and field-level reference material. | Docs use navigation, copy controls with failure handling, real configured endpoints, and a query table. Do not copy its credentials, account model, SDK, or styling. |
| [Plane reading document](https://mobbin.com/screens/c3e698b6-efb2-48e5-a1d5-755391b06ae0) | Clear title, plain prose, heading hierarchy, and sequential content within a readable column. | Guides use a focused article with in-page navigation, concrete steps, and primary-source reading. The editor chrome is not relevant. |
| [Snowflake getting-started index](https://mobbin.com/screens/620c1b18-a8ab-453e-a652-1ad8aa1c2749) | Foundation material and build guides grouped by task. | Guides are grouped into Connect, Understand, Respond, and Stay informed, with one recommended starting path. Do not copy trial, upgrade, or marketplace controls. |
| [Linear integrations section](https://mobbin.com/sites/sections/e1ad034b-b2a5-44ce-902d-f8aea07f3f5d) | Integration names paired with a concise job, grouped within an engineering category. | Make GitHub and GitLab.com discoverable by name, but use dedicated explainers for permissions and maintenance; no directory of unsupported integrations. |
| [Cloudflare Workers pricing section](https://mobbin.com/sites/sections/c315924c-07d1-457b-847b-5526b2644403) | Visible plan distinctions and a deeper feature comparison. | Make available versus planned access explicit. Wisesama has no approved paid amounts, so a comparison with fabricated prices would mislead. |

The first article search returned modal help and developer settings rather than a useful help article. A broader help-article pull returned a help modal and a consumer example page. Those are not foundations for the reading layout. The inspected Plane document and task-grouped Snowflake index provide the useful reading structure; Wisesama’s source-backed guide content supplies the actual task sequence.

## Page-by-page decisions

| Page or family | Mode and intended action | Composition and content |
| --- | --- | --- |
| Home | Persuade: start a project or browse the feed. | Response question plus a labelled synthetic product record; source strip; connect/assess/respond sequence; one quiet illustration; independent public channels; scope FAQ; repository action. |
| Product | Persuade: understand the complete workflow. | Wider record followed by snapshot, evidence, and response sections. The scope section makes package matching and user-attested closure explicit. |
| GitHub / GitLab.com integration | Persuade and Read: understand and authorize the connection. | Provider identity; connection action; permission table; import sequence; maintenance and disconnect information. Actual authorization is separate from account sign-in. |
| Guides index | Read: choose a useful task. | One starting route, one end-to-end response walkthrough, then task-grouped linked rows with reading estimates. No empty blog categories. |
| Seven guide articles | Read: complete the named task. | Title and description, in-page links, concrete steps, bounded code example where useful, primary-source links, next reading. On mobile, navigation precedes the article instead of squeezing a second column. |
| Agents | Persuade and Read: choose MCP or API. | Two actual public read tools displayed as a simple sequence; explicit private-data boundary; reference CTA. No untested client badge or private-workspace claim. |
| Docs overview | Read: choose an interface. | Three routes by task and one real public read. It does not force a product-account step for public data. |
| API reference | Read: issue a valid request. | Configured API origin, exact GET examples, supported query parameters, source status, advisory retrieval, and failure handling. |
| RSS reference | Read: add or filter a feed. | Copyable configured RSS URL, reader steps, source-update interpretation, matched web-feed filters, and email alternative. |
| MCP reference | Read: verify public tools. | Actual endpoint, protocol, tool purposes, exact modern request metadata and routing headers, untrusted-source handling, and private-access boundary. No claims of a tested desktop client. |
| Pricing and access | Persuade: start free with clear expectations. | Current early access workflow beside clearly planned paid expansion. No invented price, checkout, seat count, retention promise, or team-permission claim. |
| Security / privacy / early access terms | Read: understand processing and limits. | Linked trust navigation, implementation facts, and visibly unresolved operator/legal/retention publication requirements. These pages do not pretend a production legal review occurred. |

## Primary-source checks

Guide and product copy was checked against the implementation and primary documentation: [OSV](https://osv.dev/), [FIRST EPSS](https://www.first.org/epss/), [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app), and the provider research in `REPOSITORY-CONNECTIONS.md`. CISA’s catalog page returned HTTP 403 in the research tool; its canonical link remains the source destination, while the already-researched KEV semantics and implemented source model supply the guide’s distinction. No CISA page text was copied.

MCP and subscription contracts come from the implementation agent’s route and test contracts, with details in `PUBLIC-DELIVERY.md`. The MCP endpoint is `/api/v1/mcp`, separate from the public advisory and RSS paths. The current public MCP release reads public intelligence only. No specific desktop client compatibility is claimed by the page.

## Responsive and interaction contract

Desktop marketing uses wide section changes in density rather than repeated same-size cards. Small screens collapse grids into reading order, retain primary actions, and replace the full navigation with a native disclosure. The theme button remains available in either layout. In-page and developer navigation are normal links; FAQ questions are native disclosures. Copy buttons announce their copied state and offer manual-copy recovery.

The illustration is the parent-generated transparent `/illustrations/response-thread.png`, reserved for the continuing-evidence section. Its natural 1792:1024 ratio is preserved. Original generation provenance is embedded by the parent. This work introduces no stock image or copied reference-product asset into the public UI.

Type checking was run successfully after the initial implementation. Parent integration performs the bounded desktop, mobile, light-theme, and operational-flow checks and independent finish review once routes and backend contracts are connected. This document does not treat unrendered source as visual approval.
