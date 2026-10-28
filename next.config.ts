import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// Enforced. srcdoc runner iframes inherit this policy, so student code (inline scripts, esm.sh imports
// for React, fetch to any https API, any image URL) must keep working.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://esm.sh blob:${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  'img-src * data: blob:',
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), display-capture=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Old static URLs (files with an extension bypass proxy.ts). `/lessons/<slug>` is handled by proxy.ts.
  async redirects() {
    return [
      { source: '/01-functions.html', destination: '/ru/lessons/functions', permanent: false },
      { source: '/02-arrays.html', destination: '/ru/lessons/arrays', permanent: false },
      { source: '/03-objects.html', destination: '/ru/lessons/objects', permanent: false },
      // New numbering (file names of the lesson fragments).
      { source: '/05-functions.html', destination: '/ru/lessons/functions', permanent: false },
      { source: '/06-arrays.html', destination: '/ru/lessons/arrays', permanent: false },
      { source: '/07-objects.html', destination: '/ru/lessons/objects', permanent: false },
    ];
  },
};

export default nextConfig;
