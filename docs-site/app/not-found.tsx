import Link from "next/link";

export default function NotFound() {
  return (
    <main className="empty-state">
      <div className="empty-card">
        <h1>Page not found</h1>
        <p>
          The requested documentation page does not exist in the current Nextra
          route tree.
        </p>
        <p>
          <Link href="/">Return to the docs index</Link>
        </p>
      </div>
    </main>
  );
}
