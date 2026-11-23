'use client';

import { ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type Playbook, playbookApi } from '../lib/playbook-api';
import './public-playbooks.css';

export function PublicPlaybooks({ id }: { id?: string }) {
  const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing retry explicitly retries collection after a transport failure.
  useEffect(() => {
    const controller = new AbortController();
    setPlaybooks(null);
    setError('');
    void playbookApi
      .list(controller.signal)
      .then((value) => setPlaybooks(value.playbooks))
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Playbooks could not load. Try again.');
      });
    return () => controller.abort();
  }, [retry]);
  if (error)
    return (
      <section className="pub-wrap pb-loading" role="alert">
        <h1>The playbooks could not load</h1>
        <p>{error}</p>
        <button className="pub-button" type="button" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </button>
      </section>
    );
  if (!playbooks)
    return (
      <section className="pub-wrap pb-loading" role="status">
        Loading response playbooks…
      </section>
    );
  const playbook = id ? playbooks.find((value) => value.id === id) : null;
  if (id && !playbook)
    return (
      <section className="pub-wrap pb-loading">
        <h1>This playbook could not be found.</h1>
        <Link className="pub-text-link" href="/playbooks">
          Browse response playbooks <ArrowRight />
        </Link>
      </section>
    );
  if (!playbook)
    return (
      <section className="pub-wrap pb-index">
        <div className="pub-page-intro">
          <h1>
            A clear response.
            <br />A record you can return to.
          </h1>
          <p>
            Practical playbooks for investigating a security incident, containing the impact, and
            recording recovery. Read freely. Save progress inside your project.
          </p>
        </div>
        <div className="pb-principle">
          <h2>Start with applicability.</h2>
          <p>
            What was installed, where it ran, and when it happened matter. These playbooks keep
            those questions beside the actions and evidence needed for a response.
          </p>
        </div>
        <div className="pb-list">
          {playbooks.map((item) => (
            <Link key={item.id} href={`/playbooks/${item.id}`}>
              <div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <small>
                  {item.phases.length} phases · {item.questions.length} applicability questions ·
                  Updated {item.updatedAt}
                </small>
              </div>
              <ArrowRight />
            </Link>
          ))}
        </div>
        <div className="pb-boundary">
          <h2>Your team owns the investigation.</h2>
          <p>
            Wisesama keeps the response record. It does not scan developer devices, isolate hosts,
            rotate credentials, or certify recovery. Check authoritative guidance before acting.
          </p>
          <Link className="pub-text-link" href="/guides/respond-to-a-finding">
            Responding to an ordinary vulnerability? Start here <ArrowRight />
          </Link>
        </div>
      </section>
    );
  return (
    <div className="pub-reading-layout pub-wrap pb-reading">
      <aside className="pub-reading-nav">
        <Link className="pub-back-link" href="/playbooks">
          <ArrowRight /> All playbooks
        </Link>
        <nav aria-label="On this page">
          <a href="#applicability">Applicability</a>
          {playbook.phases.map((phase) => (
            <a key={phase.id} href={`#${phase.id}`}>
              {phase.title}
            </a>
          ))}
          <a href="#sources">Sources and boundaries</a>
        </nav>
        <Link href={`/app/responses/new?playbook=${playbook.id}`}>
          Save a project response <ArrowRight />
        </Link>
      </aside>
      <article className="pub-article">
        <header>
          <h1>{playbook.title}</h1>
          <p>{playbook.description}</p>
          <div className="pub-article-meta">
            <span>Guidance version {playbook.version}</span>
            <span>Updated {playbook.updatedAt}</span>
          </div>
        </header>
        <div className="pb-scope">
          <strong>What this playbook covers</strong>
          <p>{playbook.scope}</p>
        </div>
        <section id="applicability">
          <h2>Check applicability</h2>
          <p>
            Review these questions against historical evidence. Keep unanswered questions marked
            unknown. Answers are team reported and do not establish a verified exposure assessment.
          </p>
          <ol className="pb-questions">
            {playbook.questions.map((question) => (
              <li key={question.id}>
                <strong>{question.label}</strong>
                <p>{question.help}</p>
              </li>
            ))}
          </ol>
        </section>
        {playbook.phases.map((phase) => (
          <section id={phase.id} key={phase.id}>
            <h2>{phase.title}</h2>
            <p>{phase.description}</p>
            <ol className="pb-tasks">
              {phase.tasks.map((task) => (
                <li key={task.id}>
                  <h3>{task.title}</h3>
                  <p>{task.detail}</p>
                  <p className="pb-record">Record: {task.evidenceHint}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <section id="sources" className="pub-article-sources">
          <h2>Sources and boundaries</h2>
          <ul>
            {playbook.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                  <ExternalLink size={14} />
                </a>
              </li>
            ))}
          </ul>
          {playbook.limitations.map((limit) => (
            <p key={limit}>{limit}</p>
          ))}
        </section>
        <div className="pb-start">
          <h2>Keep the response with your project.</h2>
          <p>
            Save applicability answers, task completion, and evidence references in a private record
            with a history of changes.
          </p>
          <Link className="pub-button" href={`/app/responses/new?playbook=${playbook.id}`}>
            Choose a project to start <ArrowRight />
          </Link>
        </div>
      </article>
    </div>
  );
}
