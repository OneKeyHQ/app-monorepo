/* eslint-disable no-restricted-globals */
/* eslint-disable unicorn/prefer-global-this */
import { precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

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

// JS/CSS chunks -> StaleWhileRevalidate
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);
