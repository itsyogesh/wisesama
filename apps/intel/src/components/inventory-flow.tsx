'use client';

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileJson,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { intelApi } from '../lib/api';
import type { Environment, InventoryFormat, InventoryPackage, Project } from '../lib/models';
import type { Organization } from '../lib/organization-api';

interface Preview {
  packages: InventoryPackage[];
  warnings: string[];
  format: InventoryFormat;
}

export function InventoryFlow({
  project,
  organization,
  onComplete,
  onCancel,
}: {
  project?: Project;
  organization?: Organization;
  onComplete: (id: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(project ? 1 : 0);
  const [name, setName] = useState(project?.name || '');
  const [environment, setEnvironment] = useState<Environment>(project?.environment || 'production');
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const id = useId();

  async function readFile(file?: File) {
    if (!file || busy || reading) return;
    setError('');
    setPreview(null);
    setSavedId(null);
    if (file.size > 2 * 1024 * 1024) {
      setError('This file exceeds 2 MB. Split the inventory into smaller projects.');
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      const response = await fetch('/api/inventory-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
        cache: 'no-store',
      });
      const result = (await response.json()) as Preview & { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'This file could not be read. Try a supported lockfile.');
      setContent(text);
      setFileName(file.name);
      setPreview(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The inventory could not be read. Try again.',
      );
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function saveAndScan() {
    if (!preview || busy) return;
    setBusy(true);
    setError('');
    try {
      let projectId = savedId;
      if (!projectId) {
        if (!project && !organization)
          throw new Error('Choose an organization before creating a project.');
        const inventory = { content, format: preview.format };
        const result = project
          ? await intelApi.updateInventory(project.id, { inventory })
          : await intelApi.createProject({
              organizationId: organization?.id || '',
              name: name.trim(),
              environment,
              inventory,
            });
        projectId = result.project.id;
        setSavedId(projectId);
      }
      await onComplete(projectId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your scan could not complete. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup-layout">
      <ol className="step-list" aria-label="Project setup progress">
        {['Project details', 'Review inventory', 'First assessment'].map((label, index) => (
          <li
            key={label}
            className={index === step ? 'current' : index < step ? 'done' : ''}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="step-number">{index < step ? <Check /> : index + 1}</span>
            <div>
              <strong>{label}</strong>
              <small>
                {
                  ['Name and environment', 'Check imported versions', 'Assess relevant advisories'][
                    index
                  ]
                }
              </small>
            </div>
          </li>
        ))}
      </ol>
      <section className="setup-body" aria-busy={busy || reading}>
        <h1>
          {step === 0
            ? 'Add a project'
            : project
              ? 'Update project inventory'
              : 'Review your inventory'}
        </h1>
        {organization ? (
          <div className="org-project-destination">
            <Building2 size={17} aria-hidden="true" />
            <div>
              <p>
                {project ? 'Project in' : 'Creating in'} <strong>{organization.name}</strong>
              </p>
              <small>
                Members of this organization can review its inventory and contribute responses.
              </small>
            </div>
          </div>
        ) : null}
        {step === 0 ? (
          <>
            <p>
              Start with one service. Its exact package versions tell Wisesama which advisories to
              assess.
            </p>
            <form
              className="form-block"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) setStep(1);
              }}
            >
              <div className="field">
                <label htmlFor={`${id}-name`}>Project name</label>
                <input
                  id={`${id}-name`}
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="production-api"
                  maxLength={100}
                  required
                  pattern=".*\S.*"
                />
                <p className="field-help">Use the name your team recognizes.</p>
              </div>
              <div className="field">
                <label htmlFor={`${id}-environment`}>Environment</label>
                <select
                  id={`${id}-environment`}
                  className="select"
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value as Environment)}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="button ghost" onClick={onCancel}>
                  Cancel
                </button>
                <button type="submit" className="button primary">
                  Continue <ArrowRight />
                </button>
              </div>
            </form>
            <p className="annotation">
              <ShieldCheck />
              No repository access or credentials are needed.
            </p>
          </>
        ) : (
          <>
            <div className="project-context">
              <strong>{name}</strong>
              <span className="environment">{environment}</span>
            </div>
            {error ? (
              <div className="notice error" role="alert">
                {savedId ? 'Your inventory is saved. ' : ''}
                {error}
              </div>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              className="sr-only"
              id={`${id}-file`}
              accept=".json,.yaml,.yml"
              tabIndex={-1}
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
            {preview ? (
              <>
                <div className="import-file">
                  <FileJson />
                  <div>
                    <strong>{fileName}</strong>
                    <p className="file-meta">{preview.packages.length} exact package versions</p>
                  </div>
                  <button
                    type="button"
                    className="button"
                    disabled={busy || reading}
                    onClick={() => fileInput.current?.click()}
                  >
                    Replace
                  </button>
                </div>
                <div className="import-summary">
                  <strong>{preview.packages.length} packages ready</strong>
                  <span className="muted">Exact versions only</span>
                </div>
                <div className="inventory-preview-scroll">
                  <table className="mini-table">
                    <caption className="sr-only">Imported package preview</caption>
                    <thead>
                      <tr>
                        <th scope="col">Package</th>
                        <th scope="col">Installed version</th>
                        <th scope="col">Ecosystem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.packages.slice(0, 10).map((item) => (
                        <tr key={`${item.ecosystem}:${item.name}@${item.version}`}>
                          <td>
                            <code>{item.name}</code>
                          </td>
                          <td>
                            <code>{item.version}</code>
                          </td>
                          <td>{item.ecosystem}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.packages.length > 10 ? (
                  <p className="field-help">
                    And {preview.packages.length - 10} more package versions.
                  </p>
                ) : null}
                {[...new Set(preview.warnings)].map((warning) => (
                  <p className="notice" key={warning}>
                    {warning}
                  </p>
                ))}
                <div className="notice">
                  <div>
                    <strong>Package matching has limits</strong>A version match does not establish
                    that a vulnerable function is reachable or that this version is deployed.
                    Runtime and container versions are not assessed.
                  </div>
                </div>
              </>
            ) : (
              // biome-ignore lint/a11y/noStaticElementInteractions: Choose file provides the keyboard alternative to drag and drop.
              <div
                className={`drop-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void readFile(event.dataTransfer.files[0]);
                }}
              >
                <Upload className="drop-icon" />
                <h2>{reading ? 'Reading your inventory…' : 'Drop your inventory here'}</h2>
                <p>Upload a lockfile or a pinned package inventory.</p>
                <button
                  className="button"
                  type="button"
                  disabled={reading || busy}
                  onClick={() => fileInput.current?.click()}
                >
                  Choose file
                </button>
                <p className="supported">
                  package-lock.json · pnpm-lock.yaml · inventory.json
                  <br />
                  Up to 2 MB · 2,000 package versions
                </p>
              </div>
            )}
            <p className="annotation">
              <ShieldCheck />
              Files are sent to Wisesama for inventory review. Scanning sends package names and
              versions to OSV. Upload package metadata only; leave out credentials and source code.
            </p>
            <div className="form-actions">
              <button
                className="button ghost"
                type="button"
                disabled={busy || reading}
                onClick={() => (project ? onCancel() : setStep(0))}
              >
                <ArrowLeft />
                Back
              </button>
              <button
                className="button primary"
                type="button"
                onClick={() => void saveAndScan()}
                disabled={!preview || busy || reading}
              >
                {busy
                  ? 'Saving and assessing…'
                  : savedId
                    ? 'Retry assessment'
                    : project
                      ? 'Save inventory & assess'
                      : 'Create project & assess'}
                {busy ? <span className="spinner" /> : <ArrowRight />}
              </button>
            </div>
            {busy ? (
              <p className="field-help" role="status">
                Checking OSV package matches, CISA exploitation evidence, and FIRST EPSS forecasts.
                This can take a moment.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
