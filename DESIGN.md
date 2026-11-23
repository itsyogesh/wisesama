---
name: Wisesama security response
description: Sourced security response across public discovery, reading, and private work in dark and light themes.
colors:
  dark-bg: "#101014"
  dark-sidebar: "#151519"
  dark-surface: "#18181e"
  dark-surface-2: "#202027"
  dark-hover: "#24232d"
  dark-text: "#efedf4"
  dark-muted: "#aaa6b6"
  dark-quiet: "#aaa6b6"
  dark-line: "#2b2934"
  dark-accent: "#aa8aff"
  dark-accent-solid: "#7945e7"
  dark-accent-hover: "#8954ef"
  dark-tint: "#282035"
  dark-danger: "#f198a3"
  dark-danger-bg: "#34212a"
  dark-warn: "#e6b975"
  dark-warn-bg: "#332b20"
  dark-success: "#90c4af"
  dark-success-bg: "#20312b"
  light-bg: "#fcfbfd"
  light-sidebar: "#f4f2f7"
  light-surface: "#fff"
  light-surface-2: "#f5f3f8"
  light-hover: "#efecf4"
  light-text: "#211d2a"
  light-muted: "#6a6278"
  light-quiet: "#6a6278"
  light-line: "#e4dfeb"
  light-accent: "#6d36ca"
  light-accent-solid: "#743cdb"
  light-accent-hover: "#6431bf"
  light-tint: "#ede5fb"
  light-danger: "#ad354c"
  light-danger-bg: "#fbeaf0"
  light-warn: "#946015"
  light-warn-bg: "#fbf0dc"
  light-success: "#29664f"
  light-success-bg: "#e8f3ed"
  on-accent: "#fff"
  dark-public-heading: "#c3acef"
  light-public-heading: "#784db2"
typography:
  display:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(38px, 3.6vw, 54px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  public-headline:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(36px, 4.5vw, 62px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  article-headline:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(32px, 3.8vw, 48px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  reading:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.8
  public-label:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.45
  headline:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  label:
    fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "13px"
    letterSpacing: "0"
rounded:
  environment: "4px"
  compact: "5px"
  control: "6px"
  evidence: "7px"
  form: "8px"
  upload: "9px"
  menu: "10px"
  panel: "12px"
  circular: "50%"
spacing:
  icon-label: "8px"
  field-adornment: "9px"
  compact: "12px"
  control-x: "13px"
  group: "16px"
  mobile-gutter: "16px"
  tablet-gutter: "20px"
  section: "24px"
  desktop-gutter: "36px"
  public-gutter: "48px"
  public-section: "110px"
components:
  button-primary:
    backgroundColor: "{colors.dark-accent-solid}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  button-primary-hover:
    backgroundColor: "{colors.dark-accent-hover}"
  button-primary-light:
    backgroundColor: "{colors.light-accent-solid}"
    textColor: "{colors.on-accent}"
  button-primary-light-hover:
    backgroundColor: "{colors.light-accent-hover}"
  button-default:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  button-default-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.dark-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  input:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  input-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
  scoped-text-input:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.form}"
    padding: "0 12px"
  scoped-picker:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.form}"
    padding: "10px 12px"
  scoped-textarea:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.form}"
    padding: "11px 12px"
  scoped-field-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
  scoped-checkbox:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.compact}"
    height: "18px"
    width: "18px"
  scoped-checkbox-selected:
    backgroundColor: "{colors.dark-accent-solid}"
    textColor: "{colors.on-accent}"
  scoped-checkbox-light:
    backgroundColor: "{colors.light-surface}"
  scoped-checkbox-selected-light:
    backgroundColor: "{colors.light-accent-solid}"
    textColor: "{colors.on-accent}"
  nav-active:
    backgroundColor: "{colors.dark-tint}"
    textColor: "{colors.dark-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "38px"
  nav-active-light:
    backgroundColor: "{colors.light-tint}"
    textColor: "{colors.light-accent}"
  evidence-card:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.evidence}"
  evidence-card-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
  button-public:
    backgroundColor: "{colors.dark-accent-solid}"
    textColor: "{colors.on-accent}"
    typography: "{typography.public-label}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-public-light:
    backgroundColor: "{colors.light-accent-solid}"
    textColor: "{colors.on-accent}"
  code-block:
    backgroundColor: "{colors.dark-surface-2}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.form}"
  code-block-light:
    backgroundColor: "{colors.light-surface-2}"
    textColor: "{colors.light-text}"
  repository-source:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.panel}"
    padding: "26px"
  repository-source-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
  subscription-email:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.form}"
    padding: "12px 14px"
---

# Design System: Wisesama

## Overview

**Creative North Star: "Response desk"**

Wisesama uses the original geometric purple mark and wordmark, Satoshi typography, charcoal surfaces, and restrained purple emphasis. The user selected A — Response desk as the functional foundation on 2026-11-04; the later Mobbin workflow corrections establish the implemented compact inbox and full finding record. The public expansion carries that identity into spacious product explanations and readable guides without changing the compact private workspace. Light mode carries the same hierarchy with its own text, surface, accent, and status values.

This document captures the built interface in `apps/intel`, alongside the original crypto application. It records `src/app/globals.css`, the account, finding, public-advisory, public-site, subscription, repository-flow, project-security, response-playbook, and supporting-view components, and the reviewed captures in `.impeccable/review/`. The expansion contract is `.impeccable/briefs/public-and-repository-expansion.md`; page-specific structural decisions remain in `docs/PUBLIC-PAGE-DESIGN.md` and `docs/REPOSITORY-CONNECTIONS.md`. The baseline and response contracts are `.impeccable/briefs/project-security.md` and `.impeccable/briefs/response-playbooks.md`; their inspected references and accepted patterns are recorded in `docs/BASELINE-DESIGN.md` and the response brief. Earlier response references remain in `.impeccable/references/workflow-research.md`. Reference products do not supply Wisesama's identity or security claims.

