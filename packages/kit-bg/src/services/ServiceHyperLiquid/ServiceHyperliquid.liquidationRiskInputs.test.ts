import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';
import type {
  IHex,
  IWsAllDexsClearinghouseState,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsAbstractionModeAtom,
  perpsActiveAccountAtom,
  perpsLiquidationRiskInputsAtom,
} from '../../states/jotai/atoms/perps';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import { invalidatePerpsLiquidationRiskInputs } from './liquidationRiskInputs';
import ServiceHyperliquid from './ServiceHyperliquid';
import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@nktkas/hyperliquid', () => ({
  HttpRequestError: class extends Error {},
  SubscriptionClient: jest.fn(),
  WebSocketTransport: jest.fn(),
}));
jest.mock('p-timeout', () => ({
  __esModule: true,
  default: (promise: Promise<unknown>) => promise,
}));

const USER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as IHex;
const UNIFIED = EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT;
const PORTFOLIO = EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function spotState(available: string) {
  return {
    user: USER,
    spotState: {
      balances: [],
      tokenToAvailableAfterMaintenance: [[0, available]] as [number, string][],
    },
  };
}

const clearinghouseState = {
  user: USER,
  clearinghouseStates: [
    [
      '',
      {
        crossMarginSummary: { accountValue: '100' },
        crossMaintenanceMarginUsed: '10',
      },
    ],
  ],
} as IWsAllDexsClearinghouseState;

