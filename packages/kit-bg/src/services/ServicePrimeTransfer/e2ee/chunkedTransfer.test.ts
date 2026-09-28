import { Buffer } from 'buffer';

import {
  PRIME_TRANSFER_CHUNK_SIZE,
  PRIME_TRANSFER_CHUNK_TIMEOUT,
  PRIME_TRANSFER_MAX_PAYLOAD_SIZE,
} from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';
import type { IPrimeTransferChunkAck } from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

import {
  PrimeTransferChunkReceiver,
  isValidPrimeTransferChunkData,
  sendPrimeTransferChunks,
  waitForTransferRequest,
} from './chunkedTransfer';

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class extends Error {},
}));

describe('Prime Transfer chunk transport', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('reassembles out-of-order chunks and counts retransmissions only once', () => {
    const data = 'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE + 4);
    const receiver = new PrimeTransferChunkReceiver({
      transferId: 'test-1',
      totalBytes: data.length,
    });
    const tail = {
      transferId: 'test-1',
      index: 1,
      data: data.slice(PRIME_TRANSFER_CHUNK_SIZE),
    };
    expect(receiver.receive(tail).receivedBytes).toBe(4);
    expect(receiver.receive(tail).receivedBytes).toBe(4);
    expect(() => receiver.complete()).toThrow('incomplete');
    receiver.receive({
      transferId: 'test-1',
      index: 0,
      data: data.slice(0, PRIME_TRANSFER_CHUNK_SIZE),
    });
    expect(receiver.complete()).toBe(data);
  });

  test('rejects invalid manifests, foreign chunks, invalid sizes and conflicting duplicates', () => {
    for (const totalBytes of [
      0,
      -1,
      1,
      2,
      3,
      6,
      NaN,
      Infinity,
      1.5,
      PRIME_TRANSFER_MAX_PAYLOAD_SIZE + 1,
    ]) {
      expect(
        () =>
          new PrimeTransferChunkReceiver({ transferId: 'test-1', totalBytes }),
      ).toThrow();
    }
    const receiver = new PrimeTransferChunkReceiver({
      transferId: 'test-1',
      totalBytes: 4,
    });
    for (const chunk of [
      { transferId: 'old', index: 0, data: 'AAAA' },
      { transferId: 'test-1', index: -1, data: 'AAAA' },
      { transferId: 'test-1', index: 1, data: 'AAAA' },
      { transferId: 'test-1', index: 0, data: 'AAA' },
      { transferId: 'test-1', index: 0, data: '私钥私钥' },
    ])
      expect(() => receiver.receive(chunk)).toThrow();
    receiver.receive({ transferId: 'test-1', index: 0, data: 'AAAA' });
    expect(() =>
      receiver.receive({ transferId: 'test-1', index: 0, data: 'BBBB' }),
    ).toThrow('Conflicting');
  });

  test('canonical padding validation matches Base64 round trips for every final sextet', () => {
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (const char of alphabet) {
      for (const data of [`A${char}==`, `AA${char}=`]) {
        const canonical =
          Buffer.from(data, 'base64').toString('base64') === data;
        expect(isValidPrimeTransferChunkData(data)).toBe(canonical);
        const receiver = new PrimeTransferChunkReceiver({
          transferId: 'padding',
          totalBytes: 4,
        });
        if (canonical) {
          receiver.receive({ transferId: 'padding', index: 0, data });
          expect(receiver.complete()).toBe(data);
        } else {
          expect(() =>
            receiver.receive({ transferId: 'padding', index: 0, data }),
          ).toThrow('Invalid transfer chunk');
          expect(receiver.receivedBytes).toBe(0);
        }
      }
    }
  });

  test.each([49_151, 49_152, 49_153, 49_154])(
    'real Base64 across the 64 KiB boundary reassembles without changing bytes: %s',
    (length) => {
      const source = Buffer.alloc(length, 0xaf);
      const rawData = source.toString('base64');
      const receiver = new PrimeTransferChunkReceiver({
        transferId: 'boundary',
        totalBytes: rawData.length,
      });
      const count = Math.ceil(rawData.length / PRIME_TRANSFER_CHUNK_SIZE);
      for (let index = count - 1; index >= 0; index -= 1) {
        receiver.receive({
          transferId: 'boundary',
          index,
          data: rawData.slice(
            index * PRIME_TRANSFER_CHUNK_SIZE,
            (index + 1) * PRIME_TRANSFER_CHUNK_SIZE,
          ),
        });
      }
      expect(Buffer.from(receiver.complete(), 'base64')).toEqual(source);
    },
  );

  test('padding in a non-final chunk is rejected before storing or reporting progress', () => {
    const receiver = new PrimeTransferChunkReceiver({
      transferId: 'interior',
      totalBytes: PRIME_TRANSFER_CHUNK_SIZE + 4,
    });
    expect(() =>
      receiver.receive({
        transferId: 'interior',
        index: 0,
        data: `${'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE - 4)}AA==`,
      }),
    ).toThrow('Invalid transfer chunk');
    expect(receiver.receivedBytes).toBe(0);
    receiver.receive({
      transferId: 'interior',
      index: 0,
      data: 'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE),
    });
    receiver.receive({ transferId: 'interior', index: 1, data: 'AA==' });
    expect(receiver.complete()).toBe(
      `${'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE)}AA==`,
    );
  });

  test('both endpoints progress only when data arrives and acknowledgements return', async () => {
    const rawData = 'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE * 7 + 4);
    const receiver = new PrimeTransferChunkReceiver({
      transferId: 'slow',
      totalBytes: rawData.length,
    });
    const onProgress = jest.fn();
    let inFlight = 0;
    let maxInFlight = 0;
    const send = sendPrimeTransferChunks({
      rawData,
      transferId: 'slow',
      signal: new AbortController().signal,
      onProgress,
      sendChunk: (chunk) =>
        new Promise<IPrimeTransferChunkAck>((resolve) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          setTimeout(() => {
            const ack = receiver.receive(chunk);
            setTimeout(() => {
              inFlight -= 1;
              resolve(ack);
            }, 100);
          }, 1000);
        }),
    });
    expect(onProgress).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(receiver.receivedBytes).toBe(PRIME_TRANSFER_CHUNK_SIZE * 4);
    expect(onProgress).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(100);
    expect(onProgress).toHaveBeenLastCalledWith(PRIME_TRANSFER_CHUNK_SIZE * 4);
    await jest.runAllTimersAsync();
    await send;
    expect(maxInFlight).toBe(4);
    expect(onProgress).toHaveBeenLastCalledWith(rawData.length);
    expect(receiver.complete()).toBe(rawData);
  });

  test('cancellation ignores late acknowledgements and does not schedule more chunks', async () => {
    const controller = new AbortController();
    const onProgress = jest.fn();
    const sendChunk = jest.fn(
      (chunk) =>
        new Promise<IPrimeTransferChunkAck>((resolve) => {
          setTimeout(
            () =>
              resolve({
                transferId: chunk.transferId,
                index: chunk.index,
                receivedBytes: chunk.data.length,
              }),
            1000,
          );
        }),
    );
    const send = sendPrimeTransferChunks({
      rawData: 'A'.repeat(PRIME_TRANSFER_CHUNK_SIZE * 10),
      transferId: 'cancel',
      signal: controller.signal,
      onProgress,
      sendChunk,
    });
    const result = send.catch((error: unknown) => error);
    controller.abort();
    await jest.runAllTimersAsync();
    expect(await result).toEqual(new Error('Transfer cancelled'));
    expect(sendChunk).toHaveBeenCalledTimes(4);
    expect(onProgress).not.toHaveBeenCalled();
  });

  test('rejects a foreign acknowledgement without reporting successful bytes', async () => {
    const onProgress = jest.fn();
    await expect(
      sendPrimeTransferChunks({
        rawData: 'AAAA',
        transferId: 'new',
        signal: new AbortController().signal,
        onProgress,
        sendChunk: async () => ({
          transferId: 'old',
          index: 0,
          receivedBytes: 4,
        }),
      }),
    ).rejects.toThrow('acknowledgement');
    expect(onProgress).not.toHaveBeenCalled();
  });

  test('requests time out or abort promptly and release their timers', async () => {
    const controller = new AbortController();
    const never = new Promise<void>(() => undefined);
    const aborted = waitForTransferRequest(never, controller.signal).catch(
      (error: unknown) => error,
    );
    controller.abort();
    expect(await aborted).toEqual(new Error('Transfer cancelled'));
    expect(jest.getTimerCount()).toBe(0);
    const timedOut = waitForTransferRequest(
      never,
      new AbortController().signal,
    ).catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(PRIME_TRANSFER_CHUNK_TIMEOUT);
    expect(await timedOut).toEqual(new Error('Transfer timed out'));
    expect(jest.getTimerCount()).toBe(0);
  });
});
