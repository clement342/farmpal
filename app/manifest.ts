import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FarmPal — Offline AI Crop Disease Diagnosis',
    short_name: 'FarmPal',
    description:
      'Diagnose crop diseases anywhere, even offline. Powered by Google Gemma.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1a0f',
    theme_color: '#22c55e',
    categories: ['agriculture', 'health', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