describe('liquidation risk snapshot lifecycle', () => {
  const previousScope = globalThis.$onekeyIsInBackground;
  let service: ServiceHyperliquid;
  let subscription: ServiceHyperliquidSubscription;
  let backgroundApi: IBackgroundApi;

  beforeAll(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
  });

  beforeEach(async () => {
    globalThis.$onekeyIsInBackground = true;
    backgroundApi = {
      simpleDb: {
        perp: {
          getPerpData: jest.fn().mockResolvedValue({}),
          setUserAbstractionMode: jest.fn().mockResolvedValue(undefined),
          clearUserAbstractionMode: jest.fn().mockResolvedValue(undefined),
          getUserAbstractionMode: jest.fn().mockResolvedValue(PORTFOLIO),
        },
      },
      serviceHyperliquidCache: {
        writePerpsAccountDisplaySnapshot: jest
          .fn()
          .mockResolvedValue(undefined),
        writePerpsAccountDisplaySummary: jest.fn().mockResolvedValue(undefined),
        writePerpsAccountDisplaySpotBalances: jest
          .fn()
          .mockResolvedValue(undefined),
      },
    } as unknown as IBackgroundApi;
    service = new ServiceHyperliquid({ backgroundApi });
    backgroundApi.serviceHyperliquid = service;
    subscription = new ServiceHyperliquidSubscription({ backgroundApi });
    // Pricing and persistence are unrelated to the eligibility of live risk inputs.
    jest
      .spyOn(
        service as unknown as { _ensureSpotMappings: () => Promise<void> },
        '_ensureSpotMappings',
      )
      .mockResolvedValue(undefined);
    await perpsActiveAccountAtom.set({
      accountId: "hd-1--m/44'/60'/0'/0/0",
      indexedAccountId: 'hd-1--0',
      deriveType: 'default',
      accountAddress: USER,
    });
    await perpsAbstractionModeAtom.set({
      accountAddress: USER,
      mode: UNIFIED,
      source: 'live',
    });
    await invalidatePerpsLiquidationRiskInputs();
    await service.updateSpotBalances(spotState('100'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.$onekeyIsInBackground = previousScope;
    const internals = subscription as unknown as {
      _clearOfflineGrace: () => void;
    };
    internals._clearOfflineGrace();
  });

  function closeSocket() {
    subscription.socketCloseHandler({
      target: { readyState: 3 },
    } as unknown as WebSocketEventMap['close']);
  }

  it('drops pre-disconnect collateral and does not recover it from a clearinghouse-only frame', async () => {
    closeSocket();
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
    await service.updateActiveAccountSummaryFromClearinghouseState(
      clearinghouseState,
    );
    expect(
      (await perpsLiquidationRiskInputsAtom.get())
        ?.tokenToAvailableAfterMaintenance,
    ).toBeUndefined();
    await service.updateSpotBalances(spotState('20'));
    expect(
      (await perpsLiquidationRiskInputsAtom.get())
        ?.tokenToAvailableAfterMaintenance,
    ).toEqual({ 0: '20' });
  });

  it('invalidates on explicit transport teardown even without a close event', async () => {
    await (
      subscription as unknown as { _closeClient: () => Promise<void> }
    )._closeClient();
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
  });

  it.each(['spot', 'clearinghouse'] as const)(
    'rejects an in-flight %s frame after reconnect invalidation',
    async (kind) => {
      const account = await perpsActiveAccountAtom.get();
      const pending = deferred<typeof account>();
      jest
        .spyOn(perpsActiveAccountAtom, 'get')
        .mockReturnValueOnce(pending.promise);
      const oldUpdate =
        kind === 'spot'
          ? service.updateSpotBalances(spotState('999'))
          : service.updateActiveAccountSummaryFromClearinghouseState(
              clearinghouseState,
            );
      closeSocket();
      await service.updateSpotBalances(spotState('20'));
      pending.resolve(account);
      await oldUpdate;
      const risk = await perpsLiquidationRiskInputsAtom.get();
      expect(risk?.tokenToAvailableAfterMaintenance).toEqual({ 0: '20' });
      expect(risk?.crossMarginByDex).toBeUndefined();
    },
  );

  it('clears on a confirmed mode switch before publishing that mode and rejects a pending old-mode frame', async () => {
    const account = await perpsActiveAccountAtom.get();
    const pending = deferred<typeof account>();
    jest
      .spyOn(perpsActiveAccountAtom, 'get')
      .mockReturnValueOnce(pending.promise);
    const oldUpdate = service.updateSpotBalances(spotState('999'));
    jest
      .spyOn(service, 'fetchUserAbstractionRawWithCache')
      .mockResolvedValue(PORTFOLIO);
    Object.assign(service.fetchUserAbstractionRawWithCache, {
      delete: jest.fn(),
    });
    await service.refreshUserAbstractionMode(USER, 'portfolioMargin');
    expect((await perpsAbstractionModeAtom.get())?.mode).toBe(PORTFOLIO);
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
    pending.resolve(account);
    await oldUpdate;
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
    await service.updateSpotBalances(spotState('20'));
    expect(await perpsLiquidationRiskInputsAtom.get()).toMatchObject({
      abstractionMode: PORTFOLIO,
      tokenToAvailableAfterMaintenance: { 0: '20' },
    });
  });

  it('invalidates a mode change discovered by live fetch', async () => {
    jest
      .spyOn(service, 'fetchUserAbstractionRawWithCache')
      .mockResolvedValue(PORTFOLIO);
    await service.fetchUserAbstraction(USER);
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
  });

  it('invalidates a mode change obtained from the cache fallback without accepting new risk until live mode is known', async () => {
    jest
      .spyOn(service, 'fetchUserAbstractionRawWithCache')
      .mockRejectedValue(new Error('offline'));
    await service.fetchUserAbstraction(USER);
    await service.updateSpotBalances(spotState('999'));
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
  });

  it('retains risk on same-mode refreshes, including cache to live source changes', async () => {
    await perpsAbstractionModeAtom.set({
      accountAddress: USER,
      mode: UNIFIED,
      source: 'cache',
    });
    jest
      .spyOn(service, 'fetchUserAbstractionRawWithCache')
      .mockResolvedValue(UNIFIED);
    await service.fetchUserAbstraction(USER);
    expect(
      (await perpsLiquidationRiskInputsAtom.get())
        ?.tokenToAvailableAfterMaintenance,
    ).toEqual({ 0: '100' });
  });

  it('clears risk when the live mode becomes unknown', async () => {
    jest
      .spyOn(service, 'fetchUserAbstractionRawWithCache')
      .mockResolvedValue(undefined);
    await service.fetchUserAbstraction(USER);
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
  });

  it('invalidates a mode change received through WEB_DATA3', async () => {
    jest
      .spyOn(service, 'updateSpotDustingOptOutStatus')
      .mockResolvedValue(undefined);
    const internals = subscription as unknown as {
      _handleSubscriptionData: (
        type: ESubscriptionType,
        event: CustomEvent,
      ) => Promise<void>;
    };
    await internals._handleSubscriptionData(ESubscriptionType.WEB_DATA3, {
      detail: { userState: { user: USER, abstraction: PORTFOLIO } },
    } as CustomEvent);
    expect((await perpsAbstractionModeAtom.get())?.mode).toBe(PORTFOLIO);
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
  });

  it('recovers from account frames arriving before the live mode on the next periodic frame', async () => {
    await invalidatePerpsLiquidationRiskInputs();
    await perpsAbstractionModeAtom.set(undefined);
    await service.updateSpotBalances(spotState('100'));
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
    jest
      .spyOn(service, 'fetchUserAbstractionRawWithCache')
      .mockResolvedValue(UNIFIED);
    await service.fetchUserAbstraction(USER);
    await service.updateSpotBalances(spotState('100'));
    expect(
      (await perpsLiquidationRiskInputsAtom.get())
        ?.tokenToAvailableAfterMaintenance,
    ).toEqual({ 0: '100' });
  });

  it('does not merge an old-mode frame that arrived between invalidation and new-mode publication', async () => {
    const publishMode = deferred<void>();
    const writeStarted = deferred<void>();
    const originalSet = perpsAbstractionModeAtom.set.bind(
      perpsAbstractionModeAtom,
    );
    jest
      .spyOn(perpsAbstractionModeAtom, 'set')
      .mockImplementationOnce(async (value) => {
        writeStarted.resolve();
        await publishMode.promise;
        return originalSet(value);
      });
    jest
      .spyOn(service, 'fetchUserAbstractionRawWithCache')
      .mockResolvedValue(PORTFOLIO);
    const refresh = service.fetchUserAbstraction(USER);
    await writeStarted.promise;
    await service.updateSpotBalances(spotState('999'));
    expect((await perpsLiquidationRiskInputsAtom.get())?.abstractionMode).toBe(
      UNIFIED,
    );
    publishMode.resolve();
    await refresh;
    await service.updateActiveAccountSummaryFromClearinghouseState(
      clearinghouseState,
    );
    const risk = await perpsLiquidationRiskInputsAtom.get();
    expect(risk?.abstractionMode).toBe(PORTFOLIO);
    expect(risk?.tokenToAvailableAfterMaintenance).toBeUndefined();
  });

  it('drops collateral when a silent open socket is declared offline', async () => {
    (
      subscription as unknown as { _markNetworkStatusOffline: () => void }
    )._markNetworkStatusOffline();
    expect(await perpsLiquidationRiskInputsAtom.get()).toBeUndefined();
    await service.updateSpotBalances(spotState('20'));
    expect(
      (await perpsLiquidationRiskInputsAtom.get())
        ?.tokenToAvailableAfterMaintenance,
    ).toEqual({ 0: '20' });
  });
});
