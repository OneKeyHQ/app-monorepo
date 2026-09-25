import { EventEmitter } from 'events';

import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';
import { EWalletConnectSessionEvents } from '@onekeyhq/shared/src/walletConnect/types';

import { walletConnectDiagnostics } from '../../services/ServiceWalletConnect/WalletConnectDiagnostics';

import type { WalletConnectRequestProxy } from './WalletConnectRequestProxy';
import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';

const mockGetWalletSideClient = jest.fn<Promise<IWalletKit>, []>();
let mockTransitionBlocked = false;
const mockGetEnvironment = jest.fn(async () =>
  RuntimeEnvironment.create(
    getTravelModeRuntimeProfile(false),
    () => mockTransitionBlocked,
  ),
);

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { getRuntimeEnvironment: mockGetEnvironment },
}));
jest.mock('../../services/ServiceWalletConnect/walletConnectClient', () => ({
  __esModule: true,
  default: {
    getWalletSideClient: () => mockGetWalletSideClient(),
    getWalletSideStorageSessions: async () => [{ topic: 'stored-session' }],
  },
}));
jest.mock('./WalletConnectRequestProxyAlgo', () => ({
  WalletConnectRequestProxyAlgo: jest.fn(),
}));
jest.mock('./WalletConnectRequestProxyCosmos', () => ({
  WalletConnectRequestProxyCosmos: jest.fn(),
}));
jest.mock('./WalletConnectRequestProxyEth', () => ({
  WalletConnectRequestProxyEth: jest.fn(),
}));

describe('WalletConnect Travel Mode event gating', () => {
  it('blocks existing session listeners after activation and unregisters the same callbacks', async () => {
    const { default: ProviderApiWalletConnect } =
      await import('./ProviderApiWalletConnect');
    const getWcChainInfo = jest.fn(async () => undefined);
    const handleSessionDelete = jest.fn(async () => undefined);
    const provider = new ProviderApiWalletConnect({
      backgroundApi: {
        serviceWalletConnect: { getWcChainInfo, handleSessionDelete },
        serviceApp: { showToast: jest.fn(async () => undefined) },
      },
    });
    const on = jest.fn();
    const off = jest.fn();
    const pingOn = jest.fn();
    const pingOff = jest.fn();
    const respondSessionRequest = jest.fn(async () => undefined);
    provider.web3Wallet = {
      on,
      off,
      engine: { signClient: { events: { on: pingOn, off: pingOff } } },
      respondSessionRequest,
    } as unknown as IWalletKit;
    provider.registerEvents();
    const requestListener = on.mock.calls.find(
      ([event]) => event === EWalletConnectSessionEvents.session_request,
    )?.[1] as (request: WalletKitTypes.SessionRequest) => Promise<void>;
    const request = {
      topic: 'session-topic',
      id: 1,
      params: {
        chainId: 'eip155:1',
        request: { method: 'eth_sendTransaction', params: [] },
      },
    } as unknown as WalletKitTypes.SessionRequest;

    await requestListener(request);
    expect(getWcChainInfo).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    getWcChainInfo.mockClear();
    respondSessionRequest.mockClear();
    mockTransitionBlocked = true;

    for (const [, listener] of on.mock.calls as Array<
      [string, (args: unknown) => Promise<void>]
    >) {
      await listener(request);
    }
    expect(getWcChainInfo).not.toHaveBeenCalled();
    expect(handleSessionDelete).not.toHaveBeenCalled();
    expect(respondSessionRequest).not.toHaveBeenCalled();
    expect(walletConnectDiagnostics.getSnapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'session_request_blocked_by_travel_mode',
          requestId: 1,
        }),
      ]),
    );
    provider.unregisterEvents();
    expect(off.mock.calls).toEqual(on.mock.calls);
    expect(pingOff.mock.calls).toEqual(pingOn.mock.calls);
  });
});