The captures establish the rendered states shown. The independent review cleared the two listed mobile corrections: finding properties precede Suggested response and Activity, and inbox rows retain project identity. The later expansion review found and resolved the source-freshness issue (EXP01): source records now show the persisted project assessment time and assessment error independently from inventory synchronization. The final baseline/playbook finish review opened 14 captured screens and found two provenance gaps (FIN01 and FIN02). The reviewed corrections expose the exact guidance version and make saved answers and tasks inspectable even when an event has no evidence reference; both findings are resolved. The earlier layout assessment still applies, and the verdict permits shipping within the fixlist scope. The captures and these bounded verdicts do not certify the whole app, live repository authorization, real email delivery, or production operation. Example counts and local verification records are not customer or performance evidence; the source-provenance capture used a clearly labelled synthetic database fixture with no active provider connection.

The `/admin` extension carries the same Response desk world into a separate operator shell for users, advisory curation, intelligence sources, public subscriptions, failed work, and audit. Its contract and inspected references are `.impeccable/briefs/v2-admin.md` and `docs/ADMIN-DESIGN.md`. The finish review in `docs/ADMIN-FINISH-REVIEW.md` resolved ADM-FIN01 through readable mobile row facts and discoverable actual overflow, and ADM-FIN02 through explicit Collection and Check state labels. Its ship verdict covers those scored fixes and their observed regressions; it does not broaden the production-verification limits above. The admin captures in `.impeccable/review/admin/` document the rendered extension, not an approved new comp or a new identity.

The CI dependency, organization, and free local skill extension uses the same world. Its contracts are `.impeccable/briefs/ci-dependencies.md`, `.impeccable/briefs/organizations.md`, and `.impeccable/briefs/open-source-skills.md`; inspected structural references and accepted patterns remain in `docs/CI-DEPENDENCY-DESIGN.md`, `docs/ORGANIZATIONS-DESIGN.md`, and `docs/SKILLS-PAGE-DESIGN.md`. The finish review in `docs/CI-ORG-FINISH-REVIEW.md` retains its original 18-capture assessment and scores nine replacement captures: both P2 findings are resolved through a native invitation-account anchor and wrapping private mobile navigation. Its ship verdict covers those repairs and their observed regressions. It does not establish production launch, live provider transport, real invitation email delivery, or external package publication. No new raster imagery was introduced; these factual settings and reading surfaces use evidence, controls, and prose.

The reviewed form-control refinement covers OrganizationSwitcher, OrganizationCreation, OrganizationSettings, and RepositoryOnboarding. It uses coss ui visual patterns with `@base-ui/react` (1.9.0), plain CSS, and the existing React 18 runtime. `.impeccable/review/form-controls/verification.json` records the checks and 12 captures; `finish-verdict.md` in that directory resolves FC-FIN01 (disable Add file during pending reads) and FC-FIN02 (document the scoped controls). Its ship disposition covers only those fixes and their observed regressions. The preview used the real local API, authentication, and PostgreSQL with explicitly synthetic GitHub transport; it establishes no live provider grant, real access change, production deployment, or full-app control rollout. The refinement ships no new raster assets and preserves the provenance above.

**Key Characteristics:**

- Compact rows and quiet separators support scanning.
- Evidence, response actions, and assessment properties have distinct places.
- Purple identifies actions and navigation; status colors retain written labels.
- Dark and light themes share content order and component geometry.
- Scope, uncertainty, source health, and user attestation remain visible.
- Repository observations, self-reported context, and saved response progress retain separate provenance.
- Public pages vary between product evidence, focused reading, and task completion while sharing one visual world.
- Operator records separate authoritative facts, scoped changes, and recorded audit history.
- CI reference states retain exact file/line, snapshot scope, and collection limits.
- Selected organization, current role, and access consequences stay visible around shared work.

## Colors

The palette pairs neutral charcoal or pale lilac grounds with purple controls and readable semantic signals. The frontmatter records the effective CSS values, including the final quiet-text overrides. `dark-*` is the default theme; `light-*` replaces the corresponding role when `data-theme="light"` is present. The CSS aliases `--accent-strong`, `--surface-raised`, and `--warning` resolve to accent-solid, surface-2, and warn respectively. Sidecar tonal ramps are generated display aids, not additional shipped CSS scales.

### Primary

- **Purple accent:** accent colors text links, selected navigation, focus outlines, and investigation states. Accent-solid fills primary actions; accent-hover is their hover state. Tint is the low-emphasis selected or contextual background.
- **On-accent white:** primary action labels retain white in both themes.
- **Public heading lavender:** the dark-public-heading and light-public-heading roles supply the homepage heading emphasis. They are separate from the action accent and semantic status signals.

### Neutral

- **Ground and navigation:** bg is the page ground; sidebar is the fixed navigation surface.
- **Raised information surfaces:** surface holds fields, evidence tables, and response forms. Surface-2 holds quiet notices and grouped controls. Hover supplies row and secondary-control feedback.
- **Reading hierarchy:** text is primary content; muted is supporting copy; quiet is small metadata. Quiet and muted currently have the same effective value in each theme.
- **Separators:** line defines table rules, field outlines, and section boundaries.

### Semantic signals

- **Rose danger:** critical/high severity, known exploitation, and errors use danger; danger-bg supports error messages.
- **Amber warning:** medium severity, mitigation, and incomplete checks use warn; warn-bg is available in the theme.
- **Green success:** low severity, resolved/not affected states, healthy sources, and confirmations use success; success-bg supports account confirmation messages.

**The Separate Signals Rule.** Technical severity, CISA KEV evidence, EPSS forecast, and customer response status keep their own labels. Color never turns them into a combined risk score or a deployment claim.

