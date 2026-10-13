/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
// cspell:ignore presign RLUSD
import {
  BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
  BINANCE_DEPOSIT_CREATE_TIMEOUT_MS,
  BINANCE_DEPOSIT_MAX_DEBUG_EVENTS,
  BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
  BINANCE_DEPOSIT_RETURN_GRACE_MS,
  BINANCE_DEPOSIT_RETURN_NONCE_REGEX,
  BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS,
  BINANCE_DEPOSIT_SESSION_KEY_REGEX,
  EBinanceDepositLocalErrorCode,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositReturnSource,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';

import { SimpleDbEntityBinanceDeposit } from '../dbs/simple/entity/SimpleDbEntityBinanceDeposit';

import ServiceBinanceDeposit from './ServiceBinanceDeposit';

import type { ISimpleDbBinanceDeposit } from '../dbs/simple/entity/SimpleDbEntityBinanceDeposit';

type ILogCall = { step: string; params: Record<string, unknown> };

const mockLogCalls: ILogCall[] = [];

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    fiatCrypto: {
      binanceDeposit: new Proxy(
        {},
        {
          get:
            (_target: unknown, step: string | symbol) =>
            (params: Record<string, unknown>) => {
              mockLogCalls.push({ step: String(step), params });
            },
        },
      ),
    },
  },
}));

jest.mock(
  '@onekeyhq/shared/src/storage/instance/secureStorageInstance',
  () => ({
    __esModule: true,
    default: {
      getSecureItem: jest.fn(),
      setSecureItem: jest.fn(),
      removeSecureItem: jest.fn(),
    },
  }),
);

const NOW = 1_760_000_000_000;
const MINUTE = 60_000;
const NONCE = '0123456789abcdefghijklmnopqrstuvwxyzABCDE-_';
const OTHER_NONCE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';
const SESSION_ID =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const LINK = 'https://app.binance.com/en/connect/deposit?token=LinkSecretValue';
const NETWORK_ID = 'evm--56';
const SYMBOL = 'USDT';
const CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
const SENDER = '0x1111111111111111111111111111111111111111';
const TX_HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const KEY_STORAGE_PREFIX = 'onekey_bcd_sk.';
// The wallet endpoint the app points at, and the one of the other environment.
const WALLET_ENDPOINT = 'https://wallet.test.example';
const OTHER_WALLET_ENDPOINT = 'https://wallet.prod.example';
const LINK_EXPIRE_TIME = NOW + 15 * MINUTE;
// From here on a return is no longer accepted when only the link expiry is
// known locally.
const LOCAL_RETURN_DEADLINE =
  LINK_EXPIRE_TIME + BINANCE_DEPOSIT_RETURN_GRACE_MS;

const DESTINATION: IBinanceDepositAuthorizedDestination = {
  networkId: NETWORK_ID,
  binanceNetwork: 'BSC',
  cryptoCurrency: SYMBOL,
  contractAddress: CONTRACT.toLowerCase(),
  minAmount: '0.01',
  address: '0x2222222222222222222222222222222222222222',
  authorizedAt: NOW,
};

const CREATE_PARAMS = {
  networkId: NETWORK_ID,
  cryptoCurrency: SYMBOL,
  contractAddress: CONTRACT,
  accountId: "hd-1--m/44'/60'/0'/0/0",
  walletId: 'hd-1',
  indexedAccountId: 'hd-1--0',
  senderAddress: SENDER,
};

type IRouteName = 'create' | 'query' | 'bind' | 'report';
type IPostCall = {
  route: IRouteName;
  url: string;
  body: Record<string, string>;
  config: Record<string, unknown>;
};
type IPostResponse = { status: number; data: unknown };
type IResponder = (call: IPostCall) => IPostResponse | Promise<IPostResponse>;

function ok(data: unknown): IResponder {
  return () => ({ status: 200, data: { code: 0, message: 'Success', data } });
}

function businessError(code: number): IResponder {
  return () => ({
    status: 200,
    data: { code, message: 'server message', messageId: 'error__x' },
  });
}

// Shaped like an axios timeout: the error keeps the request config, whose
// `data` is the serialized request body.
function networkError(): IResponder {
  return (call) => {
    const error = new Error('timeout of 75000ms exceeded');
    error.name = 'AxiosError';
    throw Object.assign(error, {
      code: 'ECONNABORTED',
      config: { url: call.url, data: JSON.stringify(call.body) },
    });
  };
}

// Keeps a request in flight until `release` is called.
function held(responder: IResponder) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const heldResponder: IResponder = async (call) => {
    await gate;
    return responder(call);
  };
  return { responder: heldResponder, release: () => release() };
}

function resolveRoute(url: string): IRouteName {
  if (url.endsWith('/deposit/sessions')) {
    return 'create';
  }
  const route = (['query', 'bind', 'report'] as const).find((name) =>
    url.endsWith(`/${name}`),
  );
  if (!route) {
    throw new OneKeyLocalError('unknown route');
  }
  return route;
}

function createFakeServer() {
  const queues: Record<IRouteName, IResponder[]> = {
    create: [],
    query: [],
    bind: [],
    report: [],
  };
  const calls: IPostCall[] = [];
  const post = jest.fn(
    async (
      url: string,
      body: Record<string, string>,
      config: Record<string, unknown>,
    ): Promise<IPostResponse> => {
      const call: IPostCall = {
        route: resolveRoute(url),
        url,
        body: { ...body },
        config,
      };
      calls.push(call);
      const responder = queues[call.route].shift();
      if (!responder) {
        throw new OneKeyLocalError(`unexpected ${call.route} request`);
      }
      return responder(call);
    },
  );
  return {
    post,
    calls,
    enqueue: (route: IRouteName, ...responders: IResponder[]) => {
      queues[route].push(...responders);
    },
    callsTo: (route: IRouteName) =>
      calls.filter((call) => call.route === route),
  };
}

function view(
  status: EBinanceDepositSessionStatus,
  extra: Record<string, unknown> = {},
) {
  return {
    sessionId: SESSION_ID,
    status,
    networkId: NETWORK_ID,
    cryptoCurrency: SYMBOL,
    contractAddress: CONTRACT.toLowerCase(),
    ...extra,
  };
}

const initView = (extra: Record<string, unknown> = {}) =>
  view(EBinanceDepositSessionStatus.INIT, {
    link: LINK,
    linkExpireTime: LINK_EXPIRE_TIME,
    ...extra,
  });

const authorizedView = (
  destination: IBinanceDepositAuthorizedDestination = DESTINATION,
) =>
  view(EBinanceDepositSessionStatus.AUTHORIZED, {
    authorizedDestination: destination,
  });

const secure = jest.mocked(secureStorageInstance);
const mockSecureItems = new Map<string, string>();

function createStore() {
  const holder: { data: ISimpleDbBinanceDeposit | null | undefined } = {
    data: null,
  };
  return holder;
}

// What the app's vaults can send, by network implementation. Anything else is
// a network the app does not know.
const SINGLE_TOKEN_BY_IMPL: Partial<Record<string, boolean>> = {
  evm: false,
  xrp: true,
};

function createHarness(
  shared: {
    store?: ReturnType<typeof createStore>;
    server?: ReturnType<typeof createFakeServer>;
    endpoint?: { current: string };
  } = {},
) {
  const store = shared.store ?? createStore();
  const server = shared.server ?? createFakeServer();
  // Mutable, like the dev setting that picks the test or the prod endpoint.
  const endpoint = shared.endpoint ?? { current: WALLET_ENDPOINT };
  const entity = new SimpleDbEntityBinanceDeposit();
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => store.data);
  // Applied synchronously, like the real write under the entity lock, so
  // concurrent flows in a test cannot lose each other's update.
  jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
    if (typeof builder === 'function') {
      const built = builder(store.data);
      store.data = built instanceof Promise ? await built : built;
    } else {
      store.data = builder;
    }
    return store.data ?? undefined;
  });
  const serviceToken = {
    getBinanceSupportedAssets: jest.fn(),
    clearBinanceSupportedAssetsCache: jest.fn(async () => undefined),
  };
  const serviceNetwork = {
    getVaultSettings: jest.fn(async ({ networkId }: { networkId: string }) => {
      const isSingleToken = SINGLE_TOKEN_BY_IMPL[networkId.split('--')[0]];
      if (isSingleToken === undefined) {
        throw new OneKeyLocalError('no settings found');
      }
      return { isSingleToken };
    }),
  };
  const service = new ServiceBinanceDeposit({
    backgroundApi: {
      simpleDb: { binanceDeposit: entity },
      serviceToken,
      serviceNetwork,
    },
  });
  const getClient = jest.fn(async () => ({ post: server.post }));
  (service as unknown as { getClient: typeof getClient }).getClient = getClient;
  service.getClientEndpointInfo = jest.fn(
    async (name: EServiceEndpointEnum) => ({
      endpoint: endpoint.current,
      name,
    }),
  );

  const getSession = (localId: string) => store.data?.sessions[localId];
  const getOnlySession = () => {
    const sessions = Object.values(store.data?.sessions ?? {});
    expect(sessions).toHaveLength(1);
    return sessions[0];
  };
  return {
    service,
    server,
    store,
    endpoint,
    serviceToken,
    serviceNetwork,
    getClient,
    getSession,
    getOnlySession,
  };
}

type IHarness = ReturnType<typeof createHarness>;

async function flush() {
  await jest.advanceTimersByTimeAsync(0);
}

function handleReturn(
  harness: IHarness,
  returnNonce: string,
  source: IBinanceDepositReturnSource = 'os_event',
) {
  return harness.service.handleDepositReturn({
    returnNonce,
    otherParamNames: [],
    source,
  });
}

async function createInitSession(harness: IHarness) {
  harness.server.enqueue('create', ok(initView()));
  return harness.service.createSession(CREATE_PARAMS);
}

// A session whose link was opened: it accepts a return.
async function createWaitingSession(harness: IHarness) {
  const snapshot = await createInitSession(harness);
  await harness.service.prepareOpenLink(snapshot.localId);
  return snapshot;
}

async function createAuthorizedSession(harness: IHarness) {
  const snapshot = await createWaitingSession(harness);
  harness.server.enqueue('bind', ok(authorizedView()));
  await handleReturn(harness, NONCE);
  await flush();
  expect(harness.getSession(snapshot.localId)?.status).toBe(
    EBinanceDepositSessionStatus.AUTHORIZED,
  );
  return snapshot;
}

function getStoredKey(localId: string) {
  return mockSecureItems.get(`${KEY_STORAGE_PREFIX}${localId}`);
}

// An authorized session whose transfer was reported once without an answer.
async function createPendingReportSession(harness: IHarness) {
  const snapshot = await createAuthorizedSession(harness);
  harness.server.enqueue('report', networkError());
  await harness.service.submitReport({
    localId: snapshot.localId,
    txHash: TX_HASH,
    senderAddress: SENDER,
  });
  expect(harness.getSession(snapshot.localId)?.report).toMatchObject({
    status: 'PENDING',
    attempts: 1,
  });
  return snapshot;
}

// Same storage and server, new service instance: what an app restart leaves.
function restartHarness(harness: IHarness, endpoint = harness.endpoint) {
  return createHarness({
    store: harness.store,
    server: harness.server,
    endpoint,
  });
}

async function catchError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as {
      code?: number;
      message?: string;
      autoToast?: boolean;
    };
  }
  throw new OneKeyLocalError('expected the call to reject');
}

// Everything that leaves the service or is persisted in plain text.
async function collectObservableOutput(harness: IHarness, extra?: unknown) {
  return JSON.stringify({
    logs: mockLogCalls,
    state: await harness.service.getState(),
    store: harness.store.data,
    extra,
  });
}

