import React from 'react';

import { WebView } from 'react-native-webview';

import injectedFactory from '../injected/factory/injectedFactory';
import { IJsBridgeConfig, IJsBridgeMessagePayload } from '../types';

import JsBridgeBase from './JsBridgeBase';

class JsBridgeNativeHost extends JsBridgeBase {
  constructor(config: IJsBridgeConfig) {
    super(config);
    this.webviewRef = config.webviewRef;
  }

  sendAsString = true;

  webviewRef?: React.RefObject<WebView>;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    if (this.webviewRef && this.webviewRef.current) {
      const payloadStr: string = payload as string;
      const inpageReceiveCode =
        injectedFactory.createCodeJsBridgeReceive(payloadStr);

      this.webviewRef.current?.injectJavaScript?.(inpageReceiveCode);
    }
  }
}

export default JsBridgeNativeHost;
