import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { ipcMain } from 'electron';

import {
  CALL_DESKTOP_API_EVENT_NAME,
  DESKTOP_API_MESSAGE_TYPE,
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
    ipcMain.on(CALL_DESKTOP_API_EVENT_NAME, (event, payload) => {
      let responsePayload: IJsBridgeMessagePayload | string = payload as
        | IJsBridgeMessagePayload
        | string;
      if (typeof responsePayload === 'string') {
        try {
          responsePayload = JSON.parse(
            responsePayload,
          ) as IJsBridgeMessagePayload;
        } catch {
          return;
        }
        if (
          !responsePayload ||
          typeof responsePayload !== 'object' ||
          Array.isArray(responsePayload)
        ) {
          return;
        }
      }
      const bridgePayload = responsePayload as IJsBridgeMessagePayload;
      const methodCall = bridgePayload?.data as
        | { type?: unknown; module?: unknown; method?: unknown }
        | undefined;
      if (
        bridgePayload?.type === 'REQUEST' &&
        methodCall?.type === DESKTOP_API_MESSAGE_TYPE &&
        (typeof methodCall.module !== 'string' ||
          typeof methodCall.method !== 'string')
      ) {
        return;
      }
      if (
        methodCall?.module === 'dev' &&
        (typeof methodCall.method !== 'string' ||
          [
            'collectLoggerDigest',
            'exportLoggerZip',
            'uploadLoggerBundle',
          ].includes(methodCall.method))
      ) {
        const mainWindow =
          globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
        if (
          !mainWindow ||
          event.sender.id !== mainWindow.webContents.id ||
          event.senderFrame !== mainWindow.webContents.mainFrame
        ) {
          return;
        }
      }
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
