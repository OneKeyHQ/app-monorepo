import {
  JS_BRIDGE_MESSAGE_EXT_CHANNEL,
  JS_BRIDGE_MESSAGE_DIRECTION,
} from '../consts';
import createJsBridgeInpage from '../jsBridge/createJsBridgeInpage';
import injectJsBridge from '../injected/factory/injectJsBridge';
import injectWeb3Provider from '../injected/factory/injectWeb3Provider';
import { IPostMessageEventData } from '../types';

// TODO move to JsBridgeBase, and off event
// - receive
// #### content-script -> injected
window.addEventListener(
  'message',
  (event: MessageEvent) => {
    // We only accept messages from ourselves
    if (event.source !== window) {
      return;
    }

    const eventData = event.data as IPostMessageEventData;
    if (
      eventData.channel === JS_BRIDGE_MESSAGE_EXT_CHANNEL &&
      eventData.direction === JS_BRIDGE_MESSAGE_DIRECTION.HOST_TO_INPAGE
    ) {
      console.log('event receive in site: ', eventData);
      window?.onekey?.jsBridge?.receive(eventData.payload);
    }
  },
  false,
);

// - send
injectJsBridge({
  createBridge: () =>
    createJsBridgeInpage({
      sendAsString: false,
      // #### injected -> content-script
      sendPayload: (payloadObj) => {
        window.postMessage({
          channel: JS_BRIDGE_MESSAGE_EXT_CHANNEL,
          direction: JS_BRIDGE_MESSAGE_DIRECTION.INPAGE_TO_HOST,
          payload: payloadObj,
        });
      },
    }),
});
injectWeb3Provider();

console.log('============== injected.js in extension done!  111');
