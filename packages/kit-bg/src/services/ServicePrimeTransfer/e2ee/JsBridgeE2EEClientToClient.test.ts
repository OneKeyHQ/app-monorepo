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
      ...[
        '=',
        'A',
        'A=',
        'AA',
        'AAA',
        '====',
        'A===',
        'AA=A',
        'AA==AAAA',
        'AB==',
        'AAB=',
      ].map((data) => [{ ...validChunk, data }]),
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

  test('valid chunk floods return one 1100 per window before dropping further chunks', () => {
    const { send, responses, receiveHandler } = createReceiver();
    for (let id = 1; id <= 512; id += 1)
      send([validChunk], 'sendTransferChunk', id);
    expect(receiveHandler).toHaveBeenCalledTimes(512);
    send([validChunk], 'sendTransferChunk', 513);
    expect(responses.at(-1)?.payload.error).toMatchObject({
      code: 1100,
      message: 'Requests too frequent',
    });
    const responseCount = responses.length;
    send([{ ...validChunk, data: '' }]);
    send([validChunk]);
    expect(responses).toHaveLength(responseCount);
    expect(receiveHandler).toHaveBeenCalledTimes(512);
    jest.setSystemTime(11_000);
    send([validChunk]);
    expect(receiveHandler).toHaveBeenCalledTimes(513);
  });

  test('invalid chunk floods bound both validation and error replies and recover next window', () => {
    const { send, responses, receiveHandler } = createReceiver();
    const readData = jest.fn(
      () => `${'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE - 1)}!`,
    );
    const malformed = {
      ...validChunk,
      get data() {
        return readData();
      },
    };
    for (let id = 1; id <= 2048; id += 1)
      send([malformed], 'sendTransferChunk', id);
    expect(receiveHandler).not.toHaveBeenCalled();
    expect(readData).toHaveBeenCalledTimes(512);
    expect(responses).toHaveLength(513);
    for (const { payload } of responses.slice(0, 512))
      expect(payload.error).toMatchObject({ code: 1001 });
    expect(responses[512].payload.error).toMatchObject({ code: 1100 });
    jest.setSystemTime(10_999);
    send([validChunk]);
    expect(readData).toHaveBeenCalledTimes(512);
    expect(responses).toHaveLength(513);
    jest.setSystemTime(11_000);
    send([malformed]);
    expect(responses.at(-1)?.payload.error).toMatchObject({ code: 1001 });
    send([validChunk]);
    expect(receiveHandler).toHaveBeenCalledTimes(1);
    expect(readData).toHaveBeenCalledTimes(513);
  });

  test('mixed valid and invalid chunks share one allowance', () => {
    const { send, responses, receiveHandler } = createReceiver();
    for (let id = 1; id <= 512; id += 1)
      send(
        [{ ...validChunk, data: id % 2 === 0 ? 'AAAA' : 'A=' }],
        'sendTransferChunk',
        id,
      );
    expect(receiveHandler).toHaveBeenCalledTimes(256);
    send([validChunk], 'sendTransferChunk', 513);
    expect(responses.at(-1)?.payload.error).toMatchObject({ code: 1100 });
    expect(receiveHandler).toHaveBeenCalledTimes(256);
  });

  test.each([
    'AAAA',
    'AA==',
    'AAA=',
    '/w==',
    '//8=',
    'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE),
  ])('canonical Base64 chunks reach the receiver: %#', (data) => {
    const { send, receiveHandler } = createReceiver();
    send([{ ...validChunk, data }]);
    expect(receiveHandler).toHaveBeenCalledTimes(1);
  });

  test('a flood is isolated to its receiver and does not block cancellation', () => {
    const flooded = createReceiver();
    for (let id = 1; id <= 514; id += 1)
      flooded.send([{ ...validChunk, data: 'A=' }], 'sendTransferChunk', id);
    flooded.send([], 'cancelTransfer');
    expect(flooded.receiveHandler).toHaveBeenCalledTimes(1);
    const other = createReceiver();
    other.send([validChunk]);
    expect(other.receiveHandler).toHaveBeenCalledTimes(1);
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
