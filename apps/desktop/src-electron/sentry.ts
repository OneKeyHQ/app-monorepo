import Sentry from '@sentry/electron/main';
import isDev from 'electron-is-dev';

import { basicOptions } from '@onekeyhq/shared/src/modules3rdParty/sentry/basicOptions';

export const initSentry = () => {
  if (isDev) {
    return;
  }
  let dsn =
    'https://05ed77019985fb3c81f0bcbdbe1774cd@o4508208799809536.ingest.de.sentry.io/4508320047890512';
  if (process.mas) {
    dsn =
      'https://80fff328f1cb3aa66917ca017ad3f92e@o4508208799809536.ingest.de.sentry.io/4508325159632976';
  } else if (process.env.DESK_CHANNEL === 'ms-store') {
    dsn =
      'https://2a500dd98b6e0348ac9da8cc38ab1f55@o4508208799809536.ingest.de.sentry.io/4508325162385488';
  } else if (process.platform === 'linux' && process.env.SNAP) {
    dsn =
      'https://8c4df967faf64ee7daa2d26d7e2f3fb0@o4508208799809536.ingest.de.sentry.io/4508325161074768';
  }
  Sentry.init({
    dsn,
    enableRendererProfiling: true,
    ...basicOptions,
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
