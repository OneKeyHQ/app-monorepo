import { PrimeSubscriptionScene } from './subscription';

describe('PrimeSubscriptionScene OneKey ID auth failure logging', () => {
  it('keeps scrubbed text local and sends only structured fields to server', () => {
    const scene = new PrimeSubscriptionScene();
    const emitLog = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
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
