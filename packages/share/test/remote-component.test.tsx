import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RemoteComponent } from '../src/remote-component';
import { RemoteErrorBoundary } from '../src/remote-error-boundary';

vi.mock('../src/manifest-loader', () => ({
  loadManifest: vi.fn(),
}));

vi.mock('../src/chunk-loader', () => ({
  loadChunk: vi.fn(),
}));

import { loadManifest } from '../src/manifest-loader';
import { loadChunk } from '../src/chunk-loader';

const mockManifest = {
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': { chunk: '/button.chunk.js', version: '1.0.0' },
  },
};

// A mount function that renders a text node into the container.
function mockMount(container: HTMLElement, props: Record<string, unknown>) {
  const div = document.createElement('div');
  div.textContent = `mounted:${String(props.label ?? '')}`;
  container.appendChild(div);
  return () => div.remove();
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────
// RemoteErrorBoundary
// ──────────────────────────────────────────────────────
describe('<RemoteErrorBoundary>', () => {
  it('renders children when there is no error', () => {
    render(
      <RemoteErrorBoundary fallback={<p>error</p>}>
        <span>ok</span>
      </RemoteErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.queryByText('error')).not.toBeInTheDocument();
  });

  it('renders static fallback when a child throws', () => {
    function Bomb() {
      throw new Error('boom');
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <RemoteErrorBoundary fallback={<p>caught</p>}>
        <Bomb />
      </RemoteErrorBoundary>,
    );

    expect(screen.getByText('caught')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('renders render-prop fallback with the caught error', () => {
    function Bomb() {
      throw new Error('boom');
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <RemoteErrorBoundary fallback={(err) => <p>caught: {err.message}</p>}>
        <Bomb />
      </RemoteErrorBoundary>,
    );

    expect(screen.getByText('caught: boom')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────
// RemoteComponent
// ──────────────────────────────────────────────────────
describe('<RemoteComponent>', () => {
  it('shows fallback while loading', () => {
    vi.mocked(loadManifest).mockReturnValue(new Promise(() => {})); // never resolves

    render(
      <RemoteComponent
        manifestUrl="http://example.com/manifest.json"
        expose="./Button"
        fallback={<span>loading…</span>}
      />,
    );

    expect(screen.getByText('loading…')).toBeInTheDocument();
  });

  it('mounts the chunk into a container div on success', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);
    vi.mocked(loadChunk).mockResolvedValue({ default: mockMount });

    render(
      <RemoteComponent
        manifestUrl="http://example.com/manifest.json"
        expose="./Button"
        props={{ label: 'hello' }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('mounted:hello')).toBeInTheDocument(),
    );
  });

  it('renders errorFallback (render-prop) on manifest failure', async () => {
    vi.mocked(loadManifest).mockRejectedValue(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <RemoteComponent
        manifestUrl="http://example.com/manifest.json"
        expose="./Button"
        errorFallback={(err) => <p>error: {err.message}</p>}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('error: Network error')).toBeInTheDocument(),
    );

    consoleSpy.mockRestore();
  });

  it('renders static errorFallback on version mismatch', async () => {
    vi.mocked(loadManifest).mockResolvedValue(mockManifest);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <RemoteComponent
        manifestUrl="http://example.com/manifest.json"
        expose="./Button"
        requiredVersion="^2.0.0"
        errorFallback={<p>version error</p>}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('version error')).toBeInTheDocument(),
    );

    consoleSpy.mockRestore();
  });
});
