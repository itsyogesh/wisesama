'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone-message">
      <h1>This page could not load</h1>
      <p>Try again. Your saved projects and responses are unchanged.</p>
      <button className="button primary" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
