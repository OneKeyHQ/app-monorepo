import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

interface IMockExchangeClient {
  userAddress: string;
  order: jest.Mock;
  modify: jest.Mock;
}

const mockExchangeClients: IMockExchangeClient[] = [];
const mockActiveAccountState: { value: { accountAddress?: string } } = {
  value: {},
};

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  ExchangeClient: jest
    .fn()
    .mockImplementation(({ wallet }: { wallet: { userAddress: string } }) => {
      const client: IMockExchangeClient = {
        userAddress: wallet.userAddress,
        order: jest.fn().mockResolvedValue({
          status: 'ok',
          response: {
            type: 'order',
            data: { statuses: [{ resting: { oid: 1 } }] },
          },
        }),
        modify: jest.fn().mockResolvedValue({
          status: 'ok',
          response: { type: 'default' },
        }),
      };
      mockExchangeClients.push(client);
      return client;
    }),
}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('../../states/jotai/atoms', () => ({
  perpsActiveAccountAtom: {
    get: () => Promise.resolve(mockActiveAccountState.value),
  },
  perpsActiveAccountStatusAtom: {
    get: () => Promise.resolve({ canTrade: true, details: { agentOk: true } }),
  },
  perpsAbstractionModeAtom: { get: () => Promise.resolve(undefined) },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    getLocale: () => 'en-US',
    onLocaleChange: () => () => {},
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: { hyperliquid: new Proxy({}, { get: () => jest.fn() }) },
  },
}));

const ADDRESS_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ADDRESS_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const symbolMeta = { assetId: 0, isSpot: false, universe: { szDecimals: 3 } };
const tradingUniverse = { universesByDex: [[{ assetId: 0, szDecimals: 3 }]] };
const accountChangedMessage = ETranslations.active_trading_account_changed__msg;

const getSymbolMeta = jest.fn();
const getTradingUniverse = jest.fn();
const backgroundApi = {
  serviceHyperliquid: {
    getSymbolMeta,
    fetchExtraAgentsWithCache: { clear: jest.fn() },
    getUserApprovedMaxBuilderFeeWithCache: { clear: jest.fn() },
  },
  serviceHyperliquidWallet: {
    getProxyWallet: jest.fn(
      async ({
        agentCredential,
      }: {
        agentCredential: { agentAddress: string; userAddress: string };
      }) => ({
        address: agentCredential.agentAddress,
        wallet: { userAddress: agentCredential.userAddress },
      }),
    ),
  },
  serviceRookieGuide: { recordTaskCompleted: jest.fn() },
  simpleDb: {
    perp: {
      getPerpData: jest.fn().mockResolvedValue({}),
      getTradingUniverse,
      getSpotMeta: jest.fn().mockResolvedValue({ universes: [], tokens: [] }),
      isFirstPerpOrderOpen: jest.fn().mockResolvedValue(false),
      markPerpOrderOpen: jest.fn(),
    },
  },
} as unknown as IBackgroundApi;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const credentialFor = (userAddress: string) => ({
  agentAddress: `0x${userAddress.slice(-4).repeat(10)}`,
  agentName: EHyperLiquidAgentName.OneKeyAgent1,
  userAddress,
  validUntil: 2_000_000_000_000,
});

const addPositionParams = {
  coin: 'BTC',
  expectedAccountAddress: ADDRESS_A,
  isBuy: true,
  size: '0.1',
  price: '100',
  orderType: 'limit' as const,
  tif: 'Gtc' as const,
};

const chaseParams = {
  coin: 'BTC',
  oid: 7,
  newPrice: '101',
  isBuy: true,
  size: '0.1',
  reduceOnly: false,
  amendKind: { kind: 'limit' as const, tif: 'Gtc' as const },
  alwaysPlace: true as const,
  expectedAccountAddress: ADDRESS_A,
};

describe('ServiceHyperliquidExchange account guard', () => {
  let service: ServiceHyperliquidExchange;
  const previousScope = globalThis.$onekeyIsInBackground;

  const switchTo = async (address: string) => {
    mockActiveAccountState.value = { accountAddress: address };
    await service.setup({
      userAddress: address as `0x${string}`,
      agentCredential: credentialFor(address),
    });
  };

  const orderCalls = () =>
    mockExchangeClients.reduce(
      (sum, client) => sum + client.order.mock.calls.length,
      0,
    );
  const modifyCalls = () =>
    mockExchangeClients.reduce(
      (sum, client) => sum + client.modify.mock.calls.length,
      0,
    );

  beforeEach(async () => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    mockExchangeClients.length = 0;
    getSymbolMeta.mockResolvedValue(symbolMeta);
    getTradingUniverse.mockResolvedValue(tradingUniverse);
    service = new ServiceHyperliquidExchange({ backgroundApi });
    await switchTo(ADDRESS_A);
  });

  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it('signs an add-position order with the confirmed account', async () => {
    await service.placeOrderByCoin(addPositionParams);

    expect(mockExchangeClients).toHaveLength(1);
    expect(mockExchangeClients[0].userAddress).toBe(ADDRESS_A);
    expect(mockExchangeClients[0].order).toHaveBeenCalledTimes(1);
  });

  it('rejects an add-position order when the account switches during the metadata lookup', async () => {
    const meta = createDeferred<typeof symbolMeta>();
    getSymbolMeta.mockReturnValueOnce(meta.promise);

    const pending = service.placeOrderByCoin(addPositionParams);
    await flush();
    expect(getSymbolMeta).toHaveBeenCalledTimes(1);

    await switchTo(ADDRESS_B);
    meta.resolve(symbolMeta);

    await expect(pending).rejects.toThrow(accountChangedMessage);
    expect(mockExchangeClients.map((client) => client.userAddress)).toEqual([
      ADDRESS_A,
      ADDRESS_B,
    ]);
    expect(orderCalls()).toBe(0);
  });

  it('rejects a chase amendment when the account switches during the metadata lookup', async () => {
    const meta = createDeferred<typeof symbolMeta>();
    getSymbolMeta.mockReturnValueOnce(meta.promise);

    const pending = service.amendOrderPriceByOid(chaseParams);
    await flush();
    expect(getSymbolMeta).toHaveBeenCalledTimes(1);

    await switchTo(ADDRESS_B);
    meta.resolve(symbolMeta);

    await expect(pending).rejects.toThrow(accountChangedMessage);
    expect(modifyCalls()).toBe(0);
  });

  it('binds a plain order open to the account that was active when it started', async () => {
    const universe = createDeferred<typeof tradingUniverse>();
    getTradingUniverse.mockReturnValueOnce(universe.promise);

    const pending = service.orderOpen({
      assetId: 0,
      isBuy: true,
      size: '0.1',
      price: '100',
      type: 'limit',
      tif: 'Gtc',
    });
    await flush();
    expect(getTradingUniverse).toHaveBeenCalledTimes(1);

    await switchTo(ADDRESS_B);
    universe.resolve(tradingUniverse);

    await expect(pending).rejects.toThrow(accountChangedMessage);
    expect(orderCalls()).toBe(0);
  });
});
