import { ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG } from '@onekeyhq/shared/src/consts/desktopNativeMessaging';

if (process.argv.includes(ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG)) {
  // The Native Messaging host is dev-only and must never ship in production
  // bundles. esbuild substitutes process.env.NODE_ENV at build time, so this
  // guard dead-code-eliminates the `import('./nativeMessagingHost')` branch
  // (and its safeStorage crypto) out of the production appEntry bundle entirely.
  // This is build-time defense in depth on top of the dev-gated manifest
  // install and the host's own runtime guard. In a packaged build a stale dev
  // manifest could still spawn us with this arg, so exit immediately instead of
  // falling through and launching the full app.
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
} else {
  void import('./app').catch((error) => {
    console.error('[appEntry] failed to start app', error);
    process.exit(1);
  });
}
