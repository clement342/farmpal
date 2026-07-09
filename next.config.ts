import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  // Path to the service worker source file (relative to project root).
  swSrc: 'app/sw.ts',
  // Output path for the compiled service worker in the public directory.
  swDest: 'public/sw.js',
  // Disable in development — Turbopack doesn't support @serwist/next.
  // The service worker is compiled only during `pnpm build`.
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  // Turbopack (used by `next dev` in Next.js 16) requires an explicit
  // turbopack key when a webpack config is also present, even if empty.
  turbopack: {},
};

export default withSerwist(nextConfig);
