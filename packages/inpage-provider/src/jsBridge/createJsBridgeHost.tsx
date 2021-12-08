import createBaseJsBridge from './createJsBridgeBase';
import injectedFactory from '../injected/factory/injectedFactory';
import {
  ICreateJsBridgeHostParams,
  IElectronWebViewRef,
  IReactNativeWebViewRef,
} from '../types';
import {
  JS_BRIDGE_MESSAGE_DIRECTION,
  JS_BRIDGE_MESSAGE_EXT_CHANNEL,
} from '../consts';

function createJsBridgeHost({
  webviewRef,
  isReactNative = false,
  isElectron = false,
  isExtension = false,
}: ICreateJsBridgeHostParams) {
  // host -> inpage
  return createBaseJsBridge({
    sendAsString: isReactNative || isElectron,
    sendPayload(payload) {
      console.log('[host] sendPayload: \n', payload);
      // run on: browser extension content-scripts
      if (isExtension) {
        window.postMessage({
          channel: JS_BRIDGE_MESSAGE_EXT_CHANNEL,
          direction: JS_BRIDGE_MESSAGE_DIRECTION.HOST_TO_INPAGE,
          payload,
        });
      } else {
        const payloadStr: string = payload as string;
        const inpageReceiveCode =
          injectedFactory.createCodeJsBridgeReceive(payloadStr);

        // run on: react-native webview
        if (isReactNative && webviewRef && webviewRef.current) {
          (webviewRef.current as IReactNativeWebViewRef)?.injectJavaScript?.(
            inpageReceiveCode,
          );
        }

        // run on: electron webview
        if (isElectron && webviewRef && webviewRef.current) {
          (webviewRef.current as IElectronWebViewRef)?.executeJavaScript?.(
            inpageReceiveCode,
          );
          // webviewRef.current?.send(JS_BRIDGE_MESSAGE_CHANNEL, payloadStr);
          // preload.js ipcRenderer.on(JS_BRIDGE_MESSAGE_CHANNEL) window.onekey.jsBridge.receive()
        }
      }
    },
  });
}

export default createJsBridgeHost;
