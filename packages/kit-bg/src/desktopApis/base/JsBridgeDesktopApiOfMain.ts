import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { ipcMain } from 'electron';

import {
  CALL_DESKTOP_API_EVENT_NAME,
  REPLY_DESKTOP_API_EVENT_NAME,
} from './consts';

import type {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

export class JsBridgeDesktopApiOfMain extends JsBridgeBase {
  constructor(config?: IJsBridgeConfig) {
    super(config);
    this.setup();
  }

  override sendAsString = false;

  override sendPayload(payload: IJsBridgeMessagePayload | string): void {
    // ipcMain.emit is only valid in the main process
    // ipcMain.emit(REPLY_DESKTOP_API_EVENT_NAME, payload);
    const mainWindow =
      globalThis?.$desktopMainAppFunctions.getSafelyMainWindow?.();
    if (mainWindow) {
      mainWindow.webContents.send(REPLY_DESKTOP_API_EVENT_NAME, payload);
    }
  }

  setup() {
    ipcMain.on(CALL_DESKTOP_API_EVENT_NAME, (event, payload, ...others) => {
      const responsePayload = payload as IJsBridgeMessagePayload;
      const sender:
        | {
            origin?: string;
            internal?: boolean;
          }
        | undefined = {
        origin: event?.senderFrame?.origin,
        internal: true,
      };
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const jsBridge = this;
      jsBridge.receive(responsePayload, sender);
    });
  }
}
