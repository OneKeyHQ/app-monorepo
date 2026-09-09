import {
  ASYNC_STORAGE_WRITE_FORWARDER_STATUS_KEY_PREFIX,
  type IAsyncStorageWriteForwarderRequestStatus,
  buildAsyncStorageWriteForwarderStatusKey,
  parseAsyncStorageWriteForwarderRequestStatus,
  serializeAsyncStorageWriteForwarderRequestStatus,
} from './asyncStorageWriteForwarderTypes';

// These pure helpers back the cross-runtime request-status fence that keeps the
// AsyncStorage write forwarder's timeout/bg-restart replay safe. If parsing ever
// silently accepts malformed status, a stale/garbage SharedStore entry could be
// read as `committed` (dropping a real write) or as `pending` (an unsafe replay).
describe('asyncStorageWriteForwarderTypes status fence', () => {
  const validStatus: IAsyncStorageWriteForwarderRequestStatus = {
    requestId: 'runtime-abc-1',
    status: 'pending',
    bootId: 'boot-1',
    ts: 1_700_000_000_000,
  };

  it('builds a namespaced, collision-resistant status key', () => {
    expect(buildAsyncStorageWriteForwarderStatusKey('runtime-abc-1')).toBe(
      `${ASYNC_STORAGE_WRITE_FORWARDER_STATUS_KEY_PREFIX}runtime-abc-1`,
    );
    // Distinct requestIds must map to distinct keys.
    expect(buildAsyncStorageWriteForwarderStatusKey('a')).not.toBe(
      buildAsyncStorageWriteForwarderStatusKey('b'),
    );
  });

  it('round-trips a valid status (with bootId)', () => {
    const serialized =
      serializeAsyncStorageWriteForwarderRequestStatus(validStatus);
    expect(parseAsyncStorageWriteForwarderRequestStatus(serialized)).toEqual(
      validStatus,
    );
  });

  it('round-trips a valid status (without optional bootId)', () => {
    const status: IAsyncStorageWriteForwarderRequestStatus = {
      requestId: 'runtime-abc-2',
      status: 'committed',
      ts: 1_700_000_000_001,
    };
    const serialized = serializeAsyncStorageWriteForwarderRequestStatus(status);
    expect(parseAsyncStorageWriteForwarderRequestStatus(serialized)).toEqual(
      status,
    );
  });

  it.each(['pending', 'executing', 'committed'] as const)(
    'accepts the "%s" status value',
    (status) => {
      const serialized = serializeAsyncStorageWriteForwarderRequestStatus({
        ...validStatus,
        status,
      });
      expect(
        parseAsyncStorageWriteForwarderRequestStatus(serialized)?.status,
      ).toBe(status);
    },
  );

  it('returns undefined for non-string SharedStore values', () => {
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(undefined),
    ).toBeUndefined();
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(1 as never),
    ).toBeUndefined();
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(true as never),
    ).toBeUndefined();
  });

  it('returns undefined for non-JSON / malformed strings', () => {
    expect(
      parseAsyncStorageWriteForwarderRequestStatus('not json'),
    ).toBeUndefined();
    expect(parseAsyncStorageWriteForwarderRequestStatus('')).toBeUndefined();
    expect(
      parseAsyncStorageWriteForwarderRequestStatus('null'),
    ).toBeUndefined();
  });

  it('rejects an unknown status enum value', () => {
    const serialized = JSON.stringify({
      requestId: 'runtime-abc-1',
      status: 'done',
      ts: 1,
    });
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(serialized),
    ).toBeUndefined();
  });

  it('rejects a missing / wrong-typed requestId', () => {
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(
        JSON.stringify({ status: 'pending', ts: 1 }),
      ),
    ).toBeUndefined();
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(
        JSON.stringify({ requestId: 123, status: 'pending', ts: 1 }),
      ),
    ).toBeUndefined();
  });

  it('rejects a missing / wrong-typed ts', () => {
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(
        JSON.stringify({ requestId: 'x', status: 'pending' }),
      ),
    ).toBeUndefined();
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(
        JSON.stringify({ requestId: 'x', status: 'pending', ts: '1' }),
      ),
    ).toBeUndefined();
  });

  it('rejects a non-string bootId when present', () => {
    expect(
      parseAsyncStorageWriteForwarderRequestStatus(
        JSON.stringify({
          requestId: 'x',
          status: 'pending',
          ts: 1,
          bootId: 42,
        }),
      ),
    ).toBeUndefined();
  });
});
