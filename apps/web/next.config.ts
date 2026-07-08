import type { NextConfig } from 'next';
import { sharedDepsConfig } from '@nextjs-bridges/share/next-config-helper';

const nextConfig: NextConfig = {
  transpilePackages: ['@nextjs-bridges/lazy-handler', '@nextjs-bridges/hydration'],
};

export default sharedDepsConfig({
  provides: ['react', 'react-dom', 'date-fns'],
  outputPath: '../../packages/share/shared-contract.json',
})(nextConfig);
