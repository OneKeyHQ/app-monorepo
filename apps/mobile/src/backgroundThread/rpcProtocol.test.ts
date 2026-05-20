import {
  parseBackgroundThreadJotaiStateBroadcastBatchPayload,
  parseBackgroundThreadResponse,
  serializeBackgroundThreadJotaiStateBroadcastBatchPayload,
  serializeBackgroundThreadResponse,
} from './rpcProtocol';

describe('background thread RPC protocol', () => {
  it('preserves error payload metadata across response serialization', () => {
    const payload = {
      connectId: 'CE:1F:0C:F1:CA:A9',
      deviceId: 'device-1',
      params: {
        walletId: 'wallet-1',
      },
    };
    const error = {
      name: 'OneKeyHardwareError',
      message: 'Please enable Passphrase',
      className: 'DeviceNotOpenedPassphrase',
      code: 801,
      payload,
    };

    const response = parseBackgroundThreadResponse(
      serializeBackgroundThreadResponse({
        ok: false,
        error,
      }),
    );

    expect(response?.error?.payload).toEqual(payload);
  });

  describe('jotai batch broadcast payload', () => {
    it('round-trips a multi-item batch preserving order and payload shape', () => {
      const batch = {
        items: [
          { name: 'atomA', payload: { value: 1 } },
          { name: 'atomB', payload: 'string-payload' },
          { name: 'atomC', payload: null },
          { name: 'atomD', payload: [1, 2, 3] },
        ],
      };

      const parsed = parseBackgroundThreadJotaiStateBroadcastBatchPayload(
        serializeBackgroundThreadJotaiStateBroadcastBatchPayload(batch),
      );

      expect(parsed).toEqual(batch);
      // Order matters — derived UI subscribers depend on insertion-order
      // semantics that JotaiBgSync.flushBroadcastMicroBatch promises.
      expect(parsed?.items.map((item) => item.name)).toEqual([
        'atomA',
        'atomB',
        'atomC',
        'atomD',
      ]);
    });

    it('rejects payloads where any item is missing the `name` field', () => {
      // Manually serialize to skip the typed `serialize` helper, which
      // would refuse to compile a malformed payload at the type layer.
      const malformed = JSON.stringify({
        items: [{ name: 'atomA', payload: 1 }, { payload: 'missing name' }],
      });

      expect(
        parseBackgroundThreadJotaiStateBroadcastBatchPayload(malformed),
      ).toBeUndefined();
    });

    it('rejects payloads where items is not an array', () => {
      const malformed = JSON.stringify({ items: 'not-an-array' });

      expect(
        parseBackgroundThreadJotaiStateBroadcastBatchPayload(malformed),
      ).toBeUndefined();
    });

    it('accepts an empty batch (no-op flush case)', () => {
      const batch = { items: [] };

      const parsed = parseBackgroundThreadJotaiStateBroadcastBatchPayload(
        serializeBackgroundThreadJotaiStateBroadcastBatchPayload(batch),
      );

      expect(parsed).toEqual(batch);
    });
  });
});
