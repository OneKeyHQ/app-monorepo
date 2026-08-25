import { PrimeSubscriptionScene } from './subscription';

function createSceneWithSpy() {
  const scene = new PrimeSubscriptionScene();
  const emitLog = jest
    .spyOn(scene, '_emitLog')
    .mockImplementation(() => undefined);
  return { scene, emitLog };
}

describe('PrimeSubscriptionScene OneKey ID auth failure logging', () => {
  it('keeps scrubbed text local and sends only structured fields to server', () => {
    const { scene, emitLog } = createSceneWithSpy();
    const secret = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456';
    const requestId = '3f8a1c92-7d4e-4b16-9c0a-5e2b7f13a840';

    scene.onekeyIdLoginFailedReason({
      reason: `OneKey ID is already logged in name=OneKeyLocalError message=${secret} code=auth_conflict status=409 requestId=${requestId}`,
    });

    const localCall = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'onekeyIdAuthFailureLocal',
    );
    const serverCall = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'onekeyIdLoginFailedReason',
    );
    expect(localCall?.[1]).toEqual([
      {
        source: 'throwSite',
        reason:
          'OneKey ID is already logged in name=OneKeyLocalError message=[credential] code=auth_conflict status=409 requestId=3f8a1c92-7d4e-4b16-9c0a-5e2b7f13a840',
      },
    ]);
    expect(localCall?.[2]).toEqual([
      expect.objectContaining({ type: 'local', level: 'error' }),
    ]);
    expect(serverCall?.[1]).toEqual([
      {
        source: 'throwSite',
        category: 'alreadyLoggedIn',
        errorName: 'OneKeyLocalError',
        errorCode: 'auth_conflict',
        httpStatusCode: 409,
        requestId,
      },
    ]);
    expect(serverCall?.[2]).toEqual([
      expect.objectContaining({ type: 'server' }),
    ]);
    expect(JSON.stringify(serverCall)).not.toContain(secret);
    expect(serverCall?.[1]?.[0]).not.toHaveProperty('reason');
  });
});

describe('PrimeSubscriptionScene sanitized event payloads', () => {
  it('strips url query/hash and scrubs the message on onekeyIdInvalidToken', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.onekeyIdInvalidToken({
      url: 'https://api.example.com/prime/v1/user/info?token=SeCrEtValue123#frag',
      errorCode: 401,
      errorMessage:
        'request rejected Bearer AbCdEfGhIjKlMnOpQrStUvWxYz123456 for user@example.com',
    });

    const call = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'onekeyIdInvalidToken',
    );
    const payload = call?.[1]?.[0] as {
      url: string;
      errorMessage: string;
    };
    expect(payload.url).toBe('https://api.example.com/prime/v1/user/info');
    expect(payload.errorMessage).not.toContain('SeCrEtValue123');
    expect(payload.errorMessage).not.toContain('user@example.com');
    expect(payload.errorMessage).toContain('Bearer [token]');
  });

  it('scrubs the store error message on fetchPackagesFailed', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.fetchPackagesFailed({
      errorMessage: 'store failed for user@example.com',
    });

    const call = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'fetchPackagesFailed',
    );
    const payload = call?.[1]?.[0] as { errorMessage: string };
    expect(payload.errorMessage).toBe('store failed for [email]');
  });

  it('sends structured primeSubscribeFailed to server and keeps the message local', () => {
    const { scene, emitLog } = createSceneWithSpy();
    const rawMessage = 'card declined for user@example.com';

    scene.primeSubscribeFailed({
      paymentMethod: 'iap',
      subscriptionPeriod: 'P1Y',
      reason: 'paymentFailed',
      errorCode: '2',
      errorMessage: rawMessage,
    });

    const serverCall = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'primeSubscribeFailed',
    );
    const localCall = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'primeSubscribeFailedLocal',
    );
    expect(serverCall?.[1]).toEqual([
      {
        paymentMethod: 'iap',
        subscriptionPeriod: 'P1Y',
        featureName: undefined,
        reason: 'paymentFailed',
        errorCode: '2',
      },
    ]);
    expect(serverCall?.[2]).toEqual([
      expect.objectContaining({ type: 'server' }),
    ]);
    expect(JSON.stringify(serverCall)).not.toContain('errorMessage');
    expect(localCall?.[2]).toEqual([
      expect.objectContaining({ type: 'local', level: 'error' }),
    ]);
    const localPayload = localCall?.[1]?.[0] as { errorMessage: string };
    expect(localPayload.errorMessage).toBe('card declined for [email]');
  });

  it('keeps onekeyIdStateTrace local-only and scrubs free-text reasons', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.onekeyIdStateTrace({
      reason:
        'setPrimePersistAtomNotLoggedIn failed for user@example.com Bearer AbCdEfGhIjKlMnOpQrStUvWxYz123456',
    });

    const call = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'onekeyIdStateTrace',
    );
    const payload = call?.[1]?.[0] as { reason: string };
    expect(payload.reason).toContain('[email]');
    expect(payload.reason).toContain('Bearer [token]');
    expect(payload.reason).not.toContain('user@example.com');
    expect(call?.[2]).toEqual([expect.objectContaining({ type: 'local' })]);
    expect(
      (call?.[2] as { type: string }[]).some((c) => c.type === 'server'),
    ).toBe(false);
  });

  it('sends onekeyIdIdentityLinked with the onekeyUserId to server', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.onekeyIdIdentityLinked({ onekeyUserId: 'user-uuid-1' });

    const call = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'onekeyIdIdentityLinked',
    );
    expect(call?.[1]).toEqual([{ onekeyUserId: 'user-uuid-1' }]);
    expect(call?.[2]).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'server' })]),
    );
  });
});
