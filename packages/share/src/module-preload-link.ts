export type FetchPriority = 'high' | 'low' | 'auto';

/**
 * Appends a `<link rel="modulepreload">` for `url` to `<head>`, unless one is
 * already there — so the browser's own module preloader schedules and dedupes
 * the fetch instead of relying solely on `import()`'s ad-hoc timing. No-ops
 * outside the browser (SSR).
 */
export function injectModulePreloadLink(url: string, fetchPriority?: FetchPriority): void {
  if (typeof document === 'undefined') return;

  const existing = document.head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]');
  for (const link of existing) {
    if (link.getAttribute('href') === url) return;
  }

  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = url;
  if (fetchPriority) link.setAttribute('fetchpriority', fetchPriority);
  document.head.appendChild(link);
}
