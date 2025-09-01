import { systemPreferences } from 'electron';
import logger from 'electron-log/main';

import {
  checkAvailabilityAsync,
  checkBiometricAuthChanged,
  requestVerificationAsync,
} from '@onekeyhq/desktop/app/service';

import type { IDesktopApi } from './instance/IDesktopApi';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

class DesktopApiSecurity {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async canPromptTouchID(): Promise<boolean> {
    if (isWin) {
      logger.info('[TOUCH_ID_CAN_PROMPT] Windows checkAvailabilityAsync');
      try {
        const result = await checkAvailabilityAsync();
        return !!result;
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
  ): Promise<{ success: boolean; error?: string; isSupport: boolean }> {
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
        return { success, isSupport: true };
      } catch (e: unknown) {
        logger.info(
          '[TOUCH_ID_PROMPT] Windows requestVerificationAsync error',
          e,
        );
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          isSupport: true,
        };
      }
    }

    if (isMac) {
      try {
        await systemPreferences.promptTouchID(msg);
        return { success: true, isSupport: true };
      } catch (e: unknown) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          isSupport: true,
        };
      }
    }
    return { success: false, isSupport: false };
  }
}

export default DesktopApiSecurity;
