import { ipcRenderer } from 'electron';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import type { IMediaType, IPrefType } from '@onekeyhq/shared/types/desktop';

class DesktopApiSecurity {
  canPromptTouchID(): boolean {
    return ipcRenderer.sendSync(ipcMessageKeys.TOUCH_ID_CAN_PROMPT) as boolean;
  }

  checkBiometricAuthChanged(): boolean {
    return ipcRenderer.sendSync(ipcMessageKeys.CHECK_BIOMETRIC_AUTH_CHANGED);
  }

  async promptTouchID(msg: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      ipcRenderer.once(ipcMessageKeys.TOUCH_ID_PROMPT_RES, (_, arg) => {
        resolve(arg);
      });
      ipcRenderer.send(ipcMessageKeys.TOUCH_ID_PROMPT, msg);
    });
  }

  secureSetItemAsync(key: string, value: string): Promise<void> {
    return ipcRenderer.sendSync(ipcMessageKeys.SECURE_SET_ITEM_ASYNC, {
      key,
      value,
    });
  }

  secureGetItemAsync(key: string): Promise<string | null> {
    return ipcRenderer.sendSync(ipcMessageKeys.SECURE_GET_ITEM_ASYNC, { key });
  }

  secureDelItemAsync(key: string): Promise<void> {
    return ipcRenderer.sendSync(ipcMessageKeys.SECURE_DEL_ITEM_ASYNC, { key });
  }

  getMediaAccessStatus(
    prefType: IMediaType,
  ): 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown' {
    return ipcRenderer.sendSync(ipcMessageKeys.APP_GET_MEDIA_ACCESS_STATUS, prefType);
  }

  openPreferences(prefType: IPrefType): void {
    ipcRenderer.send(ipcMessageKeys.APP_OPEN_PREFERENCES, prefType);
  }
}

export default DesktopApiSecurity;