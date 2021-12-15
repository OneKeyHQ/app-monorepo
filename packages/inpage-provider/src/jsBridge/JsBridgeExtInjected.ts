import JsBridgeBase from './JsBridgeBase';
import {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IPostMessageEventData,
} from '../types';
import {
  JS_BRIDGE_MESSAGE_DIRECTION,
  JS_BRIDGE_MESSAGE_EXT_CHANNEL,
} from '../consts';

class JsBridgeExtInjected extends JsBridgeBase {
  constructor(config: IJsBridgeConfig) {
    super(config);
    this.setupPostMessageListener();
  }

  sendAsString = false;

  sendPayload(payloadObj: IJsBridgeMessagePayload | string) {
    window.postMessage({
      channel: JS_BRIDGE_MESSAGE_EXT_CHANNEL,
      direction: JS_BRIDGE_MESSAGE_DIRECTION.INPAGE_TO_HOST,
      payload: payloadObj,
    });
  }

  setupPostMessageListener() {
    // TODO off event
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
          // TODO use window.$onekey
          window?.$onekey?.jsBridge?.receive(eventData.payload);
        }
      },
      false,
    );
  }
}

export default JsBridgeExtInjected;
