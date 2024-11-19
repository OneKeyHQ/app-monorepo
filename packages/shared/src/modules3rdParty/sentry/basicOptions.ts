export const basicOptions = {
  maxBreadcrumbs: 60,
};

export const buildIntegrations = (Sentry: typeof import('@sentry/react')) => ({
  integrations: [
    Sentry.browserProfilingIntegration(),
    Sentry.browserTracingIntegration(),
  ],
});
