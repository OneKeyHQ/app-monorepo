import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IEventWebData2Parameters,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import ServiceHyperliquid from './ServiceHyperliquid';

const mockWebData2 = jest.fn<
  Promise<IWsWebData2 | null | undefined>,
  [IEventWebData2Parameters]
>();

jest.mock('p-timeout', () => ({
  __esModule: true,
  default: <T>(promise: Promise<T>) => promise,
}));

jest.mock('./utils/fundingHistory', () => ({}));

jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    infoClient: {
      webData2: (params: IEventWebData2Parameters) => mockWebData2(params),
    },
  },
}));

describe('ServiceHyperliquid TWAP response projection', () => {
  // These methods only use the API client; skip unrelated service startup.
  const service = Object.create(
    ServiceHyperliquid.prototype,
  ) as ServiceHyperliquid;
  const params = { user: '0xAbCd' } as const satisfies IEventWebData2Parameters;

  beforeEach(() => mockWebData2.mockReset());

  it('keeps user identity and TWAP state but omits the full account/market snapshot', async () => {
    const twapStates: IWsWebData2['twapStates'] = [
      [
        7,
        {
          coin: 'BTC',
          executedNtl: '0',
          executedSz: '0',
          minutes: 5,
          randomize: false,
          reduceOnly: false,
          side: 'B',
          sz: '1',
          timestamp: 1,
          user: params.user,
        },
      ],
    ];
    const response = {
      user: params.user,
      twapStates,
      meta: { universe: [{ name: 'BTC' }] },
      assetCtxs: [{ markPx: '1' }],
      openOrders: [{ oid: 1 }],
      clearinghouseState: { assetPositions: [] },
    } as unknown as IWsWebData2;
    mockWebData2.mockResolvedValue(response);

    const result = await service.getTwapStates(params);

    expect(result).toEqual({ user: params.user, twapStates });
    expect(result.twapStates).toBe(twapStates);
    expect(JSON.parse(JSON.stringify(result))).toEqual({
      user: params.user,
      twapStates,
    });
    expect(mockWebData2).toHaveBeenCalledTimes(1);
    expect(mockWebData2).toHaveBeenCalledWith(params);
    await expect(service.getWebData2(params)).resolves.toBe(response);
  });

  it('preserves a successful empty TWAP response', async () => {
    mockWebData2.mockResolvedValue({
      user: params.user,
      twapStates: [],
    } as unknown as IWsWebData2);
    await expect(service.getTwapStates(params)).resolves.toEqual({
      user: params.user,
      twapStates: [],
    });
  });

  it.each([null, undefined])(
    'preserves an absent response: %s',
    async (data) => {
      mockWebData2.mockResolvedValue(data);
      await expect(service.getTwapStates(params)).resolves.toBe(data);
    },
  );

  it('propagates the API failure for the existing main fallback', async () => {
    const error = new OneKeyLocalError('TWAP request failed');
    mockWebData2.mockRejectedValue(error);
    await expect(service.getTwapStates(params)).rejects.toBe(error);
  });
});
