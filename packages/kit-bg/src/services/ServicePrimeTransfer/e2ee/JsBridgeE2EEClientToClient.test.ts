import { EventEmitter } from 'events';

import { IJsBridgeMessageTypes } from '@onekeyfe/cross-inpage-provider-types';

import {
  PRIME_TRANSFER_CHUNK_SIZE,
  PRIME_TRANSFER_MAX_CHUNKS,
} from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

import { JsBridgeE2EEClientToClient } from './JsBridgeE2EEClientToClient';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: { global_request_limit: 'global.request_limit' },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: () => 'Requests too frequent' } },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/errors/errors/appErrors', () => ({
  RequestLimitExceededError: Error,
  TransferInvalidCodeError: Error,
}));

const validChunk = { transferId: 'test-transfer', index: 0, data: 'AAAA' };
let socketSequence = 0;

function createReceiver() {
  socketSequence += 1;
  const socket = Object.assign(new EventEmitter(), {
    id: `chunk-errors-${socketSequence}`,
  });
  const receiveHandler = jest.fn(async () => 'accepted');
  const bridge = new JsBridgeE2EEClientToClient(
    { receiveHandler },
    {
      // Only the Socket.IO event surface is needed; the real bridge handles errors.
      socket: socket as unknown as Socket,
      roomId: 'test-room',
      isProxySide: false,
    },
  );
  const responses: Array<{ roomId: string; payload: IJsBridgeMessagePayload }> =
    [];
  socket.on('e2ee-c2c-response', (response) => responses.push(response));
  const send = (params: unknown[], method = 'sendTransferChunk', id = 1) => {
    socket.emit('e2ee-c2c-request', {
      id,
      type: IJsBridgeMessageTypes.REQUEST,
      scope: 'test-scope',
      remoteId: 'test-remote',
      peerOrigin: 'test-origin',
      data: { module: 'api', method, params },
    });
  };
  return { bridge, send, responses, receiveHandler };
}

describe('Prime Transfer client bridge errors', () => {
  beforeEach(() => jest.useFakeTimers({ now: 10_000 }));
  afterEach(() => jest.useRealTimers());

  test.each(
    [
      [],
      [null],
      [validChunk, validChunk],
      [{ ...validChunk, extra: true }],
      [{ ...validChunk, transferId: '' }],
      [{ ...validChunk, index: -1 }],
      [{ ...validChunk, index: PRIME_TRANSFER_MAX_CHUNKS }],
      [{ ...validChunk, data: '' }],
      [{ ...validChunk, data: '!' }],
      [{ ...validChunk, data: 'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE + 1) }],
    ].map((params) => ({ params })),
  )('invalid chunk parameters return 1001: %#', ({ params }) => {
    const { send, responses, receiveHandler } = createReceiver();
    send(params, 'sendTransferChunk', 0);
    expect(receiveHandler).not.toHaveBeenCalled();
    expect(responses).toEqual([
      {
        roomId: 'test-room',
        payload: expect.objectContaining({
          id: 0,
          type: IJsBridgeMessageTypes.RESPONSE,
          scope: 'test-scope',
          remoteId: 'test-remote',
          peerOrigin: 'test-origin',
          error: expect.objectContaining({
            code: 1001,
            message: 'Invalid transfer chunk',
          }),
        }),
      },
    ]);
  });

  test('valid chunk floods return 1100, while malformed chunks remain parameter errors', () => {
    const { send, responses, receiveHandler } = createReceiver();
    for (let id = 1; id <= 512; id += 1)
      send([validChunk], 'sendTransferChunk', id);
    expect(receiveHandler).toHaveBeenCalledTimes(512);
    send([validChunk], 'sendTransferChunk', 513);
    expect(responses.at(-1)?.payload.error).toMatchObject({
      code: 1100,
      message: 'Requests too frequent',
    });
    send([{ ...validChunk, data: '' }]);
    expect(responses.at(-1)?.payload.error).toMatchObject({ code: 1001 });
    jest.setSystemTime(11_000);
    send([validChunk]);
    expect(receiveHandler).toHaveBeenCalledTimes(513);
  });

  test('invalid chunks do not consume the valid-chunk allowance', () => {
    const { send, receiveHandler } = createReceiver();
    for (let id = 1; id <= 512; id += 1)
      send([{ ...validChunk, data: '' }], 'sendTransferChunk', id);
    send([validChunk]);
    expect(receiveHandler).toHaveBeenCalledTimes(1);
  });

  test('ordinary method throttling returns 1100 and whitelisted calls remain allowed', () => {
    const { send, responses, receiveHandler } = createReceiver();
    send([], 'hello');
    send([], 'hello', 2);
    expect(receiveHandler).toHaveBeenCalledTimes(1);
    expect(responses.at(-1)?.payload.error).toMatchObject({ code: 1100 });
    send([], 'cancelTransfer', 3);
    send([], 'cancelTransfer', 4);
    expect(receiveHandler).toHaveBeenCalledTimes(3);
  });
});
