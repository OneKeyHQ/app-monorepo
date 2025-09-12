import * as Sentry from '@sentry/electron/main';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { buildBasicOptions } from '@onekeyhq/shared/src/modules3rdParty/sentry/basicOptions';

export const initSentry = () => {
  if (isDev) {
    return;
  }
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
    integrations: [
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
};

export { Sentry };
