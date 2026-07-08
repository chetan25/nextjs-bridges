import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RemoteManifestPreloadLink } from '../src/remote-manifest-preload-link';

describe('RemoteManifestPreloadLink', () => {
  it('renders a preload link for the manifest URL', () => {
    const { container } = render(
      <RemoteManifestPreloadLink manifestUrl="http://localhost:3001/share-manifest.json" />,
    );

    const link = container.querySelector('link');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('rel', 'preload');
    expect(link).toHaveAttribute('as', 'fetch');
    expect(link).toHaveAttribute('crossorigin', 'anonymous');
    expect(link).toHaveAttribute('href', 'http://localhost:3001/share-manifest.json');
  });

  it('sets fetchpriority when provided', () => {
    const { container } = render(
      <RemoteManifestPreloadLink
        manifestUrl="http://localhost:3001/share-manifest.json"
        fetchPriority="high"
      />,
    );

    expect(container.querySelector('link')).toHaveAttribute('fetchpriority', 'high');
  });

  it('omits fetchpriority when not provided', () => {
    const { container } = render(
      <RemoteManifestPreloadLink manifestUrl="http://localhost:3001/share-manifest.json" />,
    );

    expect(container.querySelector('link')).not.toHaveAttribute('fetchpriority');
  });
});
