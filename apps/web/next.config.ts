import type { NextConfig } from 'next';
import { sharedDepsConfig } from '@chetand/share/next-config-helper';

const nextConfig: NextConfig = {
  transpilePackages: ['@chetand/lazy-handler', '@chetand/hydration'],
};

export default sharedDepsConfig({
  provides: ['react', 'react-dom', 'date-fns'],
  outputPath: '../../packages/share/shared-contract.json',
})(nextConfig);
