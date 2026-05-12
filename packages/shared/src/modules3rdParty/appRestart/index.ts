import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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