## Typography

**Body Font:** Satoshi with the system sans-serif fallbacks in the frontmatter; headings use the same family. The app loads the bundled regular face for weights 400–599 and bold face for 600–900, with font-display swap.

**Label/Mono Font:** the system monospace stack is reserved for package names with versions, advisory identifiers, and code. Clash Display exists in the older app's assets but is not loaded by `apps/intel`; it is not the operational heading face.

### Hierarchy

- **Public display:** the display role is the homepage headline, with a 13ch desktop measure. At 1170px it becomes 43px, at 850px 36px, and at 700px it uses a mobile clamp of 36px–49px with a 15ch measure. General public introductions use public-headline; article introductions use article-headline. All remain Satoshi and use balanced wrapping.
- **Public reading:** the reading role provides the guide and reference prose; it becomes 15px at 700px. Public page introductions use 19px with a 1.65 line height, reducing to 17px on small screens. General public paragraphs stay within 68ch; the article layout caps its main column at 740px. Headings, row summaries, code, and metadata have separate densities rather than scaling the workspace up uniformly.
- **Page heading:** the headline role; smaller viewports use 24px. Account introduction headings reach 32px on desktop.
- **Finding heading:** 28px, weight 700, line height 1.3, and tight tracking; it grows to 30px at the widest detail breakpoint and becomes 25px at the smallest breakpoint. Its desktop measure is 30ch.
- **Section title:** the title role for general sections. Finding sections use 15px; the properties rail uses 14px.
- **Body:** the body role is the base. Operational rows, controls, evidence, and activity commonly use 13px. Finding introductions use 14px with a 1.75 line height and a 72ch maximum measure.
- **Advisory reading:** public advisory summaries use 14px text, a 1.85 line height, and a 74ch maximum measure; text becomes 13px at 520px. The summary preserves upstream line breaks as plain text.
- **Labels and metadata:** controls use the label role; secondary values commonly use 11–12px. Mobile inbox headings reach 10px and row labels 11–12px, which is the current compact implementation rather than a new minimum-size recommendation.
- **Monospace:** the mono role reduces to 11–12px in dense tables. Long identifiers and references wrap instead of widening the page.

## Layout

The desktop shell has a fixed sidebar (208px), a top bar (62px), and centered content capped at 1390px with a 36px gutter. The gutter reduces to 28px at 1100px, to 20px when the sidebar disappears at 820px, and to 16px at 520px. At 1500px and above, horizontal content padding becomes 48px. These are viewport breakpoints, not device classifications.

Organization selection occupies the existing sidebar. Below 820px it follows the wrapping private destination navigation and precedes the main content. Every destination and sign-out remain within the available width; labels stay unbroken while the group wraps. Organization settings are capped at 1080px. Member rows pair identity, role explanation, and available actions in three columns, become two columns at 1050px, and become vertical records below 600px. Invitation and confirmation controls stack there; long organization names and member identities wrap within their own area.

Project setup and inventory review are focused task pages: a 930px maximum layout combines a 210px progress column with the form and a 58px gap. The progress column narrows at 1100px; below 820px it becomes a horizontal step list above a single form column. Account entry has a separate two-column explanation/form layout that stacks at 760px; account fields become 16px text with a 44px minimum height there.

The inbox places status tabs, project/severity filters, and search above one table. The desktop columns are finding/package, project, severity, exploitation evidence, and response. Below 820px the separate project column is hidden and the project name appears inside each finding's metadata. Exploitation evidence remains visible. Below 520px search moves above the filters; long findings wrap. The compact table uses fewer identifier and footer details on small screens, while the full record carries their detail.

The finding record uses a flexible evidence/actions column and a properties rail (245px with a 42px gap). The rail narrows to 210px at 1100px and grows to 275px at 1600px. At 850px and below, the explicit order is main record and match evidence, properties, then follow-up content: Suggested response, Source advisory, and Activity. Properties use two internal columns; assessment-source rows stack at 520px. Keep this order when extending the record so assessment context is available before follow-up work.

Project security places project identity and environment before persistent destination links. Its baseline column and separate context form use a flexible column plus a 310px rail with a 34px gap. At 1180px and below, context follows the baseline in a single column and is capped at 680px. Below 600px, check states move to their own row; source hashes and paths wrap without widening the page. The related response-playbook list follows both sections.

CI dependency search and reference-state filters sit together above the saved reference list. Each row retains identity, kind, exact file/line, written state, and a native disclosure. Below 600px the filters become one column and the state moves beneath identity. Full references, paths, and recommendations wrap instead of hiding essential facts in horizontal table columns.

Private response records are capped at 1180px, with a flexible form and a 270px sources/history rail separated by 36px. At 1000px the rail follows the form as a two-column group; below 600px it becomes one column, metadata stacks, and playbook-picker actions follow their descriptions. Questions precede phased tasks, then summary, evidence, status, and the explicit save action.

The independent admin shell uses a 216px sidebar, a 62px top bar, and content capped at 1600px with 32px horizontal padding. Full records pair a flexible reading area with a 340px action area and a 40px gap. At 1200px and below, the action area follows the record as a two-column group; at 650px and below it becomes one column. At 900px the sidebar gives way to a 60px top bar and named horizontal destination navigation. Content gutters become 20px there and 16px at 650px. Facts and consequences precede the action form in the mobile reading order.

Admin lists and related-record tables retain native table markup. At 650px and below, each identity cell contains a labelled definition list of the other fields, including state, outcome, and complete timestamps; the alternative desktop columns are hidden with `display: none`, while those mobile facts are hidden above the breakpoint. Each field therefore appears once in the accessibility tree. A named table region becomes keyboard-focusable and gains a visible horizontal-scroll instruction only when measured content actually overflows. Attempt history uses a fixed table layout and wrapping dates in its narrow reading panel. Long names, errors, reasons, and identifiers wrap within their own area rather than widening the document.

