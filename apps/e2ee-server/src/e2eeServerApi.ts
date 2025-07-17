/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
/* eslint-disable new-cap */

import { JsBridgeE2EEServer } from './JsBridgeE2EEServer';
import { memoizee } from './utils/cacheUtils';
import { buildCallRemoteApiMethod } from './utils/RemoteApiProxyBase';

import type { IRoomManagerContext, RoomManager } from './roomManager';
import type { IE2EEServerApiKeys } from './types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

function createBridgeE2EEServer({
  socketClient,
  roomManager,
}: {
  socketClient: Socket;
  roomManager: RoomManager;
}) {
  const createE2EEServerApiModule = memoizee(
    async (name: IE2EEServerApiKeys) => {
      if (name === 'roomManager') {
        return roomManager;
      }
      throw new Error(`Unknown E2EE Server API module: ${name as string}`);
    },
    {
      promise: true,
    },
  );

  const context: IRoomManagerContext = { socketClient };

  const callE2EEServerApiMethod = buildCallRemoteApiMethod(
    createE2EEServerApiModule,
    'e2eeServerApi',
    context,
  );

  return new JsBridgeE2EEServer(
    {
      receiveHandler: async (payload) => {
        const req: IJsonRpcRequest = payload.data as IJsonRpcRequest;

        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const result = await callE2EEServerApiMethod(req);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      },
    },
    {
      socketClient,
    },
  );
}

export function e2eeServerApiSetup({
  socketClient,
  roomManager,
}: {
  socketClient: Socket;
  roomManager: RoomManager;
}) {
  const bridge = createBridgeE2EEServer({
    socketClient,
    roomManager,
  });
  return bridge;
}
