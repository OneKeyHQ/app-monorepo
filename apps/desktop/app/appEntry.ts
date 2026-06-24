import { ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG } from '@onekeyhq/shared/src/consts/desktopNativeMessaging';

if (process.argv.includes(ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG)) {
  void import('./nativeMessagingHost')
    .then(({ runDesktopNativeMessagingHost }) =>
      runDesktopNativeMessagingHost(),
    )
    .catch(() => {
      process.exit(1);
    });
} else {
  void import('./app').catch((error) => {
    console.error('[appEntry] failed to start app', error);
    process.exit(1);
  });
}
