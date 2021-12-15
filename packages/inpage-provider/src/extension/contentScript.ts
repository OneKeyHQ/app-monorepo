import injectedFactory from '../injected/factory/injectedFactory';
import {
  EXT_PORT_CS_TO_BG,
  JS_BRIDGE_MESSAGE_DIRECTION,
  JS_BRIDGE_MESSAGE_EXT_CHANNEL,
} from '../consts';
import messagePort from './extMessagePort';
import { IPostMessageEventData } from '../types';

// TODO one-time only
function inject(filename: string) {
  // Manifest V2
  /*
  injectedFactory.injectCodeWithScriptTag({
    code: injectedExtension as string,
  });
  */

  // Manifest V3 V2
  injectedFactory.injectCodeWithScriptTag({
    file: chrome.runtime.getURL(filename),
  });
}

// TODO one-time only
function setupMessagePort() {
  messagePort.connect({
    name: EXT_PORT_CS_TO_BG,
    // #### background -> content-script
    onMessage(payload: unknown) {
      // #### content-script -> injected
      window.postMessage({
        channel: JS_BRIDGE_MESSAGE_EXT_CHANNEL,
        direction: JS_BRIDGE_MESSAGE_DIRECTION.HOST_TO_INPAGE,
        payload,
      });
    },
    onConnect(port) {
      // #### injected -> content-script
      const onWindowPostMessage = (event: MessageEvent) => {
        // We only accept messages from ourselves
        if (event.source !== window) {
          return;
        }
        const eventData = event.data as IPostMessageEventData;
        if (
          eventData.channel === JS_BRIDGE_MESSAGE_EXT_CHANNEL &&
          eventData.direction === JS_BRIDGE_MESSAGE_DIRECTION.INPAGE_TO_HOST
        ) {
          console.log('event receive in content-scripts: ', event.data);
          // #### content-script -> background
          port.postMessage(eventData.payload);
        }
      };
      window.addEventListener('message', onWindowPostMessage, false);
      return () => {
        window.removeEventListener('message', onWindowPostMessage, false);
      };
    },
  });
}

//  -> inpage -> dapp injected jsBridge -> bridge.request()
//      -> window.postMessage
//  -> contentScript -> on message -> chrome.runtime.connect port
//      -> port.postMessage
//  -> background -> createJsBridgeHost -> chrome.runtime.onConnect.addListener -> bridge.receive()
//      -> port.postMessage
//  -> ui -> createJsBridgeInpage -> chrome.runtime.connect port -> bridge.receive()

export default {
  inject,
  setupMessagePort,
};
