import {
  UnwrappedIpcError,
  attachDesktopIpcCallContext,
  unwrapElectronIpcError,
} from '@onekeyhq/shared/src/errors/utils/electronIpcError';
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import { SupabaseStorageTransientError } from '@onekeyhq/shared/src/utils/supabaseAuthErrorUtils';

import { oneKeyIdAuthFailureLogLimiter } from '../oneKeyIdAuthFailureLogLimiter';

import { PrimeSubscriptionScene } from './subscription';

function createSceneWithSpy() {
  const scene = new PrimeSubscriptionScene();
  const emitLog = jest
    .spyOn(scene, '_emitLog')
    .mockImplementation(() => undefined);
  return { scene, emitLog };
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function buildDesktopIpcError({
  method,
  message,
  data,
}: {
  method: string;
  message: string;
  data?: unknown;
}) {
  const wrapped = new Error(
    `Error invoking remote method 'DESKTOP_API_CALL': Error: ${JSON.stringify({
      message,
      data,
    })}`,
  );
  return attachDesktopIpcCallContext(unwrapElectronIpcError(wrapped), {
    module: 'storage',
    method,
  });
}

function getCalls(
  emitLog: ReturnType<typeof createSceneWithSpy>['emitLog'],
  methodName: string,
) {
  return emitLog.mock.calls.filter(([name]) => name === methodName);
}

describe('PrimeSubscriptionScene OneKey ID auth failure logging', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-14T00:00:00.000Z'));
    oneKeyIdAuthFailureLogLimiter.reset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    oneKeyIdAuthFailureLogLimiter.reset();
  });

  it('keeps scrubbed text local and sends a scrubbed reason with structured fields', () => {
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
    const expectedReason =
      'OneKey ID is already logged in name=OneKeyLocalError message=[credential] code=auth_conflict status=409 requestId=3f8a1c92-7d4e-4b16-9c0a-5e2b7f13a840';
    expect(localCall?.[1]).toEqual([
      {
        source: 'throwSite',
        trigger: 'unknown',
        reason: expectedReason,
      },
    ]);
    expect(localCall?.[2]).toEqual([
      expect.objectContaining({ type: 'local', level: 'error' }),
    ]);
    expect(serverCall?.[1]).toEqual([
      {
        source: 'throwSite',
        trigger: 'unknown',
        category: 'alreadyLoggedIn',
        errorName: 'OneKeyLocalError',
        errorCode: 'auth_conflict',
        httpStatusCode: 409,
        requestId,
        reason: expectedReason,
      },
    ]);
    expect(serverCall?.[2]).toEqual([
      expect.objectContaining({ type: 'server' }),
    ]);
    expect(JSON.stringify(serverCall)).not.toContain(secret);
  });

  it('bounds the server reason and strips emails, tokens, URL params and home paths', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.onekeyIdLoginFailedReason({
      reason: `SupabaseAuthProvider session fetch failed: name=UnwrappedIpcError message=read /Users/alice/Library/OneKey/store.json for bob@example.com via https://auth.onekey.so/cb?code=abc123&state=xyz access_token=at_123 ${'x'.repeat(400)}`,
      trigger: 'passive',
    });

    const payload = getCalls(
      emitLog,
      'onekeyIdLoginFailedReason',
    )[0]?.[1]?.[0] as {
      reason: string;
    };
    expect(payload.reason).toContain('/Users/[user]/Library');
    expect(payload.reason).toContain('[email]');
    expect(payload.reason).toContain('https://auth.onekey.so/cb ');
    expect(payload.reason).toContain('access_token=[redacted]');
    expect(payload.reason).not.toMatch(/alice|bob@|abc123|at_123/);
    expect(payload.reason.length).toBeLessThanOrEqual(203);
  });

  it('reports which login step failed and what triggered it', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.onekeyIdLoginFailedReason({
      reason:
        'OneKey ID OAuth sign-in failed: name=AuthRetryableFetchError message=fetch failed code= status= requestId=',
      step: 'auth',
      trigger: 'interactive',
    });

    const serverCall = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'onekeyIdLoginFailedReason',
    );
    expect(serverCall?.[1]).toEqual([
      {
        source: 'throwSite',
        step: 'auth',
        trigger: 'interactive',
        category: 'oauth',
        errorName: 'AuthRetryableFetchError',
        reason:
          'OneKey ID OAuth sign-in failed: name=AuthRetryableFetchError message=fetch failed code= status= requestId=',
      },
    ]);
  });

  it('reports a repeated passive failure once and summarizes the repeats when its window ends', () => {
    const { scene, emitLog } = createSceneWithSpy();
    const startedAt = Date.now();

    for (let i = 0; i < 10; i += 1) {
      // A new Error object and request id every time, like a provider that
      // remounts and fails again.
      const error = new Error('session read failed');
      scene.onekeyIdLoginFailedReason({
        reason: `SupabaseAuthProvider session fetch failed: name=Error message=session read failed requestId=req-${i}`,
        trigger: 'passive',
        error,
      });
      jest.advanceTimersByTime(60 * 1000);
    }

    expect(getCalls(emitLog, 'onekeyIdLoginFailedReason')).toHaveLength(1);
    expect(getCalls(emitLog, 'onekeyIdAuthFailureLocal')).toHaveLength(1);
    expect(getCalls(emitLog, 'onekeyIdLoginFailedReasonRepeated')).toHaveLength(
      0,
    );

    jest.advanceTimersByTime(ONE_HOUR_MS);

    const summaryCalls = getCalls(emitLog, 'onekeyIdLoginFailedReasonRepeated');
    expect(summaryCalls).toHaveLength(1);
    expect(summaryCalls[0]?.[1]?.[0]).toEqual(
      expect.objectContaining({
        trigger: 'passive',
        reason: expect.stringContaining(
          'SupabaseAuthProvider session fetch failed',
        ),
        repeatCount: 9,
        firstRepeatAt: startedAt + 60 * 1000,
        lastRepeatAt: startedAt + 9 * 60 * 1000,
      }),
    );
    expect(summaryCalls[0]?.[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'local' }),
        expect.objectContaining({ type: 'server' }),
      ]),
    );

    // A new window reports the failure again.
    scene.onekeyIdLoginFailedReason({
      reason:
        'SupabaseAuthProvider session fetch failed: name=Error message=session read failed requestId=req-next',
      trigger: 'passive',
    });
    expect(getCalls(emitLog, 'onekeyIdLoginFailedReason')).toHaveLength(2);
  });

  it('keeps different failures and repeated user attempts observable', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.onekeyIdLoginFailedReason({
      reason: 'SupabaseAuthProvider session fetch failed: name=Error',
      trigger: 'passive',
    });
    scene.onekeyIdLoginFailedReason({
      reason: 'SupabaseAuthProvider initial session fetch failed: name=Error',
      trigger: 'passive',
    });
    for (let i = 0; i < 7; i += 1) {
      scene.onekeyIdLoginFailedReason({
        reason: 'OneKey ID OAuth sign-in failed: name=AuthApiError status=400',
        trigger: 'interactive',
      });
    }
    // Same text from a passive check is a different signature.
    scene.onekeyIdLoginFailedReason({
      reason: 'OneKey ID OAuth sign-in failed: name=AuthApiError status=400',
      trigger: 'passive',
    });

    const reported = getCalls(emitLog, 'onekeyIdLoginFailedReason').map(
      (call) => call[1]?.[0] as { trigger: string; reason: string },
    );
    expect(reported).toHaveLength(2 + 5 + 1);
    expect(
      reported.filter((payload) => payload.trigger === 'interactive'),
    ).toHaveLength(5);
  });

  it('tells apart Desktop API calls that fail with the same error name', () => {
    const { scene, emitLog } = createSceneWithSpy();
    const methods = [
      'isSecureStorageAvailable',
      'secureGetItemAsync',
      'secureSetItemAsync',
    ];

    methods.forEach((method) => {
      const error = buildDesktopIpcError({
        method,
        message: 'Keychain is locked',
      });
      scene.onekeyIdLoginFailedReason({
        reason: `SupabaseAuthProvider session fetch failed: ${getSanitizedErrorLogText(
          error,
        )}`,
        trigger: 'passive',
        error,
      });
    });
    // Rewrapped by the session storage layer: the cause chain keeps it.
    const transientError = new SupabaseStorageTransientError(
      'Supabase secure storage read failed: Keychain is locked',
      {
        cause: buildDesktopIpcError({
          method: 'secureGetItemAsync',
          message: 'Keychain is locked',
        }),
      },
    );
    scene.onekeyIdLoginFailedReason({
      reason: `SupabaseAuthProvider stored session read failed: ${getSanitizedErrorLogText(
        transientError,
      )}`,
      trigger: 'passive',
      error: transientError,
    });

    const reported = getCalls(emitLog, 'onekeyIdLoginFailedReason').map(
      (call) => call[1]?.[0] as Record<string, unknown>,
    );
    expect(reported).toHaveLength(4);
    expect(reported.slice(0, 3)).toEqual(
      methods.map((method): unknown =>
        expect.objectContaining({
          errorName: 'UnwrappedIpcError',
          ipcModule: 'storage',
          ipcMethod: method,
        }),
      ),
    );
    expect(reported[3]).toEqual(
      expect.objectContaining({
        errorName: 'SupabaseStorageTransientError',
        ipcModule: 'storage',
        ipcMethod: 'secureGetItemAsync',
      }),
    );
    expect(reported.some((payload) => 'ipcContextMissing' in payload)).toBe(
      false,
    );
    const localCall = getCalls(emitLog, 'onekeyIdAuthFailureLocal')[1];
    expect(localCall?.[1]?.[0]).toEqual(
      expect.objectContaining({
        ipcModule: 'storage',
        ipcMethod: 'secureGetItemAsync',
      }),
    );
  });

  it('does not invent IPC context and marks it missing when it was lost', () => {
    const { scene, emitLog } = createSceneWithSpy();

    scene.onekeyIdLoginFailedReason({
      reason: 'OAuth redirect state parsing failed: name=TypeError',
      trigger: 'interactive',
      error: new TypeError('Invalid URL'),
    });
    scene.onekeyIdLoginFailedReason({
      reason: 'Desktop OAuth local server start failed: name=UnwrappedIpcError',
      trigger: 'interactive',
      error: new UnwrappedIpcError('port in use'),
    });
    scene.onekeyIdLoginFailedReason({
      reason: 'ServicePrime bind check failed: name=UnwrappedIpcError',
      trigger: 'passive',
    });

    const reported = getCalls(emitLog, 'onekeyIdLoginFailedReason').map(
      (call) => call[1]?.[0] as Record<string, unknown>,
    );
    expect(reported[0]).not.toHaveProperty('ipcModule');
    expect(reported[0]).not.toHaveProperty('ipcMethod');
    expect(reported[0]).not.toHaveProperty('ipcContextMissing');
    expect(reported[1]).toEqual(
      expect.objectContaining({ ipcContextMissing: true }),
    );
    expect(reported[1]).not.toHaveProperty('ipcModule');
    expect(reported[2]).toEqual(
      expect.objectContaining({ ipcContextMissing: true }),
    );
  });

  it('never sends IPC params, payloads or session content', () => {
    const { scene, emitLog } = createSceneWithSpy();
    const sessionKey = 'onekey-supabase-keyless-auth-session';
    const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';
    const error = buildDesktopIpcError({
      method: 'secureSetItemAsync',
      message: `write failed for {"access_token":"${accessToken}"}`,
      data: { key: sessionKey, value: accessToken },
    });

    scene.onekeyIdLoginFailedReason({
      reason: `ServicePrime.apiEmailOtpLogin failed: ${getSanitizedErrorLogText(
        error,
      )}`,
      trigger: 'interactive',
      error,
    });

    const emitted = JSON.stringify(emitLog.mock.calls);
    expect(emitted).toContain('secureSetItemAsync');
    expect(emitted).not.toContain(sessionKey);
    expect(emitted).not.toContain(accessToken);
    expect(emitted).not.toContain('"data"');
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

    void scene.reportOneKeyIdIdentityLinked({ onekeyUserId: 'user-uuid-1' });

    const call = emitLog.mock.calls.find(
      ([methodName]) => methodName === 'onekeyIdIdentityLinked',
    );
    expect(call?.[1]).toEqual([{ onekeyUserId: 'user-uuid-1' }]);
    expect(call?.[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'server', waitForServer: true }),
      ]),
    );
  });
});
