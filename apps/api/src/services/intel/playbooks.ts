/** Curated response guidance. These templates never establish machine exposure automatically. */
export type PlaybookAnswer = 'yes' | 'no' | 'unknown';
export type PlaybookStatus =
  | 'investigating'
  | 'contained'
  | 'recovering'
  | 'closed'
  | 'not_affected';
export interface ResponsePlaybook {
  id: string;
  version: string;
  title: string;
  description: string;
  updatedAt: string;
  scope: string;
  questions: Array<{ id: string; label: string; help: string }>;
  phases: Array<{
    id: string;
    title: string;
    description: string;
    tasks: Array<{ id: string; title: string; detail: string; evidenceHint: string }>;
  }>;
  sources: Array<{ title: string; url: string }>;
  limitations: string[];
}

const sharedLimitations = [
  'Answers, completed tasks, and closure are recorded by your team. Wisesama does not inspect endpoints, revoke credentials, or verify recovery.',
  'Keep passwords, tokens, personal data, and raw logs out of this record. Save a reference to evidence in your approved evidence system.',
  'Check the vendor notice for updates before acting. Guidance here is a versioned starting point, not a complete incident investigation.',
];
const recoveryTasks = [
  {
    id: 'rotate-access',
    title: 'Review and replace accessible credentials',
    detail:
      'From a trusted device, revoke exposed sessions and rotate credentials the affected environment could access. Check deployment, source-control, cloud, and package-publishing access.',
    evidenceHint:
      'Credential classes reviewed, revocation record, and time. Never paste a credential.',
  },
  {
    id: 'review-downstream',
    title: 'Review downstream activity and artifacts',
    detail:
      'Review relevant sign-ins, CI activity, releases, and production changes during the suspected window. Escalate evidence of unauthorized access to the incident owner.',
    evidenceHint: 'Investigation or audit reference, review window, and outstanding unknowns.',
  },
  {
    id: 'verify-recovery',
    title: 'Record recovery checks and remaining risk',
    detail:
      'Have the responsible person review the recovery evidence, monitoring, and any remaining uncertainty before closing. Removing a package or extension alone does not establish recovery.',
    evidenceHint:
      'Reviewer, recovery evidence reference, monitoring period, and accepted remaining risk.',
  },
];

