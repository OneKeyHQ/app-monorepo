/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  JS_BRIDGE_MESSAGE_DIRECTION,
  JS_BRIDGE_MESSAGE_EXT_CHANNEL,
} from '../consts';
import {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IPostMessageEventData,
} from '../types';

import JsBridgeBase from './JsBridgeBase';

class JsBridgeExtInjected extends JsBridgeBase {
  constructor(config: IJsBridgeConfig) {
    super(config);
    this.setupPostMessageListener();
  }

  sendAsString = false;

  isInjected = true;

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
          debugLogger.extInjected('window on message', eventData);

          const { payload } = eventData;
          const jsBridge = window?.$onekey?.jsBridge;
          if (jsBridge) {
            jsBridge.receive(payload);
          }
        }
      },
      false,
    );
  }
}

export default JsBridgeExtInjected;
