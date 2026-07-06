'use client';
import { useRef, useEffect, type ReactNode } from 'react';
import { useRemoteComponent } from './use-remote-component';
import { RemoteErrorBoundary } from './remote-error-boundary';

type ErrorFallbackProp = ReactNode | ((error: Error) => ReactNode);

interface RemoteComponentProps {
  manifestUrl: string;
  expose: string;
  requiredVersion?: string;
  fallback?: ReactNode;
  errorFallback?: ErrorFallbackProp;
  props?: Record<string, unknown>;
  /** Poll the resolved chunk URL and swap in a rebuilt version without a page reload. Dev-only — opt in explicitly. */
  hotReload?: boolean;
  /** Poll interval in ms. Defaults to 2000. Only used when hotReload is true. */
  hotReloadInterval?: number;
}

function DefaultErrorFallback() {
  return (
    <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>
      Remote component failed to load.
    </p>
  );
}

function RemoteInner({
  manifestUrl,
  expose,
  requiredVersion,
  fallback = null,
  props = {},
  hotReload = false,
  hotReloadInterval,
}: Omit<RemoteComponentProps, 'errorFallback'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mount, loading, error } = useRemoteComponent(
    manifestUrl,
    expose,
    requiredVersion,
    { hotReload, ...(hotReloadInterval !== undefined ? { hotReloadInterval } : {}) },
  );

  useEffect(() => {
    if (!mount || !containerRef.current) return;
    // The chunk renders into this div with its own React root — the consumer's
    // React never sees elements created by the chunk's bundled React instance.
    const unmount = mount(containerRef.current, props);
    return unmount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mount]); // Re-mount only when the chunk itself changes; use key prop for prop resets

  if (loading) return <>{fallback}</>;
  if (error) throw error;
  return <div ref={containerRef} />;
}

export function RemoteComponent({
  errorFallback = <DefaultErrorFallback />,
  ...rest
}: RemoteComponentProps) {
  return (
    <RemoteErrorBoundary fallback={errorFallback}>
      <RemoteInner {...rest} />
    </RemoteErrorBoundary>
  );
}
