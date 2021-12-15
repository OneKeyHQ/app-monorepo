import React from 'react';
import JsBridgeBase from './JsBridgeBase';
import {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IElectronWebView,
} from '../types';
import injectedFactory from '../injected/factory/injectedFactory';

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

      this.webviewRef.current?.executeJavaScript?.(inpageReceiveCode);
      // webviewRef.current?.send(JS_BRIDGE_MESSAGE_CHANNEL, payloadStr);
      // preload.js ipcRenderer.on(JS_BRIDGE_MESSAGE_CHANNEL) window.$onekey.jsBridge.receive()
    }
  }
}

export default JsBridgeDesktopHost;
