# CI dependency integrity and agent audits

Research date: 5 November 2026. This source research preceded the implementation. CI dependency checks, organization workspaces and the first free local audit skill are now implemented; see `CI-DEPENDENCY-CONTRACT.md`, `ORGANIZATIONS-CONTRACT.md` and `OPEN-SOURCE-SKILLS.md`. The separate Cloudflare prelaunch audit has its own frozen-source coverage and findings report. Production operation still requires deployment verification.

## Sources and verified distinctions

[Dan Robinson's post](https://x.com/danlovesproofs/status/2118127827732320332) describes mutable GitHub Actions tags and recommends full commit references plus a lint rule. The cited historical incident is the March 2025 compromise of `tj-actions/changed-files`, CVE-2025-30066. It should not be presented as a newly discovered November vulnerability. [CISA's incident notice](https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-github-action-cve-2025-30066) confirms the compromise and secret disclosure; the [CVE record](https://www.cve.org/CVERecord?id=CVE-2025-30066) records repointed tags on 14–15 March 2025. Repository usage or potential impact is not proof that every repository lost credentials.

Current [GitHub guidance](https://docs.github.com/en/actions/reference/security/secure-use) recommends least-privilege tokens, careful treatment of privileged workflow triggers and action source review. A SHA is immutable identification, not a safety verdict. [Workflow dependency lockfiles](https://docs.github.com/en/enterprise-cloud@latest/actions/concepts/security/workflow-dependency-lockfiles) now cover onboarded workflows' transitive action dependencies; reusable workflow calls need separate full-SHA references. Merely seeing `actions.lock` does not prove a particular workflow is covered. Runtime downloads, images, inputs and secrets remain separate concerns.

[Cloudflare's post](https://x.com/cloudflaredev/status/2118013149538390253) points to the MIT-licensed [security-audit skill](https://github.com/cloudflare/security-audit-skill). Its methodology includes architecture/coverage mapping, hunting, independent challenge, structured findings, final verification and reporting. The useful product lesson is to preserve distinct confirmed, unresolved and rejected outcomes with source revision and evidence. The [report schema](https://github.com/cloudflare/security-audit-skill/blob/main/skills/security-audit/report-schema.json) provides stable identifiers, traces, evidence and explicit unresolved facts. It is a repository-audit workflow, not an intelligence feed or proof that deployed software is secure.

## Fit with current Wisesama

At the time of this research, the existing repository baseline read bounded root workflow/configuration files at the imported commit. Its four checks covered package-manager declaration, committed lockfile, a candidate immutable install and version-compatible dependency cooldown. It did not yet assess action pinning or workflow lockfile coverage. The implemented fifth check now does both within the documented bounds; token-permission and action-advisory evaluation remain separate work. External actions/includes are deliberately not executed or recursively followed.

The smallest useful next flow is: connect GitHub → inspect workflow dependencies at a named commit → show action/reference/file and evidence → explain the applicable locking or pinning change → recheck the next imported commit. Show a configuration weakness separately from known vulnerable code and incident exposure. Unreadable files, skipped workflows and unavailable provider-policy information must remain unknown. Do not turn the existing ten-workflow read limit into an all-repository coverage claim.

Consider established static rules such as [zizmor's audits](https://docs.zizmor.sh/audits/) before designing a new scanner. GitLab needs provider-specific include/image rules; GitHub's syntax and lockfile guarantees do not transfer to GitLab.

A later flow can import a local agent's structured audit into an authenticated private project. Bind the report to repository/commit, distinguish reported conclusions from Wisesama verification, preserve unresolved facts, assign response work, and revalidate after changes. A separate isolated worker architecture, code-access consent and measured per-run costs are prerequisites for hosted code auditing. That proposed audit-report import remains future work. The Cloudflare skill has since been installed into an isolated task tools directory for the separate prelaunch review; its exact source coverage and results belong to that audit’s report.

## Recommended sequence

1. Add workflow dependency integrity to project security, with read-only evidence and provider-aware guidance. Basic diagnosis and fix instructions can be free.
2. Extend continuous repository monitoring to relevant CI changes and known-action advisories. Team routing, recurring checks and retained history are plausible paid value; no price is proposed here.
3. Use Cloudflare's methodology for a separately scoped prelaunch review of Wisesama, then evaluate private audit-report import. Keep public advisory provenance, configuration observations and independently reproduced vulnerabilities distinguishable throughout the product.

This sequence adds an actionable repository workflow while reusing existing connections, evidence, response history, subscriptions and operator recovery. The value comes from keeping those records current and helping a team complete its response.
