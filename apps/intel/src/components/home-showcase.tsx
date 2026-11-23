'use client';

import {
  ArrowDownRight,
  ArrowRight,
  Bell,
  Check,
  CircleDot,
  ExternalLink,
  FileCode2,
  GitBranch,
  ListChecks,
  Radio,
  Rss,
  Terminal,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import './home-showcase.css';

const steps = [
  {
    label: 'Match',
    icon: CircleDot,
    title: 'An affected version is in your lockfile',
    description: 'One dependency in the storefront project matches the advisory’s affected range.',
    facts: [
      ['Installed', 'example-package@1.2.3'],
      ['Fixed version', '1.2.4'],
      ['Assessed commit', '7f92c4d'],
    ],
    status: 'Version match',
    action: 'Check where this version is deployed',
  },
  {
    label: 'Assess',
    icon: ListChecks,
    title: 'Check how production is affected',
    description: 'Compare the affected version and configuration with what’s actually deployed.',
    facts: [
      ['Advisory severity', 'High'],
      ['Exploitation evidence', 'Unconfirmed'],
      ['Deployment review', 'In progress'],
    ],
    status: 'Investigating',
    action: 'Review deployment and plan the update',
  },
  {
    label: 'Respond',
    icon: Check,
    title: 'Record the fix and verify it',
    description: 'Keep the updated dependency, assessed commit, and deployment evidence together.',
    facts: [
      ['Updated version', 'example-package@1.2.4'],
      ['Assessed commit', 'c83b05e'],
      ['Deployment evidence', 'Recorded'],
    ],
    status: 'Verified',
    action: 'Close the finding with evidence',
  },
] as const;

const sources = [
  ['OSV', 'https://osv.dev/'],
  ['GitHub Advisory Database', 'https://github.com/advisories'],
  ['CISA KEV', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'],
  ['FIRST EPSS', 'https://www.first.org/epss/'],
] as const;

function ResponsePreview() {
  const [step, setStep] = useState<(typeof steps)[number]>(steps[0]);
  return (
    <figure className="home-preview">
      <figcaption className="home-preview-top">
        <span>
          <GitBranch aria-hidden="true" /> acme / storefront
        </span>
        <span>Example project</span>
      </figcaption>
      <fieldset className="home-preview-steps">
        <legend className="sr-only">Preview a response step</legend>
        {steps.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={item === step}
            aria-controls="homepage-preview-details"
            onClick={() => setStep(item)}
          >
            <item.icon aria-hidden="true" /> {item.label}
          </button>
        ))}
      </fieldset>
      <div id="homepage-preview-details" aria-live="polite">
        <div className="home-preview-details" key={step.label}>
          <span className="home-preview-status">
            <span />
            {step.status}
          </span>
          <h2>{step.title}</h2>
          <p>{step.description}</p>
          <dl>
            {step.facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="home-preview-action">
            <ArrowDownRight aria-hidden="true" /> {step.action}
          </div>
        </div>
      </div>
    </figure>
  );
}

export function HomeShowcase() {
  return (
    <div className="home-showcase">
      <section className="home-hero pub-wrap">
        <div className="home-hero-copy">
          <h1>Find the vulnerabilities that affect your code.</h1>
          <p>
            Connect a repository to see which advisories match your dependencies, what to check
            first, and what your team has already fixed.
          </p>
          <div className="home-hero-actions">
            <Link className="pub-button" href="/app/projects/new?provider=github">
              <Image src="/brands/github.svg" alt="" width={17} height={17} />
              Connect GitHub <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="pub-text-link" href="/feed">
              Browse the free feed <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <Link className="home-manual" href="/app/projects/new/manual">
            <FileCode2 aria-hidden="true" /> Start with a lockfile
          </Link>
        </div>
        <ResponsePreview />
      </section>

      <div className="home-sources pub-wrap">
        <span>Advisory and risk sources</span>
        <div className="home-source-links">
          {sources.map(([label, url]) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {label} <ExternalLink aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      <section className="home-feature-section pub-wrap" aria-labelledby="home-features">
        <div className="home-section-heading">
          <h2 id="home-features">From advisory to verified fix.</h2>
          <p>Start with one project. Give your team the evidence to make the next call.</p>
        </div>
        <div className="home-bento">
          <article className="home-feature home-feature-art">
            <Image
              src="/illustrations/dependency-stack.webp"
              alt=""
              width={1200}
              height={800}
              sizes="(max-width: 760px) 92vw, (max-width: 1180px) 55vw, 690px"
            />
            <div className="home-feature-copy">
              <h3>Know which packages are affected.</h3>
              <p>
                Match exact versions from your lockfile to published advisories. See which version
                was assessed and where the fix starts.
              </p>
              <Link href="/product" className="pub-text-link">
                See how matching works <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>

          <article className="home-feature home-feature-integrations">
            <div className="home-integration-list">
              <Link href="/integrations/github">
                <Image src="/brands/github.svg" alt="" width={23} height={23} /> GitHub{' '}
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="/integrations/gitlab">
                <Image src="/brands/gitlab.svg" alt="" width={23} height={23} /> GitLab.com{' '}
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="/guides/choose-your-inventory">
                <Image src="/brands/npm.svg" alt="" width={23} height={23} /> npm lockfiles{' '}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div className="home-feature-copy">
              <h3>Start with the software you ship.</h3>
              <p>
                Pick a repository to monitor or upload an inventory. Review dependency and CI
                settings at the assessed commit.
              </p>
            </div>
          </article>

          <article className="home-feature home-feature-small">
            <Bell className="home-feature-icon" aria-hidden="true" />
            <h3>Get alerts about your projects.</h3>
            <p>Turn on email alerts for new dependency matches in the projects you follow.</p>
            <Link className="pub-text-link" href="/app/settings/notifications">
              See alert settings <ArrowRight aria-hidden="true" />
            </Link>
          </article>
          <article className="home-feature home-feature-small">
            <ListChecks className="home-feature-icon" aria-hidden="true" />
            <h3>Give every finding a next step.</h3>
            <p>
              Record what you checked, what you changed, and the evidence that the fix reached
              production.
            </p>
            <Link className="pub-text-link" href="/guides/respond-to-a-finding">
              Read the response guide <ArrowRight aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section className="home-wire" aria-labelledby="home-wire">
        <div className="pub-wrap home-wire-inner">
          <div className="home-section-heading">
            <h2 id="home-wire">Follow the security feed for free.</h2>
            <p>
              Read advisories with links to their original sources. Follow the feed without a
              Wisesama account.
            </p>
            <Link className="pub-text-link" href="/feed">
              Open the public feed <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="home-wire-channels">
            <Link href="/feed#subscribe">
              <Radio aria-hidden="true" />
              <span>
                <strong>Email updates</strong>
                <small>Subscribe with a verified address</small>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/docs/rss">
              <Rss aria-hidden="true" />
              <span>
                <strong>RSS</strong>
                <small>Add the feed to your reader</small>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/agents">
              <Terminal aria-hidden="true" />
              <span>
                <strong>API &amp; MCP</strong>
                <small>Look up public advisories in your tools</small>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