describe('ServiceBinanceDeposit', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    mockLogCalls.length = 0;
    mockSecureItems.clear();
    secure.getSecureItem.mockImplementation(
      async (key) => mockSecureItems.get(key) ?? null,
    );
    secure.setSecureItem.mockImplementation(async (key, value) => {
      mockSecureItems.set(key, value);
    });
    secure.removeSecureItem.mockImplementation(async (key) => {
      mockSecureItems.delete(key);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('uses fixtures that match the server patterns', () => {
    expect(NONCE).toMatch(BINANCE_DEPOSIT_RETURN_NONCE_REGEX);
    expect(OTHER_NONCE).toMatch(BINANCE_DEPOSIT_RETURN_NONCE_REGEX);
  });

  describe('createSession', () => {
    test('persists the key and a pending record before the server sees the key', async () => {
      const harness = createHarness();
      const seen: {
        storedKey?: string;
        status?: string;
        recordCount?: number;
      } = {};
      harness.server.enqueue('create', (call) => {
        const session = harness.getOnlySession();
        seen.storedKey = getStoredKey(session.localId);
        seen.status = session.status;
        seen.recordCount = mockSecureItems.size;
        expect(call.body.sessionKey).toBe(seen.storedKey);
        return ok(initView())(call);
      });

      const snapshot = await harness.service.createSession(CREATE_PARAMS);

      expect(seen.status).toBe('LOCAL_PENDING_CREATE');
      expect(seen.storedKey).toMatch(BINANCE_DEPOSIT_SESSION_KEY_REGEX);
      expect(seen.recordCount).toBe(1);
      // Written, then read back to prove it was really persisted.
      const storageKey = `${KEY_STORAGE_PREFIX}${snapshot.localId}`;
      expect(secure.setSecureItem).toHaveBeenCalledWith(
        storageKey,
        seen.storedKey,
      );
      expect(secure.getSecureItem).toHaveBeenCalledWith(storageKey);

      const [call] = harness.server.callsTo('create');
      expect(call.url).toBe('/wallet/v1/exchange/binance/deposit/sessions');
      expect(call.body).toEqual({
        sessionKey: seen.storedKey,
        networkId: NETWORK_ID,
        cryptoCurrency: SYMBOL,
        contractAddress: CONTRACT,
      });
      expect(call.config).toEqual({
        autoHandleError: false,
        timeout: BINANCE_DEPOSIT_CREATE_TIMEOUT_MS,
      });

      expect(snapshot).toMatchObject({
        sessionId: SESSION_ID,
        status: EBinanceDepositSessionStatus.INIT,
        linkExpireTime: NOW + 15 * MINUTE,
        accountId: CREATE_PARAMS.accountId,
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        senderAddress: SENDER,
        awaitingReturn: false,
        hasPendingNonce: false,
        bindInFlight: false,
        sessionIdMasked: '01234567…',
      });
      const state = await harness.service.getState();
      expect(state.active?.localId).toBe(snapshot.localId);
      expect(state.recent).toEqual([]);
    });

    test('keeps the key, the nonce and the link out of everything observable', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      const sessionKey = getStoredKey(snapshot.localId) ?? '';
      expect(sessionKey).toMatch(BINANCE_DEPOSIT_SESSION_KEY_REGEX);

      const output = await collectObservableOutput(harness, snapshot);

      expect(output).not.toContain(sessionKey);
      expect(output).not.toContain(NONCE);
      expect(output).not.toContain(LINK);
      expect(output).not.toContain('LinkSecretValue');
      // The steps themselves were recorded.
      expect(mockLogCalls.map((call) => call.step)).toEqual(
        expect.arrayContaining([
          'createStart',
          'createResult',
          'linkOpen',
          'returnReceived',
          'bindAttempt',
          'bindResult',
        ]),
      );
    });

    test('aborts when the key cannot be read back, as in Travel Mode', async () => {
      const harness = createHarness();
      // Travel Mode skips the write without failing.
      secure.setSecureItem.mockImplementation(async () => undefined);

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.StorageUnavailable);
      expect(error.autoToast).toBe(false);
      expect(harness.server.post).not.toHaveBeenCalled();
      expect(harness.store.data?.sessions ?? {}).toEqual({});
    });

    test('aborts when secure storage throws, without leaking the key', async () => {
      const harness = createHarness();
      let attemptedKey = '';
      secure.setSecureItem.mockImplementation(async (_key, value) => {
        attemptedKey = value;
        throw new OneKeyLocalError(`keychain rejected ${value}`);
      });

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      expect(attemptedKey).toMatch(BINANCE_DEPOSIT_SESSION_KEY_REGEX);
      expect(error.code).toBe(EBinanceDepositLocalErrorCode.StorageUnavailable);
      expect(error.message).not.toContain(attemptedKey);
      expect(await collectObservableOutput(harness)).not.toContain(
        attemptedKey,
      );
      expect(harness.server.post).not.toHaveBeenCalled();
    });

    test('refuses a second session while one is in progress', async () => {
      const harness = createHarness();
      await createInitSession(harness);

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.SessionInProgress);
      expect(error.autoToast).toBe(false);
      expect(harness.server.callsTo('create')).toHaveLength(1);
      // The key of the refused attempt was never written.
      expect(mockSecureItems.size).toBe(1);
    });

    test('rejects invalid parameters before touching storage', async () => {
      const harness = createHarness();

      const error = await catchError(
        harness.service.createSession({ ...CREATE_PARAMS, senderAddress: '' }),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.InvalidParams);
      expect(secure.setSecureItem).not.toHaveBeenCalled();
      expect(harness.server.post).not.toHaveBeenCalled();
    });

    test('keeps the record and the key after a timeout and replays with the same key', async () => {
      const harness = createHarness();
      harness.server.enqueue('create', networkError());

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      const session = harness.getOnlySession();
      const sessionKey = getStoredKey(session.localId) ?? '';
      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RequestFailed);
      expect(error.autoToast).toBe(false);
      expect(session.status).toBe('LOCAL_PENDING_CREATE');
      expect(session.localClosedReason).toBeUndefined();
      expect(sessionKey).toMatch(BINANCE_DEPOSIT_SESSION_KEY_REGEX);
      // The thrown request error carried the body; none of it got out.
      expect(error.message).not.toContain(sessionKey);
      expect(await collectObservableOutput(harness, error)).not.toContain(
        sessionKey,
      );
      expect(mockLogCalls).toContainEqual({
        step: 'createResult',
        params: expect.objectContaining({
          ok: false,
          isNetworkError: true,
          errorName: 'AxiosError:ECONNABORTED',
        }),
      });

      harness.server.enqueue('create', ok(initView()));
      const snapshot = await harness.service.retryCreate(session.localId);

      const [first, second] = harness.server.callsTo('create');
      expect(second.body.sessionKey).toBe(first.body.sessionKey);
      expect(second.body.sessionKey).toBe(sessionKey);
      expect(snapshot.status).toBe(EBinanceDepositSessionStatus.INIT);
      expect(snapshot.sessionId).toBe(SESSION_ID);
    });

    test('treats a service failure as retryable too', async () => {
      const harness = createHarness();
      harness.server.enqueue('create', businessError(10_000));

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      const session = harness.getOnlySession();
      expect(error.code).toBe(10_000);
      expect(session.status).toBe('LOCAL_PENDING_CREATE');
      expect(session.localClosedReason).toBeUndefined();
      expect(session.lastErrorCode).toBe(10_000);
      expect(getStoredKey(session.localId)).toBeDefined();
    });

    test.each<[string, IResponder, Record<string, unknown>]>([
      [
        'a body without a code',
        () => ({
          status: 200,
          data: { message: 'Internal error', data: null },
        }),
        { isNetworkError: false, errorName: 'MissingResponseCode' },
      ],
      [
        'a body that is not an envelope',
        () => ({ status: 200, data: '<html>captive portal</html>' }),
        { isNetworkError: true, errorName: 'MalformedResponse' },
      ],
      [
        'a gateway error',
        () => {
          // What the response interceptor throws for a 5xx status.
          throw Object.assign(new OneKeyLocalError('Server error'), {
            code: 502,
            httpStatusCode: 502,
          });
        },
        { isNetworkError: true, httpStatus: 502 },
      ],
    ])(
      'treats %s as no verdict and keeps the session replayable',
      async (_label, responder, logged) => {
        const harness = createHarness();
        harness.server.enqueue('create', responder);

        const error = await catchError(
          harness.service.createSession(CREATE_PARAMS),
        );

        const session = harness.getOnlySession();
        // Never mistaken for a business code of the deposit API.
        expect(error.code).toBe(EBinanceDepositLocalErrorCode.RequestFailed);
        expect(session.status).toBe('LOCAL_PENDING_CREATE');
        expect(session.localClosedReason).toBeUndefined();
        expect(getStoredKey(session.localId)).toBeDefined();
        expect(mockLogCalls).toContainEqual({
          step: 'createResult',
          params: expect.objectContaining({ ok: false, ...logged }),
        });
      },
    );

    test('closes the record and removes the key on a business rejection', async () => {
      const harness = createHarness();
      harness.server.enqueue(
        'create',
        businessError(EBinanceDepositErrorCode.RateLimited),
      );

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      const session = harness.getOnlySession();
      expect(error.code).toBe(EBinanceDepositErrorCode.RateLimited);
      expect(error.autoToast).toBe(false);
      // A fixed message, never the server's.
      expect(error.message).toBe(
        'Too many deposit requests. Please try again later.',
      );
      expect(session.localClosedReason).toBe('create_rejected');
      expect(session.lastErrorCode).toBe(EBinanceDepositErrorCode.RateLimited);
      expect(getStoredKey(session.localId)).toBeUndefined();
      expect(
        harness.serviceToken.clearBinanceSupportedAssetsCache,
      ).not.toHaveBeenCalled();

      // The slot is free again.
      await expect(createInitSession(harness)).resolves.toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
      });
    });

    test('drops the cached asset list when the server calls it stale', async () => {
      const harness = createHarness();
      harness.server.enqueue(
        'create',
        businessError(EBinanceDepositErrorCode.CapabilityStale),
      );

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      expect(error.code).toBe(EBinanceDepositErrorCode.CapabilityStale);
      expect(
        harness.serviceToken.clearBinanceSupportedAssetsCache,
      ).toHaveBeenCalledTimes(1);
    });

    test('does not accept a view whose session id could not go into a path', async () => {
      const harness = createHarness();
      harness.server.enqueue(
        'create',
        ok(initView({ sessionId: '../../other/route' })),
      );

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RequestFailed);
      expect(harness.getOnlySession().sessionId).toBeUndefined();
    });

    test.each([
      EBinanceDepositErrorCode.FeatureDisabled,
      EBinanceDepositErrorCode.DepositDisabled,
    ])(
      'keeps a replayed create open on code %s, which says nothing about the session',
      async (code) => {
        const harness = createHarness();
        // The first attempt may have created the session on the server.
        harness.server.enqueue('create', networkError());
        await catchError(harness.service.createSession(CREATE_PARAMS));
        const { localId } = harness.getOnlySession();
        const sessionKey = getStoredKey(localId);
        harness.server.enqueue('create', businessError(code));

        const error = await catchError(harness.service.retryCreate(localId));

        expect(error.code).toBe(code);
        expect(error.autoToast).toBe(false);
        const session = harness.getOnlySession();
        expect(session.status).toBe('LOCAL_PENDING_CREATE');
        expect(session.localClosedReason).toBeUndefined();
        expect(session.lastErrorCode).toBe(code);
        expect(getStoredKey(localId)).toBe(sessionKey);
        expect(secure.removeSecureItem).not.toHaveBeenCalled();

        // Once the switch is back on, the same key gets the session back.
        harness.server.enqueue('create', ok(initView()));
        const snapshot = await harness.service.retryCreate(localId);
        expect(snapshot.status).toBe(EBinanceDepositSessionStatus.INIT);
        expect(
          harness.server.callsTo('create').map((call) => call.body.sessionKey),
        ).toEqual([sessionKey, sessionKey, sessionKey]);
      },
    );

    test.each([
      EBinanceDepositErrorCode.FeatureDisabled,
      EBinanceDepositErrorCode.DepositDisabled,
    ])('still closes a first create rejected with code %s', async (code) => {
      const harness = createHarness();
      harness.server.enqueue('create', businessError(code));

      const error = await catchError(
        harness.service.createSession(CREATE_PARAMS),
      );

      const session = harness.getOnlySession();
      expect(error.code).toBe(code);
      expect(session.localClosedReason).toBe('create_rejected');
      expect(getStoredKey(session.localId)).toBeUndefined();
    });

    test('still closes a replayed create that is rate limited', async () => {
      const harness = createHarness();
      harness.server.enqueue('create', networkError());
      await catchError(harness.service.createSession(CREATE_PARAMS));
      const { localId } = harness.getOnlySession();
      harness.server.enqueue(
        'create',
        businessError(EBinanceDepositErrorCode.RateLimited),
      );

      const error = await catchError(harness.service.retryCreate(localId));

      expect(error.code).toBe(EBinanceDepositErrorCode.RateLimited);
      expect(harness.getOnlySession().localClosedReason).toBe(
        'create_rejected',
      );
      expect(getStoredKey(localId)).toBeUndefined();
    });

    test.each([
      [
        'a token on a network whose vault only sends its native coin',
        {
          networkId: 'xrp--0',
          cryptoCurrency: 'RLUSD',
          contractAddress: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
        },
      ],
      [
        'the native coin listed under a placeholder contract',
        {
          networkId: 'evm--137',
          cryptoCurrency: 'POL',
          // Compared case-insensitively.
          contractAddress:
            '0x0000000000000000000000000000000000001010'.toUpperCase(),
        },
      ],
      [
        'a network the app has no vault for',
        {
          networkId: 'unknown--1',
          cryptoCurrency: 'COIN',
          contractAddress: undefined,
        },
      ],
    ])('refuses %s before touching storage', async (_label, asset) => {
      const harness = createHarness();

      const error = await catchError(
        harness.service.createSession({ ...CREATE_PARAMS, ...asset }),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.InvalidParams);
      expect(error.autoToast).toBe(false);
      expect(secure.setSecureItem).not.toHaveBeenCalled();
      expect(harness.server.post).not.toHaveBeenCalled();
      expect(harness.store.data?.sessions ?? {}).toEqual({});
    });

    test.each([
      ['the native coin of a single-token network', 'xrp--0', 'XRP'],
      ['a coin without a contract on the placeholder network', 'evm--137', 'X'],
    ])('accepts %s', async (_label, networkId, cryptoCurrency) => {
      const harness = createHarness();
      harness.server.enqueue(
        'create',
        ok(initView({ networkId, cryptoCurrency, contractAddress: undefined })),
      );

      await expect(
        harness.service.createSession({
          ...CREATE_PARAMS,
          networkId,
          cryptoCurrency,
          contractAddress: undefined,
        }),
      ).resolves.toMatchObject({ status: EBinanceDepositSessionStatus.INIT });
    });

    test('only replays a create that the server has not confirmed', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);

      const error = await catchError(
        harness.service.retryCreate(snapshot.localId),
      );

      expect(error.code).toBe(
        EBinanceDepositLocalErrorCode.InvalidSessionState,
      );
      expect(harness.server.callsTo('create')).toHaveLength(1);
    });
  });

  describe('prepareOpenLink', () => {
    test('hands over a verified link and starts waiting for the return', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);

      await expect(
        harness.service.prepareOpenLink(snapshot.localId),
      ).resolves.toEqual({ link: LINK });

      expect(harness.getSession(snapshot.localId)?.linkOpenedAt).toBe(NOW);
      const state = await harness.service.getState();
      expect(state.active?.awaitingReturn).toBe(true);
      expect(mockLogCalls).toContainEqual({
        step: 'linkOpen',
        params: expect.objectContaining({
          stage: 'prepare',
          ok: true,
          linkSource: 'memory',
        }),
      });
    });

    test.each([
      [
        'another host',
        'https://app.binance.com.evil.example/x',
        'host_not_allowed',
      ],
      ['plain http', 'http://app.binance.com/x', 'not_https'],
      ['userinfo', 'https://app.binance.com@evil.example/x', 'has_credentials'],
    ])('refuses a link with %s', async (_label, link, rejectReason) => {
      const harness = createHarness();
      harness.server.enqueue('create', ok(initView({ link })));
      const snapshot = await harness.service.createSession(CREATE_PARAMS);

      const error = await catchError(
        harness.service.prepareOpenLink(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.LinkRejected);
      expect(error.message).not.toContain('binance.com');
      expect(
        harness.getSession(snapshot.localId)?.linkOpenedAt,
      ).toBeUndefined();
      expect((await harness.service.getState()).active?.awaitingReturn).toBe(
        false,
      );
      expect(mockLogCalls).toContainEqual({
        step: 'linkOpen',
        params: expect.objectContaining({ ok: false, rejectReason }),
      });
      expect(await collectObservableOutput(harness, error)).not.toContain(link);
    });

    test('refuses an expired link', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);
      jest.setSystemTime(NOW + 16 * MINUTE);

      const error = await catchError(
        harness.service.prepareOpenLink(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.LinkRejected);
      expect(mockLogCalls).toContainEqual({
        step: 'linkOpen',
        params: expect.objectContaining({ rejectReason: 'expired' }),
      });
    });

    test('queries the link again after the process restarted', async () => {
      const first = createHarness();
      const snapshot = await createInitSession(first);
      // A new instance on the same storage: the in-memory link is gone.
      const restarted = createHarness({
        store: first.store,
        server: first.server,
      });
      restarted.server.enqueue('query', ok(initView()));

      await expect(
        restarted.service.prepareOpenLink(snapshot.localId),
      ).resolves.toEqual({ link: LINK });

      const [query] = restarted.server.callsTo('query');
      expect(query.url).toBe(
        `/wallet/v1/exchange/binance/deposit/sessions/${SESSION_ID}/query`,
      );
      expect(query.body).toEqual({
        sessionKey: getStoredKey(snapshot.localId),
      });
      expect(query.config).toEqual({ autoHandleError: false });
      expect(JSON.stringify(restarted.store.data)).not.toContain(LINK);
    });

    test('has no link to hand over once the session left INIT', async () => {
      const first = createHarness();
      const snapshot = await createInitSession(first);
      const restarted = createHarness({
        store: first.store,
        server: first.server,
      });
      restarted.server.enqueue(
        'query',
        ok(
          view(EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND, {
            bindDeadline: NOW + 10 * MINUTE,
          }),
        ),
      );

      const error = await catchError(
        restarted.service.prepareOpenLink(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.LinkUnavailable);
      expect(restarted.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
        bindDeadline: NOW + 10 * MINUTE,
      });
    });
  });

  describe('handleDepositReturn', () => {
    test('discards a return when no session is waiting for one', async () => {
      const harness = createHarness();
      // Created, but its link was never opened by this device.
      await createInitSession(harness);

      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: false,
        reason: 'no_waiting_session',
      });
      await flush();

      expect(harness.server.callsTo('bind')).toHaveLength(0);
      expect(mockLogCalls).toContainEqual({
        step: 'returnDiscarded',
        params: expect.objectContaining({ reason: 'no_waiting_session' }),
      });
      expect(await collectObservableOutput(harness)).not.toContain(NONCE);
    });

    test('discards a return when there is no session at all', async () => {
      const harness = createHarness();

      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: false,
        reason: 'no_waiting_session',
      });
      expect(harness.server.post).not.toHaveBeenCalled();
    });

    test.each([
      ['too short', NONCE.slice(1)],
      ['percent-encoded', `${NONCE.slice(3)}%2D`],
      ['not a string', 42 as unknown as string],
    ])('discards a nonce that is %s', async (_label, returnNonce) => {
      const harness = createHarness();
      await createWaitingSession(harness);

      await expect(handleReturn(harness, returnNonce)).resolves.toEqual({
        accepted: false,
        reason: 'malformed_rn',
      });
      await flush();

      expect(harness.server.callsTo('bind')).toHaveLength(0);
    });

    test('binds a return that arrives after the link expired while the server still accepts it', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      // The server froze the destination just before the link expired and
      // its bind window is still open; locally only the link expiry is known.
      jest.setSystemTime(LINK_EXPIRE_TIME + MINUTE);
      harness.server.enqueue('bind', ok(authorizedView()));

      expect((await harness.service.getState()).active?.awaitingReturn).toBe(
        true,
      );
      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
      });
      await flush();

      expect(harness.server.callsTo('bind')).toHaveLength(1);
      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination: DESTINATION,
      });
    });

    test('keeps retrying an INIT answer past the link expiry, within the grace', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      jest.setSystemTime(LINK_EXPIRE_TIME + MINUTE);
      harness.server.enqueue('bind', ok(initView()), ok(authorizedView()));

      await handleReturn(harness, NONCE);
      await flush();

      expect(mockLogCalls).toContainEqual({
        step: 'bindResult',
        params: expect.objectContaining({
          action: 'retry',
          reason: 'init_pending',
        }),
      });
      expect(harness.server.callsTo('query')).toHaveLength(0);
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );
      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.AUTHORIZED,
      );
    });

    test('discards a return once the server can no longer accept a bind', async () => {
      const harness = createHarness();
      await createWaitingSession(harness);

      jest.setSystemTime(LOCAL_RETURN_DEADLINE - 1);
      expect((await harness.service.getState()).active?.awaitingReturn).toBe(
        true,
      );
      jest.setSystemTime(LOCAL_RETURN_DEADLINE);
      expect((await harness.service.getState()).active?.awaitingReturn).toBe(
        false,
      );
      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: false,
        reason: 'no_waiting_session',
      });
      expect(harness.server.callsTo('bind')).toHaveLength(0);
    });

    test('does not stretch a bind deadline the server has given', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue(
        'query',
        ok(
          view(EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND, {
            bindDeadline: NOW + 10 * MINUTE,
          }),
        ),
      );
      await harness.service.refreshSession(snapshot.localId);

      jest.setSystemTime(NOW + 10 * MINUTE);

      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: false,
        reason: 'no_waiting_session',
      });
      expect(harness.server.callsTo('bind')).toHaveLength(0);
    });

    test('binds with the stored key and stores the released destination', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue('bind', ok(authorizedView()));

      await expect(
        harness.service.handleDepositReturn({
          returnNonce: NONCE,
          otherParamNames: ['state', 'not a name!'],
          source: 'os_initial',
        }),
      ).resolves.toEqual({ accepted: true });
      await flush();

      const [bind] = harness.server.callsTo('bind');
      expect(bind.url).toBe(
        `/wallet/v1/exchange/binance/deposit/sessions/${SESSION_ID}/bind`,
      );
      expect(bind.body).toEqual({
        sessionKey: getStoredKey(snapshot.localId),
        returnNonce: NONCE,
      });
      expect(bind.config).toEqual({ autoHandleError: false });

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination: DESTINATION,
        returnReceivedAt: NOW,
        bindAttempts: 1,
        lastBindCode: 0,
      });
      const state = await harness.service.getState();
      expect(state.active).toMatchObject({
        awaitingReturn: false,
        hasPendingNonce: false,
        bindInFlight: false,
      });
      // An AUTHORIZED session keeps its key: it still has to report.
      expect(getStoredKey(snapshot.localId)).toBeDefined();
      expect(mockLogCalls).toContainEqual({
        step: 'returnReceived',
        params: expect.objectContaining({
          source: 'os_initial',
          duplicate: false,
          otherParamNames: ['state', '[invalid]'],
        }),
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    test('returns before the bind request has finished', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      const bind = held(ok(authorizedView()));
      harness.server.enqueue('bind', bind.responder);

      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
      });
      await flush();

      const state = await harness.service.getState();
      expect(state.active).toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        hasPendingNonce: true,
        bindInFlight: true,
      });

      bind.release();
      await flush();
      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.AUTHORIZED,
      );
    });

    test('binds once when the same return is delivered again', async () => {
      const harness = createHarness();
      await createWaitingSession(harness);
      const bind = held(ok(authorizedView()));
      harness.server.enqueue('bind', bind.responder);

      const results = await Promise.all([
        handleReturn(harness, NONCE, 'os_initial'),
        handleReturn(harness, NONCE, 'os_event'),
      ]);
      await flush();
      const whileInFlight = await handleReturn(
        harness,
        NONCE,
        'foreground_fallback',
      );

      expect(results).toEqual([
        { accepted: true },
        { accepted: true, reason: 'duplicate' },
      ]);
      expect(whileInFlight).toEqual({ accepted: true, reason: 'duplicate' });

      bind.release();
      await flush();
      // Replayed after the bind succeeded: still accepted, still one request.
      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
        reason: 'already_bound',
      });
      await flush();
      expect(harness.server.callsTo('bind')).toHaveLength(1);
    });

    test('retries with the same nonce while the server still reports INIT', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue(
        'bind',
        ok(initView()),
        businessError(EBinanceDepositErrorCode.DepositDisabled),
        ok(authorizedView()),
      );

      await handleReturn(harness, NONCE);
      await flush();

      expect(harness.server.callsTo('bind')).toHaveLength(1);
      expect((await harness.service.getState()).active).toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        hasPendingNonce: true,
        bindInFlight: false,
      });

      // Not before the server-side cooldown has passed.
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS - 1,
      );
      expect(harness.server.callsTo('bind')).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(harness.server.callsTo('bind')).toHaveLength(2);
      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        lastBindCode: EBinanceDepositErrorCode.DepositDisabled,
      });

      await jest.advanceTimersByTimeAsync(5000);
      const binds = harness.server.callsTo('bind');
      expect(binds).toHaveLength(3);
      expect(binds.map((call) => call.body.returnNonce)).toEqual([
        NONCE,
        NONCE,
        NONCE,
      ]);
      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        bindAttempts: 3,
      });
      expect(
        mockLogCalls
          .filter((call) => call.step === 'bindAttempt')
          .map((call) => call.params.attempt),
      ).toEqual([1, 2, 3]);
      expect(jest.getTimerCount()).toBe(0);
    });

    test('does not close the session when the nonce is rejected', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue(
        'bind',
        businessError(EBinanceDepositErrorCode.BindProofInvalid),
      );
      harness.server.enqueue('query', ok(initView()));

      await expect(handleReturn(harness, OTHER_NONCE)).resolves.toEqual({
        accepted: true,
      });
      await flush();

      const session = harness.getSession(snapshot.localId);
      expect(session).toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        lastBindCode: EBinanceDepositErrorCode.BindProofInvalid,
      });
      expect(session?.localClosedReason).toBeUndefined();
      expect(session?.returnReceivedAt).toBeUndefined();
      expect(getStoredKey(snapshot.localId)).toBeDefined();
      // The server is asked once whether it expired the session.
      expect(harness.server.callsTo('query')).toHaveLength(1);
      expect((await harness.service.getState()).active).toMatchObject({
        awaitingReturn: true,
        hasPendingNonce: false,
      });
      expect(jest.getTimerCount()).toBe(0);

      // The session still accepts the real return.
      harness.server.enqueue('bind', ok(authorizedView()));
      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
      });
      await flush();
      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination: DESTINATION,
      });
    });

    test('does not send a rejected nonce again', async () => {
      const harness = createHarness();
      await createWaitingSession(harness);
      harness.server.enqueue(
        'bind',
        businessError(EBinanceDepositErrorCode.BindProofInvalid),
      );
      harness.server.enqueue('query', ok(initView()));
      await handleReturn(harness, OTHER_NONCE);
      await flush();

      await expect(handleReturn(harness, OTHER_NONCE)).resolves.toEqual({
        accepted: false,
        reason: 'nonce_already_rejected',
      });
      await flush();

      expect(harness.server.callsTo('bind')).toHaveLength(1);
    });

    test('binds the real nonce that arrived behind a forged one', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      const forged = held(
        businessError(EBinanceDepositErrorCode.BindProofInvalid),
      );
      harness.server.enqueue('bind', forged.responder, ok(authorizedView()));
      harness.server.enqueue('query', ok(initView()));

      await handleReturn(harness, OTHER_NONCE);
      await flush();
      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
        reason: 'queued',
      });
      forged.release();
      await flush();

      expect(
        harness.server.callsTo('bind').map((call) => call.body.returnNonce),
      ).toEqual([OTHER_NONCE, NONCE]);
      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.AUTHORIZED,
      );
      expect((await harness.service.getState()).active?.hasPendingNonce).toBe(
        false,
      );
    });

    test('holds only a few nonces behind the one being bound', async () => {
      const harness = createHarness();
      await createWaitingSession(harness);
      const bind = held(ok(authorizedView()));
      harness.server.enqueue('bind', bind.responder);
      await handleReturn(harness, NONCE);
      await flush();

      const results = [];
      for (const suffix of ['a', 'b', 'c', 'd']) {
        results.push(
          await handleReturn(harness, `${NONCE.slice(0, 42)}${suffix}`),
        );
      }

      expect(results).toEqual([
        { accepted: true, reason: 'queued' },
        { accepted: true, reason: 'queued' },
        { accepted: true, reason: 'queued' },
        { accepted: false, reason: 'queue_full' },
      ]);

      // Binding the first one drops everything queued behind it.
      bind.release();
      await flush();
      expect(harness.server.callsTo('bind')).toHaveLength(1);
      expect((await harness.service.getState()).active).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        hasPendingNonce: false,
      });
    });

    test.each([
      EBinanceDepositSessionStatus.REJECTED,
      EBinanceDepositSessionStatus.EXPIRED,
      EBinanceDepositSessionStatus.SECURITY_CONFLICT,
    ])('closes the session when the server reports %s', async (status) => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue('bind', ok(view(status)));

      await handleReturn(harness, NONCE);
      await flush();

      expect(harness.getSession(snapshot.localId)?.status).toBe(status);
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
      expect((await harness.service.getState()).active).toMatchObject({
        awaitingReturn: false,
        hasPendingNonce: false,
      });
      expect(mockLogCalls).toContainEqual({
        step: 'localCleanup',
        params: expect.objectContaining({
          reason: 'server_terminal',
          secureRemoved: true,
        }),
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    test('closes the session when the server no longer knows it', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue('bind', businessError(10_422));

      await handleReturn(harness, NONCE);
      await flush();

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        localClosedReason: 'key_missing_or_unknown_session',
        lastErrorCode: 10_422,
      });
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });

    test('stops retrying and frees the timer when the session is abandoned', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue('bind', ok(initView()));
      await handleReturn(harness, NONCE);
      await flush();
      expect(jest.getTimerCount()).toBe(1);

      await harness.service.abandonSession(snapshot.localId);

      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(10 * MINUTE);
      expect(harness.server.callsTo('bind')).toHaveLength(1);
      expect((await harness.service.getState()).active).toMatchObject({
        localClosedReason: 'abandoned',
        hasPendingNonce: false,
      });
    });

    test('ignores a bind response that arrives after the session was abandoned', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      const bind = held(ok(authorizedView()));
      harness.server.enqueue('bind', bind.responder);
      await handleReturn(harness, NONCE);
      await flush();

      await harness.service.abandonSession(snapshot.localId);
      bind.release();
      await flush();

      const session = harness.getSession(snapshot.localId);
      expect(session?.localClosedReason).toBe('abandoned');
      expect(session?.status).toBe(EBinanceDepositSessionStatus.INIT);
      expect(session?.destination).toBeUndefined();
    });

    test('gives up once the window has passed and asks the server once', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue('bind', networkError(), networkError());
      harness.server.enqueue('query', ok(initView()));

      await handleReturn(harness, NONCE);
      await flush();
      // Only the link expiry is known locally: the loop goes on until the
      // server could no longer have a bind window open for it.
      jest.setSystemTime(LOCAL_RETURN_DEADLINE);
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );

      expect(harness.server.callsTo('bind')).toHaveLength(2);
      expect(harness.server.callsTo('query')).toHaveLength(1);
      expect(mockLogCalls).toContainEqual({
        step: 'bindResult',
        params: expect.objectContaining({
          action: 'give_up',
          reason: 'deadline_passed',
        }),
      });
      // Not closed: only the server may end a session.
      expect(
        harness.getSession(snapshot.localId)?.localClosedReason,
      ).toBeUndefined();
      expect((await harness.service.getState()).active?.hasPendingNonce).toBe(
        false,
      );
      expect(jest.getTimerCount()).toBe(0);
    });

    test('keeps binding when the server turns out to have a later bind deadline', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue(
        'bind',
        businessError(EBinanceDepositErrorCode.DepositDisabled),
        ok(authorizedView()),
      );
      // The device clock runs ahead: locally the window is over, the server
      // still has it open.
      const bindDeadline = LOCAL_RETURN_DEADLINE + 8 * MINUTE;
      harness.server.enqueue(
        'query',
        ok(
          view(EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND, {
            bindDeadline,
          }),
        ),
      );
      await handleReturn(harness, NONCE);
      jest.setSystemTime(LOCAL_RETURN_DEADLINE + MINUTE);
      await flush();

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
        bindDeadline,
      });
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );

      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.AUTHORIZED,
      );
    });

    test('never stores an address released for another asset', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue(
        'bind',
        ok(authorizedView({ ...DESTINATION, networkId: 'evm--1' })),
      );

      await handleReturn(harness, NONCE);
      await flush();

      const session = harness.getSession(snapshot.localId);
      expect(session?.destination).toBeUndefined();
      expect(session?.status).toBe(EBinanceDepositSessionStatus.INIT);
      expect(session?.localClosedReason).toBe('destination_mismatch');
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });

    test('closes the session when its key has gone missing', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      mockSecureItems.clear();

      await handleReturn(harness, NONCE);
      await flush();

      expect(harness.server.callsTo('bind')).toHaveLength(0);
      expect(harness.getSession(snapshot.localId)?.localClosedReason).toBe(
        'key_missing',
      );
    });
  });

  describe('refreshSession', () => {
    test('mirrors the server view without persisting the link', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);
      harness.server.enqueue(
        'query',
        ok(initView({ linkExpireTime: NOW + 20 * MINUTE })),
      );

      const refreshed = await harness.service.refreshSession(snapshot.localId);

      expect(refreshed).toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        linkExpireTime: NOW + 20 * MINUTE,
      });
      expect(JSON.stringify(refreshed)).not.toContain(LINK);
      expect(JSON.stringify(harness.store.data)).not.toContain(LINK);
    });

    test('closes the session locally when the server does not know it', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);
      harness.server.enqueue('query', businessError(10_422));

      const refreshed = await harness.service.refreshSession(snapshot.localId);

      expect(refreshed).toMatchObject({
        localClosedReason: 'key_missing_or_unknown_session',
        lastErrorCode: 10_422,
      });
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });

    test('surfaces a failed query as a quiet coded error', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);
      harness.server.enqueue('query', networkError());

      const error = await catchError(
        harness.service.refreshSession(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RequestFailed);
      expect(error.autoToast).toBe(false);
      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.INIT,
      );
    });

    test('ignores a stale view that would move the session backwards', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('query', ok(initView()));

      const refreshed = await harness.service.refreshSession(snapshot.localId);

      expect(refreshed).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination: DESTINATION,
      });
    });

    test('never replaces the destination that was already shown', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue(
        'query',
        ok(
          authorizedView({
            ...DESTINATION,
            address: '0x3333333333333333333333333333333333333333',
          }),
        ),
      );

      const refreshed = await harness.service.refreshSession(snapshot.localId);

      expect(refreshed.destination).toEqual(DESTINATION);
      expect(mockLogCalls).toContainEqual({
        step: 'presignCheck',
        params: expect.objectContaining({
          destinationMatches: false,
          reason: 'refresh_changed',
        }),
      });
    });

    test('cannot query a session the server has not confirmed', async () => {
      const harness = createHarness();
      harness.server.enqueue('create', networkError());
      await catchError(harness.service.createSession(CREATE_PARAMS));

      const error = await catchError(
        harness.service.refreshSession(harness.getOnlySession().localId),
      );

      expect(error.code).toBe(
        EBinanceDepositLocalErrorCode.InvalidSessionState,
      );
      expect(harness.server.callsTo('query')).toHaveLength(0);
    });
  });

  describe('revalidateBeforeSign', () => {
    test('passes when the server still reports the displayed destination', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('query', ok(authorizedView()));
      jest.setSystemTime(NOW + MINUTE);

      await expect(
        harness.service.revalidateBeforeSign(snapshot.localId),
      ).resolves.toBeUndefined();

      expect(harness.getSession(snapshot.localId)?.presignCheckedAt).toBe(
        NOW + MINUTE,
      );
      expect(mockLogCalls).toContainEqual({
        step: 'presignCheck',
        params: expect.objectContaining({ ok: true, destinationMatches: true }),
      });
    });

    test.each([
      ['address', { address: '0x3333333333333333333333333333333333333333' }],
      ['tag', { addressTag: '12345' }],
      ['network', { networkId: 'evm--1' }],
      ['contract', { contractAddress: '0x4444' }],
      ['currency', { cryptoCurrency: 'USDC' }],
    ])('blocks signing when the %s differs', async (_label, change) => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue(
        'query',
        ok(authorizedView({ ...DESTINATION, ...change })),
      );

      const error = await catchError(
        harness.service.revalidateBeforeSign(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RevalidateFailed);
      expect(error.autoToast).toBe(true);
      expect(error.message).toBe(
        'Binance deposit address could not be re-verified. Please start a new deposit.',
      );
      const session = harness.getSession(snapshot.localId);
      expect(session?.destination).toEqual(DESTINATION);
      expect(session?.presignCheckedAt).toBeUndefined();
    });

    test('blocks signing and closes the session when the server ended it', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue(
        'query',
        ok(view(EBinanceDepositSessionStatus.SECURITY_CONFLICT)),
      );

      const error = await catchError(
        harness.service.revalidateBeforeSign(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RevalidateFailed);
      expect(error.autoToast).toBe(true);
      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.SECURITY_CONFLICT,
      );
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });

    test('blocks signing when the query fails', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('query', networkError());

      const error = await catchError(
        harness.service.revalidateBeforeSign(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RequestFailed);
      expect(error.autoToast).toBe(true);
      expect(
        harness.getSession(snapshot.localId)?.presignCheckedAt,
      ).toBeUndefined();
    });

    test('blocks signing for a session that is not authorized locally', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);

      const error = await catchError(
        harness.service.revalidateBeforeSign(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RevalidateFailed);
      expect(error.autoToast).toBe(true);
      expect(harness.server.callsTo('query')).toHaveLength(0);
    });
  });

  describe('submitReport', () => {
    const REPORT_PARAMS = { txHash: TX_HASH, senderAddress: SENDER };

    test('stores the report as PENDING before sending it, then confirms it', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      const sessionKey = getStoredKey(snapshot.localId);
      const seen: { report?: unknown } = {};
      harness.server.enqueue('report', (call) => {
        seen.report = { ...harness.getSession(snapshot.localId)?.report };
        return ok({ reportAccepted: true })(call);
      });

      const result = await harness.service.submitReport({
        localId: snapshot.localId,
        ...REPORT_PARAMS,
      });

      expect(seen.report).toMatchObject({
        txHash: TX_HASH,
        senderAddress: SENDER,
        status: 'PENDING',
        attempts: 1,
      });
      const [report] = harness.server.callsTo('report');
      expect(report.url).toBe(
        `/wallet/v1/exchange/binance/deposit/sessions/${SESSION_ID}/report`,
      );
      expect(report.body).toEqual({
        sessionKey,
        txHash: TX_HASH,
        senderAddress: SENDER,
      });
      expect(result.report).toMatchObject({ status: 'CONFIRMED', attempts: 1 });
      // Nothing is left to do with the server: the key is gone.
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
      const output = await collectObservableOutput(harness, result);
      expect(output).not.toContain(sessionKey);
      // Only a prefix of the hash is ever logged.
      expect(JSON.stringify(mockLogCalls)).not.toContain(TX_HASH);
      expect(mockLogCalls).toContainEqual({
        step: 'reportAttempt',
        params: expect.objectContaining({ txHashPrefix: '0xaaaaaaaa…' }),
      });
    });

    test('keeps the report PENDING on a network error without throwing', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('report', networkError());

      const result = await harness.service.submitReport({
        localId: snapshot.localId,
        ...REPORT_PARAMS,
      });

      expect(result.report).toMatchObject({ status: 'PENDING', attempts: 1 });
      expect(getStoredKey(snapshot.localId)).toBeDefined();

      harness.server.enqueue(
        'report',
        businessError(10_000),
        ok({ reportAccepted: true }),
      );
      await harness.service.retryPendingReports();
      expect(harness.getSession(snapshot.localId)?.report).toMatchObject({
        status: 'PENDING',
        attempts: 2,
        lastErrorCode: 10_000,
      });
      await harness.service.retryPendingReports();
      expect(harness.getSession(snapshot.localId)?.report).toMatchObject({
        status: 'CONFIRMED',
        attempts: 3,
      });

      // Nothing pending any more.
      await harness.service.retryPendingReports();
      expect(harness.server.callsTo('report')).toHaveLength(3);
    });

    test.each([
      EBinanceDepositErrorCode.ReportConflict,
      EBinanceDepositErrorCode.SecurityConflict,
      10_422,
    ])(
      'marks the report FAILED on code %s and stops retrying',
      async (code) => {
        const harness = createHarness();
        const snapshot = await createAuthorizedSession(harness);
        harness.server.enqueue('report', businessError(code));

        const result = await harness.service.submitReport({
          localId: snapshot.localId,
          ...REPORT_PARAMS,
        });
        await harness.service.retryPendingReports();

        expect(result.report).toMatchObject({
          status: 'FAILED',
          lastErrorCode: code,
        });
        expect(harness.server.callsTo('report')).toHaveLength(1);
      },
    );

    test('refuses to replace a recorded hash with a different one', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('report', networkError());
      await harness.service.submitReport({
        localId: snapshot.localId,
        ...REPORT_PARAMS,
      });

      const result = await harness.service.submitReport({
        localId: snapshot.localId,
        txHash: TX_HASH.replace(/a/g, 'b'),
        senderAddress: SENDER,
      });

      expect(result.report).toMatchObject({
        txHash: TX_HASH,
        status: 'PENDING',
      });
      expect(harness.server.callsTo('report')).toHaveLength(1);
      expect(mockLogCalls).toContainEqual({
        step: 'reportResult',
        params: expect.objectContaining({ errorName: 'TxHashConflict' }),
      });
    });

    test('sends the same hash again while it is still PENDING', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue(
        'report',
        networkError(),
        ok({ reportAccepted: true }),
      );
      await harness.service.submitReport({
        localId: snapshot.localId,
        ...REPORT_PARAMS,
      });

      const result = await harness.service.submitReport({
        localId: snapshot.localId,
        txHash: TX_HASH.toUpperCase().replace('0X', '0x'),
        senderAddress: SENDER,
      });

      expect(result.report).toMatchObject({
        txHash: TX_HASH,
        status: 'CONFIRMED',
        attempts: 2,
      });
    });

    test('gives up after the maximum number of attempts', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue(
        'report',
        ...Array.from({ length: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS }, () =>
          networkError(),
        ),
      );
      await harness.service.submitReport({
        localId: snapshot.localId,
        ...REPORT_PARAMS,
      });

      for (
        let attempt = 1;
        attempt < BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS + 3;
        attempt += 1
      ) {
        await harness.service.retryPendingReports();
      }

      expect(harness.server.callsTo('report')).toHaveLength(
        BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
      );
      expect(harness.getSession(snapshot.localId)?.report).toMatchObject({
        status: 'FAILED',
        attempts: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
      });
    });

    test('records but does not send a report for a session that is not authorized', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);

      const result = await harness.service.submitReport({
        localId: snapshot.localId,
        ...REPORT_PARAMS,
      });

      expect(result.report).toMatchObject({
        txHash: TX_HASH,
        status: 'FAILED',
      });
      expect(harness.server.callsTo('report')).toHaveLength(0);
    });

    test('picks up a confirmation the server already holds', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('report', networkError());
      await harness.service.submitReport({
        localId: snapshot.localId,
        ...REPORT_PARAMS,
      });
      harness.server.enqueue(
        'query',
        ok({
          ...authorizedView(),
          reportedTxHash: TX_HASH,
          reportStatus: 'CONFIRMED',
        }),
      );

      const refreshed = await harness.service.refreshSession(snapshot.localId);

      expect(refreshed.report?.status).toBe('CONFIRMED');
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });
  });

  describe('abandonSession', () => {
    test('closes the session locally and removes its key', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);

      await harness.service.abandonSession(snapshot.localId);

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        localClosedReason: 'abandoned',
      });
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
      expect(harness.server.calls).toHaveLength(1);
      // An abandoned session no longer accepts a return.
      await expect(handleReturn(harness, NONCE)).resolves.toMatchObject({
        accepted: false,
      });
      // Nor can its link be reopened.
      const error = await catchError(
        harness.service.prepareOpenLink(snapshot.localId),
      );
      expect(error.code).toBe(
        EBinanceDepositLocalErrorCode.InvalidSessionState,
      );
    });

    test('is refused while a report is still pending', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('report', networkError());
      await harness.service.submitReport({
        localId: snapshot.localId,
        txHash: TX_HASH,
        senderAddress: SENDER,
      });

      const error = await catchError(
        harness.service.abandonSession(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.ReportPending);
      expect(error.autoToast).toBe(false);
      expect(
        harness.getSession(snapshot.localId)?.localClosedReason,
      ).toBeUndefined();
      expect(getStoredKey(snapshot.localId)).toBeDefined();
    });

    test('rejects an unknown session', async () => {
      const harness = createHarness();

      const error = await catchError(harness.service.abandonSession('nope'));

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.SessionNotFound);
    });
  });

  describe('getState', () => {
    test('lists earlier sessions newest first, next to the active one', async () => {
      const harness = createHarness();
      const snapshots: IBinanceDepositSessionSnapshot[] = [];
      for (let index = 0; index < 3; index += 1) {
        jest.setSystemTime(NOW + index * MINUTE);
        const snapshot = await createInitSession(harness);
        snapshots.push(snapshot);
        if (index < 2) {
          await harness.service.abandonSession(snapshot.localId);
        }
      }

      const state = await harness.service.getState();

      expect(state.active?.localId).toBe(snapshots[2].localId);
      expect(state.recent.map((item) => item.localId)).toEqual([
        snapshots[1].localId,
        snapshots[0].localId,
      ]);
    });

    test('keeps only the most recent debug events', async () => {
      const harness = createHarness();

      for (
        let index = 0;
        index < BINANCE_DEPOSIT_MAX_DEBUG_EVENTS + 5;
        index += 1
      ) {
        await handleReturn(harness, NONCE);
      }

      const { events } = await harness.service.getState();
      expect(events).toHaveLength(BINANCE_DEPOSIT_MAX_DEBUG_EVENTS);
      expect(events[0]).toEqual({
        ts: NOW,
        step: 'returnDiscarded',
        detail: { source: 'os_event', reason: 'no_waiting_session' },
      });
    });
  });

  describe('getDepositAssets', () => {
    test('keeps deposit-enabled symbols only and leaves their spelling alone', async () => {
      const harness = createHarness();
      harness.serviceToken.getBinanceSupportedAssets.mockResolvedValue({
        'evm--56': {
          USDT: {
            withdrawEnable: true,
            depositEnable: true,
            binanceNetwork: 'BSC',
            contractAddress: CONTRACT,
            requiresAddressTag: false,
          },
          BNB: { withdrawEnable: true, depositEnable: true },
          wBETH: { withdrawEnable: true, depositEnable: true },
          CAKE: { withdrawEnable: true, depositEnable: false },
          OLD: { withdrawEnable: true },
        },
        'xrp--0': {
          XRP: {
            withdrawEnable: false,
            depositEnable: true,
            requiresAddressTag: true,
          },
        },
        'btc--0': { BTC: { withdrawEnable: true, depositEnable: false } },
      });

      await expect(harness.service.getDepositAssets()).resolves.toEqual([
        {
          networkId: 'evm--56',
          symbols: [
            {
              symbol: 'USDT',
              contractAddress: CONTRACT,
              requiresAddressTag: false,
            },
            { symbol: 'BNB' },
            { symbol: 'wBETH' },
          ],
        },
        {
          networkId: 'xrp--0',
          symbols: [{ symbol: 'XRP', requiresAddressTag: true }],
        },
      ]);
    });

    test('leaves out what the app cannot send and passes the deposit dust on', async () => {
      const harness = createHarness();
      harness.serviceToken.getBinanceSupportedAssets.mockResolvedValue({
        'xrp--0': {
          XRP: { depositEnable: true, depositDust: 0.001 },
          // An issued token: the XRP vault only builds native payments.
          RLUSD: {
            depositEnable: true,
            contractAddress: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
            depositDust: 0.000_001,
          },
          // Listed under a second symbol with the dust as a string.
          XRP2: { depositEnable: true, depositDust: '0.99' },
        },
        'evm--137': {
          // The native coin under its placeholder contract, whatever the case.
          POL: {
            depositEnable: true,
            contractAddress:
              '0x0000000000000000000000000000000000001010'.toUpperCase(),
          },
          USDT: {
            depositEnable: true,
            contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            depositDust: 0.01,
          },
        },
        // Nothing left once the placeholder is gone.
        'evm--1101': {
          POL: {
            depositEnable: true,
            contractAddress: '0x0000000000000000000000000000000000001010',
          },
        },
        // The app has no vault for this network.
        'unknown--1': { COIN: { depositEnable: true } },
        'evm--56': {
          BNB: { depositEnable: true, depositDust: 0 },
          NEG: { depositEnable: true, depositDust: -1 },
        },
      });

      await expect(harness.service.getDepositAssets()).resolves.toEqual([
        {
          networkId: 'xrp--0',
          symbols: [
            { symbol: 'XRP', depositDust: '0.001' },
            { symbol: 'XRP2', depositDust: '0.99' },
          ],
        },
        {
          networkId: 'evm--137',
          symbols: [
            {
              symbol: 'USDT',
              contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
              depositDust: '0.01',
            },
          ],
        },
        // The placeholder is specific to Polygon.
        {
          networkId: 'evm--1101',
          symbols: [
            {
              symbol: 'POL',
              contractAddress: '0x0000000000000000000000000000000000001010',
            },
          ],
        },
        // A dust that is not a positive number adds no floor.
        {
          networkId: 'evm--56',
          symbols: [{ symbol: 'BNB' }, { symbol: 'NEG' }],
        },
      ]);
      // Vault settings are looked up, never the token API.
      expect(harness.serviceNetwork.getVaultSettings).toHaveBeenCalledWith({
        networkId: 'xrp--0',
      });
    });

    test.each<[unknown, string]>([
      [0.99, '0.99'],
      [1e-8, '0.00000001'],
      [5, '5'],
      // The contract types the field as a string.
      ['0.99', '0.99'],
      ['0.00000001', '0.00000001'],
      ['1e-8', '0.00000001'],
      ['1E+2', '100'],
      ['10', '10'],
      ['010.50', '10.5'],
    ])(
      'passes a deposit dust of %j on as the decimal string %s',
      async (depositDust, expected) => {
        const harness = createHarness();
        harness.serviceToken.getBinanceSupportedAssets.mockResolvedValue({
          'evm--56': { BNB: { depositEnable: true, depositDust } },
        });

        await expect(harness.service.getDepositAssets()).resolves.toEqual([
          {
            networkId: 'evm--56',
            symbols: [{ symbol: 'BNB', depositDust: expected }],
          },
        ]);
      },
    );

    test.each<[unknown]>([
      [0],
      [-1],
      [Number.NaN],
      [Number.POSITIVE_INFINITY],
      ['0'],
      ['0.0'],
      ['-1'],
      [''],
      [' '],
      [' 0.5'],
      ['0.5 '],
      ['abc'],
      ['NaN'],
      ['Infinity'],
      ['0x10'],
      ['1,5'],
      ['.5'],
      ['5.'],
      ['1e'],
      ['1e999'],
      [null],
      [true],
      [{ value: '0.5' }],
      [['0.5']],
    ])('drops a deposit dust of %j', async (depositDust) => {
      const harness = createHarness();
      harness.serviceToken.getBinanceSupportedAssets.mockResolvedValue({
        'evm--56': { BNB: { depositEnable: true, depositDust } },
      });

      // The asset stays listed; it just carries no dust.
      await expect(harness.service.getDepositAssets()).resolves.toEqual([
        { networkId: 'evm--56', symbols: [{ symbol: 'BNB' }] },
      ]);
    });
  });

  describe('session key that Android cannot read', () => {
    // What the patched expo-secure-store answers while the Keystore is
    // unavailable: null, with the ciphertext left in place.
    function makeKeyUnreadable() {
      jest.replaceProperty(platformEnv, 'isNativeAndroid', true);
      secure.getSecureItem.mockImplementation(async () => null);
    }

    function makeKeyReadableAgain() {
      secure.getSecureItem.mockImplementation(
        async (key) => mockSecureItems.get(key) ?? null,
      );
    }

    function expectSessionUntouched(harness: IHarness, localId: string) {
      expect(harness.getSession(localId)?.localClosedReason).toBeUndefined();
      expect(secure.removeSecureItem).not.toHaveBeenCalled();
      expect(getStoredKey(localId)).toMatch(BINANCE_DEPOSIT_SESSION_KEY_REGEX);
    }

    test('fails the query without closing the session or deleting the key', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      makeKeyUnreadable();

      const error = await catchError(
        harness.service.refreshSession(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RequestFailed);
      expect(harness.server.callsTo('query')).toHaveLength(0);
      expectSessionUntouched(harness, snapshot.localId);

      // The Keystore is back: the same session works again.
      makeKeyReadableAgain();
      harness.server.enqueue('query', ok(authorizedView()));
      await expect(
        harness.service.refreshSession(snapshot.localId),
      ).resolves.toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
      });
    });

    test('keeps a PENDING report pending and counts the attempt', async () => {
      const harness = createHarness();
      const snapshot = await createPendingReportSession(harness);
      makeKeyUnreadable();

      await harness.service.retryPendingReports();

      expect(harness.server.callsTo('report')).toHaveLength(1);
      expect(harness.getSession(snapshot.localId)?.report).toMatchObject({
        status: 'PENDING',
        attempts: 2,
        lastErrorCode: EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
      });
      expectSessionUntouched(harness, snapshot.localId);
      expect(mockLogCalls).toContainEqual({
        step: 'reportResult',
        params: expect.objectContaining({
          attempt: 2,
          ok: false,
          errorName: 'SecureStorageUnreadable',
          reportStatus: 'PENDING',
        }),
      });

      makeKeyReadableAgain();
      harness.server.enqueue('report', ok({ reportAccepted: true }));
      await harness.service.retryPendingReports();
      const confirmed = harness.getSession(snapshot.localId)?.report;
      expect(confirmed).toMatchObject({ status: 'CONFIRMED', attempts: 3 });
      expect(confirmed?.lastErrorCode).toBeUndefined();
    });

    // Leaves the report FAILED the way a key that never comes back does.
    async function exhaustReportOnUnreadableKey(harness: IHarness) {
      const snapshot = await createPendingReportSession(harness);
      makeKeyUnreadable();
      for (
        let attempt = 1;
        attempt < BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS;
        attempt += 1
      ) {
        expect(harness.getSession(snapshot.localId)?.report?.status).toBe(
          'PENDING',
        );
        await harness.service.retryPendingReports();
      }
      return snapshot;
    }

    test('fails the report once the attempts are used up, keeping the session and the key', async () => {
      const harness = createHarness();
      const snapshot = await exhaustReportOnUnreadableKey(harness);

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        report: {
          txHash: TX_HASH,
          status: 'FAILED',
          attempts: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
          lastErrorCode: EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
        },
      });
      // Only the first report ever reached the server.
      expect(harness.server.callsTo('report')).toHaveLength(1);
      expectSessionUntouched(harness, snapshot.localId);

      // The automatic retry leaves a FAILED report alone.
      const failed = harness.getSession(snapshot.localId);
      await harness.service.retryPendingReports();
      expect(harness.getSession(snapshot.localId)).toEqual(failed);
      expectSessionUntouched(harness, snapshot.localId);
    });

    test('lets a session whose report failed on an unreadable key be abandoned', async () => {
      const harness = createHarness();
      const snapshot = await exhaustReportOnUnreadableKey(harness);

      await expect(
        harness.service.abandonSession(snapshot.localId),
      ).resolves.toBeUndefined();

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        localClosedReason: 'abandoned',
        report: {
          status: 'FAILED',
          lastErrorCode: EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
        },
      });
      // Abandoning is what finally lets go of the key.
      expect(secure.removeSecureItem).toHaveBeenCalledWith(
        `${KEY_STORAGE_PREFIX}${snapshot.localId}`,
      );
      expect((await harness.service.getState()).active).toMatchObject({
        localId: snapshot.localId,
        localClosedReason: 'abandoned',
      });
    });

    test('does not re-arm a FAILED report while the key cannot be read', async () => {
      const harness = createHarness();
      const snapshot = await exhaustReportOnUnreadableKey(harness);
      const before = harness.getSession(snapshot.localId);

      const result = await harness.service.retryReport(snapshot.localId);

      // Still FAILED, so still open to being abandoned.
      expect(result.report).toMatchObject({
        status: 'FAILED',
        attempts: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
        lastErrorCode: EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
      });
      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(harness.server.callsTo('report')).toHaveLength(1);
      expectSessionUntouched(harness, snapshot.localId);
      expect(
        mockLogCalls.filter(
          (call) => call.params.errorName === 'RearmedManually',
        ),
      ).toHaveLength(0);
      await expect(
        harness.service.abandonSession(snapshot.localId),
      ).resolves.toBeUndefined();
    });

    test('delivers the report by hand once the key is readable again', async () => {
      const harness = createHarness();
      const snapshot = await exhaustReportOnUnreadableKey(harness);
      makeKeyReadableAgain();
      harness.server.enqueue('report', ok({ reportAccepted: true }));

      const result = await harness.service.retryReport(snapshot.localId);

      expect(result.report).toMatchObject({
        txHash: TX_HASH,
        status: 'CONFIRMED',
        attempts: 1,
      });
      expect(result.report?.lastErrorCode).toBeUndefined();
      expect(harness.server.callsTo('report')).toHaveLength(2);
      const delivered = harness.server.callsTo('report')[1];
      expect(delivered.body.sessionKey).toMatch(
        BINANCE_DEPOSIT_SESSION_KEY_REGEX,
      );
      expect(delivered.body.txHash).toBe(TX_HASH);
      // Nothing is left to do with the server: the key goes.
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });

    test('holds the nonce and binds once the key is readable', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      makeKeyUnreadable();

      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
      });
      await flush();

      expect(harness.server.callsTo('bind')).toHaveLength(0);
      expectSessionUntouched(harness, snapshot.localId);
      expect((await harness.service.getState()).active?.hasPendingNonce).toBe(
        true,
      );

      makeKeyReadableAgain();
      harness.server.enqueue('bind', ok(authorizedView()));
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );
      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.AUTHORIZED,
      );
    });

    test('blocks signing with a retryable error', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      makeKeyUnreadable();

      const error = await catchError(
        harness.service.revalidateBeforeSign(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.RequestFailed);
      expect(error.autoToast).toBe(true);
      expect(harness.server.callsTo('query')).toHaveLength(0);
      expectSessionUntouched(harness, snapshot.localId);
    });

    test('keeps an unconfirmed create replayable', async () => {
      const harness = createHarness();
      harness.server.enqueue('create', networkError());
      await catchError(harness.service.createSession(CREATE_PARAMS));
      const { localId } = harness.getOnlySession();
      makeKeyUnreadable();

      const error = await catchError(harness.service.retryCreate(localId));

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.StorageUnavailable);
      expect(harness.server.callsTo('create')).toHaveLength(1);
      expectSessionUntouched(harness, localId);
    });

    test('still treats a malformed stored value as a lost key', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      jest.replaceProperty(platformEnv, 'isNativeAndroid', true);
      secure.getSecureItem.mockImplementation(async () => 'not-a-session-key');

      await harness.service.refreshSession(snapshot.localId);

      expect(harness.getSession(snapshot.localId)?.localClosedReason).toBe(
        'key_missing',
      );
    });

    test('is a lost key on other platforms, where null only means absent', async () => {
      const harness = createHarness();
      const snapshot = await createPendingReportSession(harness);
      secure.getSecureItem.mockImplementation(async () => null);

      await harness.service.retryPendingReports();

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        localClosedReason: 'key_missing',
        report: { status: 'FAILED' },
      });
      expect(secure.removeSecureItem).toHaveBeenCalledWith(
        `${KEY_STORAGE_PREFIX}${snapshot.localId}`,
      );
    });
  });

  describe('retryReport', () => {
    async function exhaustReportAttempts(harness: IHarness) {
      const snapshot = await createPendingReportSession(harness);
      harness.server.enqueue(
        'report',
        ...Array.from({ length: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS - 1 }, () =>
          businessError(10_000),
        ),
      );
      for (
        let attempt = 1;
        attempt < BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS;
        attempt += 1
      ) {
        await harness.service.retryPendingReports();
      }
      expect(harness.getSession(snapshot.localId)?.report).toMatchObject({
        status: 'FAILED',
        attempts: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
        lastErrorCode: 10_000,
      });
      return snapshot;
    }

    test('re-arms a report that ran out of automatic attempts and sends it', async () => {
      const harness = createHarness();
      const snapshot = await exhaustReportAttempts(harness);
      // The automatic retry stays capped.
      await harness.service.retryPendingReports();
      expect(harness.server.callsTo('report')).toHaveLength(
        BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
      );
      harness.server.enqueue(
        'report',
        businessError(10_000),
        ok({ reportAccepted: true }),
      );

      const rearmed = await harness.service.retryReport(snapshot.localId);

      // Counted from zero again, and sent right away.
      expect(rearmed.report).toMatchObject({
        txHash: TX_HASH,
        senderAddress: SENDER,
        status: 'PENDING',
        attempts: 1,
        lastErrorCode: 10_000,
      });
      expect(harness.server.callsTo('report')).toHaveLength(
        BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS + 1,
      );
      expect(mockLogCalls).toContainEqual({
        step: 'reportResult',
        params: expect.objectContaining({
          errorName: 'RearmedManually',
          attempt: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
          reportStatus: 'PENDING',
        }),
      });

      const confirmed = await harness.service.retryReport(snapshot.localId);
      expect(confirmed.report).toMatchObject({
        status: 'CONFIRMED',
        attempts: 2,
      });
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });

    test.each([
      EBinanceDepositErrorCode.ReportConflict,
      EBinanceDepositErrorCode.SecurityConflict,
      10_422,
    ])('leaves a report the server refused with %s as FAILED', async (code) => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('report', businessError(code));
      await harness.service.submitReport({
        localId: snapshot.localId,
        txHash: TX_HASH,
        senderAddress: SENDER,
      });
      const before = harness.getSession(snapshot.localId);

      const result = await harness.service.retryReport(snapshot.localId);

      expect(result.report).toMatchObject({
        status: 'FAILED',
        attempts: 1,
        lastErrorCode: code,
      });
      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(harness.server.callsTo('report')).toHaveLength(1);
    });

    test('does not re-arm the report of a session that was closed', async () => {
      const harness = createHarness();
      const snapshot = await exhaustReportAttempts(harness);
      await harness.service.abandonSession(snapshot.localId);
      const before = harness.getSession(snapshot.localId);

      const result = await harness.service.retryReport(snapshot.localId);

      expect(result.report?.status).toBe('FAILED');
      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(harness.server.callsTo('report')).toHaveLength(
        BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
      );
    });

    test('does not re-arm a report whose key is gone', async () => {
      const harness = createHarness();
      const snapshot = await exhaustReportAttempts(harness);
      // Not Android: null means the key is absent.
      secure.getSecureItem.mockImplementation(async () => null);
      const before = harness.getSession(snapshot.localId);

      const result = await harness.service.retryReport(snapshot.localId);

      expect(result.report).toMatchObject({
        status: 'FAILED',
        attempts: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
      });
      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(harness.server.callsTo('report')).toHaveLength(
        BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
      );
      expect(mockLogCalls).toContainEqual({
        step: 'reportResult',
        params: expect.objectContaining({
          ok: false,
          errorName: 'SessionKeyMissing',
          reportStatus: 'FAILED',
        }),
      });
    });

    test('sends a PENDING report once more without resetting its count', async () => {
      const harness = createHarness();
      const snapshot = await createPendingReportSession(harness);
      harness.server.enqueue('report', businessError(10_000));

      const result = await harness.service.retryReport(snapshot.localId);

      expect(result.report).toMatchObject({ status: 'PENDING', attempts: 2 });
      expect(harness.server.callsTo('report')).toHaveLength(2);
    });

    test('returns the snapshot as it is when there is no report', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      const before = harness.getSession(snapshot.localId);

      const result = await harness.service.retryReport(snapshot.localId);

      expect(result.report).toBeUndefined();
      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(harness.server.callsTo('report')).toHaveLength(0);
    });

    test('rejects an unknown session', async () => {
      const harness = createHarness();

      const error = await catchError(harness.service.retryReport('nope'));

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.SessionNotFound);
    });
  });

  describe('wallet endpoint binding', () => {
    const MISMATCH_MESSAGE =
      'This Binance deposit session was created on a different server environment. Switch back to that environment to continue.';

    // The app restarted with the test endpoint switch flipped.
    function restartOnOtherEndpoint(harness: IHarness) {
      return restartHarness(harness, { current: OTHER_WALLET_ENDPOINT });
    }

    test('records the endpoint the session was created on', async () => {
      const harness = createHarness();

      const snapshot = await createInitSession(harness);

      expect(harness.getSession(snapshot.localId)?.walletEndpoint).toBe(
        WALLET_ENDPOINT,
      );
      expect(snapshot).toMatchObject({
        walletEndpoint: WALLET_ENDPOINT,
        endpointMismatch: false,
      });
    });

    test('flags an open session of another endpoint in the state', async () => {
      const first = createHarness();
      const snapshot = await createWaitingSession(first);
      const other = restartOnOtherEndpoint(first);

      expect((await other.service.getState()).active).toMatchObject({
        localId: snapshot.localId,
        endpointMismatch: true,
        awaitingReturn: true,
      });
      // Back on the original endpoint nothing is flagged.
      expect(
        (await restartHarness(first).service.getState()).active
          ?.endpointMismatch,
      ).toBe(false);
    });

    test('refuses a query without sending it or touching the session', async () => {
      const first = createHarness();
      const snapshot = await createInitSession(first);
      const before = first.getSession(snapshot.localId);
      const other = restartOnOtherEndpoint(first);

      const error = await catchError(
        other.service.refreshSession(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.EndpointMismatch);
      expect(error.autoToast).toBe(false);
      expect(error.message).toBe(MISMATCH_MESSAGE);
      expect(other.server.callsTo('query')).toHaveLength(0);
      expect(other.getSession(snapshot.localId)).toEqual(before);
      expect(getStoredKey(snapshot.localId)).toBeDefined();
      expect(mockLogCalls).toContainEqual({
        step: 'queryResult',
        params: expect.objectContaining({
          ok: false,
          errorName: 'EndpointMismatch',
        }),
      });

      // The session is usable again once the app points back at its endpoint.
      const back = restartHarness(first);
      back.server.enqueue('query', ok(initView()));
      await expect(
        back.service.refreshSession(snapshot.localId),
      ).resolves.toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        endpointMismatch: false,
      });
    });

    test('does not hand over the link, not even a cached one', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);
      harness.endpoint.current = OTHER_WALLET_ENDPOINT;

      const error = await catchError(
        harness.service.prepareOpenLink(snapshot.localId),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.EndpointMismatch);
      expect(
        harness.getSession(snapshot.localId)?.linkOpenedAt,
      ).toBeUndefined();
      expect(harness.server.callsTo('query')).toHaveLength(0);
    });

    test('keeps a PENDING report pending and uncounted', async () => {
      const first = createHarness();
      const snapshot = await createPendingReportSession(first);
      const before = first.getSession(snapshot.localId);
      const other = restartOnOtherEndpoint(first);

      await other.service.retryPendingReports();
      const retried = await other.service.retryReport(snapshot.localId);

      expect(other.server.callsTo('report')).toHaveLength(1);
      expect(other.getSession(snapshot.localId)).toEqual(before);
      expect(retried).toMatchObject({
        endpointMismatch: true,
        report: { status: 'PENDING', attempts: 1 },
      });
      expect(getStoredKey(snapshot.localId)).toBeDefined();

      // Delivered once the app is back where the session lives.
      const back = restartHarness(first);
      back.server.enqueue('report', ok({ reportAccepted: true }));
      await back.service.retryPendingReports();
      expect(back.getSession(snapshot.localId)?.report).toMatchObject({
        status: 'CONFIRMED',
        attempts: 2,
      });
    });

    test('records a new report locally but does not send it', async () => {
      const first = createHarness();
      const snapshot = await createAuthorizedSession(first);
      const other = restartOnOtherEndpoint(first);

      const result = await other.service.submitReport({
        localId: snapshot.localId,
        txHash: TX_HASH,
        senderAddress: SENDER,
      });

      expect(result.report).toMatchObject({
        txHash: TX_HASH,
        status: 'PENDING',
        attempts: 0,
      });
      expect(other.server.callsTo('report')).toHaveLength(0);
    });

    test('does not re-arm a FAILED report it could not send', async () => {
      const first = createHarness();
      const snapshot = await createPendingReportSession(first);
      first.server.enqueue(
        'report',
        ...Array.from({ length: BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS - 1 }, () =>
          networkError(),
        ),
      );
      for (
        let attempt = 1;
        attempt < BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS;
        attempt += 1
      ) {
        await first.service.retryPendingReports();
      }
      const before = first.getSession(snapshot.localId);
      expect(before?.report?.status).toBe('FAILED');
      const other = restartOnOtherEndpoint(first);

      await other.service.retryReport(snapshot.localId);

      expect(other.getSession(snapshot.localId)).toEqual(before);
    });

    test('blocks signing without asking the other environment', async () => {
      const first = createHarness();
      const snapshot = await createAuthorizedSession(first);
      const before = first.getSession(snapshot.localId);
      const other = restartOnOtherEndpoint(first);

      const error = await catchError(
        other.service.revalidateBeforeSign(snapshot.localId, {
          markSendAttempt: true,
        }),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.EndpointMismatch);
      expect(error.autoToast).toBe(true);
      expect(error.message).toBe(MISMATCH_MESSAGE);
      expect(other.server.callsTo('query')).toHaveLength(0);
      expect(other.getSession(snapshot.localId)).toEqual(before);
    });

    test('does not replay a create against another endpoint', async () => {
      const first = createHarness();
      first.server.enqueue('create', networkError());
      await catchError(first.service.createSession(CREATE_PARAMS));
      const before = first.getOnlySession();
      const other = restartOnOtherEndpoint(first);

      const error = await catchError(other.service.retryCreate(before.localId));

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.EndpointMismatch);
      expect(other.server.callsTo('create')).toHaveLength(1);
      expect(other.getOnlySession()).toEqual(before);
      expect(getStoredKey(before.localId)).toBeDefined();
    });

    // A return taken in on the session's own endpoint, with a bind loop that
    // is still retrying because the server has not confirmed the
    // authorization yet.
    async function createRetryingBind(harness: IHarness) {
      const snapshot = await createWaitingSession(harness);
      harness.server.enqueue('bind', ok(initView()));
      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
      });
      await flush();
      expect(harness.server.callsTo('bind')).toHaveLength(1);
      return snapshot;
    }

    test('holds a running bind without sending or counting it, and resumes after the switch back', async () => {
      const harness = createHarness();
      const snapshot = await createRetryingBind(harness);
      // Changed in the running process, e.g. a custom endpoint in a dev build.
      harness.endpoint.current = OTHER_WALLET_ENDPOINT;

      await jest.advanceTimersByTimeAsync(
        3 * BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );

      // Nothing beyond the call made before the switch.
      expect(harness.server.callsTo('bind')).toHaveLength(1);
      const onHold = harness.getSession(snapshot.localId);
      expect(onHold?.bindAttempts).toBe(1);
      expect(onHold?.lastBindCode).toBe(0);
      expect(onHold?.localClosedReason).toBeUndefined();
      expect((await harness.service.getState()).active).toMatchObject({
        hasPendingNonce: true,
        endpointMismatch: true,
      });
      // Logged once for the whole hold, not on every tick.
      expect(
        mockLogCalls.filter(
          (call) =>
            call.step === 'bindResult' &&
            call.params.errorName === 'EndpointMismatch',
        ),
      ).toHaveLength(1);
      expect(
        mockLogCalls.filter((call) => call.step === 'bindAttempt'),
      ).toHaveLength(1);

      harness.endpoint.current = WALLET_ENDPOINT;
      harness.server.enqueue('bind', ok(authorizedView()));
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        bindAttempts: 2,
      });
    });

    test('drops a held nonce once the bind window has passed', async () => {
      const harness = createHarness();
      const snapshot = await createRetryingBind(harness);
      const before = harness.getSession(snapshot.localId);
      expect(before?.returnReceivedAt).toBe(NOW);
      harness.endpoint.current = OTHER_WALLET_ENDPOINT;

      jest.setSystemTime(LOCAL_RETURN_DEADLINE);
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );

      // The create and the one bind made before the switch.
      expect(harness.server.calls).toHaveLength(2);
      expect(jest.getTimerCount()).toBe(0);
      expect((await harness.service.getState()).active?.hasPendingNonce).toBe(
        false,
      );
      // Not a single write while it was held or when it was dropped.
      expect(harness.getSession(snapshot.localId)).toEqual(before);
    });

    test('does not take in a return that arrives on another endpoint', async () => {
      const first = createHarness();
      const snapshot = await createWaitingSession(first);
      const before = first.getSession(snapshot.localId);
      const other = restartOnOtherEndpoint(first);

      await expect(handleReturn(other, NONCE, 'os_initial')).resolves.toEqual({
        accepted: false,
        reason: 'endpoint_mismatch',
      });
      await flush();
      await jest.advanceTimersByTimeAsync(
        3 * BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      );

      // No bind job, no request, and the record was not written at all: the
      // session still shows that no return was received.
      expect(other.server.callsTo('bind')).toHaveLength(0);
      expect(jest.getTimerCount()).toBe(0);
      expect(other.getSession(snapshot.localId)).toEqual(before);
      expect(before?.returnReceivedAt).toBeUndefined();
      expect((await other.service.getState()).active).toMatchObject({
        awaitingReturn: true,
        hasPendingNonce: false,
        bindInFlight: false,
        endpointMismatch: true,
      });
      expect(
        mockLogCalls.filter((call) => call.step === 'returnDiscarded'),
      ).toEqual([
        {
          step: 'returnDiscarded',
          params: {
            sid: `${SESSION_ID.slice(0, 8)}…`,
            source: 'os_initial',
            reason: 'endpoint_mismatch',
            otherParamNames: undefined,
          },
        },
      ]);
      expect(
        mockLogCalls.filter((call) => call.step === 'returnReceived'),
      ).toHaveLength(0);
      expect(await collectObservableOutput(other)).not.toContain(NONCE);

      // The app is back on the session's endpoint, which takes a restart:
      // the same return, when it is delivered again, is bound. Only iOS has
      // it to deliver again; the Android restart loses it with the process.
      const back = restartHarness(first);
      back.server.enqueue('bind', ok(authorizedView()));
      await expect(
        handleReturn(back, NONCE, 'foreground_fallback'),
      ).resolves.toEqual({ accepted: true });
      await flush();
      expect(back.getSession(snapshot.localId)).toMatchObject({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        returnReceivedAt: NOW + 3 * BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
        destination: DESTINATION,
      });
    });

    test('refuses every delivery of the return while the endpoint differs, then takes it', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      const before = harness.getSession(snapshot.localId);
      harness.endpoint.current = OTHER_WALLET_ENDPOINT;

      // A replayed delivery is refused the same way; none of them is queued
      // or remembered as rejected.
      for (const source of ['os_event', 'foreground_fallback'] as const) {
        await expect(handleReturn(harness, NONCE, source)).resolves.toEqual({
          accepted: false,
          reason: 'endpoint_mismatch',
        });
      }
      await flush();
      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(harness.server.callsTo('bind')).toHaveLength(0);

      harness.endpoint.current = WALLET_ENDPOINT;
      harness.server.enqueue('bind', ok(authorizedView()));
      await expect(handleReturn(harness, NONCE)).resolves.toEqual({
        accepted: true,
      });
      await flush();
      expect(harness.getSession(snapshot.localId)?.status).toBe(
        EBinanceDepositSessionStatus.AUTHORIZED,
      );
    });

    test('still lets the session be abandoned', async () => {
      const first = createHarness();
      const snapshot = await createWaitingSession(first);
      const other = restartOnOtherEndpoint(first);

      await other.service.abandonSession(snapshot.localId);

      expect((await other.service.getState()).active).toMatchObject({
        localClosedReason: 'abandoned',
        // Nothing is left to ask the server, so nothing is flagged.
        endpointMismatch: false,
      });
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });

    test('does not guard a record written before the endpoint was stored', async () => {
      const first = createHarness();
      const snapshot = await createInitSession(first);
      const stored = first.store.data?.sessions[snapshot.localId];
      if (!stored) {
        throw new OneKeyLocalError('expected a stored session');
      }
      delete stored.walletEndpoint;
      const other = restartOnOtherEndpoint(first);
      other.server.enqueue('query', ok(initView()));

      await expect(
        other.service.refreshSession(snapshot.localId),
      ).resolves.toMatchObject({
        status: EBinanceDepositSessionStatus.INIT,
        endpointMismatch: false,
      });
      expect(other.server.callsTo('query')).toHaveLength(1);
    });

    test('keeps treating session not found on its own endpoint as final', async () => {
      const harness = createHarness();
      const snapshot = await createInitSession(harness);
      harness.server.enqueue('query', businessError(10_422));

      const refreshed = await harness.service.refreshSession(snapshot.localId);

      expect(refreshed.localClosedReason).toBe(
        'key_missing_or_unknown_session',
      );
      expect(getStoredKey(snapshot.localId)).toBeUndefined();
    });
  });

  describe('send attempt marker', () => {
    test('is not set by the check made before the confirmation page', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('query', ok(authorizedView()));

      await harness.service.revalidateBeforeSign(snapshot.localId);

      const session = harness.getSession(snapshot.localId);
      expect(session?.presignCheckedAt).toBe(NOW);
      expect(session?.sendAttemptedAt).toBeUndefined();
    });

    test('is stored together with the check that gates the signature', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('query', ok(authorizedView()));
      jest.setSystemTime(NOW + MINUTE);
      const setRawData = jest.mocked(
        harness.service.backgroundApi.simpleDb.binanceDeposit.setRawData,
      );
      const writesBefore = setRawData.mock.calls.length;

      await harness.service.revalidateBeforeSign(snapshot.localId, {
        markSendAttempt: true,
      });

      expect(harness.getSession(snapshot.localId)).toMatchObject({
        presignCheckedAt: NOW + MINUTE,
        sendAttemptedAt: NOW + MINUTE,
      });
      // One write for the server view, one for the check and the marker.
      expect(setRawData.mock.calls.length - writesBefore).toBe(2);
      expect((await harness.service.getState()).active?.sendAttemptedAt).toBe(
        NOW + MINUTE,
      );
      expect(mockLogCalls).toContainEqual({
        step: 'presignCheck',
        params: expect.objectContaining({
          ok: true,
          destinationMatches: true,
          beforeSend: true,
        }),
      });
    });

    test.each<[string, IResponder]>([
      [
        'the destination changed',
        ok(
          authorizedView({
            ...DESTINATION,
            address: '0x3333333333333333333333333333333333333333',
          }),
        ),
      ],
      ['the query failed', networkError()],
    ])('is not set when %s', async (_label, responder) => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue('query', responder);

      await catchError(
        harness.service.revalidateBeforeSign(snapshot.localId, {
          markSendAttempt: true,
        }),
      );

      expect(
        harness.getSession(snapshot.localId)?.sendAttemptedAt,
      ).toBeUndefined();
    });

    test('is cleared only by an explicit acknowledgement', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      harness.server.enqueue(
        'query',
        ok(authorizedView()),
        ok(authorizedView()),
        ok(authorizedView()),
      );
      await harness.service.revalidateBeforeSign(snapshot.localId, {
        markSendAttempt: true,
      });

      // Neither a refresh nor a later check without the flag lifts it; that
      // check is refused and leaves the record as it is.
      await harness.service.refreshSession(snapshot.localId);
      jest.setSystemTime(NOW + MINUTE);
      const refused = await catchError(
        harness.service.revalidateBeforeSign(snapshot.localId),
      );
      expect(refused.code).toBe(
        EBinanceDepositLocalErrorCode.SendAttemptUnresolved,
      );
      expect(harness.getSession(snapshot.localId)).toMatchObject({
        presignCheckedAt: NOW,
        sendAttemptedAt: NOW,
      });

      // The acknowledgement is taken once the attempt is old enough.
      jest.setSystemTime(NOW + 2 * MINUTE);
      const acknowledged = await harness.service.acknowledgeSendAttempt(
        snapshot.localId,
      );

      expect(acknowledged.sendAttemptedAt).toBeUndefined();
      expect(
        harness.getSession(snapshot.localId)?.sendAttemptedAt,
      ).toBeUndefined();
      expect(acknowledged.status).toBe(EBinanceDepositSessionStatus.AUTHORIZED);
      expect(mockLogCalls).toContainEqual({
        step: 'presignCheck',
        params: expect.objectContaining({
          reason: 'send_attempt_acknowledged',
        }),
      });

      // With the hold lifted the session passes the check again, and a new
      // attempt can be marked.
      await expect(
        harness.service.revalidateBeforeSign(snapshot.localId, {
          markSendAttempt: true,
        }),
      ).resolves.toBeUndefined();
      expect(harness.getSession(snapshot.localId)).toMatchObject({
        presignCheckedAt: NOW + 2 * MINUTE,
        sendAttemptedAt: NOW + 2 * MINUTE,
      });
      expect(harness.server.callsTo('query')).toHaveLength(3);
    });

    describe('gate against a second transfer', () => {
      const UNRESOLVED_MESSAGE =
        'A previous transfer for this deposit may already have been sent. Check the account history before sending again.';
      const CHECK_KINDS: [string, { markSendAttempt: boolean } | undefined][] =
        [
          ['made before the confirmation page', undefined],
          ['that gates the signature', { markSendAttempt: true }],
        ];

      function expectRefused(error: Awaited<ReturnType<typeof catchError>>) {
        expect(error.code).toBe(
          EBinanceDepositLocalErrorCode.SendAttemptUnresolved,
        );
        expect(error.autoToast).toBe(true);
        expect(error.message).toBe(UNRESOLVED_MESSAGE);
      }

      test.each(CHECK_KINDS)(
        'refuses the check %s while an attempt is marked, without asking the server',
        async (_label, options) => {
          const harness = createHarness();
          const snapshot = await createAuthorizedSession(harness);
          harness.server.enqueue('query', ok(authorizedView()));
          await harness.service.revalidateBeforeSign(snapshot.localId, {
            markSendAttempt: true,
          });
          const before = harness.getSession(snapshot.localId);
          jest.setSystemTime(NOW + MINUTE);

          expectRefused(
            await catchError(
              harness.service.revalidateBeforeSign(snapshot.localId, options),
            ),
          );

          expect(harness.server.callsTo('query')).toHaveLength(1);
          // Neither the marker nor the time of the last passed check moved.
          expect(harness.getSession(snapshot.localId)).toEqual(before);
          expect(getStoredKey(snapshot.localId)).toBeDefined();
          expect(mockLogCalls).toContainEqual({
            step: 'presignCheck',
            params: expect.objectContaining({
              ok: false,
              reason: 'send_attempt_unresolved',
            }),
          });
        },
      );

      test('lets only one of two concurrent checks that gate the signature pass', async () => {
        const harness = createHarness();
        const snapshot = await createAuthorizedSession(harness);
        const firstQuery = held(ok(authorizedView()));
        const secondQuery = held(ok(authorizedView()));
        harness.server.enqueue(
          'query',
          firstQuery.responder,
          secondQuery.responder,
        );

        // Two confirm pages of the same session, both past the local gate
        // before either has written the marker.
        const checks = [
          harness.service.revalidateBeforeSign(snapshot.localId, {
            markSendAttempt: true,
          }),
          harness.service.revalidateBeforeSign(snapshot.localId, {
            markSendAttempt: true,
          }),
        ];
        const settled = Promise.allSettled(checks);
        await flush();
        expect(harness.server.callsTo('query')).toHaveLength(2);
        expect(
          harness.getSession(snapshot.localId)?.sendAttemptedAt,
        ).toBeUndefined();
        secondQuery.release();
        firstQuery.release();

        const [first, second] = await settled;
        expect([first.status, second.status].toSorted()).toEqual([
          'fulfilled',
          'rejected',
        ]);
        const rejected = [first, second].find(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        );
        expectRefused(
          rejected?.reason as Awaited<ReturnType<typeof catchError>>,
        );
        expect(harness.getSession(snapshot.localId)?.sendAttemptedAt).toBe(NOW);
      });

      test('refuses a check without the mark that raced with the one that set it', async () => {
        const harness = createHarness();
        const snapshot = await createAuthorizedSession(harness);
        const markingQuery = held(ok(authorizedView()));
        const plainQuery = held(ok(authorizedView()));
        harness.server.enqueue(
          'query',
          markingQuery.responder,
          plainQuery.responder,
        );

        const marking = harness.service.revalidateBeforeSign(snapshot.localId, {
          markSendAttempt: true,
        });
        const plain = catchError(
          harness.service.revalidateBeforeSign(snapshot.localId),
        );
        await flush();
        markingQuery.release();
        await expect(marking).resolves.toBeUndefined();
        plainQuery.release();

        // It would have opened a second confirm page for the same session.
        expectRefused(await plain);
        expect(harness.server.callsTo('query')).toHaveLength(2);
        expect(harness.getSession(snapshot.localId)).toMatchObject({
          presignCheckedAt: NOW,
          sendAttemptedAt: NOW,
        });
      });

      test.each(CHECK_KINDS)(
        'refuses the check %s once a transaction is recorded, whatever its report status',
        async (_label, options) => {
          const harness = createHarness();
          const pending = await createPendingReportSession(harness);
          const before = harness.getSession(pending.localId);
          expect(before?.sendAttemptedAt).toBeUndefined();

          expectRefused(
            await catchError(
              harness.service.revalidateBeforeSign(pending.localId, options),
            ),
          );
          expect(harness.getSession(pending.localId)).toEqual(before);

          // The same once the server refused the report for good.
          harness.server.enqueue(
            'report',
            businessError(EBinanceDepositErrorCode.ReportConflict),
          );
          await harness.service.retryPendingReports();
          expect(harness.getSession(pending.localId)?.report?.status).toBe(
            'FAILED',
          );
          expectRefused(
            await catchError(
              harness.service.revalidateBeforeSign(pending.localId, options),
            ),
          );
          expect(harness.server.callsTo('query')).toHaveLength(0);
        },
      );

      test('keeps refusing a session with a report after the attempt was acknowledged', async () => {
        const harness = createHarness();
        const snapshot = await createAuthorizedSession(harness);
        harness.server.enqueue('query', ok(authorizedView()));
        await harness.service.revalidateBeforeSign(snapshot.localId, {
          markSendAttempt: true,
        });
        harness.server.enqueue('report', networkError());
        await harness.service.submitReport({
          localId: snapshot.localId,
          txHash: TX_HASH,
          senderAddress: SENDER,
        });

        jest.setSystemTime(NOW + BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS);
        const acknowledged = await harness.service.acknowledgeSendAttempt(
          snapshot.localId,
        );
        expect(acknowledged.sendAttemptedAt).toBeUndefined();
        expect(acknowledged.report?.status).toBe('PENDING');

        expectRefused(
          await catchError(
            harness.service.revalidateBeforeSign(snapshot.localId, {
              markSendAttempt: true,
            }),
          ),
        );
        expect(
          harness.getSession(snapshot.localId)?.sendAttemptedAt,
        ).toBeUndefined();
        expect(harness.server.callsTo('query')).toHaveLength(1);
      });

      describe('session that stops being open while the check runs', () => {
        const REVALIDATE_FAILED_MESSAGE =
          'Binance deposit address could not be re-verified. Please start a new deposit.';

        function expectRevalidateFailed(
          error: Awaited<ReturnType<typeof catchError>>,
        ) {
          expect(error.code).toBe(
            EBinanceDepositLocalErrorCode.RevalidateFailed,
          );
          expect(error.autoToast).toBe(true);
          expect(error.message).toBe(REVALIDATE_FAILED_MESSAGE);
        }

        // A check writes twice: the server view first, then the check itself
        // with the marker. `intruder` runs between the two, the way another
        // call can take the entity lock in between.
        function runBeforeCheckWrite(
          harness: IHarness,
          intruder: () => Promise<void>,
        ) {
          const entity = harness.service.backgroundApi.simpleDb.binanceDeposit;
          const updateSession = entity.updateSession.bind(entity);
          let writes = 0;
          jest
            .spyOn(entity, 'updateSession')
            .mockImplementation(async (localId, updater) => {
              writes += 1;
              if (writes === 2) {
                await intruder();
              }
              return updateSession(localId, updater);
            });
        }

        test.each(CHECK_KINDS)(
          'refuses the check %s when the session was abandoned after its view was stored',
          async (_label, options) => {
            const harness = createHarness();
            const snapshot = await createAuthorizedSession(harness);
            harness.server.enqueue('query', ok(authorizedView()));
            const abandoned: {
              record?: ReturnType<IHarness['getSession']>;
            } = {};
            runBeforeCheckWrite(harness, async () => {
              await harness.service.abandonSession(snapshot.localId);
              abandoned.record = harness.getSession(snapshot.localId);
            });

            expectRevalidateFailed(
              await catchError(
                harness.service.revalidateBeforeSign(snapshot.localId, options),
              ),
            );

            // The server did confirm the destination; the session was closed
            // right after, and nothing was written onto the closed record.
            expect(harness.server.callsTo('query')).toHaveLength(1);
            expect(abandoned.record?.localClosedReason).toBe('abandoned');
            expect(harness.getSession(snapshot.localId)).toEqual(
              abandoned.record,
            );
            expect(abandoned.record?.presignCheckedAt).toBeUndefined();
            expect(abandoned.record?.sendAttemptedAt).toBeUndefined();
            expect(getStoredKey(snapshot.localId)).toBeUndefined();
            expect(mockLogCalls).toContainEqual({
              step: 'presignCheck',
              params: expect.objectContaining({
                ok: false,
                reason: 'session_closed',
              }),
            });
          },
        );

        test.each(CHECK_KINDS)(
          'refuses the check %s when the session was abandoned while its query was in flight',
          async (_label, options) => {
            const harness = createHarness();
            const snapshot = await createAuthorizedSession(harness);
            const query = held(ok(authorizedView()));
            harness.server.enqueue('query', query.responder);

            const check = catchError(
              harness.service.revalidateBeforeSign(snapshot.localId, options),
            );
            await flush();
            expect(harness.server.callsTo('query')).toHaveLength(1);
            await harness.service.abandonSession(snapshot.localId);
            const abandoned = harness.getSession(snapshot.localId);
            query.release();

            expectRevalidateFailed(await check);
            expect(abandoned?.localClosedReason).toBe('abandoned');
            expect(harness.getSession(snapshot.localId)).toEqual(abandoned);
            expect(abandoned?.presignCheckedAt).toBeUndefined();
            expect(abandoned?.sendAttemptedAt).toBeUndefined();
          },
        );

        test.each(CHECK_KINDS)(
          'refuses the check %s when another query stored a terminal status after its view was stored',
          async (_label, options) => {
            const harness = createHarness();
            const snapshot = await createAuthorizedSession(harness);
            harness.server.enqueue(
              'query',
              ok(authorizedView()),
              ok(view(EBinanceDepositSessionStatus.EXPIRED)),
            );
            runBeforeCheckWrite(harness, async () => {
              await harness.service.refreshSession(snapshot.localId);
            });

            expectRevalidateFailed(
              await catchError(
                harness.service.revalidateBeforeSign(snapshot.localId, options),
              ),
            );

            expect(harness.server.callsTo('query')).toHaveLength(2);
            const session = harness.getSession(snapshot.localId);
            expect(session?.status).toBe(EBinanceDepositSessionStatus.EXPIRED);
            expect(session?.presignCheckedAt).toBeUndefined();
            expect(session?.sendAttemptedAt).toBeUndefined();
          },
        );

        test.each(CHECK_KINDS)(
          'refuses the check %s when the record is gone by the time the check is written',
          async (_label, options) => {
            const harness = createHarness();
            const snapshot = await createAuthorizedSession(harness);
            harness.server.enqueue('query', ok(authorizedView()));
            runBeforeCheckWrite(harness, async () => {
              // What wiping the local data leaves behind.
              harness.store.data = null;
            });

            expectRevalidateFailed(
              await catchError(
                harness.service.revalidateBeforeSign(snapshot.localId, options),
              ),
            );

            // There is no record the marker could have been written to, so
            // the check must not report that signing may start.
            expect(harness.getSession(snapshot.localId)).toBeUndefined();
            expect(mockLogCalls).toContainEqual({
              step: 'presignCheck',
              params: expect.objectContaining({
                ok: false,
                reason: 'check_not_recorded',
              }),
            });
          },
        );

        test('goes by the stored record for whether the marker was written', async () => {
          const harness = createHarness();
          const snapshot = await createAuthorizedSession(harness);
          harness.server.enqueue('query', ok(authorizedView()));
          const entity = harness.service.backgroundApi.simpleDb.binanceDeposit;
          const updateSession = entity.updateSession.bind(entity);
          let writes = 0;
          // The write of the check comes back with a record that carries no
          // marker, as if it had not taken.
          jest
            .spyOn(entity, 'updateSession')
            .mockImplementation(async (localId, updater) => {
              writes += 1;
              const stored = await updateSession(localId, updater);
              return stored && writes === 2
                ? { ...stored, sendAttemptedAt: undefined }
                : stored;
            });

          expectRevalidateFailed(
            await catchError(
              harness.service.revalidateBeforeSign(snapshot.localId, {
                markSendAttempt: true,
              }),
            ),
          );

          expect(writes).toBe(2);
          expect(mockLogCalls).toContainEqual({
            step: 'presignCheck',
            params: expect.objectContaining({
              ok: false,
              reason: 'check_not_recorded',
              beforeSend: true,
            }),
          });
        });
      });
    });

    describe('wait before an attempt can be acknowledged', () => {
      const HOLD_MS = BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS;
      const TOO_EARLY_MESSAGE =
        'The previous transfer may still be signing or broadcasting. Wait, then check the account history before confirming it was not sent.';

      // Signing was allowed to start at NOW.
      async function createMarkedSession(harness: IHarness) {
        const snapshot = await createAuthorizedSession(harness);
        harness.server.enqueue('query', ok(authorizedView()));
        await harness.service.revalidateBeforeSign(snapshot.localId, {
          markSendAttempt: true,
        });
        expect(harness.getSession(snapshot.localId)?.sendAttemptedAt).toBe(NOW);
        return snapshot;
      }

      function expectTooEarly(error: Awaited<ReturnType<typeof catchError>>) {
        expect(error.code).toBe(
          EBinanceDepositLocalErrorCode.SendAttemptAckTooEarly,
        );
        expect(error.autoToast).toBe(false);
        expect(error.message).toBe(TOO_EARLY_MESSAGE);
      }

      async function expectSendStillHeld(harness: IHarness, localId: string) {
        for (const options of [undefined, { markSendAttempt: true }]) {
          const error = await catchError(
            harness.service.revalidateBeforeSign(localId, options),
          );
          expect(error.code).toBe(
            EBinanceDepositLocalErrorCode.SendAttemptUnresolved,
          );
        }
      }

      test('lasts 90 seconds', () => {
        expect(HOLD_MS).toBe(90_000);
      });

      test.each<[string, number]>([
        ['right after the attempt', 0],
        ['one millisecond before the wait is over', HOLD_MS - 1],
        // The device clock was set back after the mark was written, so less
        // than no time has passed: still waiting.
        ['with the device clock set back by a second', -1000],
        ['with the device clock set back by a day', -24 * 60 * MINUTE],
      ])(
        'refuses the acknowledgement %s and keeps the hold',
        async (_label, offsetMs) => {
          const harness = createHarness();
          const snapshot = await createMarkedSession(harness);
          const before = harness.getSession(snapshot.localId);
          jest.setSystemTime(NOW + offsetMs);

          expectTooEarly(
            await catchError(
              harness.service.acknowledgeSendAttempt(snapshot.localId),
            ),
          );

          // Nothing was written, and the refusal left a trace.
          expect(harness.getSession(snapshot.localId)).toEqual(before);
          expect(mockLogCalls).toContainEqual({
            step: 'presignCheck',
            params: {
              sid: `${SESSION_ID.slice(0, 8)}…`,
              ok: false,
              reason: 'send_attempt_ack_too_early',
            },
          });
          expect(
            mockLogCalls.filter(
              (call) => call.params.reason === 'send_attempt_acknowledged',
            ),
          ).toHaveLength(0);
          // Sending again stays refused, and the server is asked nothing.
          await expectSendStillHeld(harness, snapshot.localId);
          expect(harness.server.callsTo('query')).toHaveLength(1);
        },
      );

      test('takes the acknowledgement from the moment the wait is over, and starts over with the next attempt', async () => {
        const harness = createHarness();
        const snapshot = await createMarkedSession(harness);
        jest.setSystemTime(NOW + HOLD_MS - 1);
        expectTooEarly(
          await catchError(
            harness.service.acknowledgeSendAttempt(snapshot.localId),
          ),
        );

        jest.setSystemTime(NOW + HOLD_MS);
        const acknowledged = await harness.service.acknowledgeSendAttempt(
          snapshot.localId,
        );

        expect(acknowledged.sendAttemptedAt).toBeUndefined();
        expect(
          harness.getSession(snapshot.localId)?.sendAttemptedAt,
        ).toBeUndefined();
        expect(mockLogCalls).toContainEqual({
          step: 'presignCheck',
          params: expect.objectContaining({
            ok: true,
            reason: 'send_attempt_acknowledged',
          }),
        });

        // Sending is possible again, and the attempt it marks has a wait of
        // its own, counted from its own time.
        harness.server.enqueue('query', ok(authorizedView()));
        await expect(
          harness.service.revalidateBeforeSign(snapshot.localId, {
            markSendAttempt: true,
          }),
        ).resolves.toBeUndefined();
        expect(harness.getSession(snapshot.localId)?.sendAttemptedAt).toBe(
          NOW + HOLD_MS,
        );
        jest.setSystemTime(NOW + 2 * HOLD_MS - 1);
        expectTooEarly(
          await catchError(
            harness.service.acknowledgeSendAttempt(snapshot.localId),
          ),
        );
        jest.setSystemTime(NOW + 2 * HOLD_MS);
        await expect(
          harness.service.acknowledgeSendAttempt(snapshot.localId),
        ).resolves.toMatchObject({ sendAttemptedAt: undefined });
      });

      test('waits for a session whose transfer was reported too, and never lets that one send again', async () => {
        const harness = createHarness();
        const snapshot = await createMarkedSession(harness);
        harness.server.enqueue('report', networkError());
        await harness.service.submitReport({
          localId: snapshot.localId,
          txHash: TX_HASH,
          senderAddress: SENDER,
        });

        jest.setSystemTime(NOW + HOLD_MS - 1);
        expectTooEarly(
          await catchError(
            harness.service.acknowledgeSendAttempt(snapshot.localId),
          ),
        );
        expect(harness.getSession(snapshot.localId)?.sendAttemptedAt).toBe(NOW);
        await expectSendStillHeld(harness, snapshot.localId);

        jest.setSystemTime(NOW + HOLD_MS);
        const acknowledged = await harness.service.acknowledgeSendAttempt(
          snapshot.localId,
        );
        expect(acknowledged.sendAttemptedAt).toBeUndefined();
        expect(acknowledged.report?.status).toBe('PENDING');
        // The recorded transaction alone keeps the gate shut.
        await expectSendStillHeld(harness, snapshot.localId);
        expect(harness.server.callsTo('query')).toHaveLength(1);
      });
    });

    test('acknowledging changes nothing when no attempt is marked', async () => {
      const harness = createHarness();
      const snapshot = await createAuthorizedSession(harness);
      const before = harness.getSession(snapshot.localId);

      await harness.service.acknowledgeSendAttempt(snapshot.localId);

      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(
        mockLogCalls.filter(
          (call) => call.params.reason === 'send_attempt_acknowledged',
        ),
      ).toHaveLength(0);
    });

    test('acknowledging rejects an unknown session', async () => {
      const harness = createHarness();

      const error = await catchError(
        harness.service.acknowledgeSendAttempt('nope'),
      );

      expect(error.code).toBe(EBinanceDepositLocalErrorCode.SessionNotFound);
    });
  });

  describe('purgeAllSessionKeysForReset', () => {
    test('removes the key of every record and stops what runs in memory', async () => {
      const harness = createHarness();
      // An abandoned one (key already gone), an authorized one that still has
      // to report, and one waiting for its return with a bind in progress.
      const abandoned = await createInitSession(harness);
      await harness.service.abandonSession(abandoned.localId);
      const authorized = await createAuthorizedSession(harness);
      const waiting = await createWaitingSession(harness);
      harness.server.enqueue('bind', ok(initView()));
      // NONCE was spent on the authorized session above.
      await handleReturn(harness, OTHER_NONCE);
      await flush();
      expect(jest.getTimerCount()).toBe(1);
      expect(mockSecureItems.size).toBe(2);
      secure.removeSecureItem.mockClear();

      await expect(
        harness.service.purgeAllSessionKeysForReset(),
      ).resolves.toBeUndefined();

      expect(mockSecureItems.size).toBe(0);
      expect(
        secure.removeSecureItem.mock.calls.map(([key]) => key).toSorted(),
      ).toEqual(
        [abandoned, authorized, waiting]
          .map((item) => `${KEY_STORAGE_PREFIX}${item.localId}`)
          .toSorted(),
      );
      // The retry timer, the nonce and the link are gone as well.
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(10 * MINUTE);
      expect(harness.server.callsTo('bind')).toHaveLength(2);
      expect((await harness.service.getState()).active?.hasPendingNonce).toBe(
        false,
      );
      // The records are left to the reset itself.
      expect(Object.keys(harness.store.data?.sessions ?? {})).toHaveLength(3);
    });

    test('goes on when a key cannot be removed', async () => {
      const harness = createHarness();
      const first = await createInitSession(harness);
      await harness.service.abandonSession(first.localId);
      const second = await createInitSession(harness);
      secure.removeSecureItem.mockClear();
      secure.removeSecureItem.mockRejectedValueOnce(
        new OneKeyLocalError('keychain locked'),
      );

      await expect(
        harness.service.purgeAllSessionKeysForReset(),
      ).resolves.toBeUndefined();

      expect(secure.removeSecureItem).toHaveBeenCalledTimes(2);
      expect(secure.removeSecureItem).toHaveBeenLastCalledWith(
        `${KEY_STORAGE_PREFIX}${second.localId}`,
      );
    });

    test('never throws, even when the records cannot be read', async () => {
      const harness = createHarness();
      await createWaitingSession(harness);
      harness.server.enqueue('bind', ok(initView()));
      await handleReturn(harness, NONCE);
      await flush();
      expect(jest.getTimerCount()).toBe(1);
      secure.removeSecureItem.mockClear();
      jest
        .mocked(
          harness.service.backgroundApi.simpleDb.binanceDeposit.getRawData,
        )
        .mockRejectedValue(new OneKeyLocalError('storage unavailable'));

      await expect(
        harness.service.purgeAllSessionKeysForReset(),
      ).resolves.toBeUndefined();

      // Without the records no key name is known, but what runs in memory is
      // stopped all the same.
      expect(secure.removeSecureItem).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(10 * MINUTE);
      expect(harness.server.callsTo('bind')).toHaveLength(1);
    });
  });

  describe('recordReturnDiscardedByMain', () => {
    test('puts the discard into the log and the debug events, and nothing else', async () => {
      const harness = createHarness();
      const snapshot = await createWaitingSession(harness);
      const before = harness.getSession(snapshot.localId);
      const callsBefore = harness.server.calls.length;

      await expect(
        harness.service.recordReturnDiscardedByMain({
          reason: 'duplicate_rn',
          otherParamNames: ['state', 'not a name!'],
          source: 'os_event',
        }),
      ).resolves.toBeUndefined();

      const expected = {
        source: 'os_event',
        reason: 'duplicate_rn',
        otherParamNames: ['state', '[invalid]'],
        byMain: true,
      };
      expect(mockLogCalls.at(-1)).toEqual({
        step: 'returnDiscarded',
        params: expected,
      });
      expect((await harness.service.getState()).events.at(-1)).toEqual({
        ts: NOW,
        step: 'returnDiscarded',
        detail: { ...expected, otherParamNames: 'state,[invalid]' },
      });
      expect(harness.getSession(snapshot.localId)).toEqual(before);
      expect(harness.server.calls).toHaveLength(callsBefore);
      expect((await harness.service.getState()).active?.hasPendingNonce).toBe(
        false,
      );
    });

    test.each([
      ['a nonce passed as the reason', NONCE],
      ['a URL passed as the reason', `onekey-wallet://x?rn=${NONCE}`],
      ['a reason that is not a string', 42 as unknown as string],
    ])('never records %s', async (_label, reason) => {
      const harness = createHarness();

      await harness.service.recordReturnDiscardedByMain({
        reason,
        otherParamNames: [NONCE],
        source: 'somewhere' as IBinanceDepositReturnSource,
      });

      expect(mockLogCalls.at(-1)).toEqual({
        step: 'returnDiscarded',
        params: {
          source: 'foreground_fallback',
          reason: 'invalid_reason',
          otherParamNames: ['[invalid]'],
          byMain: true,
        },
      });
      expect(await collectObservableOutput(harness)).not.toContain(
        NONCE.slice(0, 16),
      );
    });
  });
});
