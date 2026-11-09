import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPlaceTwapOrderParams } from '@onekeyhq/shared/types/hyperliquid';

import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const mockTwapOrder = jest.fn();
const mockFormatMessage = jest.fn(({ id }: { id: string }) => id);
jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  ExchangeClient: jest.fn().mockImplementation(() => ({
    twapOrder: mockTwapOrder,
  })),
}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('../../states/jotai/atoms', () => ({
  perpsActiveAccountAtom: { get: async () => ({}) },
  perpsActiveAccountStatusAtom: {
    get: async () => ({ canTrade: true, details: { agentOk: true } }),
  },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat('en-US', options).format(value),
      formatMessage: (...args: Parameters<typeof mockFormatMessage>) =>
        mockFormatMessage(...args),
    },
    getLocale: () => 'en-US',
    onLocaleChange: () => () => {},
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: { hyperliquid: new Proxy({}, { get: () => jest.fn() }) },
  },
}));

const params: IPlaceTwapOrderParams = {
  assetId: 1,
  isBuy: true,
  size: '0.054246',
  reduceOnly: false,
  minutes: 5,
  randomize: false,
  referencePrice: '1843.5',
  markPrice: '1843.5',
};
const recordTaskCompleted = jest.fn();

describe('ServiceHyperliquidExchange TWAP notional', () => {
  let service: ServiceHyperliquidExchange;
  const previousScope = globalThis.$onekeyIsInBackground;

  beforeEach(async () => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    mockTwapOrder.mockResolvedValue({
      status: 'ok',
      response: {
        type: 'twapOrder',
        data: { status: { running: { twapId: 1 } } },
      },
    });
    service = new ServiceHyperliquidExchange({
      backgroundApi: {
        serviceHyperliquidWallet: {
          getOnekeyWallet: jest.fn().mockResolvedValue({}),
        },
        serviceRookieGuide: { recordTaskCompleted },
        simpleDb: {
          perp: {
            getPerpData: jest.fn().mockResolvedValue({}),
            getTradingUniverse: jest.fn().mockResolvedValue({
              universesByDex: [[{ assetId: 1, szDecimals: 4 }]],
            }),
            getSpotMeta: jest.fn().mockResolvedValue({ universes: [] }),
          },
        },
      } as unknown as IBackgroundApi,
    });
    await service.setup({
      userAccountId: 'wallet-a',
      userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  });

  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it('rejects an order whose raw notional passes but wire notional is below 100', async () => {
    await expect(service.placeTwapOrder(params)).rejects.toThrow(
      ETranslations.perp_twap_min_order_notional__msg,
    );
    expect(mockTwapOrder).not.toHaveBeenCalled();
    expect(mockFormatMessage).toHaveBeenCalledWith(
      { id: ETranslations.perp_twap_min_order_notional__msg },
      { amount: '100.11' },
    );
    expect(recordTaskCompleted).not.toHaveBeenCalled();
  });

  it('submits the truncated size when its wire notional meets the minimum', async () => {
    await service.placeTwapOrder({ ...params, size: '0.054399' });

    expect(mockTwapOrder).toHaveBeenCalledWith({
      twap: { a: 1, b: true, s: '0.0543', r: false, m: 5, t: false },
    });
  });

  it('accepts an exact 100 notional after truncation', async () => {
    await service.placeTwapOrder({
      ...params,
      size: '0.010099',
      referencePrice: '10000',
      szDecimals: 3,
    });

    expect(mockTwapOrder).toHaveBeenCalledWith({
      twap: { a: 1, b: true, s: '0.01', r: false, m: 5, t: false },
    });
  });

  it('rejects a confirmed trigger direction that the mark has crossed', async () => {
    await expect(
      service.placeTwapOrder({
        ...params,
        size: '0.0543',
        triggerPrice: '1900',
        triggerAbove: true,
        referencePrice: '1950',
        markPrice: '1950',
      }),
    ).rejects.toThrow(ETranslations.target_market_data_changed__msg);
    expect(mockTwapOrder).not.toHaveBeenCalled();
  });

  it('submits advanced details and rejects an invalid stop before calling the SDK', async () => {
    const advanced = {
      ...params,
      size: '0.0543',
      triggerPrice: '1900',
      triggerAbove: true,
      stopPrice: '2000',
    };
    await service.placeTwapOrder(advanced);
    expect(mockTwapOrder).toHaveBeenCalledWith({
      twap: { a: 1, b: true, s: '0.0543', r: false, m: 5, t: false },
      details: { t: { p: '1900', a: true }, s: '2000' },
    });
    await expect(
      service.placeTwapOrder({ ...advanced, stopPrice: '1800' }),
    ).rejects.toThrow(ETranslations.perp_twap_max_price_above_trigger__msg);
    expect(mockTwapOrder).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      true,
      undefined,
      '1843.5',
      ETranslations.perp_twap_max_price_above_mark__msg,
    ],
    [
      false,
      undefined,
      '1843.5',
      ETranslations.perp_twap_min_price_below_mark__msg,
    ],
    [
      true,
      '1900',
      '1850',
      ETranslations.perp_twap_max_price_above_trigger__msg,
    ],
    [
      false,
      '1800',
      '1820',
      ETranslations.perp_twap_min_price_below_trigger__msg,
    ],
  ] as const)(
    'reports the actual stop boundary and rejects submission: buy=%s, trigger=%s',
    async (isBuy, triggerPrice, stopPrice, errorKey) => {
      await expect(
        service.placeTwapOrder({
          ...params,
          size: '0.0543',
          isBuy,
          triggerPrice,
          triggerAbove: triggerPrice ? isBuy : undefined,
          stopPrice,
        }),
      ).rejects.toThrow(errorKey);
      expect(mockTwapOrder).not.toHaveBeenCalled();
    },
  );

  it('uses mark for spot trigger direction while keeping mid for the minimum', async () => {
    await service.placeTwapOrder({
      ...params,
      assetId: 10_001,
      size: '1',
      referencePrice: '100',
      markPrice: '102',
      triggerPrice: '101',
      triggerAbove: false,
    });
    expect(mockTwapOrder).toHaveBeenCalledWith({
      twap: { a: 10_001, b: true, s: '1', r: false, m: 5, t: false },
      details: { t: { p: '101', a: false }, s: null },
    });
  });

  it.each(['102', ''])(
    'rejects a buy stop below mark or without mark: %s',
    async (markPrice) => {
      await expect(
        service.placeTwapOrder({
          ...params,
          assetId: 10_001,
          size: '1',
          referencePrice: '100',
          markPrice,
          stopPrice: '101',
        }),
      ).rejects.toThrow();
      expect(mockTwapOrder).not.toHaveBeenCalled();
    },
  );
});
