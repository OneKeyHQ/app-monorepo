import { systemPreferences } from 'electron';
import logger from 'electron-log/main';

import {
  checkAvailabilityAsync,
  checkBiometricAuthChanged,
  requestVerificationAsync,
} from '@onekeyhq/desktop/app/service';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IDesktopApi } from './instance/IDesktopApi';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

export type IDesktopHyperLiquidAgentSessionPayload = {
  ciphertext: string;
  iv: string;
  unlocked: boolean;
  version: 1;
};

const HYPERLIQUID_AGENT_SESSION_MAX_FIELD_LENGTH = 1024;

function validateHyperLiquidAgentSessionPayload(
  payload: IDesktopHyperLiquidAgentSessionPayload,
): void {
  if (
    !payload ||
    payload.version !== 1 ||
    typeof payload.ciphertext !== 'string' ||
    payload.ciphertext.length === 0 ||
    payload.ciphertext.length > HYPERLIQUID_AGENT_SESSION_MAX_FIELD_LENGTH ||
    typeof payload.iv !== 'string' ||
    payload.iv.length === 0 ||
    payload.iv.length > HYPERLIQUID_AGENT_SESSION_MAX_FIELD_LENGTH ||
    typeof payload.unlocked !== 'boolean'
  ) {
    throw new OneKeyLocalError(
      'Invalid HyperLiquid agent desktop session payload',
    );
  }
}

class DesktopApiSecurity {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  private hyperLiquidAgentSession:
    | IDesktopHyperLiquidAgentSessionPayload
    | undefined;

  async setHyperLiquidAgentSession(
    payload: IDesktopHyperLiquidAgentSessionPayload,
  ): Promise<void> {
    validateHyperLiquidAgentSessionPayload(payload);
    this.hyperLiquidAgentSession = { ...payload };
  }

  async getHyperLiquidAgentSession(): Promise<
    IDesktopHyperLiquidAgentSessionPayload | undefined
  > {
    return this.hyperLiquidAgentSession
      ? { ...this.hyperLiquidAgentSession }
      : undefined;
  }

  async clearHyperLiquidAgentSession(): Promise<void> {
    this.hyperLiquidAgentSession = undefined;
  }

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

  // Blanks the window in screenshots/recordings/screen shares while sensitive
  // content (e.g. a recovery phrase) is on screen. macOS uses
  // NSWindowSharingNone; Windows needs 10 2004+ (WDA_EXCLUDEFROMCAPTURE);
  // Linux Electron is a documented no-op.
  async setContentProtection(enabled: boolean): Promise<void> {
    try {
      const win =
        globalThis.$desktopMainAppFunctions?.getSafelyBrowserWindow?.();
      win?.setContentProtection(enabled);
    } catch (error) {
      logger.error('[SET_CONTENT_PROTECTION] Error:', error);
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
        return { success, error: error || undefined, isSupport: true };
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
