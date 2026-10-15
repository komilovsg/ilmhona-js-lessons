import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Old static URLs (files with an extension bypass proxy.ts). `/lessons/<slug>` is handled by proxy.ts.
  async redirects() {
    return [
      { source: '/01-functions.html', destination: '/ru/lessons/functions', permanent: false },
      { source: '/02-arrays.html', destination: '/ru/lessons/arrays', permanent: false },
      { source: '/03-objects.html', destination: '/ru/lessons/objects', permanent: false },
    ];
  },
};

export default nextConfig;
