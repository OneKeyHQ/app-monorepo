import JsBridgeBase from './JsBridgeBase';
import { IJsBridgeMessagePayload } from '../types';

class JsBridgeNativeInjected extends JsBridgeBase {
  sendAsString = true;

  sendPayload(payload: IJsBridgeMessagePayload | string) {
    window.ReactNativeWebView.postMessage(payload as string);
  }
}

export default JsBridgeNativeInjected;
