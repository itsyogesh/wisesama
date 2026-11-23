'use client';

import { ArrowLeft, ExternalLink, Info, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, intelApi } from '../lib/api';
import type { IntelAdvisory } from '../lib/models';
import './advisory-detail.css';

function dateTime(value: string | undefined) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function safeReference(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function AdvisoryDetail({ id }: { id: string }) {
  const [advisory, setAdvisory] = useState<IntelAdvisory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setAdvisory(null);
    setError('');
    setNotFound(false);
    intelApi
      .getBriefing(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setAdvisory(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setNotFound(cause instanceof ApiError && cause.status === 404);
        setError(
          cause instanceof Error
            ? cause.message
            : 'This briefing could not be loaded. Please try again.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [id]);
  useEffect(() => {
    refresh();
    return () => request.current?.abort();
  }, [refresh]);

  const references = advisory
    ? [
        ...new Set(
          advisory.references
            .map((reference) => safeReference(reference.url))
            .filter((url): url is string => Boolean(url)),
        ),
      ]
    : [];
  const primary =
    references.find((url) => url.startsWith('https://github.com/advisories/')) ?? references[0];
  const knownExploited = advisory?.exploited || advisory?.exploitationStatus === 'known_exploited';
  const epss = advisory?.epss;
  const forecast =
    typeof epss === 'number' && Number.isFinite(epss) && epss >= 0 && epss <= 1
      ? `${(epss * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
      : null;
  return (
    <div className="ad-page">
      <Link href="/feed" className="text-link ad-back">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to the feed
      </Link>
      {loading ? (
        <div className="ad-loading" role="status">
          <RefreshCw className="ad-spin" size={20} aria-hidden="true" />
          Loading briefing…
        </div>
      ) : error ? (
        <section className="ad-error" aria-labelledby="ad-error-title">
          <h1 id="ad-error-title">{notFound ? 'Briefing not found' : 'Briefing unavailable'}</h1>
          <p role="alert">{error}</p>
          <button type="button" className="button" onClick={refresh}>
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </button>
        </section>
      ) : advisory ? (
        <div className="ad-layout">
          <article className="ad-main" aria-labelledby="ad-title">
            <h1 id="ad-title">{advisory.title}</h1>
            <div className="ad-identifiers">
              {[...new Set([advisory.id, ...advisory.aliases])].map((alias) => (
                <code key={alias}>{alias}</code>
              ))}
            </div>
            <p className="ad-source">Collected from {advisory.source}</p>
            <dl className="ad-dates">
              <div>
                <dt>Published</dt>
                <dd>
                  <time dateTime={advisory.publishedAt}>{dateTime(advisory.publishedAt)}</time>
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>
                  <time dateTime={advisory.modifiedAt}>{dateTime(advisory.modifiedAt)}</time>
                </dd>
              </div>
            </dl>
            {primary ? (
              <a className="button" href={primary} target="_blank" rel="noopener noreferrer">
                Read source advisory
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}
            <section className="ad-section" aria-labelledby="ad-summary">
              <h2 id="ad-summary">Advisory summary</h2>
              <p className="ad-summary">
                {advisory.summary ||
                  'The source has not provided a summary. Review its references for details.'}
              </p>
            </section>
            {advisory.editorial?.guidance ? (
              <section className="ad-section" aria-labelledby="ad-editorial">
                <h2 id="ad-editorial">Wisesama response guidance</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{advisory.editorial.guidance}</p>
                <p className="ad-footnote">
                  Editorial guidance is separate from the source advisory.{' '}
                  {advisory.editorial.reviewedAt
                    ? `Reviewed ${dateTime(advisory.editorial.reviewedAt)}.`
                    : ''}
                </p>
              </section>
            ) : null}
            <section className="ad-section" aria-labelledby="ad-packages">
              <h2 id="ad-packages">Affected software reported by the source</h2>
              {advisory.affected.length ? (
                <ul className="ad-packages">
                  {advisory.affected.map((item) => (
                    <li key={`${item.ecosystem}-${item.name}-${item.fixedVersion ?? ''}`}>
                      <div>
                        <code>{item.name}</code>
                        <span>{item.ecosystem}</span>
                      </div>
                      {item.ranges?.length ? (
                        <p>
                          Affected ranges: <code>{item.ranges.join(', ')}</code>
                        </p>
                      ) : null}
                      <p>
                        {item.fixedVersion ? (
                          <>
                            First fixed version reported: <code>{item.fixedVersion}</code>
                          </>
                        ) : (
                          'No fixed version reported in this record.'
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ad-muted">No package details were provided in this record.</p>
              )}
              <p className="ad-footnote">
                Version ranges and fixes reflect the collected advisory. Follow current vendor
                guidance before changing a deployment.
              </p>
            </section>
            <section className="ad-section" aria-labelledby="ad-references">
              <h2 id="ad-references">Source references</h2>
              {references.length ? (
                <ul className="ad-references">
                  {references.map((url) => (
                    <li key={url}>
                      <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">
                        {url}
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ad-muted">No source links were provided in this record.</p>
              )}
            </section>
          </article>
          <aside className="ad-signals" aria-label="Advisory evidence">
            <section>
              <h2>Technical severity</h2>
              <p className={`ad-severity ad-${advisory.severity}`}>{advisory.severity}</p>
              <p className="ad-footnote">
                {advisory.cvss !== null ? `CVSS ${advisory.cvss}` : 'CVSS score not available'}
              </p>
            </section>
            <section>
              <h2>Known exploitation</h2>
              <p className={knownExploited ? 'ad-danger' : ''}>
                {knownExploited
                  ? 'Known exploited · CISA KEV'
                  : advisory.exploitationStatus === 'not_in_kev'
                    ? 'Not listed in checked KEV data'
                    : 'Exploitation evidence unknown'}
              </p>
              <p className="ad-footnote">
                {advisory.exploitationCheckedAt
                  ? `Checked ${dateTime(advisory.exploitationCheckedAt)}. `
                  : ''}
                {knownExploited
                  ? 'CISA KEV membership is evidence of exploitation.'
                  : 'Absence from KEV does not prove absence of exploitation.'}
              </p>
            </section>
            <section>
              <h2>Exploitation forecast</h2>
              <p>{forecast ? `EPSS ${forecast}` : 'EPSS not available'}</p>
              <p className="ad-footnote">
                {forecast
                  ? 'Estimated probability of exploitation in the next 30 days. A forecast is not observed exploitation.'
                  : 'No probability estimate is available in this record.'}
              </p>
            </section>
            <p className="ad-scope">
              <Info size={15} aria-hidden="true" />
              This is a public advisory. It does not establish whether your project is affected or
              whether a deployed system has been fixed.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
