import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import {
  type IHomeRuntimeAdapter,
  createHomeRuntimeEnvelope,
} from '../runtime/homeRuntimeAdapter';
import { SingleRuntimeHomeAdapter } from '../runtime/singleRuntimeHomeAdapter';
import { SplitRuntimeHomeAdapter } from '../runtime/splitRuntimeHomeAdapter';

const expected = {
  producerInstanceId: 'producer-1',
  sessionId: 'session-1',
  sourceKey: {
    scopeKey: 'scope-1',
    sourceId: 'portfolio' as const,
    paramsFingerprint: 'params-1',
    dataSchemaVersion: 1,
  },
  requestSeq: 1,
};

function verifyConformance(adapter: IHomeRuntimeAdapter) {
  const token = adapter.createRequestToken(expected);
  const envelope = createHomeRuntimeEnvelope(token, {
    kind: 'success',
    data: { value: '1' },
    coverageFingerprint: 'coverage-1',
  });
  expect(adapter.validateResponse(envelope, expected)).toEqual({
    accepted: true,
  });

  expect(
    adapter.validateResponse(
      { ...envelope, token: { ...token, clientInstanceId: 'other-client' } },
      expected,
    ),
  ).toEqual({ accepted: false, reason: 'clientMismatch' });
  expect(
    adapter.validateResponse(
      { ...envelope, token: { ...token, sessionId: 'other-session' } },
      expected,
    ),
  ).toEqual({ accepted: false, reason: 'sessionMismatch' });
  expect(
    adapter.validateResponse(
      { ...envelope, token: { ...token, requestSeq: 2 } },
      expected,
    ),
  ).toEqual({ accepted: false, reason: 'requestSequenceMismatch' });
  expect(
    adapter.validateResponse(
      { ...envelope, token: { ...token, protocolVersion: 999 } },
      expected,
    ),
  ).toEqual({ accepted: false, reason: 'protocolMismatch' });
}

describe('Home runtime adapters', () => {
  it('uses the same token conformance checks in single and split topologies', () => {
    verifyConformance(
      new SingleRuntimeHomeAdapter({
        clientInstanceId: 'client-1',
        producerInstanceId: 'producer-1',
      }),
    );
    verifyConformance(
      new SplitRuntimeHomeAdapter({
        clientInstanceId: 'client-1',
        getHandshake: async () => ({
          protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
          producerInstanceId: 'producer-1',
        }),
      }),
    );
  });

  it('calls the bg handshake only on split connect and explicit refresh', async () => {
    const getHandshake = jest.fn(async () => ({
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      producerInstanceId: 'producer-1',
    }));
    const split = new SplitRuntimeHomeAdapter({
      clientInstanceId: 'client-1',
      getHandshake,
    });
    await expect(split.connect()).resolves.toMatchObject({
      producerInstanceId: 'producer-1',
    });
    await expect(split.refreshHandshake()).resolves.toMatchObject({
      producerInstanceId: 'producer-1',
    });
    expect(getHandshake).toHaveBeenCalledTimes(2);

    const single = new SingleRuntimeHomeAdapter({
      clientInstanceId: 'client-1',
      producerInstanceId: 'local-producer',
    });
    await expect(single.connect()).resolves.toMatchObject({
      producerInstanceId: 'local-producer',
    });
  });

  it('rejects a malformed split-runtime handshake', async () => {
    const adapter = new SplitRuntimeHomeAdapter({
      getHandshake: async () => ({ producerInstanceId: '' }),
    });
    await expect(adapter.connect()).rejects.toThrow(
      'Invalid Home runtime handshake',
    );
  });
});