describe('WalletConnect request diagnostics', () => {
  beforeEach(() => {
    mockTransitionBlocked = false;
    walletConnectDiagnostics.clear();
  });

  async function createProvider() {
    const { default: ProviderApiWalletConnect } =
      await import('./ProviderApiWalletConnect');
    const checkMethodSupport = jest.fn(async () => false);
    const getWcChainInfo = jest.fn(async () => ({
      wcNamespace: 'eip155',
      networkId: 'evm--1',
    }));
    const getConnectedAccounts = jest.fn<
      Promise<{ accountInfo: { networkId?: string } }[] | undefined>,
      []
    >(async () => undefined);
    const provider = new ProviderApiWalletConnect({
      backgroundApi: {
        serviceDApp: { getConnectedAccounts },
        serviceWalletConnect: {
          getWcChainInfo,
          checkMethodSupport,
          getNetworkImplByNamespace: async () => 'evm',
        },
      },
    });
    const on = jest.fn();
    const respondSessionRequest = jest.fn(async (_params: unknown) => {});
    // Exercise the actual registered callback with a minimal WalletKit fixture.
    provider.web3Wallet = {
      on,
      engine: { signClient: { events: { on: jest.fn() } } },
      respondSessionRequest,
    } as unknown as IWalletKit;
    provider.registerEvents();
    const listener = on.mock.calls.find(
      ([event]) => event === EWalletConnectSessionEvents.session_request,
    )?.[1] as (request: WalletKitTypes.SessionRequest) => Promise<void>;
    const request = {
      id: 17,
      topic: 'session-topic',
      verifyContext: { verified: { origin: 'https://dapp.example' } },
      params: {
        chainId: 'eip155:1',
        request: { method: 'eth_unsupported', params: [] },
      },
    } as unknown as WalletKitTypes.SessionRequest;
    return {
      provider,
      listener,
      request,
      respondSessionRequest,
      getWcChainInfo,
      checkMethodSupport,
      getConnectedAccounts,
    };
  }

  it.each([
    { accounts: undefined, responseFails: false },
    { accounts: undefined, responseFails: true },
    { accounts: [], responseFails: false },
    { accounts: [{ accountInfo: {} }], responseFails: false },
  ])(
    'rejects missing account data $accounts once without dispatch (response fails: $responseFails)',
    async ({ accounts, responseFails }) => {
      const {
        provider,
        listener,
        request,
        respondSessionRequest,
        checkMethodSupport,
        getConnectedAccounts,
      } = await createProvider();
      checkMethodSupport.mockResolvedValue(true);
      request.params.request.method = 'eth_sendTransaction';
      getConnectedAccounts.mockResolvedValue(accounts);
      const dispatch = jest.fn(async () => '0xunexpected-transaction');
      jest.spyOn(provider, 'getRequestProxy').mockReturnValue({
        providerName: 'ethereum',
        request: dispatch,
      } as unknown as WalletConnectRequestProxy);
      const transportError = new Error('response transport failed');
      if (responseFails)
        respondSessionRequest.mockRejectedValueOnce(transportError);

      if (responseFails)
        await expect(listener(request)).rejects.toBe(transportError);
      else await listener(request);

      expect(getConnectedAccounts).toHaveBeenCalledTimes(1);
      expect(dispatch).not.toHaveBeenCalled();
      expect(respondSessionRequest).toHaveBeenCalledTimes(1);
      expect(respondSessionRequest).toHaveBeenCalledWith({
        topic: request.topic,
        response: {
          id: request.id,
          jsonrpc: '2.0',
          error: expect.objectContaining({
            code: 5000,
            message: expect.stringContaining('No connected account'),
          }),
        },
      });
    },
  );

  it.each([false, true])(
    'never resubmits a response when transport fails after execution (method rejected: %s)',
    async (methodRejected) => {
      const {
        provider,
        listener,
        request,
        respondSessionRequest,
        checkMethodSupport,
      } = await createProvider();
      checkMethodSupport.mockResolvedValue(true);
      request.params.request.method = 'eth_sendTransaction';
      const dispatch = jest.fn(async () => '0xcompleted-transaction');
      if (methodRejected)
        dispatch.mockRejectedValue(new Error('User rejected'));
      jest.spyOn(provider, 'switchNetwork').mockResolvedValue();
      jest.spyOn(provider, 'getRequestProxy').mockReturnValue({
        request: dispatch,
      } as unknown as WalletConnectRequestProxy);
      const transportError = new Error('socket disconnected during response');
      respondSessionRequest.mockRejectedValueOnce(transportError);

      await expect(listener(request)).rejects.toBe(transportError);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(respondSessionRequest).toHaveBeenCalledTimes(1);
      expect(respondSessionRequest).toHaveBeenCalledWith({
        topic: request.topic,
        response: {
          id: request.id,
          jsonrpc: '2.0',
          ...(methodRejected
            ? { error: expect.objectContaining({ code: 5000 }) }
            : { result: '0xcompleted-transaction' }),
        },
      });
      const events = walletConnectDiagnostics
        .getSnapshot()
        .events.map((event) => event.event);
      expect(events).toContain('response_failed');
      if (!methodRejected) {
        expect(events).toContain('method_completed');
        expect(events).not.toContain('sending_error_response');
      }
    },
  );

  it('distinguishes unsupported methods from communication failures', async () => {
    const { listener, request, respondSessionRequest } = await createProvider();
    await listener(request);
    expect(respondSessionRequest).toHaveBeenCalledWith({
      topic: request.topic,
      response: {
        id: 17,
        jsonrpc: '2.0',
        error: expect.objectContaining({ code: 5101 }),
      },
    });
    expect(walletConnectDiagnostics.getSnapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'session_request',
          method: 'eth_unsupported',
        }),
        expect.objectContaining({
          event: 'unsupported_method',
          errorCode: 5101,
        }),
        expect.objectContaining({ event: 'response_submitted', requestId: 17 }),
      ]),
    );

    walletConnectDiagnostics.clear();
    const transportError = new Error('socket disconnected');
    respondSessionRequest.mockRejectedValueOnce(transportError);
    await expect(listener(request)).rejects.toBe(transportError);
    expect(walletConnectDiagnostics.getSnapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'response_failed',
          errorCategory: 'Connection / transport',
        }),
      ]),
    );
    expect(
      walletConnectDiagnostics.getSnapshot().events.map((event) => event.event),
    ).not.toContain('response_submitted');
  });

  it('records failures before dispatch without swallowing them', async () => {
    const { listener, request, getWcChainInfo, respondSessionRequest } =
      await createProvider();
    const error = new Error('chain lookup failed');
    getWcChainInfo.mockRejectedValueOnce(error);
    await expect(listener(request)).rejects.toBe(error);
    expect(respondSessionRequest).not.toHaveBeenCalled();
    expect(walletConnectDiagnostics.getSnapshot().events[0]).toMatchObject({
      event: 'session_request_failed',
      requestId: 17,
      level: 'error',
    });
  });
});

