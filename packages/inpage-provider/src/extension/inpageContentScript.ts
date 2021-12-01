// import { injectedExtension } from '../injected-autogen';
import injectedFactory from '../injected/factory/injectedFactory';
import createJsBridgeHost from '../jsBridge/createJsBridgeHost';
import {
  JS_BRIDGE_MESSAGE_DIRECTION,
  JS_BRIDGE_MESSAGE_EXT_CHANNEL,
} from '../consts';

function inject() {
  // Manifest V2
  /*
  injectedFactory.injectCodeWithScriptTag({
    code: injectedExtension as string,
  });
  */

  // Manifest V3 V2
  injectedFactory.injectCodeWithScriptTag({
    // eslint-disable-next-line no-undef
    file: chrome.runtime.getURL('injected.js'),
  });
}

function createHost() {
  const bridge = createJsBridgeHost({
    isExtension: true,
  });
  // TODO move to JsBridgeBase, and off event
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
        event.data.direction === JS_BRIDGE_MESSAGE_DIRECTION.INPAGE_TO_HOST
      ) {
        console.log('event receive in content-scripts: ', event.data);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        bridge.receive(event.data.payload);
      }
    },
    false,
  );
  return bridge;
}

export default {
  inject,
  createHost,
};
