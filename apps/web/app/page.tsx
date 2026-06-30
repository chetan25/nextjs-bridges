import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>@bridge demos</h1>
      <nav>
        <ul>
          <li>
            <Link href="/demo/lazy-handler">
              @bridge/lazy-handler — deferred event handlers
            </Link>
          </li>
          <li>
            <Link href="/demo/hydration">
              @bridge/hydration — declarative hydration strategies
            </Link>
          </li>
          <li>
            <Link href="/demo/share">
              @bridge/share — runtime cross-app component sharing
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
