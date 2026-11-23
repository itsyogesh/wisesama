# Wisesama flow revision from Mobbin

## Scope and baseline

The user rejected all three earlier dashboard concepts: "the entire UX is all over the place and the ui feels substandard", and explicitly requested Mobbin references for each flow. This is a targeted revision of the first-project-to-response journey, shown as a connected review prototype before production interface implementation.

Job: a developer imports an exact software inventory, assesses a matching finding, and records a response with evidence. The record is complete when the response and its supporting evidence appear in the finding history; it is not independent proof of a deployed fix.

Baseline: `.impeccable/mocks/concept-a.png`, with B and C retained as rejected explorations. None is approved. Their only demonstrated states are populated desktop screens in dark/light mode. Initial setup, import validation, loading, failures, and transitions were absent.

Preserve: Wisesama security-response domain, existing geometric mark/wordmark, Satoshi typography, charcoal/purple/pink identity, both themes, small-team audience, backend truth, original crypto app and all backend code. Demonstration values are not real customer data. Replace unsupported illustrative runtime matches with sourced package examples; no copied reference brands, data, or product copy.

## Structural decision

Choose focused task pages feeding a compact record list and a full finding detail page. Take this structure consistently. The competing permanent split-pane workspace is deferred: it squeezed the full response task into the inspector in the rejected mockup.

## Five moves

| Problem in baseline | Chosen move | Looked-at evidence | What is not copied |
| --- | --- | --- | --- |
| No first-run or inventory-review path | Project details, upload/review, then an explicit scan result | [Supabase setup](https://mobbin.com/flows/9fcac236-9dce-4991-8786-bc4a6a0502bd), [ClickUp import](https://mobbin.com/flows/d179f1f7-daf7-41e5-a750-df62db769f60), [Featurebase import](https://mobbin.com/flows/d6b13408-74e2-4282-a8d6-be90657de06e) | Organization/billing setup, manual CSV mapping, unrelated integrations |
| Multiple competing dashboard entry points and card rows | One compact findings inbox with controls above the rows | [Featurebase list](https://mobbin.com/screens/c521f6eb-8d85-481e-a1a2-2e59710d3804) | Feedback votes, feature categories, unrelated status vocabulary |
| Investigation and response form compressed into the inspector | Open a full finding record with main evidence/activity and a properties rail | [Plane detail](https://mobbin.com/screens/99bda2af-eea1-4405-89cf-c4543bcefd84), [Sentry issue](https://mobbin.com/screens/af24d18c-78fe-4ce2-addd-ee5ed9394fb4) | Emoji controls, exception trace charts, technical debugging sections |
| Closing a finding has no demonstrated result or undo | Require response evidence, show resolved state and history, allow reopening | [Sentry resolution](https://mobbin.com/flows/31e47a63-7b68-4ff9-a916-caeb4382bc23) | Sentry does not establish evidence-required closure; that requirement belongs to Wisesama |
| Alerts occupy a main navigation destination without a setup path | Put email alert preferences and delivery history together in settings | [incident.io](https://mobbin.com/screens/db74620f-405f-4333-be21-8d8604181ecd), [Replit](https://mobbin.com/screens/cb92d9f4-8e47-4e53-bacf-9b61986de96a) | Push, Slack, escalation policies, marketing email settings, or unsupported timing controls |

Supabase, ClickUp, Featurebase, and Plane are adjacent workflow references used for structure, not security claims. The screens do not prove behavioral or business outcomes. Exact reference IDs, high-resolution assets, and limitations for issue triage are in `triage-research.json`; downloaded screens retain their Mobbin attribution.

## Connected review artifact

`.impeccable/prototype-v2/index.html` is a browser-renderable interactive mockup. It uses sample project data, local draft state, and simulated scan/delivery transitions. It must not contact production APIs or send email. The visible review label must remain on every state.

The intended path is setup, inventory review, scan results, findings inbox, finding detail, response evidence, and resolved history. Notifications, project inventory, and public briefings are supporting destinations in the same shell. Both themes retain the same content hierarchy.

## Review checks

- Continue from project details preserves its values into inventory review.
- A missing, invalid, or unsupported inventory has an actionable error.
- The imported preview precedes the scan action and states metadata scope.
- Simulation is distinct from live matching and real delivery.
- Queue filters, counts, selection, and resolved state agree.
- Exploitation evidence never collapses into the severity badge.
- Closing needs evidence and records a user attestation; reopening reverses the response state.
- Keyboard focus, small viewport navigation, dark/light contrast, and long identifiers remain usable.

## Deferred

Production authentication/onboarding implementation, live upstream integration in the interface, actual email verification and delivery, background scans, billing, GitHub repository connection, team ownership, and runtime/container matching remain separate from this review prototype. No production code or access configuration is changed by this design revision.

## Browser review result

Verified the connected walkthrough in the browser: setup carries project name and environment to import and findings; sample review precedes assessment; source checks are explicitly simulated; severity filtering updates rows; evidence is required for closure; resolved counts, history and reopening agree; email opt-in gates the simulated test and records delivery history. Invalid JSON displays recovery guidance. Dark/light desktop and 390px mobile views were visually checked; mobile inbox and finding pages have no horizontal overflow.

Deliverables: `prototype-v2/review.html` pairs six flow captures with inspected Mobbin references and includes both themes; `prototype-v2/index.html` is the clickable review; `prototype-v2/comparison.html` compares the rejected dashboard with the compact inbox. This revision is pending user approval.