describe('WalletConnect concurrent initialization', () => {
  beforeEach(() => {
    mockTransitionBlocked = false;
    mockGetWalletSideClient.mockReset();
  });

  async function createProvider() {
    const { default: ProviderApiWalletConnect } =
      await import('./ProviderApiWalletConnect');
    const getWcChainInfo = jest.fn(async () => undefined);
    const provider = new ProviderApiWalletConnect({
      backgroundApi: {
        serviceWalletConnect: { getWcChainInfo },
        serviceApp: { showToast: jest.fn(async () => undefined) },
      },
    });
    const events = new EventEmitter();
    const pingEvents = new EventEmitter();
    const respondSessionRequest = jest.fn(async () => undefined);
    const pair = jest.fn(async () => undefined);
    // Only event registration, pairing and request responses are used by this fixture.
    const wallet = Object.assign(events, {
      engine: { signClient: { events: pingEvents } },
      respondSessionRequest,
      pair,
    }) as unknown as IWalletKit;
    return {
      provider,
      wallet,
      events,
      pingEvents,
      getWcChainInfo,
      respondSessionRequest,
      pair,
    };
  }

  it('registers once when startup restoration and pairing initialize together', async () => {
    const {
      provider,
      wallet,
      events,
      pingEvents,
      getWcChainInfo,
      respondSessionRequest,
      pair,
    } = await createProvider();
    let finishInitialization = () => {};
    const initializing = new Promise<void>((resolve) => {
      finishInitialization = resolve;
    });
    mockGetWalletSideClient.mockImplementation(async () => {
      await initializing;
      return wallet;
    });
    const restoring = provider.initializeOnStart();
    const pairing = provider.connectToDapp('wc:test-pairing');
    await Promise.resolve();
    finishInitialization();
    await Promise.all([restoring, pairing]);
    await provider.initialize();

    expect(mockGetWalletSideClient).toHaveBeenCalledTimes(1);
    expect(pair).toHaveBeenCalledTimes(1);
    expect(events.listenerCount('session_request')).toBe(1);
    expect(events.listenerCount('session_proposal')).toBe(1);
    expect(pingEvents.listenerCount('session_ping')).toBe(1);
    const request = {
      id: 42,
      topic: 'session-topic',
      params: {
        chainId: 'eip155:1',
        request: { method: 'personal_sign', params: [] },
      },
    } as unknown as WalletKitTypes.SessionRequest;
    const listeners = events.listeners('session_request') as Array<
      (event: WalletKitTypes.SessionRequest) => Promise<void>
    >;
    await Promise.all(listeners.map((listener) => listener(request)));
    expect(getWcChainInfo).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    provider.unregisterEvents();
    expect(events.eventNames()).toEqual([]);
    expect(pingEvents.eventNames()).toEqual([]);
  });

  it('allows initialization to retry after a shared failure', async () => {
    const { provider, wallet, events } = await createProvider();
    const error = new Error('Synthetic initialization failure');
    mockGetWalletSideClient
      .mockRejectedValueOnce(error)
      .mockResolvedValue(wallet);
    const results = await Promise.allSettled([
      provider.initialize(),
      provider.initialize(),
    ]);
    expect(results).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    expect(provider.web3Wallet).toBeUndefined();
    expect(mockGetWalletSideClient).toHaveBeenCalledTimes(1);

    await provider.initialize();
    expect(mockGetWalletSideClient).toHaveBeenCalledTimes(2);
    expect(events.listenerCount('session_request')).toBe(1);
    provider.unregisterEvents();
  });
});
