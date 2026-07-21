import { createHomeRuntimeEnvelope } from '../../runtime/homeRuntimeAdapter';
import { SingleRuntimeHomeAdapter } from '../../runtime/singleRuntimeHomeAdapter';
import { SplitRuntimeHomeAdapter } from '../../runtime/splitRuntimeHomeAdapter';

describe('Home Store runtime gateway conformance', () => {
  it('produces equivalent source authority across single and split runtimes', async () => {
    const producerInstanceId = 'producer-a';
    const clientInstanceId = 'client-a';
    const single = new SingleRuntimeHomeAdapter({
      clientInstanceId,
      producerInstanceId,
    });
    const split = new SplitRuntimeHomeAdapter({
      clientInstanceId,
      getHandshake: async () => ({
        protocolVersion: 1,
        producerInstanceId,
      }),
    });
    await expect(single.connect()).resolves.toEqual(await split.connect());
    const expected = {
      producerInstanceId,
      sessionId: 'session-a',
      requestSeq: 1,
      sourceKey: {
        scopeKey: 'owner-a',
        sourceId: 'portfolio' as const,
        paramsFingerprint: 'portfolio-a',
        dataSchemaVersion: 1,
      },
    };
    const singleToken = single.createRequestToken(expected);
    const splitToken = split.createRequestToken(expected);
    expect(singleToken).toEqual(splitToken);
    const envelope = createHomeRuntimeEnvelope(singleToken, {
      kind: 'success',
      data: { rows: [{ id: 'row-a' }] },
      coverageFingerprint: 'portfolio-complete-a',
    });
    expect(single.validateResponse(envelope, expected)).toEqual({
      accepted: true,
    });
    expect(split.validateResponse(envelope, expected)).toEqual({
      accepted: true,
    });
  });
});
