/* eslint-disable no-restricted-syntax */

import { JsBridgeE2EEClient } from './JsBridgeE2EEClient';
import { RemoteApiProxyBase } from './utils/RemoteApiProxyBase';

import type { RoomManager } from './roomManager';
import type { IE2EEServerApi, IE2EEServerApiKeys } from './types';
import type { Socket } from 'socket.io-client';

export class E2EEServerApiProxy
  extends RemoteApiProxyBase
  implements IE2EEServerApi
{
  constructor({ socket }: { socket: Socket }) {
    super();
    this.bridge = new JsBridgeE2EEClient({}, { socket });
  }

  bridge: JsBridgeE2EEClient;

  override checkEnvAvailable(): void {
    // do nothing
  }

  override async waitRemoteApiReady(): Promise<void> {
    return Promise.resolve();
  }

  protected override async callRemoteApi(options: {
    module: IE2EEServerApiKeys;
    method: string;
    params: any[];
  }): Promise<any> {
    const { module, method, params } = options;
    const message = {
      module: module as any,
      method,
      params,
    };

    return this.bridge.request({
      data: message,
      // scope,
      // remoteId,
    });
  }

  roomManager: RoomManager =
    this._createProxyModule<IE2EEServerApiKeys>('roomManager');
}

export function createE2EEServerApiProxy({ socket }: { socket: Socket }) {
  return new E2EEServerApiProxy({
    socket,
  });
}
