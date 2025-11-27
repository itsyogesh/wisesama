/**
 * GitHub Contribution Service
 * Automatically creates PRs to polkadot-js/phishing repository when reports are verified
 * Uses native fetch instead of @octokit/rest for CommonJS compatibility
 */
import { prisma } from '@wisesama/database';
import type { EntityType } from '@wisesama/types';

// polkadot-js/phishing repository details
const UPSTREAM_OWNER = 'polkadot-js';
const UPSTREAM_REPO = 'phishing';
const DEFAULT_BRANCH = 'master';
const GITHUB_API = 'https://api.github.com';

// Get configuration from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const FORK_OWNER = process.env.GITHUB_FORK_OWNER;

interface ContributionResult {
  success: boolean;
  contributionId?: string;
  prUrl?: string;
  error?: string;
}

interface AddressJson {
  [threatName: string]: string[];
}

interface AllJson {
  allow: string[];
  deny: string[];
}

/**
 * GitHub API helper with proper error handling
 */
async function githubFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Check if GitHub contribution is configured
 */
export function isGitHubConfigured(): boolean {
  return !!(GITHUB_TOKEN && FORK_OWNER);
}

/**
 * Create a contribution record and attempt to create a PR
 */
export async function contributeToPhishing(params: {
  reportId: string;
  entityType: EntityType;
  entityValue: string;
  threatCategory: string;
  description?: string;
  evidenceUrls?: string[];
}): Promise<ContributionResult> {
  const { reportId, entityType, entityValue, threatCategory, description, evidenceUrls } = params;

  // Determine target file based on entity type
  const targetFile = entityType === 'ADDRESS' ? 'address.json' : 'all.json';

  // Create contribution record
  const contribution = await prisma.communityContribution.create({
    data: {
      reportId,
      entityType,
      entityValue,
      targetFile,
      prStatus: 'pending',
    },
  });

  // If GitHub is not configured, just track the contribution
  if (!isGitHubConfigured()) {
    console.log(`[GitHub] Not configured. Contribution tracked: ${contribution.id}`);
    return {
      success: true,
      contributionId: contribution.id,
    };
  }

  try {
    // Create the PR
    const prResult = await createPullRequest({
      entityType,
      entityValue,
      threatCategory,
      description,
      evidenceUrls,
      targetFile,
      reportId,
    });

    // Update contribution with PR info
    await prisma.communityContribution.update({
      where: { id: contribution.id },
      data: {
        prNumber: prResult.prNumber,
        prUrl: prResult.prUrl,
        prStatus: 'open',
        submittedAt: new Date(),
      },
    });

    return {
      success: true,
      contributionId: contribution.id,
      prUrl: prResult.prUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GitHub] Failed to create PR:', message);

    // Update contribution with error
    await prisma.communityContribution.update({
      where: { id: contribution.id },
      data: {
        prStatus: 'error',
        errorMessage: message,
      },
    });

    return {
      success: false,
      contributionId: contribution.id,
      error: message,
    };
  }
}

/**
 * Create a pull request to polkadot-js/phishing
 */
async function createPullRequest(params: {
  entityType: EntityType;
  entityValue: string;
  threatCategory: string;
  description?: string;
  evidenceUrls?: string[];
  targetFile: string;
  reportId: string;
}): Promise<{ prNumber: number; prUrl: string }> {
  const { entityType, entityValue, threatCategory, description, evidenceUrls, targetFile, reportId } = params;

  // 1. Ensure fork exists
  await ensureFork();

  // 2. Get the latest commit SHA from upstream
  const ref = await githubFetch<{ object: { sha: string } }>(
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/git/ref/heads/${DEFAULT_BRANCH}`
  );
  const baseSha = ref.object.sha;

  // 3. Create a unique branch name
  const branchName = `wisesama/add-${entityType.toLowerCase()}-${Date.now()}`;

  // 4. Create the branch in our fork
  await githubFetch(`/repos/${FORK_OWNER}/${UPSTREAM_REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  });

  // 5. Get current file content
  const fileData = await githubFetch<{ content: string; sha: string }>(
    `/repos/${FORK_OWNER}/${UPSTREAM_REPO}/contents/${targetFile}?ref=${branchName}`
  );

  // 6. Parse and update the file
  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
  const updatedContent = updateFileContent(currentContent, targetFile, entityType, entityValue, threatCategory);

  // 7. Commit the change
  await githubFetch(`/repos/${FORK_OWNER}/${UPSTREAM_REPO}/contents/${targetFile}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add ${entityType.toLowerCase()} reported by Wisesama community`,
      content: Buffer.from(updatedContent).toString('base64'),
      sha: fileData.sha,
      branch: branchName,
    }),
  });

  // 8. Create the pull request
  const prBody = formatPRBody({
    entityType,
    entityValue,
    threatCategory,
    description,
    evidenceUrls,
    reportId,
  });

  const pr = await githubFetch<{ number: number; html_url: string }>(
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: `Add ${entityType.toLowerCase()} to ${targetFile === 'address.json' ? 'address list' : 'deny list'}`,
        body: prBody,
        head: `${FORK_OWNER}:${branchName}`,
        base: DEFAULT_BRANCH,
      }),
    }
  );

  return {
    prNumber: pr.number,
    prUrl: pr.html_url,
  };
}

