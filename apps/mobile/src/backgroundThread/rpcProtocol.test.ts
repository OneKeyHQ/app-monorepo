import {
  parseBackgroundThreadJotaiStateBroadcastBatchPayload,
  parseBackgroundThreadMainCapabilitiesPayload,
  parseBackgroundThreadResponse,
  serializeBackgroundThreadJotaiStateBroadcastBatchPayload,
  serializeBackgroundThreadMainCapabilitiesPayload,
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

    // bg → main e2e contract: when JotaiBgSync emits N atom writes in a
    // specific order, the main runtime must fan them out to
    // jotaiUpdateFromUiByBgBroadcast in the same order. This simulates the
    // full path (serialize on bg, parse on main, iterate-and-fanOut on
    // main) without bringing up the RN runtime — it locks down the
    // insertion-order contract that JotaiBgSync.flushBroadcastMicroBatch +
    // setupMainThreadBackgroundRunner.handleBackgroundThreadJotaiStateBatchUpdate
    // promise to derived UI subscribers.
    // bg side opts into the new wire protocol only after main side has
    // advertised support via BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY. This
    // test locks down the round-trip so a future refactor of the wire
    // format can't silently break the capability handshake (and therefore
    // strand the batched bursts on partial-OTA runtimes).
    it('round-trips a main capabilities payload', () => {
      const advertised = { jotaiStateBatch: true };

      const parsed = parseBackgroundThreadMainCapabilitiesPayload(
        serializeBackgroundThreadMainCapabilitiesPayload(advertised),
      );

      expect(parsed).toEqual(advertised);
      expect(parsed?.jotaiStateBatch).toBe(true);
    });

    it('treats a malformed main capabilities payload as undefined', () => {
      expect(
        parseBackgroundThreadMainCapabilitiesPayload('null'),
      ).toBeUndefined();
      expect(
        parseBackgroundThreadMainCapabilitiesPayload('not-json'),
      ).toBeUndefined();
      expect(
        parseBackgroundThreadMainCapabilitiesPayload(undefined),
      ).toBeUndefined();
    });

    it('fans out a batch in insertion order on the main runtime', () => {
      const bgEmittedOrder = [
        { name: 'walletStatusAtom', payload: { connected: true } },
        { name: 'tokenListAtom', payload: { count: 7 } },
        { name: 'accountWorthAtom', payload: { value: '42.0' } },
        { name: 'overviewDeFiDataStateAtom', payload: { isLoading: false } },
      ];

      // bg side: serialize the batch the same way JotaiBgSync's
      // deliverBroadcastBatch → setupBackgroundThreadRPCHandler's
      // broadcastJotaiStateUpdateBatchFromBgToUi would.
      const wireFormat =
        serializeBackgroundThreadJotaiStateBroadcastBatchPayload({
          items: bgEmittedOrder,
        });

      // main side: parse the wire payload (this is what
      // setupMainThreadBackgroundRunner does after sharedRPC.read).
      const parsed =
        parseBackgroundThreadJotaiStateBroadcastBatchPayload(wireFormat);

      expect(parsed).toBeDefined();

      // main side: simulate handleBackgroundThreadJotaiStateBatchUpdate's
      // fan-out loop. The real implementation calls
      // jotaiUpdateFromUiByBgBroadcast for each item — here we capture the
      // call order via a jest.fn proxy.
      const fanOut = jest.fn();
      for (const item of parsed!.items) {
        fanOut({
          $$isFromBgStatesSyncBroadcast: true,
          name: item.name,
          payload: item.payload,
        });
      }

      const fanOutOrder = fanOut.mock.calls.map(
        ([call]) => call.name as string,
      );
      expect(fanOutOrder).toEqual(bgEmittedOrder.map((item) => item.name));

      // Spot-check that the payload survives intact on the last item too,
      // not just the name — guards against silent payload swap if anyone
      // refactors the wire format and breaks the parse-by-position invariant.
      expect(fanOut.mock.calls[fanOutOrder.length - 1][0].payload).toEqual(
        bgEmittedOrder[bgEmittedOrder.length - 1].payload,
      );
    });
  });
});
