import { shell, systemPreferences } from 'electron';
import logger from 'electron-log/main';

import * as store from '@onekeyhq/desktop/app/libs/store';
import {
  checkAvailabilityAsync,
  checkBiometricAuthChanged,
  requestVerificationAsync,
} from '@onekeyhq/desktop/app/service';
import type { IMediaType, IPrefType } from '@onekeyhq/shared/types/desktop';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

class DesktopApiSecurity {
  async canPromptTouchID(): Promise<boolean> {
    if (isWin) {
      logger.info('[TOUCH_ID_CAN_PROMPT] Windows checkAvailabilityAsync');
      try {
        const result = await checkAvailabilityAsync();
        return result;
      } catch (error) {
        logger.info(
          '[TOUCH_ID_CAN_PROMPT] Windows checkAvailabilityAsync',
          error,
        );
        return false;
      }
    }
    const result = systemPreferences?.canPromptTouchID?.();
    return !!result;
  }

  async checkBiometricAuthChanged(): Promise<boolean> {
    if (!isMac) {
      return false;
    }
    try {
      const result = await checkBiometricAuthChanged();
      return result;
    } catch (error) {
      logger.error('[CHECK_BIOMETRIC_AUTH_CHANGED] Error:', error);
      return false;
    }
  }

  async promptTouchID(
    msg: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (isWin) {
      logger.info('[TOUCH_ID_PROMPT] Windows requestVerificationAsync');
      try {
        const { success, error } = await requestVerificationAsync(msg);
        if (error) {
          logger.info(
            '[TOUCH_ID_PROMPT] Windows requestVerificationAsync error',
            error,
          );
        }
        return { success };
      } catch (e: unknown) {
        logger.info(
          '[TOUCH_ID_PROMPT] Windows requestVerificationAsync error',
          e,
        );
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }
    }

    try {
      await systemPreferences.promptTouchID(msg);
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  async secureSetItemAsync(key: string, value: string): Promise<void> {
    store.setSecureItem(key, value);
  }

  async secureGetItemAsync(key: string): Promise<string | null> {
    const value = store.getSecureItem(key);
    return value || null;
  }

  async secureDelItemAsync(key: string): Promise<void> {
    store.deleteSecureItem(key);
  }

  async getMediaAccessStatus(
    prefType: IMediaType,
  ): Promise<
    'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
  > {
    const result = systemPreferences?.getMediaAccessStatus?.(prefType);
    return result || 'unknown';
  }

  async openPreferences(prefType: IPrefType): Promise<void> {
    if (prefType === 'default') {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security',
      );
    }
  }
}

export default DesktopApiSecurity;
