import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

import type {
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io-client';

export class JsBridgeE2EEClient extends JsBridgeBase {
  constructor(config: IJsBridgeConfig, { socket }: { socket: Socket }) {
    super(config);
    this.socket = socket;
    this.setup();
  }

  socket: Socket;

  override sendAsString = false;

  sendPayload(payload: IJsBridgeMessagePayload | string): void {
    this.socket.emit('e2ee-request', payload);
  }

  setup() {
    this.socket.on('e2ee-response', async (payload) => {
      const p = payload as IJsBridgeMessagePayload;
      this.receive(p, {
        origin: 'e2ee-client',
        internal: true,
      });
    });
  }
}
