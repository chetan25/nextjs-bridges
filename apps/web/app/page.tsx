import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>@bridge demos</h1>
      <nav>
        <ul>
          <li>
            <Link href="/demo/lazy-handler">
              @nextjs-bridges/lazy-handler — deferred event handlers
            </Link>
          </li>
          <li>
            <Link href="/demo/hydration">
              @nextjs-bridges/hydration — declarative hydration strategies
            </Link>
          </li>
          <li>
            <Link href="/demo/share">
              @nextjs-bridges/share — runtime cross-app component sharing
            </Link>
          </li>
          <li>
            <Link href="/demo/ecommerce">
              e-commerce example — all three bridges together
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
