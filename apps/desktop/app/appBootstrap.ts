import { ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG } from '@onekeyhq/shared/src/consts/desktopNativeMessaging';

const harnessOutputFile =
  process.env.ONEKEY_NODE_RUNTIME_INTEGRITY_HARNESS_OUTPUT;

if (process.argv.includes(ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG)) {
  // The Native Messaging host is dev-only and must never ship in production
  // bundles. esbuild substitutes process.env.NODE_ENV at build time, so this
  // guard dead-code-eliminates the import('./nativeMessagingHost') branch (and
  // its safeStorage crypto) out of the production bundle entirely — build-time
  // defense in depth on top of the dev-gated manifest install and the host's own
  // runtime guard. In a packaged build a stale dev manifest could still spawn us
  // with this arg, so exit immediately instead of falling through to the app.
  if (process.env.NODE_ENV !== 'production') {
    void import('./nativeMessagingHost')
      .then(({ runDesktopNativeMessagingHost }) =>
        runDesktopNativeMessagingHost(),
      )
      .catch(() => {
        process.exit(1);
      });
  } else {
    process.exit(0);
  }
} else if (harnessOutputFile) {
  // The diagnostic module must load before the application so it can capture
  // pristine Electron/Node references before any app dependency is evaluated.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runAppRuntimeHarness } =
    require('./appRuntimeHarness') as typeof import('./appRuntimeHarness');

  void runAppRuntimeHarness(harnessOutputFile).catch((error: unknown) => {
    // These modules stay lazy so the normal production path pays only for the
    // environment check above before loading the original application entry.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    const message = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(
      harnessOutputFile,
      JSON.stringify({ fatalError: message }, null, 2),
      'utf8',
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron');
    app.exit(3);
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./app');
}
