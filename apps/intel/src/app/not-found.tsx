import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="standalone-message">
      <h1>This page could not be found.</h1>
      <p>
        <Link href="/">Return to Wisesama</Link> or{' '}
        <Link href="/feed">browse the security feed</Link>.
      </p>
    </main>
  );
}
