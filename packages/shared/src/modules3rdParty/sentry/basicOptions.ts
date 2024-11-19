import type { BrowserOptions } from '@sentry/browser';

export const basicOptions: BrowserOptions = {
  enabled: process.env.NODE_ENV === 'production',
  maxBreadcrumbs: 100,
  beforeSend: (event, hint) => {
    const error = hint.originalException as { message?: string };
    if (error && error.message) {
      const words = error.message.split(' ');

      if (words.length < 13) {
        return event;
      }
      for (let index = 0; index < words.length; index += 1) {
        const word = words[index];
        if (word.length < 20) {
          return event;
        }
      }
      if (event.exception?.values) {
        for (let index = 0; index < event.exception.values.length; index += 1) {
          event.exception.values[index].value = event.exception.values[
            index
          ].value?.slice(
            0,
            (event.exception.values[index].value?.length || 0) / 2,
          );
        }
      }
    }
    return event;
  },
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
