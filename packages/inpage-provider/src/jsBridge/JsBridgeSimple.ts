import { IJsBridgeMessagePayload } from '../types';

import JsBridgeBase from './JsBridgeBase';

class JsBridgeSimple extends JsBridgeBase {
  sendAsString = true;

  private remote: JsBridgeBase | null = null;

  sendPayload(payload: IJsBridgeMessagePayload | string): void {
    if (!this.remote) {
      throw new Error('JsBridgeSimple ERROR: remote not set.');
    }
    this.remote.receive(payload as string);
  }

  setRemote(remote: JsBridgeBase) {
    this.remote = remote;
  }
}

export default JsBridgeSimple;