Public advisory detail reuses a flat reading column and a separate evidence rail (245px with a 44px gap). At 1050px the rail narrows to 210px with a 27px gap. At 800px it moves below the reading content as a two-column evidence group; at 520px the signals stack in one column. This reading record has its own order and does not replace the finding-response order above.

Spacing is compact inside controls and rows, with larger breaks between working sections. Use the observed spacing tokens for repeated roles rather than treating every existing one-off margin as a new scale. The current notification-history table hides its third column at 520px; this is a documented implementation limit, not approval to hide arbitrary information.

The expansion brief distinguishes Persuade, Read, and Operate surfaces. In the built public home, product, integration, and access pages, wider section changes and a labelled synthetic product record support a decision and self-service action. Guides, documentation, and trust pages use reading columns, linked task rows, source links, and page navigation. The feed, repository connection, and subscription pages retain the focused controls and explicit state feedback of the operational system. These are surface compositions, not alternative identities; exact page strategy belongs in the expansion brief and page research.

Public sections use a centered 1184px container with 48px side margins; at 1170px the margins become 36px, and at 700px they become 20px. The header is separately capped at 1360px with 32px side margins and an 82px minimum height, reducing to 72px at 850px. The desktop home hero uses two columns with a 65px gap and 96px/72px vertical padding. At 700px it becomes a single reading order: statement and actions, then product evidence. Major public sections commonly use the public-section spacing token; mobile sections commonly use 55px–65px instead. The illustration is a later explanatory beat, not the first-viewport proof.

Guide and documentation reading layouts use a 225px navigation column, a flexible article capped at 740px, and a 78px gap; at 1170px the navigation becomes 185px with a 45px gap. At 700px the navigation becomes a wrapping block before the article. Trust pages similarly release their sticky side introduction into normal reading order. Developer code and reference tables scroll inside their own containers instead of widening the document.

Repository onboarding and connection settings are capped at 1120px. Repository, Inventory, and Review remain a horizontal progress list, with compact labels below 760px. Account/search controls, project fields, and provenance summaries use two columns on desktop and one below 760px. Source identity and actions stack there; long names, paths, and commit hashes wrap. Only the package preview keeps a bounded horizontal scroller with a 420px minimum row width. Public subscriptions use two columns with a 64px gap and collapse below 700px, placing the email action below the field and topics in one column. Token-action pages are focused reading forms capped at 700px.

Public playbook detail reuses the guide reading layout: in-page navigation, a scope block, applicability questions, ordered phase/task lists with evidence hints, authoritative sources and boundaries, then the project-response action. Its index uses flat linked rows rather than operational checkboxes. The reading navigation wraps above the article at the existing public-stack breakpoint.

The catch-all route selects the public shell for `/`, `/product`, `/feed`, `/feed/:id`, `/playbooks` and its articles, `/guides` and its articles, `/agents`, `/skills`, `/docs` and its API/RSS/MCP references, provider integration pages, `/pricing`, trust pages, sign-in/up, `/invite`, and subscription confirmation/preferences. `/app/*` uses the authenticated workspace shell; `/app` redirects to its inbox. Repository onboarding is `/app/projects/new`, manual upload is `/app/projects/new/manual`, and continuing management is `/app/settings/integrations`. Organization settings are `/app/settings/organization`. Project security is `/app/projects/:id/security`; private responses are `/app/projects/:id/responses/:playbookId`. The public playbook action opens `/app/responses/new?playbook=:playbookId`, retaining the chosen guidance while the owner selects a project. Guides and the public footer link to playbooks. Public feed links leave the private shell deliberately. Legacy briefings, project, finding, and notification paths redirect to their current destinations while preserving query parameters. Keep public navigation and authenticated workspace navigation distinct.

## Elevation & Depth

The public and private interfaces use tonal layering, one-pixel borders, separators, and a vertical rail rule for grouping. Evidence and response forms gain emphasis through their surface and outline. The scoped organization/onboarding controls add a shallow 0 1px 2px black shadow at 8% opacity; their portalled pickers use a 0 12px 34px shadow at 25% opacity and a one-pixel line edge to distinguish a temporary menu from the page.

**The Flat Surface Rule.** Retain tonal layering and separators for the operational workspace. Do not introduce shadow elevation as a replacement for its existing hierarchy.

State feedback is brief: button backgrounds and upload states transition over 140ms, source disclosures rotate over 120ms, and toggles move over 140ms. Busy indicators rotate linearly. Reduced-motion preferences disable animation and transition; pressing an enabled button moves it down 1px. The public homepage product record alone has a 700ms arrival under `prefers-reduced-motion: no-preference`, using a 12px upward translation and a shallow clip reveal with `cubic-bezier(0.16, 1, 0.3, 1)`. Public action backgrounds transition over 160ms. Reduced-motion preferences suppress both; do not promote this one hero treatment into repeated section entrances.

The scoped fields transition border/background over 120ms with ease-out; menus transition opacity/transform over 120ms with ease-out and translate upward by 2px at their starting/ending state. Their busy indicator uses an 800ms linear rotation. Reduced motion removes those transitions, menu displacement, and spinner animation.

## Shapes

Controls and navigation use gently rounded corners through the control radius. Search and compact filters use compact corners; environment labels use the smaller environment radius. Evidence tables and imported-file rows use the evidence radius; response forms use the form radius; the upload area uses the upload radius and a dashed border. Avatars and numbered steps are circular. The original geometric mark remains an asset rather than a newly drawn symbol. Public product records, access-plan panels, subscription confirmations, and repository-source containers use the panel radius; developer code blocks retain the form radius. Their one-pixel outlines and restrained surfaces continue the same flat language.

## Components

### Buttons

