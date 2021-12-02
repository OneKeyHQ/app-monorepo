import {
  JS_BRIDGE_MESSAGE_EXT_CHANNEL,
  JS_BRIDGE_MESSAGE_DIRECTION,
} from '../consts';
import createJsBridgeInpage from '../jsBridge/createJsBridgeInpage';
import injectJsBridge from './factory/injectJsBridge';
import injectWeb3Provider from './factory/injectWeb3Provider';

// TODO move to JsBridgeBase, and off event
// - receive
window.addEventListener(
  'message',
  (event: MessageEvent) => {
    // We only accept messages from ourselves
    if (event.source !== window) {
      return;
    }

    if (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      event.data.channel === JS_BRIDGE_MESSAGE_EXT_CHANNEL &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      event.data.direction === JS_BRIDGE_MESSAGE_DIRECTION.HOST_TO_INPAGE
    ) {
      console.log('event receive in site: ', event.data);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      window?.onekey?.jsBridge?.receive(event.data.payload);
    }
  },
  false,
);

// - send
injectJsBridge({
  createBridge: () =>
    createJsBridgeInpage({
      sendAsString: false,
      // inpage -> host
      sendPayload: (payloadObj) => {
        window.postMessage({
          channel: JS_BRIDGE_MESSAGE_EXT_CHANNEL,
          direction: JS_BRIDGE_MESSAGE_DIRECTION.INPAGE_TO_HOST,
          payload1: payloadObj,
        });
      },
    }),
});
injectWeb3Provider();
