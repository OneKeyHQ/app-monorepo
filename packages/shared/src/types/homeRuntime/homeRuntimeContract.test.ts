import {
  HOME_RUNTIME_PROTOCOL_VERSION,
  isHomeRuntimeHandshake,
  isHomeRuntimeJsonValue,
  isHomeRuntimeRequestToken,
  isHomeRuntimeResponseEnvelope,
} from '.';

const requestToken = {
  protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
  clientInstanceId: 'client-fixture-1',
  producerInstanceId: 'producer-fixture-1',
  sessionId: 'session-fixture-1',
  sourceKey: {
    scopeKey: 'scope-fixture-1',
    sourceId: 'portfolio' as const,
    paramsFingerprint: 'params-fixture-1',
    dataSchemaVersion: 1,
    quoteBasis: { currency: 'USD', pricingRevision: 'pricing-fixture-1' },
  },
  requestSeq: 1,
};

describe('Home runtime transport contract', () => {
  it('round-trips the JSON-safe handshake and response envelope', () => {
    const handshake = {
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      producerInstanceId: 'producer-fixture-1',
    };
    const response = {
      token: requestToken,
      result: {
        kind: 'success' as const,
        data: { valueUsd: '12.50', nested: [true, null] },
        coverageFingerprint: 'coverage-fixture-1',
      },
    };

    expect(isHomeRuntimeHandshake(JSON.parse(JSON.stringify(handshake)))).toBe(
      true,
    );
    expect(
      isHomeRuntimeResponseEnvelope(JSON.parse(JSON.stringify(response))),
    ).toBe(true);
  });

  it('rejects missing, unknown, and invalid request identity fields', () => {
    expect(isHomeRuntimeRequestToken(requestToken)).toBe(true);
    expect(
      isHomeRuntimeRequestToken({
        ...requestToken,
        producerInstanceId: undefined,
      }),
    ).toBe(false);
    expect(
      isHomeRuntimeRequestToken({
        ...requestToken,
        protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION + 1,
      }),
    ).toBe(false);
    expect(
      isHomeRuntimeRequestToken({ ...requestToken, requestSeq: null }),
    ).toBe(false);
    expect(
      isHomeRuntimeRequestToken({
        ...requestToken,
        sourceKey: { ...requestToken.sourceKey, sourceId: 'unknown' },
      }),
    ).toBe(false);
  });

  it.each(['capability', 'banner'] as const)(
    'accepts the %s controller source identity',
    (sourceId) => {
      expect(
        isHomeRuntimeRequestToken({
          ...requestToken,
          sourceKey: { ...requestToken.sourceKey, sourceId },
        }),
      ).toBe(true);
    },
  );

  it('accepts JSON null but rejects undefined, non-finite numbers, and dates', () => {
    expect(isHomeRuntimeJsonValue({ nested: [null, 0, 'value'] })).toBe(true);
    expect(isHomeRuntimeJsonValue({ value: undefined })).toBe(false);
    expect(isHomeRuntimeJsonValue(Number.NaN)).toBe(false);
    expect(isHomeRuntimeJsonValue(new Date())).toBe(false);
  });
});