Compact, readable actions with a minimum height of 35px, label typography, an 8px icon gap, and the control radius. Primary actions use solid purple with white text; secondary actions use surface, text, and a line border; ghost actions use a transparent ground and muted text. Hover changes the background. Enabled press moves down 1px. Keyboard focus uses a 2px accent outline offset by 3px. Disabled controls reduce opacity and keep their written state; account submission has its own taller treatment.

Public actions use the separate button-public variant: larger padding, 14px labels, a 14px icon gap, and the same control corners and solid accent. The compact header variant uses 10px by 14px padding and a 13px label. The public text action is a plain semibold link with a trailing arrow; hover changes it to the accent. Keep this larger invitation geometry on discovery surfaces rather than enlarging dense record actions.

### Chips and status labels

Severity is a written label with a narrow vertical marker. Response states pair a label with a circle, clock, shield, or check icon as appropriate. KEV evidence is written independently. Environment labels have a small outlined rectangle. These are quiet information labels rather than large filled badges. Theme-aware semantic colors support the wording. Baseline rows pair Observed, Needs attention, or Unknown with an icon; Observed uses the brand accent rather than a green safety grade. Response task completion and saved response status keep their written, team-attested meanings.

Admin records use compact tonal status labels with written states, 11px semibold text, 3px by 7px padding, and 4px corners. Source summaries explicitly name Collection and Check state, even when both read Paused. Last attempt and last successful check remain separate historical facts; enabling collection is not a successful check. Queued, Running, Succeeded, Failed, and Skipped describe persisted job outcomes, independently from the request acknowledgement.

CI references use the written states Pinned reference, Lock entry observed, Mutable reference, Local reference, and Unknown. Pinned and locked use the accent, mutable uses warning, and local/unknown use muted text. These are configuration states, with no green safety grade. Organization roles use compact accent text on tint, alongside a written permission explanation; role color does not grant platform operator access.

### Cards / Containers

Most content stays directly on the page with separators. Use bordered surface containers for structured match evidence, imported-file metadata, response forms, and recorded response evidence. Evidence rows use 11px by 13px padding; the response form uses 22px padding, reducing to 16px on small screens. Avoid wrapping every row or section in its own card.

### Inputs / Fields

Existing fields outside the organization/onboarding control refresh use surface, text, a line border, control corners, 9px by 11px padding, and a 38px minimum height. Their focus shifts the border to accent and suppresses the outer outline, while links and buttons retain their outline. The shared organization/onboarding controls use 42px desktop / 44px mobile shells, 8px corners, 12px horizontal shell padding, and an accent outer focus outline; their native text inputs keep plain HTML validation. Field and menu state styling is described under Organization scope and protected access. Search uses a compact icon/input frame. Field helpers, actionable error messages, and disabled/busy states remain adjacent to their task. Textareas resize vertically. Keep explicit labels and preserve entered content when a response save fails. Project-context native selects and the optional hosting field retain nearby helper text and an accent focus outline. Response selects have a 44px minimum height; task checkboxes use the solid accent with a visible focus outline, and evidence/summary textareas resize vertically.

### Navigation

The original logo/wordmark anchors the sidebar. Main navigation uses 38px rows, compact icons, muted labels, and purple-tinted active states; notifications sit with account controls toward the bottom. Below 820px a compact top mark and wrapping horizontal destination navigation replace the sidebar. Mobile links have a 32px minimum height; sign-out retains a 32px minimum width and height. The mobile theme action is icon-only with an accessible label. A skip link appears on keyboard focus.

The public shell uses the original 148px wordmark, a quiet horizontal text navigation, an underline for the current desktop destination, theme action, sign-in, and repository action. The header repository action hides at 1170px and sign-in at 850px; at 700px a native disclosure replaces the text navigation. The disclosure includes all primary destinations, documentation, sign-in, and the repository action; the theme action stays outside it. It opens a full-width panel below the 72px header. Keep native keyboard operation and the accessible menu/theme labels. Public footers use grouped destination links and become a two-column link area on mobile.

The invitation shell replaces its account action with Invitation account, a native same-document anchor to the focusable inline account target. The mobile disclosure uses the same anchor. Keep that account route on the active invitation page so its in-memory invitation survives authentication and acceptance stays a separate action.

### Finding record

The match table explains exact package/version, ecosystem, advisory identifiers, reported fix version, inventory update, and match time. The properties area keeps project, environment, customer response, technical severity/CVSS, KEV evidence, EPSS forecast, metadata scope, and source health distinct. Source advisory details and additional references use native disclosures; primary source links remain visible.

Start investigation, record response, and reopen are record actions. Closing as Resolved or Not affected requires written evidence; the response and evidence appear in Activity with a user-attestation label. The interface explicitly states that deployment has not been independently verified. Imported npm/PyPI metadata is the current matching scope; runtime, container-image, deployment, and code-reachability assessment are not established by this record.

### Public advisory record

Public briefing rows and RSS destinations open the advisory's own reading record. The main column presents source, identifiers, publication/update times, a plain upstream summary, reported affected software, and source references. The separate rail keeps severity/CVSS, KEV evidence, and EPSS distinct. HTTP(S) references are validated and deduplicated before rendering; external links use a new tab with opener isolation. Missing summaries, package details, links, or signals receive explicit fallback copy; unavailable and not-found records offer retry and a route back to briefings.

The public record does not establish that a user's project is affected or that a deployed system has been fixed. Its reported version ranges and first fixed versions retain source attribution and a reminder to check current vendor guidance. It does not show private response actions or imply an inventory match.

### Notices and notification settings

Notices describe source failures, stale/previously loaded information, import issues, or action results beside the affected surface. Loading and empty states supply a concrete next step. Notification settings keep account verification, email opt-in, test action, availability, and delivery history together. The reviewed notification state shows delivery unavailable and an unverified account; it does not demonstrate successful email delivery. Provider acceptance is described separately from inbox arrival or reading.

