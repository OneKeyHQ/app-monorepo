/* eslint-disable no-restricted-globals */
/* eslint-disable unicorn/prefer-global-this */
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

// Skip waiting immediately on install so existing users with old SW get
// the fix without needing to confirm the update prompt or close all tabs.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Precache app shell (manifest injected by InjectManifest at build time)
precacheAndRoute(self.__WB_MANIFEST);

// Navigation requests -> NetworkFirst with /index.html rewrite.
// GitHub Pages returns 404 status for SPA client-side routes like /market,
// which Workbox rejects. Rewriting to /index.html ensures a 200 response.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigations',
      plugins: [
        {
          requestWillFetch: async () => new Request('/index.html'),
          cacheKeyWillBeUsed: async () => '/index.html',
        },
      ],
    }),
  ),
);

// Static assets (images, fonts) -> CacheFirst with expiration
registerRoute(
  ({ request }) =>
    request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// JS/CSS chunks -> CacheFirst.
// These assets are immutable: they are served from app-assets.onekey.so under a
// per-build path + contenthash filename, so a given URL's bytes never change
// (new content -> new URL). StaleWhileRevalidate would re-fetch every cached
// chunk in the background on each load — and because the asset host sends NO
// `Cache-Control: immutable`, that revalidation costs a real network round-trip
// for content that cannot have changed. CacheFirst serves from cache without
// revalidating. It is safe here: the asset host returns a genuine 404 (not an
// HTML fallback) for missing files, and CacheFirst caches only 200 responses, so
// a missing chunk is never pinned. Old build URLs fall out via expiration.
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);
