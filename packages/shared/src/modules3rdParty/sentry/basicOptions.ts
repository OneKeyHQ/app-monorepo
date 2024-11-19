import type { BrowserOptions } from '@sentry/browser';

export const basicOptions: BrowserOptions = {
  enabled: process.env.NODE_ENV === 'production',
  maxBreadcrumbs: 100,
};

export const buildOptions = (Sentry: typeof import('@sentry/react')) => ({
  transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
});

export const buildIntegrations = (Sentry: typeof import('@sentry/react')) => [
  Sentry.browserProfilingIntegration(),
  Sentry.browserTracingIntegration(),
  Sentry.breadcrumbsIntegration({
    console: false,
    dom: true,
    fetch: true,
    history: true,
    xhr: true,
  }),
];