### Public product evidence and illustration

The public product record is a flat, bordered figure with a compact source-like header, project/environment, written severity and separate exploitation context, exact illustrative package/revision, response state, and next action. Its caption explicitly identifies a synthetic example and the metadata boundary. It is explanatory evidence, not a live project dashboard or customer outcome.

The sole original public illustration is `public/illustrations/response-thread.png`: transparent matte lavender sheets passing through charcoal frames into ordered records. Its natural 1792:1024 ratio is preserved with proportional width and automatic height. It sits beside the continuing-evidence passage, with empty alternative text because adjacent prose carries the meaning. Its exact generation prompt is embedded in the asset and retained in `.impeccable/briefs/response-thread-prompt.txt`; do not substitute a reference product's artwork or stretch it into a background. No other public raster asset was introduced by this expansion.

### Developer code and reading links

Code examples sit in a surface-2 block with form corners, a labelled header, and a Copy action. The monospace content scrolls horizontally within the block; mobile reduces padding and code size rather than clipping the page. Copy changes to Copied for two seconds; clipboard failure leaves the code visible and adds a manual-copy recovery status. The sidecar preview preserves the rendered header, control, focus state, and scroll geometry; live clipboard behavior belongs to the implemented React component. Guide sections retain in-page anchors, primary-source reading, and a next-guide link. Documentation separates API, RSS, and MCP by task and uses actual configured endpoints, without invented credentials or client-certification badges.

### Free local skill reading

The free CI audit skill uses the existing documentation navigation, article measure, named command blocks, and copy recovery. Version, runtime, license scope, inspectable source archive, and SHA-256 checksum remain next to the download. Extraction, standalone invocation, an example agent request, report interpretation, and coverage limits form separate reading steps. The page requires no account or API key and keeps the public read-only MCP separate.

The report's local-file fingerprint is distinct from an assessed repository commit. Pinned, locked, mutable, local, and unknown describe configuration evidence. Offline checking does not fetch external dependencies or run project code; it does not establish dependency safety, CI execution, or deployment exposure. Sharing through a coding agent follows that agent's data settings. Source, download, and checksum links describe the served archive without implying external GitHub or npm publication. Existing code and reading primitives cover this surface; no illustration is needed.

### Public subscription

The subscription is a labelled email field, a clear action, and a fieldset of written topic choices. All supported advisories excludes the narrower selections; a request needs at least one topic. The form first checks capability and visibly reports checking or unavailable delivery with an RSS route, disabling the action accordingly. Requesting, check-email acknowledgement, validation/action errors, confirmation, preference loading/saving, unsubscribe confirmation, and unsubscribed states remain distinct. The acknowledgement deliberately gives the same response for an eligible address and an existing subscription.

Confirmation and opt-out require explicit action buttons: opening a token landing page does not subscribe or unsubscribe. The page removes the secret from the URL; a missing or invalid link offers recovery. Management shows the written subscription status and protects against empty topic selection. Success feedback reports the completed action without claiming inbox arrival. The public digest needs a verified email but no Wisesama account, and every action page retains the boundary from private project alerts. Its documented 09:00 UTC cadence is the configured behavior, not proof of production scheduling or delivery.

### Repository connection and provenance

Connection onboarding uses provider permission/method rows, an accessible account selection, repository search and bounded results, then branch/file discovery, immutable snapshot review, and creation. Unconfigured providers show a reason beside a disabled action; missing or bounded repositories have refresh/access recovery. Manual upload remains visible. Repository authorization is separate from Wisesama sign-in. The permission explanation distinguishes selected processing from the broader provider grant, and inventory scope remains repository-wide where shared-lockfile parsing cannot establish a service boundary.

Continuing management separates provider account records from tracked project-source records. A source record shows repository and branch, written synchronization/paused state, last successful and last attempted sync, imported and latest observed commit, last vulnerability assessment, inventory scope, and paths. The assessment time and failure come from the persisted project assessment; neither is inferred from a repository synchronization result. Sync failure, assessment failure, and an observed/imported commit mismatch each keep their own nearby notice. Retained inventory and response history remain explicit through failure, access loss, detach, and disconnect.

Sync now, pause/resume, edit, and detach are adjacent source actions. Detach confirmation describes the affected source and retained project evidence; disconnect confirmation describes the account and all linked imports. Destructive controls use a written confirmation area and danger action, not a generic success toast. A connection, a current inventory, current intelligence, and a completed customer response are independent signals; a newer commit never proves a deployed fix. The reviewed provenance state was a synthetic local verification record, with no connected provider, and was removed after review.

### Repository baseline and project context

A compact source snapshot precedes four native check disclosures: package manager declaration, lockfile, candidate reproducible CI install, and dependency cooldown. Read commit, collection/latest-attempt times, checked inventory paths, and differing current paths or commits remain inspectable. Each disclosure keeps extracted evidence, a next step, and official tool documentation together. Failed reads retain previous evidence beside a written failure; stale selection, paused/disconnected source, and a newer observed commit have separate notices. Recheck reads the imported commit and does not replace repository synchronization. Manual uploads receive an explicit repository-required state and a connection route.

The context form is a distinct bordered surface, with internet accessibility, sensitive-data handling, and an optional hosting name. Yes, No, and Not sure yet stay explicit. The self-reported label and update time sit below the save action; inline save errors preserve entries. These answers never present an inferred deployment check or dismiss findings. No aggregate grade, new illustration, or decorative dashboard graphic is part of this operational surface.

### CI dependency evidence

The CI check opens within the baseline and keeps its saved reference count, checked-file count, and partial-snapshot label together. Each native dependency disclosure opens the full reference, extracted observation, bounded next step, and exact file/line at the read commit. A validated provider location receives an immutable source-file link; otherwise the location remains readable without an invented link. A pin or lock entry never becomes a trust, vulnerability, execution, or exposure verdict.

