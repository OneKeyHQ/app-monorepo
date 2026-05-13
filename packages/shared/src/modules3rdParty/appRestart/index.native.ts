import { BackgroundThread } from '@onekeyfe/react-native-background-thread';

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
  try {
    BootRecovery.markBootSuccess();
  } catch {
    /* ignore */
  }

  await BackgroundThread.restart(opts.mode, opts.reason);
};
