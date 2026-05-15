import { BackgroundThread } from '@onekeyfe/react-native-background-thread';
import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import BootRecovery from '@onekeyhq/shared/src/modules/BootRecovery';

import type { IAppRestart, IAppRestartOptions } from './types';

export type { IAppRestartOptions } from './types';
export { EAppRestartMode } from './types';

/**
 * Native entry point. Replaces `react-native-restart`. Routes through
 * `BackgroundThread.restart` so:
 *   1. SharedRPC listener(s) are quiesced synchronously before reload —
 *      closing the use-after-free race that crashed iOS on language switch.
 *   2. For `mode='all'`, the bg host is torn down in lockstep with the
 *      main reload — keeping bundle moduleId tables consistent after OTA.
 */
export const appRestart: IAppRestart = async (opts: IAppRestartOptions) => {
  defaultLogger.setting.page.restartApp({
    mode: opts.mode,
    reason: opts.reason,
  });

  // Reset the boot-fail counter ahead of the planned restart so the JS
  // reload is not misinterpreted as a crash-loop by BootRecovery. Best
  // effort — recovery must not block the restart.
  //
  // Past production logs on Xiaomi-class Android showed the post-restart
  // MainApplication.onCreate reading a stale non-zero count even though
  // this path was supposed to clear it. The previous silent catch hid
  // which branch failed (call threw / call landed but write was lost /
  // wasn't reached at all), so each branch is now logged explicitly and
  // a read-back proves the SharedPreferences write actually hit disk.
  try {
    BootRecovery.markBootSuccess();
    // Same Nitro module, separate sync-style getter. .commit() is
    // documented synchronous, but if a race with Runtime.exit ever
    // swallows the flush we want evidence, not guesswork.
    const countAfter =
      await ReactNativeDeviceUtils.getConsecutiveBootFailCount();
    defaultLogger.app.bootRecovery.log(
      `appRestart: markBootSuccess ok, count_after=${countAfter}`,
    );
  } catch (err) {
    defaultLogger.app.bootRecovery.log(
      `appRestart: markBootSuccess threw: ${
        (err as Error)?.message ?? String(err)
      }`,
    );
  }

  await BackgroundThread.restart(opts.mode, opts.reason);
};