Labelled search and state filters operate on the saved snapshot and announce the displayed result count. Filtered emptiness offers Clear dependency filters; an empty supported-reference report keeps its files and limits available without declaring CI dependency-free. Partial collection opens its issues, and a separate native disclosure retains checked files and collection limitations. Failed, stale, paused, or disconnected reads retain their own notices beside earlier evidence. Recheck reads the imported revision; collecting a changed repository revision requires synchronization first. The synthetic sidecar preview demonstrates disclosure and evidence geometry, while filtering, source validation, and recheck persistence belong to the application.

### Organization scope and protected access

A labelled searchable Base UI organization picker uses a 42px minimum desktop height, form corners, current-role metadata, and an adjacent Manage link. Organization and repository-onboarding controls share plain CSS wrappers styled from coss ui patterns and Wisesama tokens: short fixed-list account/environment/role pickers, native text inputs, a textarea, and checked inventory rows. Searchable organization choices retain fixed identities; typing filters existing organizations and cannot create one. Branch autocomplete instead keeps the exact typed name independent of bounded provider suggestions, including when no suggestion matches. Other workspace, public, admin, CI-filter, and continuing repository-settings controls retain their existing treatment until their separate review.

- **Geometry:** field shells use the scoped component tokens, a one-pixel line border, 13px regular text, and the field-adornment gap. Labels are 13px semibold; helper/error text is 12px with a 1.6 line height. Native text sits inside the shell with 9px vertical padding; textareas start at 108px and resize vertically. At widths up to 600px or with a coarse pointer, shells reach at least 44px, native input/search/textarea entry uses 16px type, and menu options have a 44px minimum height.
- **Focus and states:** focused shells/pickers/textareas have an accent border and a 2px accent outline offset by 2px; checkboxes use a 3px offset. Fine-pointer hover changes the border to quiet while focused hover retains accent. Invalid fields use a danger border and adjacent associated error text. Disabled shells/pickers/textareas use 55% opacity without a shadow; checkboxes and disabled options use 50%. Read-only values use muted text. Busy pickers expose their written/busy state and spinner, while the caller disables controls during pending work. Native input constraints and business callbacks remain with the caller.
- **Menus:** portalled menus inherit the document theme, align to the trigger with a 6px gap, and retain 12px viewport collision padding. They use menu corners, surface-2, the temporary shadow described above, and bounded internal scrolling. Highlighted options use hover; selected options use accent text and a purple check. Searchable menus have an integrated search row and an explicit no-match message. Static sidecar examples illustrate these states; they do not run Base UI search or persistence.
- **Inventory selection:** selected file rows use an accent border and tint with an 18px solid-purple checkbox and white check. The label remains the whole selection row. A custom file entry, its Add file action, and inventory checkboxes disable during pending discovery/preview reads, retaining the draft and selection. An empty or duplicate path, or a reached ten-path limit, also disables Add file. No slider is part of this control set.

Settings begin with organization identity and Your role, then the permission explanation and member directory. Project onboarding states the selected destination and sharing consequence before configuration. Member records keep identity, role, permissions, and available actions together; owner/admin controls remain absent from member views. Personal provider connections and original-connector control remain distinct from organization membership, as do personal notifications and platform operator access.

Role changes, removal, and invitation revocation use an inline surface naming the person and organization, the new role or consequence, a 10–500-character reason, and an explicit review checkbox before a specific confirmation action. Changing the proposed role clears confirmation. Revision conflicts retain the draft, block a stale change, and require reloading and reviewing again. Recent organization history remains a separate native disclosure. The synthetic sidecar preview shows scope, member permissions, and the unconfirmed control state; it does not save access changes or reproduce live membership validation.

### Organization invitations

Creating an invitation pairs one email with an admin/member role and a nearby permission explanation. The fresh share link has expiry, copy recovery, and Hide invitation link; history retains metadata rather than reconstructing old secret links. Written copy says the user shares the link, without claiming email delivery. Expired, revoked, and accepted states remain visible.

The public invitation presents organization, role, and expiry before inline account entry and a separate Accept invitation action. A verified matching account is required; opening the link does not join. The secret is removed from the address bar and retained only in component memory, with no storage or authentication-callback copy. Both public navigation account controls use the native inline account anchor. Missing, invalid, expired, wrong-account, and verification states retain specific recovery guidance; verification tells the person to keep the original invitation tab or reopen the original link.

### Private response progress and history

The response header preserves project/environment, guidance update date, exact guidance version, and saved time or unstarted state. A quiet scope block explains the attestation boundary. Starting a record is explicit; questions keep Unknown alongside evidence-reviewed Yes/No, while applicability feedback describes the answers without declaring verified exposure. Named phases group task checkboxes, task detail, and a written evidence hint. The completion count says recorded complete; it is independent from the saved response status.

Summary, evidence references, status, and the save control form one closing section. Unsaved, busy, saved, failed-save, and revision-conflict states are written beside it. Failed saves retain the draft; a conflict disables saving until the owner explicitly discards the draft and reloads the saved response. Closed and Not affected retain team-attested labels and evidence requirements. A reopened record remains part of the same history.

The sources/history rail has a flat vertical divider on desktop. Saved events show status, local time, and summary, plus a native disclosure containing the evidence reference and recorded applicability/task state. The disclosure remains available without an evidence reference and says so explicitly. Unknown answers and tasks not recorded complete remain visible. A guidance-version mismatch is a nearby notice, not a silent rewrite of previous work. The preview uses labelled synthetic data; static controls demonstrate the pattern, while persistence and conflict handling belong to the application.

### Public playbook reading