/**
 * Ensure we have a fork of the repository
 */
async function ensureFork(): Promise<void> {
  try {
    // Check if fork exists
    await githubFetch(`/repos/${FORK_OWNER}/${UPSTREAM_REPO}`);
  } catch {
    // Fork doesn't exist, create it
    await githubFetch(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/forks`, {
      method: 'POST',
    });

    // Wait for fork to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/**
 * Update file content based on entity type
 */
function updateFileContent(
  currentContent: string,
  targetFile: string,
  entityType: EntityType,
  entityValue: string,
  threatCategory: string
): string {
  if (targetFile === 'address.json') {
    // For addresses, add to the appropriate threat category
    const data: AddressJson = JSON.parse(currentContent);
    const categoryKey = `wisesama-${threatCategory.toLowerCase().replace(/_/g, '-')}`;

    if (!data[categoryKey]) {
      data[categoryKey] = [];
    }

    // Add address if not already present
    if (!data[categoryKey].includes(entityValue)) {
      data[categoryKey].push(entityValue);
    }

    return JSON.stringify(data, null, 2) + '\n';
  } else {
    // For domains/Twitter/email, add to deny list
    const data: AllJson = JSON.parse(currentContent);
    const normalizedValue = entityValue.toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '');

    // Add to deny list if not already present
    if (!data.deny.includes(normalizedValue)) {
      data.deny.push(normalizedValue);
      data.deny.sort(); // Keep sorted for easier diffs
    }

    return JSON.stringify(data, null, 2) + '\n';
  }
}

/**
 * Format the PR body with all relevant information
 */
function formatPRBody(params: {
  entityType: EntityType;
  entityValue: string;
  threatCategory: string;
  description?: string;
  evidenceUrls?: string[];
  reportId: string;
}): string {
  const { entityType, entityValue, threatCategory, description, evidenceUrls, reportId } = params;

  let body = `## Add ${entityType} to phishing list

**Source:** Wisesama community report
**Report ID:** \`${reportId}\`
**Category:** ${threatCategory.replace(/_/g, ' ')}

### Entity Details

| Field | Value |
|-------|-------|
| Type | ${entityType} |
| Value | \`${entityValue}\` |
| Threat Category | ${threatCategory} |
`;

  if (description) {
    body += `
### Description

${description}
`;
  }

  if (evidenceUrls && evidenceUrls.length > 0) {
    body += `
### Evidence

${evidenceUrls.map((url) => `- ${url}`).join('\n')}
`;
  }

  body += `
---

*Submitted automatically by [Wisesama](https://wisesama.com) - Polkadot Ecosystem Security*
`;

  return body;
}

/**
 * Sync PR status from GitHub
 */
export async function syncContributionStatus(contributionId: string): Promise<void> {
  if (!isGitHubConfigured()) {
    return;
  }

  const contribution = await prisma.communityContribution.findUnique({
    where: { id: contributionId },
  });

  if (!contribution || !contribution.prNumber) {
    return;
  }

  try {
    const pr = await githubFetch<{
      merged: boolean;
      merged_at: string | null;
      state: string;
    }>(`/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/pulls/${contribution.prNumber}`);

    let newStatus = contribution.prStatus;
    let mergedAt = contribution.mergedAt;

    if (pr.merged) {
      newStatus = 'merged';
      mergedAt = new Date(pr.merged_at!);
    } else if (pr.state === 'closed') {
      newStatus = 'closed';
    } else if (pr.state === 'open') {
      newStatus = 'open';
    }

    if (newStatus !== contribution.prStatus || mergedAt !== contribution.mergedAt) {
      await prisma.communityContribution.update({
        where: { id: contributionId },
        data: {
          prStatus: newStatus,
          mergedAt,
        },
      });
    }
  } catch (error) {
    console.error(`[GitHub] Failed to sync contribution ${contributionId}:`, error);
  }
}

/**
 * List all contributions with optional status filter
 */
export async function listContributions(params: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{
  contributions: Awaited<ReturnType<typeof prisma.communityContribution.findMany>>;
  total: number;
}> {
  const { status, page = 1, limit = 20 } = params;

  const where = status ? { prStatus: status } : {};

  const [contributions, total] = await Promise.all([
    prisma.communityContribution.findMany({
      where,
      include: {
        report: {
          select: {
            id: true,
            reportedValue: true,
            threatCategory: true,
            reporterEmail: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.communityContribution.count({ where }),
  ]);

  return { contributions, total };
}
