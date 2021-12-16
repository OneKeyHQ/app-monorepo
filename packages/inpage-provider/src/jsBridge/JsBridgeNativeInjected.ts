import { IJsBridgeMessagePayload } from '../types';

import JsBridgeBase from './JsBridgeBase';

class JsBridgeNativeInjected extends JsBridgeBase {
  sendAsString = true;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    window.ReactNativeWebView.postMessage(payload as string);
  }
}

export default JsBridgeNativeInjected;
