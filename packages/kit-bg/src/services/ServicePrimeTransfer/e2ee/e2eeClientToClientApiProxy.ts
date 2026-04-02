/* eslint-disable no-restricted-syntax */

import { RemoteApiProxyBase } from '../../../apis/RemoteApiProxyBase';

import { JsBridgeE2EEClientToClient } from './JsBridgeE2EEClientToClient';

import type {
  E2EEClientToClientApi,
  IE2EEClientToClientApi,
  IE2EEClientToClientApiKeys,
} from './e2eeClientToClientApi';
import type { Socket } from 'socket.io';

export class E2EEClientToClientApiProxy
  extends RemoteApiProxyBase
  implements IE2EEClientToClientApi
{
  constructor({ socket, roomId }: { socket: Socket; roomId: string }) {
    super();
    this.bridge = new JsBridgeE2EEClientToClient(
      {},
      { socket, roomId, isProxySide: true },
    );
  }

  bridge: JsBridgeE2EEClientToClient;

  override checkEnvAvailable(): void {
    // do nothing
  }

  override async waitRemoteApiReady(): Promise<void> {
    return Promise.resolve();
  }

  protected override async callRemoteApi(options: {
    module: IE2EEClientToClientApiKeys;
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

  api: E2EEClientToClientApi =
    this._createProxyModule<IE2EEClientToClientApiKeys>('api');
}

export function createE2EEClientToClientApiProxy({
  socket,
  roomId,
}: {
  socket: Socket;
  roomId: string;
}) {
  return new E2EEClientToClientApiProxy({
    socket,
    roomId,
  });
}
