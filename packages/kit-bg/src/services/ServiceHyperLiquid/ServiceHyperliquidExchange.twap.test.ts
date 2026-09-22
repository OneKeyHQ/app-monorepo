import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPlaceTwapOrderParams } from '@onekeyhq/shared/types/hyperliquid';

import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const mockTwapOrder = jest.fn();
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

const params: IPlaceTwapOrderParams = {
  assetId: 1,
  isBuy: true,
  size: '0.054246',
  reduceOnly: false,
  minutes: 5,
  randomize: false,
  referencePrice: '1843.5',
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
      ETranslations.perp_scale_order_size_too_small__msg,
    );
    expect(mockTwapOrder).not.toHaveBeenCalled();
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
});
