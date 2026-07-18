import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import BootRecovery from '@onekeyhq/shared/src/modules/BootRecovery';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import platformEnv from '../../platformEnv';

import type { IAppRestart, IAppRestartOptions } from './types';

export type { IAppRestartOptions } from './types';
export { EAppRestartMode } from './types';

/**
 * Web / desktop / extension implementation. Native (.native.ts sibling)
 * routes through `@onekeyfe/react-native-background-thread`'s coordinated
 * restart instead.
 *
 * `mode` carries no functional difference off-native: desktop/web have one
 * app JS runtime, while chrome.runtime.reload tears down every independent
 * extension context together. It is still logged so production restarts are
 * attributable across all platforms.
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
    const desktopSystemApi = globalThis.desktopApiProxy?.system;
    if (!desktopSystemApi?.reload) {
      throw new OneKeyLocalError('Desktop reload API is unavailable');
    }
    // BrowserWindow.reload() only schedules renderer teardown; its desktop
    // bridge resolves before Chromium destroys this JS runtime. Keep one
    // additional lease that the caller's finally block cannot release so no
    // delayed writer can repopulate data between a reset and actual teardown.
    resetUtils.startResetting();
    try {
      await desktopSystemApi.reload();
    } catch (error) {
      resetUtils.endResetting();
      throw error;
    }
    return;
  }
  if (platformEnv.isExtensionBackground) {
    // chrome.runtime.reload() schedules teardown but returns immediately.
    // Hold an additional guard that the caller's finally block cannot release;
    // only destruction of this background runtime ends the guarded lifetime.
    resetUtils.startResetting();
    try {
      chrome.runtime.reload();
    } catch (error) {
      resetUtils.endResetting();
      throw error;
    }
    return;
  }
  if (platformEnv.isRuntimeBrowser) {
    const browserLocation = globalThis.location;
    if (!browserLocation?.reload) {
      throw new OneKeyLocalError('Browser reload API is unavailable');
    }
    // location.reload(), like Electron's BrowserWindow.reload(), schedules
    // teardown and returns. Retain the guard until the page is destroyed.
    resetUtils.startResetting();
    try {
      browserLocation.reload();
    } catch (error) {
      resetUtils.endResetting();
      throw error;
    }
  }
  // Native target is handled by index.native.ts; this branch should never
  // run there. Leaving it as a no-op (rather than throwing) so an
  // accidental web-bundling of the native code path degrades gracefully.
};