export const responsePlaybooks: ResponsePlaybook[] = [
  {
    id: 'malicious-dependency',
    version: '2026-11-05.1',
    title: 'Respond to a malicious dependency',
    description:
      'Take a reported malicious release from applicability review through containment and recovery.',
    updatedAt: '2026-11-05',
    scope:
      'Manual incident response for a dependency reported as malicious. Ordinary vulnerability findings have their own response record.',
    questions: [
      {
        id: 'affected-release',
        label: 'Was the reported malicious package and version present?',
        help: 'Confirm ecosystem, package name, exact version, and the authoritative notice. A similar name or a version range is insufficient.',
      },
      {
        id: 'executed',
        label: 'Was that release installed or executed in this environment?',
        help: 'Review installation logs, build records, and developer environments. An inventory match alone does not prove execution.',
      },
    ],
    phases: [
      {
        id: 'assess',
        title: 'Establish the scope',
        description: 'Keep what you know separate from what still needs investigation.',
        tasks: [
          {
            id: 'record-release',
            title: 'Record the release and activity window',
            detail:
              'Save the source notice and identify affected builds, devices, or workloads. Preserve relevant records under your evidence policy.',
            evidenceHint:
              'Notice URL, package/version, exact inventory or build revision, and time window.',
          },
        ],
      },
      {
        id: 'contain',
        title: 'Contain the affected environment',
        description: 'Choose actions with the incident owner and preserve evidence.',
        tasks: [
          {
            id: 'contain-runtime',
            title: 'Stop further use and isolate affected execution',
            detail:
              'Pause affected installation or publishing paths, isolate suspect environments as appropriate, and preserve evidence. Use a trusted environment to investigate.',
            evidenceHint: 'Scope isolated, responsible person, containment action, and time.',
          },
          {
            id: 'trusted-rebuild',
            title: 'Recover from a trusted release or environment',
            detail:
              'Follow the authoritative notice. Review persistence and build artifacts; replace or rebuild compromised environments where required before resuming.',
            evidenceHint:
              'Trusted release or image, rebuild record, and persistence review reference.',
          },
        ],
      },
      {
        id: 'recover',
        title: 'Recover and verify',
        description: 'A dependency update can be one action in a larger response.',
        tasks: recoveryTasks,
      },
    ],
    sources: [
      {
        title: 'npm: reporting malware',
        url: 'https://docs.npmjs.com/reporting-malware-in-an-npm-package/',
      },
      {
        title: 'GitHub: revoke or rotate exposed secrets',
        url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository',
      },
    ],
    limitations: sharedLimitations,
  },
  {
    id: 'cursor-extension-oct-2026',
    version: '2026-11-05.1',
    title: 'Review the October Cursor extension incident',
    description:
      'Check the vendor’s affected versions, platform, distribution channel, and installation window before recording a response.',
    updatedAt: '2026-11-05',
    scope:
      'Cursor’s October 29, 2026 notice for Anthropic.claude-code 2.1.312 and 2.1.313. This is a manual review, separate from npm/PyPI inventory matching.',
    questions: [
      {
        id: 'platform',
        label: 'Was the extension used on macOS or Windows?',
        help: 'Use device records for the relevant period; do not infer the platform from a repository.',
      },
      {
        id: 'extension-version',
        label: 'Was Anthropic.claude-code 2.1.312 or 2.1.313 installed?',
        help: 'Record historical version evidence. Today’s updated version does not establish what was installed earlier.',
      },
      {
        id: 'marketplace',
        label: 'Did it come from the Cursor marketplace?',
        help: 'Check the distribution channel against the vendor notice.',
      },
      {
        id: 'install-window',
        label: 'Was it installed or updated during the affected window?',
        help: 'Vendor window: October 29, 2026, 2:27 AM–1:35 PM Pacific Time (09:27–20:35 UTC). Unknown historical evidence should stay unknown.',
      },
    ],
    phases: [
      {
        id: 'assess',
        title: 'Review applicability',
        description: 'All four conditions matter. Wisesama does not scan your devices.',
        tasks: [
          {
            id: 'review-vendor',
            title: 'Check the current vendor notice and preserve records',
            detail:
              'Use the vendor’s latest scope and indicators. Keep device, installation, and investigation references. Absence of one indicator alone does not establish a clean device.',
            evidenceHint: 'Notice version/date and device or investigation reference.',
          },
        ],
      },
      {
        id: 'contain',
        title: 'Contain and remove persistence',
        description: 'Use the vendor’s response instructions with the incident owner.',
        tasks: [
          {
            id: 'isolate-host',
            title: 'Isolate suspected affected hosts and preserve evidence',
            detail:
              'Review the vendor’s detection and containment instructions from a trusted system. Have an authorized responder decide which checks to run.',
            evidenceHint: 'Host reference, containment action, owner, and time.',
          },
          {
            id: 'remove-persistence',
            title: 'Review persistence and the need to rebuild',
            detail:
              'Follow the vendor’s cleanup and recovery guidance. Uninstalling the extension can leave attacker persistence behind; evaluate rebuilding affected systems.',
            evidenceHint: 'Cleanup or rebuild evidence and remaining investigation questions.',
          },
        ],
      },
      {
        id: 'recover',
        title: 'Recover and review access',
        description: 'Record the recovery beyond the extension update.',
        tasks: recoveryTasks,
      },
    ],
    sources: [
      {
        title: 'Cursor: authoritative extension security notice',
        url: 'https://cursor.com/blog/claude-code-extension-security-notice',
      },
    ],
    limitations: sharedLimitations,
  },
];

export function getResponsePlaybook(id: string) {
  return responsePlaybooks.find((playbook) => playbook.id === id);
}

export function playbookApplicability(
  playbook: ResponsePlaybook,
  answers: Record<string, PlaybookAnswer>,
) {
  const values = playbook.questions.map((question) => answers[question.id] ?? 'unknown');
  if (values.some((answer) => answer === 'no')) return 'not_indicated' as const;
  if (values.every((answer) => answer === 'yes')) return 'potentially_affected' as const;
  return 'needs_review' as const;
}
