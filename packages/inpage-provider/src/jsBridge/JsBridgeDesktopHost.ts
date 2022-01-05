import React from 'react';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import injectedFactory from '../injected/factory/injectedFactory';
import {
  IElectronWebView,
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
} from '../types';

import JsBridgeBase from './JsBridgeBase';

class JsBridgeDesktopHost extends JsBridgeBase {
  constructor(config: IJsBridgeConfig) {
    super(config);
    this.webviewRef = config.webviewRef;
  }

  sendAsString = true;

  webviewRef?: React.RefObject<IElectronWebView>;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    if (this.webviewRef && this.webviewRef.current) {
      const payloadStr: string = payload as string;
      const inpageReceiveCode =
        injectedFactory.createCodeJsBridgeReceive(payloadStr);

      if (
        this.webviewRef.current &&
        this.webviewRef.current.executeJavaScript
      ) {
        debugLogger.webview('executeJavaScript', inpageReceiveCode, payload);
        this.webviewRef.current?.executeJavaScript?.(inpageReceiveCode);
      } else {
        throw new Error(
          'JsBridgeDesktopHost executeJavaScript failed: webview ref not ready yet',
        );
      }
    }
  }
}

export default JsBridgeDesktopHost;
