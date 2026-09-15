/*
yarn jest packages/kit-bg/src/services/ServicePrime/ServicePrime.availability.test.ts

Pins the availability counting of OneKey ID email and OAuth logins: which
calls start a flow, the ok/failed/cancelled classification and the failure
stage reported as the flow detail.
*/
import {
  OAuthLoginCancelError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { AvailabilityAggregator } from '@onekeyhq/shared/src/request/availabilityAggregator';
import type {
  IAvailabilityFlow,
  IAvailabilityFlowHandle,
  IAvailabilityFlowResult,
} from '@onekeyhq/shared/src/request/availabilityAggregator';
import { getAvailabilityErrorCode } from '@onekeyhq/shared/src/request/availabilityMetrics';

import ServicePrime from './ServicePrime';

type IMockFlowStartOptions = { detail?: string; trackUnfinished?: boolean };
type IMockFlowCall = {
  flow: IAvailabilityFlow;
  options: IMockFlowStartOptions | undefined;
  results: IAvailabilityFlowResult[];
};

const mockAvailability: {
  aggregator: AvailabilityAggregator | undefined;
  calls: IMockFlowCall[];
} = { aggregator: undefined, calls: [] };

// Flows are counted by a real aggregator instance owned by each test, so the
// assertions below pin the recorded series and failure keys, not just calls.
jest.mock('@onekeyhq/shared/src/request/availabilityAggregator', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/request/availabilityAggregator')
  >('@onekeyhq/shared/src/request/availabilityAggregator'),
  recordAvailabilityOutcome: () => undefined,
  startAvailabilityFlow: (
    flow: IAvailabilityFlow,
    options?: IMockFlowStartOptions,
  ): IAvailabilityFlowHandle => {
    const call: IMockFlowCall = { flow, options, results: [] };
    mockAvailability.calls.push(call);
    const handle = mockAvailability.aggregator?.startFlow(flow, options);
    return {
      finish: (result) => {
        call.results.push(result);
        handle?.finish(result);
      },
    };
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  checkDevOnlyPassword: () => undefined,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

const mockOneKeyIdLoginSuccessLog = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  function createLoggerProxy(path: string[] = []): unknown {
    return new Proxy(() => undefined, {
      get: (_target, property: string | symbol) => {
        const nextPath = [...path, String(property)];
        if (nextPath.join('.') === 'prime.subscription.onekeyIdLoginSuccess') {
          return mockOneKeyIdLoginSuccessLog;
        }
        return createLoggerProxy(nextPath);
      },
    });
  }
  return { defaultLogger: createLoggerProxy() };
});

jest.mock('../../states/jotai/atoms/prime', () => ({
  primeGiftEligibilityPersistAtom: { set: jest.fn() },
  primePersistAtom: {
    get: jest.fn(async () => ({})),
    set: jest.fn(async () => undefined),
  },
  primePersistAtomInitialValue: { isLoggedIn: false },
  primeServerMasterPasswordStatusAtom: {
    get: jest.fn(async () => ({})),
    set: jest.fn(async () => undefined),
  },
  primeLoginDialogAtom: {
    get: jest.fn(async () => ({})),
    set: jest.fn(async () => undefined),
  },
}));

jest.mock('./primeAuthSessionAccess', () => ({
  allowAuthSessionStorageWritesBySessionSource: jest.fn(),
  clearAllSupabaseAuthSessions: jest.fn(async () => undefined),
  clearSupabaseStorageLocalCache: jest.fn(),
  getAuthTokenBySessionSource: jest.fn(async () => ''),
  getSupabaseClientBySessionSource: jest.fn(),
  persistKeylessAuthSession: jest.fn(async () => undefined),
  readAuthTokenAllowingRetryableAuthError: jest.fn(),
  readAuthTokenOrNull: jest.fn(async () => null),
  readPersistedAccessTokenBySessionSource: jest.fn(async () => ''),
  readPersistedAccessTokenBySessionSourceStrict: jest.fn(async () => ({
    status: 'empty',
  })),
  removeAuthSessionStorageBySessionSource: jest.fn(async () => undefined),
  revokeAuthSessionTokenOnServerBestEffort: jest.fn(async () => undefined),
  runExclusiveOnAuthSessionSlot: async (
    _source: unknown,
    fn: () => Promise<unknown>,
  ) => fn(),
}));

function createAggregator() {
  return new AvailabilityAggregator({
    now: () => 1000,
    createId: () => 'window',
    persistWindows: true,
    storage: {
      loadBudget: async () => undefined,
      saveBudget: async () => undefined,
      loadWindows: async () => undefined,
      saveWindows: async () => undefined,
    },
    canSend: async () => false,
    send: async () => undefined,
  });
}

function resetAvailability() {
  mockAvailability.calls = [];
  mockAvailability.aggregator = createAggregator();
}

function readAvailability() {
  const state = mockAvailability.aggregator?.getStateForTest();
  const series: Record<string, number> = {};
  Object.entries(state?.current?.series ?? {}).forEach(([key, value]) => {
    series[key] = value.count;
  });
  return {
    series,
    failures: { ...state?.current?.failures },
    inflight: { ...state?.inflight },
  };
}

type IPrimeLoginInternals = {
  getPrimeClient: () => Promise<unknown>;
  commitAuthSessionSourceAndPrimeAtom: (params: {
    updatePrimeAtom: () => Promise<void>;
  }) => Promise<void>;
  assertOneKeyIdLoggedOutForInteractiveLogin: (
    callerName: string,
  ) => Promise<void>;
  assertKeylessSessionPersistedBeforeLogin: (params: {
    accessToken: string;
    callerName: string;
  }) => Promise<{ verifiedTokenSub: string }>;
};

const oauthLoginResponse = {
  userId: 'onekey-user-a',
  onekeyAccount: {
    onekeyUserId: 'onekey-user-a',
    normalizedEmail: 'a@example.com',
    displayEmail: 'a@example.com',
  },
};

function createNetworkError() {
  return Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
}

function createAxiosCancelError() {
  return Object.assign(new Error('canceled'), {
    name: 'CanceledError',
    code: 'ERR_CANCELED',
  });
}

function createService() {
  const backgroundApi = {
    simpleDb: {
      prime: {
        clearCachedAuthToken: jest.fn(async () => undefined),
        clearLegacyAuthSession: jest.fn(async () => undefined),
      },
    },
    serviceKeylessWallet: {
      cleanupLocalKeylessOAuthTokens: jest.fn(async () => undefined),
    },
  };
  const service = new ServicePrime({ backgroundApi });
  const internals = service as unknown as IPrimeLoginInternals;
  const post = jest.fn(
    async (url: string): Promise<{ data: { data: unknown } }> => ({
      data: {
        data:
          url === '/prime/v1/account/oauth/login'
            ? oauthLoginResponse
            : { userId: 'onekey-user-a' },
      },
    }),
  );
  const getPrimeClient = jest
    .spyOn(internals, 'getPrimeClient')
    .mockResolvedValue({ post });
  const commit = jest
    .spyOn(internals, 'commitAuthSessionSourceAndPrimeAtom')
    .mockResolvedValue(undefined);
  const assertLoggedOut = jest
    .spyOn(internals, 'assertOneKeyIdLoggedOutForInteractiveLogin')
    .mockResolvedValue(undefined);
  const assertKeylessSession = jest
    .spyOn(internals, 'assertKeylessSessionPersistedBeforeLogin')
    .mockResolvedValue({ verifiedTokenSub: 'auth-user-a' });
  return {
    service,
    post,
    getPrimeClient,
    commit,
    assertLoggedOut,
    assertKeylessSession,
  };
}

describe('ServicePrime availability flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAvailability();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('apiLogin', () => {
    it('records nothing when there is no access token', async () => {
      const { service, getPrimeClient } = createService();

      await expect(service.apiLogin({ accessToken: '' })).resolves.toBe(
        undefined,
      );

      expect(getPrimeClient).not.toHaveBeenCalled();
      expect(mockAvailability.calls).toEqual([]);
      expect(readAvailability().series).toEqual({});
    });

    it('counts a committed login as ok', async () => {
      const { service, post, commit } = createService();

      await service.apiLogin({ accessToken: 'request-token' });

      expect(post).toHaveBeenCalledWith(
        '/prime/v1/user/login',
        {},
        { headers: { 'X-Onekey-Request-Token': 'request-token' } },
      );
      expect(commit).toHaveBeenCalledTimes(1);
      expect(mockAvailability.calls).toEqual([
        {
          flow: 'prime_login_email',
          options: undefined,
          results: [{ status: 'ok' }],
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|prime_login_email|started': 1,
          'flow|prime_login_email|ok': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('reports a server login failure with the server_login stage', async () => {
      const { service, post, commit } = createService();
      const networkError = createNetworkError();
      post.mockRejectedValue(networkError);

      await expect(
        service.apiLogin({ accessToken: 'request-token' }),
      ).rejects.toBe(networkError);

      expect(commit).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'failed', errorCode: 'err_network', detail: 'server_login' },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|prime_login_email|started': 1,
          'flow|prime_login_email|failed': 1,
        },
        failures: {
          'flow|prime_login_email|failed|server_login|err_network': 1,
        },
        inflight: {},
      });
    });

    it('reports a local commit failure with the local_commit stage', async () => {
      const { service, commit } = createService();
      const commitError = new OneKeyLocalError('Active auth token not found');
      commit.mockRejectedValue(commitError);

      await expect(
        service.apiLogin({ accessToken: 'request-token' }),
      ).rejects.toBe(commitError);

      const errorCode = getAvailabilityErrorCode(commitError);
      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'failed', errorCode, detail: 'local_commit' },
      ]);
      expect(readAvailability().failures).toEqual({
        [`flow|prime_login_email|failed|local_commit|${errorCode}`]: 1,
      });
    });

    it('counts an aborted server login as cancelled', async () => {
      const { service, post } = createService();
      const cancelError = createAxiosCancelError();
      post.mockRejectedValue(cancelError);

      await expect(
        service.apiLogin({ accessToken: 'request-token' }),
      ).rejects.toBe(cancelError);

      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'cancelled',
          errorCode: 'err_canceled',
          detail: 'server_login',
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|prime_login_email|started': 1,
          'flow|prime_login_email|cancelled': 1,
        },
        failures: {},
        inflight: {},
      });
    });
  });

  describe('apiOAuthLogin', () => {
    it('counts a committed OAuth login as ok and returns the login response', async () => {
      const { service, post, commit } = createService();

      await expect(
        service.apiOAuthLogin({ accessToken: 'oauth-token' }),
      ).resolves.toBe(oauthLoginResponse);

      expect(post).toHaveBeenCalledWith(
        '/prime/v1/account/oauth/login',
        {},
        { headers: { 'X-Onekey-Request-Token': 'oauth-token' } },
      );
      expect(commit).toHaveBeenCalledTimes(1);
      expect(mockOneKeyIdLoginSuccessLog).toHaveBeenCalledWith({
        method: 'oauth',
      });
      expect(mockAvailability.calls).toEqual([
        {
          flow: 'prime_login_oauth',
          options: undefined,
          results: [{ status: 'ok' }],
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|prime_login_oauth|started': 1,
          'flow|prime_login_oauth|ok': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('does not start a flow when the logged-out guard rejects the login', async () => {
      const { service, assertLoggedOut, post } = createService();
      const guardError = new OneKeyLocalError(
        'ServicePrime.apiOAuthLogin: OneKey ID is already logged in.',
      );
      assertLoggedOut.mockRejectedValue(guardError);

      await expect(
        service.apiOAuthLogin({ accessToken: 'oauth-token' }),
      ).rejects.toBe(guardError);

      expect(post).not.toHaveBeenCalled();
      expect(mockAvailability.calls).toEqual([]);
    });

    it('does not start a flow without an access token', async () => {
      const { service, post } = createService();

      await expect(
        service.apiOAuthLogin({ accessToken: '' }),
      ).rejects.toBeInstanceOf(OneKeyLocalError);

      expect(post).not.toHaveBeenCalled();
      expect(mockAvailability.calls).toEqual([]);
    });

    it('reports a keyless session guard failure with the session_guard stage', async () => {
      const { service, assertKeylessSession, post } = createService();
      const guardError = new OneKeyLocalError(
        'Keyless OAuth session token payload is not decodable',
      );
      assertKeylessSession.mockRejectedValue(guardError);

      await expect(
        service.apiOAuthLogin({ accessToken: 'oauth-token' }),
      ).rejects.toBe(guardError);

      expect(post).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'failed',
          errorCode: getAvailabilityErrorCode(guardError),
          detail: 'session_guard',
        },
      ]);
    });

    it('reports a server login failure with the server_login stage', async () => {
      const { service, post, commit } = createService();
      const networkError = createNetworkError();
      post.mockRejectedValue(networkError);

      await expect(
        service.apiOAuthLogin({ accessToken: 'oauth-token' }),
      ).rejects.toBe(networkError);

      expect(commit).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0].results).toEqual([
        { status: 'failed', errorCode: 'err_network', detail: 'server_login' },
      ]);
      expect(readAvailability().failures).toEqual({
        'flow|prime_login_oauth|failed|server_login|err_network': 1,
      });
    });

    it('reports an empty server response with the server_login stage', async () => {
      const { service, post, commit } = createService();
      post.mockResolvedValue({ data: { data: undefined } });

      const error = await service
        .apiOAuthLogin({ accessToken: 'oauth-token' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OneKeyLocalError);
      expect(commit).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'failed',
          errorCode: getAvailabilityErrorCode(error),
          detail: 'server_login',
        },
      ]);
    });

    it('reports a local commit failure with the local_commit stage', async () => {
      const { service, commit } = createService();
      const commitError = new OneKeyLocalError('Active auth token not found');
      commit.mockRejectedValue(commitError);

      await expect(
        service.apiOAuthLogin({ accessToken: 'oauth-token' }),
      ).rejects.toBe(commitError);

      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'failed',
          errorCode: getAvailabilityErrorCode(commitError),
          detail: 'local_commit',
        },
      ]);
    });

    it('counts an aborted server request as cancelled', async () => {
      const { service, post } = createService();
      const cancelError = createAxiosCancelError();
      post.mockRejectedValue(cancelError);

      await expect(
        service.apiOAuthLogin({ accessToken: 'oauth-token' }),
      ).rejects.toBe(cancelError);

      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'cancelled',
          errorCode: 'err_canceled',
          detail: 'server_login',
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|prime_login_oauth|started': 1,
          'flow|prime_login_oauth|cancelled': 1,
        },
        failures: {},
        inflight: {},
      });
    });

    it('counts a user-cancel class error as cancelled', async () => {
      const { service, assertKeylessSession, post } = createService();
      const cancelError = new OAuthLoginCancelError();
      assertKeylessSession.mockRejectedValue(cancelError);

      await expect(
        service.apiOAuthLogin({ accessToken: 'oauth-token' }),
      ).rejects.toBe(cancelError);

      expect(post).not.toHaveBeenCalled();
      expect(mockAvailability.calls[0].results).toEqual([
        {
          status: 'cancelled',
          errorCode: getAvailabilityErrorCode(cancelError),
          detail: 'session_guard',
        },
      ]);
      expect(readAvailability()).toEqual({
        series: {
          'flow|prime_login_oauth|started': 1,
          'flow|prime_login_oauth|cancelled': 1,
        },
        failures: {},
        inflight: {},
      });
    });
  });
});
