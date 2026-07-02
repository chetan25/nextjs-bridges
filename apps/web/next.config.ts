import type { NextConfig } from 'next';
import { sharedDepsConfig } from '@bridge/share/next-config-helper';

const nextConfig: NextConfig = {
  transpilePackages: ['@bridge/lazy-handler', '@bridge/hydration'],
};

export default sharedDepsConfig({
  provides: ['react', 'react-dom'],
  outputPath: '../../packages/share/shared-contract.json',
})(nextConfig);