Public playbooks carry the guide typography and reading width into incident guidance. The index exposes linked titles, descriptions, phase/question counts, and update dates. Detail headers show the exact guidance version and update date, followed by bounded scope, applicability questions, named response phases, ordered actions, evidence hints, and authoritative sources. Vendor-specific version, platform, channel, and incident-window conditions remain in the visible guidance. Sources and assessment limitations stay part of the article.

Public lists have no progress checkboxes or saved-state claims. The closing action chooses a project for a private response while retaining the selected incident; an account is unnecessary for reading. The design uses existing reading links, scope surfaces, and task hierarchy with no new raster imagery.

### Admin records and responsive facts

Search and written filters precede compact linked rows; explicit submission and cursor paging retain their context on record/back links. A full record begins with identity and state, followed by authoritative facts and consequences, a scoped action area, and recent audit. The overview points to actual work rather than decorative metrics. User access, public subscription consent, source collection/check state, and failed-job outcome keep their own labels and boundaries. Upstream advisory facts stay in the reading area; Wisesama guidance, visibility, and internal notes stay in the editorial action area.

Identity links remain visible in the first native table cell. Mobile labelled facts preserve the information from desktop columns, including project environment/assessment, delivery status/attempts, affected-software ecosystem/reported fix, and job-attempt outcome/start/finish times. The opposite field presentation is hidden, not merely clipped. Overflow hints and arrow-key access supplement wider tables when needed; they do not replace readable mobile facts. The sidecar row preview demonstrates this responsive structure; actual overflow measurement belongs to the application.

### Admin scoped changes and audit

An outlined surface separates a named change from the facts it affects. It states the consequence, requests a 20–1,000-character reason, then requires an explicit checkbox confirmation and a specific action label. Admin fields use 7px corners, 10px by 12px padding, and a 40px minimum height; the action surface uses 22px padding and the panel radius. Danger actions use the existing danger background, text, and outline roles. Busy/disabled, saved, failure, and revision-conflict states remain beside the form. A conflict preserves entries and blocks another stale save until the operator chooses Discard draft and reload record.

Recent audit is a separate flat list of action, time, reason, actor, and target, with a route to the paginated audit log for older records. Exact-job target, recorded failure, and structured attempt history remain inspectable before another attempt is confirmed. Queueing or resuming a source does not claim recovery; stopping public mail does not grant consent. The synthetic sidecar source preview shows the fact/action/audit separation and native control states; it does not persist changes or reproduce runtime validation.

## Do's and Don'ts

### Do:

- **Do** preserve the original Wisesama mark, Satoshi, and the charcoal/purple identity in both themes.
- **Do** reuse semantic theme roles, quiet separators, compact rows, and visible keyboard focus.
- **Do** retain project identity in every mobile finding row and place properties before Suggested response and Activity.
- **Do** show source names, collection times, unknown or failed checks, and metadata scope near the assessment.
- **Do** keep severity, KEV evidence, EPSS forecast, and customer response visually and verbally separate.
- **Do** show response evidence in history and identify closure as a user attestation.
- **Do** use wider product sections, focused article columns, and compact working controls according to the surface's task.
- **Do** preserve copy recovery, contained code/table scrolling, mobile public navigation, and the illustration's natural proportions.
- **Do** label synthetic product records and keep public subscription truth states separate from private alerts.
- **Do** show inventory synchronization, assessed revision, assessment freshness/error, and response status as independent evidence.
- **Do** preserve baseline paths/read commit, self-reported context, exact guidance version, and recorded answers/tasks in their own inspectable places.
- **Do** keep public playbooks readable without an account and retain the selected incident through project choice.
- **Do** retain admin row identity and labelled state/outcome/time facts at 650px and below, hiding the opposite field presentation from the accessibility tree.
- **Do** name source Collection and Check state separately and show an overflow instruction with keyboard access only when a table actually overflows.
- **Do** separate operator facts, consequence/reason/confirmation controls, and recorded audit history.
- **Do** keep CI identity, exact file/line, reference state, partial collection, and retained stale or failed evidence inspectable together.
- **Do** show selected organization, current role, project destination, and protected access consequences beside their controls.
- **Do** preserve inline invitation authentication, the native account anchor, and separate explicit acceptance.
- **Do** keep the free local skill's source, download, checksum, commands, evidence vocabulary, and limits in the reading flow.

### Don't:

- **Don't** replace the original mark, import reference-product branding, or load an unimplemented heading font by inference.
- **Don't** infer deployed exposure, code reachability, a verified fix, or complete coverage from a package-version match.
- **Don't** equate absence from checked KEV with absence of exploitation, or present EPSS as observed exploitation.
- **Don't** turn local verification data, sample counts, or a bounded review verdict into customer evidence, full-app certification, or proof of live provider/email operation.
- **Don't** hide source failures or unavailable notification delivery behind a success state.
- **Don't** turn repository authorization or successful inventory synchronization into a fresh assessment or verified deployment claim.
- **Don't** activate or cancel a public subscription merely by opening its confirmation or preferences link.
- **Don't** invent paid amounts, production assurances, private MCP access, or shared-team capabilities in public visual proof.
- **Don't** turn an Observed configuration check, answered applicability question, completed task, or attested closure into a safety score or verified recovery claim.
- **Don't** hide recorded answers or task state because a history event has no evidence reference, or show interactive progress controls on public reading pages.
- **Don't** present collection resumption, queued work, or a successful HTTP response as a fresh successful check or recovered job.
- **Don't** turn operator delivery controls into consent, or editorial controls into edits of upstream advisory facts.
- **Don't** turn a pinned or locked CI reference into dependency safety, executed workflow, vulnerability, or deployment evidence.
- **Don't** treat organization membership as a personal provider connection or platform operator access, or invitation creation as email delivery.
- **Don't** persist invitation secrets, place them in account callbacks, or join an organization merely by opening its link.
