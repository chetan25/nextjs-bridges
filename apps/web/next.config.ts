import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@bridge/lazy-handler', '@bridge/hydration'],
};

export default nextConfig;
