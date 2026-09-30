import { EventEmitter } from 'events';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { E2EEClientToClientApiProxy } from './e2eeClientToClientApiProxy';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test.each([true, false])(
  'peer cancellation checks the latest owner after readiness, current=%s',
  async (stillCurrent) => {
    const socket = new EventEmitter();
    const proxy = new E2EEClientToClientApiProxy({
      // Exercise the real proxy and bridge using only the Socket.IO event surface.
      socket: socket as unknown as Socket,
      roomId: 'fixture-room',
    });
    const sent: Array<{ roomId: string; payload: IJsBridgeMessagePayload }> =
      [];
    socket.on('e2ee-c2c-request', (packet: (typeof sent)[number]) => {
      sent.push(packet);
      if (packet.payload.id === undefined) {
        throw new OneKeyLocalError('Expected a request ID');
      }
      proxy.bridge.resolveCallback(packet.payload.id, undefined);
    });
    const ready = deferred();
    jest.spyOn(proxy, 'waitRemoteApiReady').mockReturnValueOnce(ready.promise);
    let current = true;
    const isCurrent = jest.fn(() => current);
    const cancelling = proxy.cancelTransferIfCurrent(isCurrent);
    expect(isCurrent).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
    current = stillCurrent;
    ready.resolve();
    await cancelling;
    expect(isCurrent).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(stillCurrent ? 1 : 0);
    if (stillCurrent) {
      expect(sent[0]).toMatchObject({
        roomId: 'fixture-room',
        payload: {
          data: { module: 'api', method: 'cancelTransfer', params: [] },
        },
      });
    }
  },
);
