import createBaseJsBridge from './createJsBridgeBase';
import injectedFactory from '../injected/factory/injectedFactory';
import {
  ICreateJsBridgeHostParams,
  IElectronWebViewRef,
  IReactNativeWebViewRef,
} from '../types';

function createJsBridgeHost({
  webviewRef,
  isReactNative = false,
  isElectron = false,
}: ICreateJsBridgeHostParams) {
  // host -> inpage
  return createBaseJsBridge({
    sendPayload(payloadStr: string) {
      console.log('[host] sendPayload: \n', payloadStr);
      const inpageReceiveCode =
        injectedFactory.createCodeJsBridgeReceive(payloadStr);
      if (isReactNative && webviewRef && webviewRef.current) {
        // react-native webview
        (webviewRef.current as IReactNativeWebViewRef)?.injectJavaScript?.(
          inpageReceiveCode,
        );
      }
      if (isElectron && webviewRef && webviewRef.current) {
        // electron webview
        (webviewRef.current as IElectronWebViewRef)?.executeJavaScript?.(
          inpageReceiveCode,
        );
        // webviewRef.current?.send(JS_BRIDGE_MESSAGE_CHANNEL, payloadStr);
        // preload.js ipcRenderer.on(JS_BRIDGE_MESSAGE_CHANNEL) window.onekey.jsBridge.receive()
      }
    },
  });
}

export default createJsBridgeHost;
