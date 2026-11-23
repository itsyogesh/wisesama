'use client';

import { CheckCircle2, Circle, Clock3, Inbox, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { Finding, Project } from '../lib/models';

const closed = (finding: Finding) =>
  finding.status === 'resolved' || finding.status === 'not_affected';
const severityRank = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
const labels: Record<Finding['status'], string> = {
  open: 'Open',
  investigating: 'Investigating',
  mitigated: 'Mitigated',
  resolved: 'Resolved',
  not_affected: 'Not affected',
};

export function FindingsInbox({
  projects,
  findings,
  projectId,
  onAdd,
  canManage = true,
}: {
  projects: Project[];
  findings: Finding[];
  projectId?: string;
  onAdd: () => void;
  canManage?: boolean;
}) {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [selectedProject, setSelectedProject] = useState(projectId || 'all');
  const [severity, setSeverity] = useState('all');
  const [query, setQuery] = useState('');
  const open = findings.filter((finding) => !closed(finding));
  const settled = findings.filter(closed);
  const results = (tab === 'open' ? open : settled)
    .filter(
      (finding) =>
        (selectedProject === 'all' || finding.projectId === selectedProject) &&
        (severity === 'all' || finding.advisory.severity === severity) &&
        `${finding.advisory.title} ${finding.advisory.id} ${finding.advisory.aliases.join(' ')} ${finding.packageName} ${finding.projectName}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (left, right) =>
        Number(right.advisory.exploited) - Number(left.advisory.exploited) ||
        severityRank[right.advisory.severity] - severityRank[left.advisory.severity] ||
        new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime(),
    );
  const filtered = query || selectedProject !== 'all' || severity !== 'all';

  return (
    <>
      <div className="page-heading inbox-heading">
        <div>
          <h1>
            Response inbox <span className="count-inline">{open.length}</span>
          </h1>
          <p>Findings matched to your imported package versions.</p>
        </div>
        {canManage ? (
          <button className="button" type="button" onClick={onAdd}>
            <Plus />
            Add project
          </button>
        ) : null}
      </div>
      {!projects.length ? (
        <div className="empty-state">
          <Inbox />
          <h2>
            {canManage ? 'Know which advisories affect your software' : 'No projects to assess yet'}
          </h2>
          <p>
            {canManage
              ? 'Add a project and review an exact package inventory to get your first assessment.'
              : 'Ask an owner or admin to add a project. Findings and response work will appear here for your organization.'}
          </p>
          {canManage ? (
            <button className="button primary" type="button" onClick={onAdd}>
              Add your first project
            </button>
          ) : (
            <Link href="/app/settings/organization" className="text-link">
              View organization members
            </Link>
          )}
        </div>
      ) : (
        <>
          <fieldset className="tabs">
            <legend className="sr-only">Finding status</legend>
            <button
              type="button"
              className={tab === 'open' ? 'active' : ''}
              aria-pressed={tab === 'open'}
              onClick={() => setTab('open')}
            >
              Needs response <span className="tab-count">{open.length}</span>
            </button>
            <button
              type="button"
              className={tab === 'closed' ? 'active' : ''}
              aria-pressed={tab === 'closed'}
              onClick={() => setTab('closed')}
            >
              Closed <span className="tab-count">{settled.length}</span>
            </button>
          </fieldset>
          <div className="toolbar">
            <div className="filters">
              <label className="sr-only" htmlFor="project-filter">
                Project filter
              </label>
              <select
                id="project-filter"
                className="filter-select"
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="severity-filter">
                Severity filter
              </label>
              <select
                id="severity-filter"
                className="filter-select"
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
              >
                <option value="all">All severities</option>
                {['critical', 'high', 'medium', 'low', 'unknown'].map((value) => (
                  <option key={value} value={value}>
                    {value[0]?.toUpperCase()}
                    {value.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <label className="search-wrap" htmlFor="finding-search">
              <Search />
              <span className="sr-only">Search findings</span>
              <input
                id="finding-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search findings"
              />
            </label>
          </div>
          {results.length ? (
            <>
              <table className="finding-table">
                <caption className="sr-only">Matching findings and response states</caption>
                <colgroup>
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Finding / package</th>
                    <th scope="col">Project</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Exploitation evidence</th>
                    <th scope="col">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((finding) => (
                    <tr key={finding.id}>
                      <td>
                        <Link
                          className="finding-title"
                          href={`/app/findings/${encodeURIComponent(finding.id)}`}
                        >
                          {finding.advisory.title}
                        </Link>
                        <div className="finding-sub">
                          <span className="finding-mobile-project">{finding.projectName}</span>
                          <code>
                            {finding.packageName} {finding.installedVersion}
                          </code>
                          <span className="finding-id">
                            {finding.advisory.aliases.find((id) => id.startsWith('CVE-')) ||
                              finding.advisory.id}
                          </span>
                        </div>
                      </td>
                      <td>{finding.projectName}</td>
                      <td>
                        <span className={`severity ${finding.advisory.severity}`}>
                          <span className="bar" />
                          {finding.advisory.severity}
                        </span>
                      </td>
                      <td>
                        <span className={`kev ${finding.advisory.exploited ? 'exploited' : ''}`}>
                          {finding.advisory.exploited
                            ? 'Known exploited · KEV'
                            : finding.advisory.exploitationStatus === 'not_in_kev'
                              ? 'Not in checked KEV'
                              : 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <span className={`state ${finding.status}`}>
                          {closed(finding) ? (
                            <CheckCircle2 />
                          ) : finding.status === 'investigating' ? (
                            <Clock3 />
                          ) : (
                            <Circle />
                          )}
                          {labels[finding.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="table-footer">
                <span>
                  {results.length} {results.length === 1 ? 'finding' : 'findings'}
                  {findings.length >= 1000 ? ' · latest 1,000 findings loaded' : ''}
                </span>
                <span>Inventory matches · deployment not verified</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Inbox />
              <h2>
                {filtered
                  ? 'No findings match these filters'
                  : tab === 'closed'
                    ? 'No findings closed yet'
                    : 'No findings need a response'}
              </h2>
              <p>
                {filtered
                  ? 'Try another search, project, or severity.'
                  : tab === 'closed'
                    ? 'Record the response and supporting evidence on a finding to close it.'
                    : 'Check project assessment dates and source health before relying on these results.'}
              </p>
              {filtered ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setQuery('');
                    setSeverity('all');
                    setSelectedProject('all');
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link className="button" href="/app/projects">
                  View projects and coverage
                </Link>
              )}
            </div>
          )}
          <div className="queue-note">
            <p>
              Severity, observed exploitation, and your response are separate signals. Absence from
              CISA KEV does not establish that exploitation has never occurred.
            </p>
            <Link href="/app/settings/notifications" className="text-link">
              Set up email alerts
            </Link>
          </div>
        </>
      )}
    </>
  );
}
