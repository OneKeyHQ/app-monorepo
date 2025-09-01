import type { IE2EESocketUserInfo } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { RemoteApiProxyBase } from '../../../apis/RemoteApiProxyBase';

import { JsBridgeE2EEClient } from './JsBridgeE2EEClient';
import transferErrors from './transferErrors';

import type { Socket } from 'socket.io-client';

interface IRoomManager {
  createRoom(): Promise<{ roomId: string }>;

  joinRoom(params: {
    roomId: string;
    appPlatformName: string;
    appVersion: string;
    appBuildNumber: string;
    appPlatform: string;
    appDeviceName: string;
  }): Promise<{ roomId: string; userId: string }>;

  joinRoomAfterCreate(params: {
    roomId: string;
    appPlatformName: string;
    appVersion: string;
    appBuildNumber: string;
    appPlatform: string;
    appDeviceName: string;
  }): Promise<{ roomId: string; userId: string }>;

  leaveRoom(params: {
    roomId: string;
    userId: string;
  }): Promise<{ roomId: string }>;

  getRoomUsers(params: { roomId: string }): Promise<IE2EESocketUserInfo[]>;

  startTransfer(params: {
    roomId: string;
    fromUserId: string;
    toUserId: string;
  }): Promise<{ roomId: string }>;

  cancelTransfer(params: {
    roomId: string;
    userId: string;
  }): Promise<{ roomId: string }>;
}

interface IE2EEServerApi {
  roomManager: IRoomManager;
}
type IE2EEServerApiKeys = keyof IE2EEServerApi;

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

    try {
      const result = await this.bridge.request({
        data: message,
        // scope,
        // remoteId,
      });
      return result;
    } catch (error) {
      const e = transferErrors.convertToLocalError(error);
      // throw error;
      throw e;
    }
  }

  roomManager: IRoomManager =
    this._createProxyModule<IE2EEServerApiKeys>('roomManager');
}

export function createE2EEServerApiProxy({ socket }: { socket: Socket }) {
  return new E2EEServerApiProxy({
    socket,
  });
}
