import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

import { IJsBridgeMessageTypes } from '@onekeyfe/cross-inpage-provider-types';

import { PRIME_TRANSFER_MAX_PAYLOAD_SIZE } from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

import { JsBridgeE2EEClientToClient } from './JsBridgeE2EEClientToClient';
import {
  DEFAULT_TRANSFER_MESSAGE_SIZE,
  assertLegacyTransferPacketSize,
  assertTransferSize,
  getTransferMessageLimit,
} from './transferSize';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type { Socket } from 'socket.io';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/errors/errors/appErrors', () => ({
  RequestLimitExceededError: Error,
  TransferInvalidCodeError: Error,
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    transfer_data_too_large__msg: 'transfer_data_too_large__msg',
  },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: (
        _message: unknown,
        values: { size: string; limit: string },
      ) => `Transfer too large: ${values.size}; limit ${values.limit}`,
    },
  },
}));

const roomId = 'test-room';
const packet = (rawData: string): IJsBridgeMessagePayload => ({
  id: 1,
  type: IJsBridgeMessageTypes.REQUEST,
  remoteId: 42,
  origin: 'https://例子.test',
  peerOrigin: 'quoted"origin',
  data: { module: 'api', method: 'sendTransferData', params: [{ rawData }] },
});

test.each([undefined, 0, -1, NaN, Infinity, 1.5])(
  'old or invalid relay limits use the existing default: %s',
  (value) =>
    expect(getTransferMessageLimit(value)).toBe(DEFAULT_TRANSFER_MESSAGE_SIZE),
);

test('an advertised deployment limit is used without capping it at the old default', () => {
  expect(getTransferMessageLimit(20 * 1024 * 1024)).toBe(20 * 1024 * 1024);
  expect(getTransferMessageLimit(512 * 1024)).toBe(512 * 1024);
});

test.each(['A'.repeat(8192), '中文😀"\\\n'])(
  'preflight counts the complete encoded packet exactly: %#',
  (rawData) => {
    const payload = packet(rawData);
    const bytes = Buffer.byteLength(
      `42${JSON.stringify(['e2ee-c2c-request', { roomId, payload }])}`,
    );
    expect(() =>
      assertLegacyTransferPacketSize({
        roomId,
        payload,
        maxMessageSize: bytes,
      }),
    ).not.toThrow();
    expect(() =>
      assertLegacyTransferPacketSize({
        roomId,
        payload,
        maxMessageSize: bytes - 1,
      }),
    ).toThrow('Transfer too large');
    expect(() =>
      assertLegacyTransferPacketSize({
        roomId,
        payload,
        maxMessageSize: rawData.length + 10,
      }),
    ).toThrow('Transfer too large');
  },
);

test('the chunk total is accepted at the limit and rejected before a larger transfer', () => {
  expect(() =>
    assertTransferSize(
      PRIME_TRANSFER_MAX_PAYLOAD_SIZE,
      PRIME_TRANSFER_MAX_PAYLOAD_SIZE,
    ),
  ).not.toThrow();
  expect(() =>
    assertTransferSize(
      PRIME_TRANSFER_MAX_PAYLOAD_SIZE + 1,
      PRIME_TRANSFER_MAX_PAYLOAD_SIZE,
    ),
  ).toThrow('Transfer too large: 64.01 MiB; limit 64 MiB');
});

test('the real sender bridge emits no wallet packet when preflight fails', async () => {
  const socket = new EventEmitter();
  const emit = jest.spyOn(socket, 'emit');
  const bridge = new JsBridgeE2EEClientToClient(
    {},
    {
      socket: socket as unknown as Socket,
      roomId,
      isProxySide: true,
      maxMessageSize: 1024,
    },
  );
  await expect(
    bridge.request({ data: packet('A'.repeat(2048)).data }),
  ).rejects.toThrow('Transfer too large');
  expect(emit).not.toHaveBeenCalled();
  bridge.sendPayload(packet('AAAA'));
  expect(emit).toHaveBeenCalledWith('e2ee-c2c-request', expect.any(Object));
});

test('legacy bridges without limit metadata preserve a valid large transfer', () => {
  const socket = new EventEmitter();
  const bridge = new JsBridgeE2EEClientToClient(
    {},
    { socket: socket as unknown as Socket, roomId, isProxySide: true },
  );
  const emit = jest.spyOn(socket, 'emit');
  bridge.sendPayload(packet('A'.repeat(9 * 1024 * 1024)));
  expect(emit).toHaveBeenCalledTimes(1);
  expect(() =>
    bridge.sendPayload(packet('A'.repeat(DEFAULT_TRANSFER_MESSAGE_SIZE))),
  ).toThrow('Transfer too large');
  expect(emit).toHaveBeenCalledTimes(1);
});
