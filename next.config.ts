import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/01-functions.html', destination: '/lessons/functions', permanent: false },
      { source: '/02-arrays.html', destination: '/lessons/arrays', permanent: false },
      { source: '/03-objects.html', destination: '/lessons/objects', permanent: false },
    ];
  },
};

export default nextConfig;
