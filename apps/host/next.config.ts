import type { NextConfig } from 'next';
import { shareConfig } from '@nextjs-bridges/share/next-config-helper';

const nextConfig: NextConfig = {
  // Allow cross-origin requests so apps/web (port 3000) can load
  // the manifest and chunk files served by this host (port 3001).
  async headers() {
    return [
      {
        source: '/(share-manifest\\.json|.*\\.chunk\\.js)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
    ];
  },
};

export default shareConfig({
  name: 'host-app',
  version: '1.0.0',
  baseUrl: 'http://localhost:3001',
  exposes: {
    './Button': './src/components/button.tsx',
    './CartWidget': './src/components/checkout-team/cart-widget.tsx',
  },
  shared: { react: {}, 'react-dom': {} },
  sharedContractPath: '../../packages/share/shared-contract.json',
})(nextConfig);
