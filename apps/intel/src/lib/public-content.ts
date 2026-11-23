export interface GuideSection {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
  code?: string;
}

export interface PublicGuide {
  slug: string;
  title: string;
  description: string;
  category: 'Connect' | 'Understand' | 'Respond' | 'Stay informed';
  minutes: number;
  sections: GuideSection[];
  sources: Array<{ title: string; href: string }>;
}

export const publicGuides: PublicGuide[] = [
  {
    slug: 'connect-github',
    title: 'Connect a GitHub repository',
    description: 'Choose repository access, import an inventory, and keep its assessment current.',
    category: 'Connect',
    minutes: 4,
    sections: [
      {
        id: 'before-you-connect',
        title: 'Before you connect',
        paragraphs: [
          'Sign in to Wisesama, then start a project. Connecting GitHub is a separate authorization from your Wisesama account. You need permission to install or request the Wisesama GitHub App for the repository owner. Organization approval may be required.',
        ],
      },
      {
        id: 'choose-access',
        title: 'Choose the repositories to share',
        paragraphs: [
          'The GitHub App requests read access to repository contents and metadata. Contents permission covers the selected repositories, even though Wisesama processes supported inventory files and allowlisted package-manager and CI configuration for baseline checks. It is not a file-only permission. Choose only the repositories you intend to assess.',
        ],
        steps: [
          'Choose GitHub in the new-project flow and authorize the connection.',
          'Install or configure the App for the correct personal account or organization.',
          'Return to Wisesama and choose a repository you can access.',
          'Choose its branch and supported inventory path. Review the parsed packages and scope before importing.',
        ],
      },
      {
        id: 'review-the-result',
        title: 'Review the imported revision',
        paragraphs: [
          'Wisesama reads inventory metadata from a specific commit. Check the assessed revision and the last successful inventory sync separately from the advisory assessment time. A successful repository sync does not mean a deployment has changed.',
          'If a repository is missing, check which repositories the app can access in GitHub, then reconnect. You can also upload a supported lockfile.',
        ],
      },
      {
        id: 'disconnect',
        title: 'Change or remove access',
        paragraphs: [
          'Manage the connection in workspace integrations. Disconnect stops future access through that connection; existing assessment records remain as evidence of the earlier snapshot. Revoke or uninstall the App in GitHub as well if you want to remove the provider grant.',
        ],
      },
    ],
    sources: [
      {
        title: 'GitHub App permissions',
        href: 'https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app',
      },
    ],
  },
  {
    slug: 'connect-gitlab',
    title: 'Connect a GitLab.com project',
    description: 'Understand the authorization scope and choose the project Wisesama will assess.',
    category: 'Connect',
    minutes: 4,
    sections: [
      {
        id: 'supported-host',
        title: 'Start with GitLab.com',
        paragraphs: [
          'Use a GitLab.com account to connect a project. For self-managed GitLab, upload a supported lockfile.',
        ],
      },
      {
        id: 'authorization',
        title: 'Understand what you authorize',
        paragraphs: [
          'GitLab’s read_api OAuth scope grants read API access under your GitLab identity. That provider grant is broader than the projects you select inside Wisesama. Project selection narrows what Wisesama processes; it does not narrow GitLab’s token permission.',
          'Wisesama reads supported inventory files, repository metadata, and allowlisted package-manager and CI configuration for static baseline checks. Raw configuration is transient; extracted facts and paths are retained. It does not need permission to push commits or create merge requests for this assessment workflow.',
        ],
        steps: [
          'Choose GitLab.com when creating a project.',
          'Review the permissions in GitLab, then return to Wisesama.',
          'Select a project, branch, and supported inventory path.',
          'Review the exact versions, warnings, and repository-wide scope before saving.',
        ],
      },
      {
        id: 'maintenance',
        title: 'Keep the connection working',
        paragraphs: [
          'GitLab OAuth credentials expire and must be refreshed. If refresh or access checks fail, reconnect from workspace integrations. The last successful snapshot remains visible; a failed refresh is not an empty or clean assessment.',
          'Wisesama checks connected GitLab projects periodically. To remove access, disconnect in Wisesama and revoke the app in GitLab.',
        ],
      },
    ],
    sources: [
      { title: 'GitLab OAuth scopes', href: 'https://docs.gitlab.com/integration/oauth_provider/' },
      { title: 'GitLab OAuth API', href: 'https://docs.gitlab.com/api/oauth2/' },
    ],
  },
  {
    slug: 'choose-your-inventory',
    title: 'Choose the right inventory',
    description: 'Exact versions, lockfiles, and the limits of a monorepo assessment.',
    category: 'Connect',
    minutes: 5,
    sections: [
      {
        id: 'exact-versions',
        title: 'Start with exact package versions',
        paragraphs: [
          'Wisesama matches package metadata for npm and PyPI. It needs a package name, an ecosystem, and an exact version. A version range such as ^1.2.3 describes allowed versions rather than the installed version, so it cannot be treated as an exact match.',
          'Prefer package-lock.json version 2 or 3, pnpm-lock.yaml, or a pinned inventory JSON. A package.json can be assessed when versions are pinned, but it omits transitive dependencies and skips ranges, tags, URLs, and workspace references.',
        ],
      },
      {
        id: 'inventory-json',
        title: 'Use inventory JSON for a pinned package list',
        paragraphs: [
          'An inventory may contain npm and PyPI entries. Export the versions you actually want to assess. The example below demonstrates the input format; it is not a recommendation to use these package versions.',
        ],
        code: '{\n  "packages": [\n    { "name": "example-package", "version": "1.2.3", "ecosystem": "npm" },\n    { "name": "example-python", "version": "2.0.0", "ecosystem": "PyPI" }\n  ]\n}',
      },
      {
        id: 'monorepos',
        title: 'Keep monorepo scope explicit',
        paragraphs: [
          'A shared pnpm lockfile can contain packages from several services. The current parser assesses the package versions in that file as a repository-wide inventory. Choosing a folder does not establish which transitive dependencies belong to one service.',
          'If you need service-specific coverage, supply a pinned inventory exported for that service. Name the project so its scope is clear, and retain the export method with your response evidence.',
        ],
      },
      {
        id: 'limits',
        title: 'Review warnings before assessing',
        paragraphs: [
          'Each inventory is limited to 2 MB and 2,000 unique package versions. Unsupported entries and incomplete package.json coverage appear in the preview warnings. An inventory with no supported exact versions is rejected.',
          'Runtime notes are context. Container images, runtime reachability, operating-system packages, deployment state, and application behavior are not assessed by this package-metadata workflow.',
        ],
      },
    ],
    sources: [
      { title: 'OSV package and version data', href: 'https://osv.dev/' },
      {
        title: 'npm package-lock.json',
        href: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json',
      },
    ],
  },
  {
    slug: 'severity-exploitation-and-exposure',
    title: 'Read the signals without conflating them',
    description:
      'Severity, known exploitation, prediction, and your own exposure answer different questions.',
    category: 'Understand',
    minutes: 5,
    sections: [
      {
        id: 'severity',
        title: 'Severity describes the vulnerability',
        paragraphs: [
          'An advisory’s severity and CVSS score describe its technical characteristics and impact under the scoring assumptions. They help you understand the issue, but they do not establish whether your application runs the affected code or is reachable by an attacker.',
        ],
      },
      {
        id: 'known-exploitation',
        title: 'Known exploitation is an evidence signal',
        paragraphs: [
          'CISA’s Known Exploited Vulnerabilities catalog records vulnerabilities for which CISA has evidence of exploitation. A checked catalog match is a reason to prioritize assessment. Absence from the checked catalog does not establish that exploitation has never occurred.',
          'If the source check fails, Wisesama shows the source’s unavailable or degraded state. Previously observed evidence should not disappear because the newest check was unsuccessful.',
        ],
      },
      {
        id: 'prediction',
        title: 'EPSS is a forecast',
        paragraphs: [
          'FIRST’s EPSS estimates the probability of a published CVE being exploited in the next 30 days. It is a forecast informed by a model, rather than proof that your service has been attacked. Check the prediction’s date and the source status when using it.',
        ],
      },
      {
        id: 'your-environment',
        title: 'Your environment supplies the exposure evidence',
        paragraphs: [
          'An inventory match means a reported affected package version was found in the assessed metadata. Investigate whether that version is deployed, whether the vulnerable feature is used, and whether an attacker can reach it.',
          'Keep the questions separate in your response: what is installed, what the advisory says, what exploitation evidence exists, and what you verified about your own environment.',
        ],
      },
    ],
    sources: [
      { title: 'FIRST EPSS', href: 'https://www.first.org/epss/' },
      {
        title: 'CISA Known Exploited Vulnerabilities',
        href: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
      },
      {
        title: 'FIRST CVSS specification',
        href: 'https://www.first.org/cvss/v4.0/specification-document',
      },
    ],
  },
  {
    slug: 'respond-to-a-finding',
    title: 'Take a finding through to a recorded response',
    description: 'Investigate the match, choose an action, and keep the verification evidence.',
    category: 'Respond',
    minutes: 5,
    sections: [
      {
        id: 'assess',
        title: 'Check the match and the source',
        paragraphs: [
          'Open a finding from the response inbox. Compare the package name, ecosystem, installed version, advisory identifier, and assessed inventory. Read the current vendor or maintainer guidance through the source links.',
          'A reported fixed version is source guidance, not a guarantee that one upgrade is appropriate for every dependency tree. Review breaking changes and test your own application.',
        ],
      },
      {
        id: 'investigate',
        title: 'Record the investigation',
        steps: [
          'Move the finding to Investigating.',
          'Check whether the assessed version is present in the relevant deployment.',
          'Assess the vulnerable feature, configuration, and reachable attack paths.',
          'Record the affected environments and the next action in the response note.',
        ],
        paragraphs: [
          'Keep severity, exploitation evidence, and your environment’s exposure as separate parts of the decision. If source collection is degraded, retain that uncertainty in the investigation.',
        ],
      },
      {
        id: 'mitigate',
        title: 'Distinguish mitigation from remediation',
        paragraphs: [
          'A compensating control, configuration change, or restricted endpoint may reduce exposure while a permanent change is prepared. Record what was changed, what it covers, and what remains. Use Mitigated when that best describes the current response.',
          'A WAF rule or other control should not be described as patching the vulnerable package. Revisit the control as vendor guidance and your deployment change.',
        ],
      },
      {
        id: 'close',
        title: 'Close with evidence, then reopen if needed',
        paragraphs: [
          'Resolved and Not affected require written evidence. Record the verification method, deployment or change reference, and what the result establishes. Removing a package from a repository alone does not verify that an older deployment has been replaced.',
          'Wisesama keeps the response in the finding’s activity. Closure is your attestation; Wisesama does not independently verify a deployed fix. Reopen the finding when new evidence or a changed environment warrants another assessment.',
        ],
      },
    ],
    sources: [
      {
        title: 'CISA vulnerability response playbooks',
        href: 'https://www.cisa.gov/resources-tools/resources/federal-government-cybersecurity-incident-and-vulnerability-response-playbooks',
      },
    ],
  },
  {
    slug: 'freshness-and-failed-syncs',
    title: 'Understand freshness and recover a failed sync',
    description:
      'Repository access, inventory revision, advisory refresh, and response status each have their own clock.',
    category: 'Understand',
    minutes: 4,
    sections: [
      {
        id: 'separate-clocks',
        title: 'Check the right timestamp',
        paragraphs: [
          'The repository’s current branch, the last imported commit, and the last advisory assessment may differ. A source advisory also has its own published and modified timestamps. None of those dates establishes when an attack on your systems began.',
          'Use the project’s inventory revision and last successful sync to understand what was assessed. Use source collection status to understand how current the intelligence check is. Use response activity to understand the actions you recorded.',
        ],
      },
      {
        id: 'recover-access',
        title: 'Recover repository access',
        steps: [
          'Check whether you need to reconnect GitHub or GitLab.',
          'Confirm that the repository is still selected in the GitHub App or accessible to your GitLab identity.',
          'Confirm that the selected branch and inventory path still exist.',
          'Reconnect or update selection, then request another sync.',
        ],
        paragraphs: [
          'If an import fails, Wisesama shows the last successful import and its date. Check the branch and connection before trying again.',
        ],
      },
      {
        id: 'upstream-outage',
        title: 'Handle an intelligence-source outage',
        paragraphs: [
          'Retry after a temporary source failure and inspect the source status again. Continue investigating previously reported findings. An unsuccessful source request does not invalidate known evidence, and a new collection time alone is not a newly discovered vulnerability.',
          'For time-sensitive decisions, follow the linked vendor or maintainer guidance directly and record what you checked.',
        ],
      },
    ],
    sources: [
      {
        title: 'GitHub installation management',
        href: 'https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps',
      },
    ],
  },
  {
    slug: 'subscribe-to-security-updates',
    title: 'Choose how to follow security updates',
    description:
      'Use email, RSS, API, or an agent without confusing public updates with private project alerts.',
    category: 'Stay informed',
    minutes: 3,
    sections: [
      {
        id: 'public-updates',
        title: 'Read the public feed without an account',
        paragraphs: [
          'The public feed contains sourced advisories and collection status. Search for a package or advisory, then filter by severity or known exploitation. Public feed results are not matches against your repositories.',
          'RSS and the public read API expose public intelligence only. They do not include private inventories, findings, or recorded response notes.',
        ],
      },
      {
        id: 'email',
        title: 'Subscribe with a verified address',
        paragraphs: [
          'Choose a topic and enter an email address on the feed page. Open the confirmation email and explicitly confirm the subscription. You do not need a Wisesama account. Opening a link alone does not activate a subscription.',
          'The daily digest covers new advisories and important changes to existing ones. The feed shows whether email sign-up is available.',
        ],
      },
      {
        id: 'manage',
        title: 'Manage public email separately',
        paragraphs: [
          'Use the preference link in an edition, or request a management link from the feed page, to change topics or unsubscribe. Unsubscribing from the public digest does not change private project notification settings.',
          'To receive alerts for your projects, verify your account email and turn on email alerts in Notification settings. You can send yourself a test from that page.',
        ],
      },
    ],
    sources: [
      { title: 'RSS format reference', href: 'https://www.rssboard.org/rss-specification' },
      { title: 'One-click unsubscribe standard', href: 'https://www.rfc-editor.org/rfc/rfc8058' },
    ],
  },
];

export const guideGroups = ['Connect', 'Understand', 'Respond', 'Stay informed'] as const;
