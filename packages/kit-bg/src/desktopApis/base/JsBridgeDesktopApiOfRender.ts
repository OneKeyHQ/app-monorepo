import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { ipcRenderer } from 'electron';

import {
  CALL_DESKTOP_API_EVENT_NAME,
  REPLY_DESKTOP_API_EVENT_NAME,
} from './consts';

import type {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

export class JsBridgeDesktopApiOfRender extends JsBridgeBase {
  constructor(config?: IJsBridgeConfig) {
    super(config);
    this.setup();
  }

  override sendAsString = false;

  override sendPayload(payload: IJsBridgeMessagePayload | string): void {
    ipcRenderer.send(CALL_DESKTOP_API_EVENT_NAME, payload);
  }

  setup() {
    ipcRenderer.on(REPLY_DESKTOP_API_EVENT_NAME, (event, payload) => {
      const responsePayload = payload as IJsBridgeMessagePayload;
      const sender:
        | {
            origin?: string;
            internal?: boolean;
          }
        | undefined = {
        origin: 'electron-main',
        internal: true,
      };
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const jsBridge = this;
      jsBridge.receive(responsePayload, sender);
    });
  }
}
