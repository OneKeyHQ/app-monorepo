import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import BootRecovery from '@onekeyhq/shared/src/modules/BootRecovery';

import platformEnv from '../../platformEnv';

import type { IAppRestart, IAppRestartOptions } from './types';

export type { IAppRestartOptions } from './types';
export { EAppRestartMode } from './types';

/**
 * Web / desktop / extension implementation. Native (.native.ts sibling)
 * routes through `@onekeyfe/react-native-background-thread`'s coordinated
 * restart instead.
 *
 * `mode` carries no functional difference off-native — these targets each
 * have a single JS context — but is still logged so production restarts
 * are attributable across all platforms.
 */
export const appRestart: IAppRestart = async (opts: IAppRestartOptions) => {
  defaultLogger.setting.page.restartApp({
    mode: opts.mode,
    reason: opts.reason,
  });

  // Reset the boot-fail counter ahead of the planned restart so the reload
  // is not misinterpreted as a crash-loop by BootRecovery (desktop bridges
  // through globalThis.desktopApi; web/ext are no-ops). Best effort —
  // recovery must not block the restart.
  try {
    BootRecovery.markBootSuccess();
  } catch {
    /* ignore */
  }

  if (platformEnv.isDesktop) {
    await globalThis.desktopApiProxy?.system?.reload?.();
    return;
  }
  if (platformEnv.isExtensionBackground) {
    chrome.runtime.reload();
    return;
  }
  if (platformEnv.isRuntimeBrowser) {
    globalThis?.location?.reload?.();
  }
  // Native target is handled by index.native.ts; this branch should never
  // run there. Leaving it as a no-op (rather than throwing) so an
  // accidental web-bundling of the native code path degrades gracefully.
};
