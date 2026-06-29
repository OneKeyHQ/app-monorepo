import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { buildBasicOptions } from '@onekeyhq/shared/src/modules3rdParty/sentry/basicOptions';

// Perf: `@sentry/electron` is marked external (see scripts/build.js) so its ~5MB
// (Sentry Node SDK + OpenTelemetry backend instrumentations) is NOT parsed as part
// of app.js on cold start. It is require()'d lazily here, and initSentry() itself
// is deferred (see app.ts) so the load happens off the synchronous module-init path.
type ISentryMain = typeof import('@sentry/electron/main');

export const initSentry = () => {
  if (isDev) {
    return;
  }
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const Sentry: ISentryMain = require('@sentry/electron/main');
  let dsn = process.env.SENTRY_DSN_DESKTOP;
  if (process.mas) {
    dsn = process.env.SENTRY_DSN_MAS;
  } else if (process.env.DESK_CHANNEL === 'ms-store') {
    dsn = process.env.SENTRY_DSN_WINMS;
  } else if (process.platform === 'linux' && process.env.SNAP) {
    dsn = process.env.SENTRY_DSN_SNAP;
  }
  Sentry.init({
    dsn,
    enableRendererProfiling: true,
    ...buildBasicOptions({
      onError: (errorMessage, stacktrace) => {
        logger.info(
          'error >>>> ',
          errorMessage,
          stacktrace ? JSON.stringify(stacktrace) : '',
        );
      },
    }),
    transportOptions: {
      maxAgeDays: 30,
      maxQueueSize: 60,
    },
    integrations: (defaultIntegrations) => [
      // Drop only the native minidump integration (native crashes are covered
      // by the Electron crashReporter / our own native pipeline). The rest of
      // @sentry/electron's default set is kept. Note: @sentry/node's backend
      // OpenTelemetry auto-instrumentations (express/mongo/redis/…) are NOT in
      // this default set — electron-main's getDefaultIntegrations() hardcodes a
      // fixed electron+node subset and never calls getAutoPerformanceIntegrations()
      // — so there is nothing extra to strip here.
      ...defaultIntegrations.filter(
        (i) => !i.name.toLowerCase().includes('minidump'),
      ),
      Sentry.anrIntegration({ captureStackTrace: true }),
      Sentry.childProcessIntegration({
        breadcrumbs: [
          'clean-exit',
          'abnormal-exit',
          'killed',
          'crashed',
          'oom',
          'launch-failed',
          'integrity-failure',
        ],
        events: [
          'clean-exit',
          'abnormal-exit',
          'killed',
          'crashed',
          'oom',
          'launch-failed',
          'integrity-failure',
        ],
      }),
      Sentry.electronBreadcrumbsIntegration({
        app: (name) => !name.startsWith('remote-'),
        autoUpdater: true,
        webContents: (name) =>
          ['dom-ready', 'context-menu', 'load-url', 'destroyed'].includes(name),
        browserWindow: (name) =>
          [
            'closed',
            'close',
            'unresponsive',
            'responsive',
            'show',
            'blur',
            'focus',
            'hide',
            'maximize',
            'minimize',
            'restore',
            'enter-full-screen',
            'leave-full-screen',
          ].includes(name),
        screen: false,
        powerMonitor: true,
      }),
    ],
  });

  Sentry.setTag('platform', process.platform);
  Sentry.setTag('arch', process.arch);
  Sentry.setTag('electron_version', process.versions.electron);
};
