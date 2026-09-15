import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import ServiceMarketV2 from './ServiceMarketV2';

const mockPerpsFavorites = { favorites: [] as string[] };

jest.mock('../states/jotai/atoms/perps', () => {
  const actual = jest.requireActual<
    typeof import('../states/jotai/atoms/perps')
  >('../states/jotai/atoms/perps');
  return {
    ...actual,
    perpTokenFavoritesPersistAtom: {
      get: jest.fn(async () => mockPerpsFavorites),
      set: jest.fn(async () => undefined),
    },
  };
});

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MemoryPressureWarning: 'MemoryPressureWarning',
  },
  appEventBus: {
    on: jest.fn(),
  },
}));

const existingFavorites: IMarketWatchListItemV2[] = [
  { chainId: 'evm--1', contractAddress: '0x1', sortIndex: 5 },
  { chainId: 'btc--0', contractAddress: '', sortIndex: 6 },
];

describe('ServiceMarketV2 perps favorites ordering', () => {
  const mockWatchListDb = {
    getMarketWatchListV2: jest.fn(async () => ({ data: existingFavorites })),
    getMarketWatchListItemV2: jest.fn(
      async (): Promise<IMarketWatchListItemV2 | undefined> => undefined,
    ),
  };

  const createService = () => {
    const service = new ServiceMarketV2({
      backgroundApi: {
        simpleDb: { marketWatchListV2: mockWatchListDb },
      },
    });
    const addSpy = jest
      .spyOn(service, 'addMarketWatchListV2')
      .mockResolvedValue(undefined as never);
    return { service, addSpy };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPerpsFavorites.favorites = [];
  });

  it('puts a perps favorite starred on the Perps page above existing favorites', async () => {
    const { service, addSpy } = createService();

    await service.syncToMarketWatchList({ coin: 'SOL', action: 'add' });

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        watchList: [
          { chainId: '', contractAddress: '', perpsCoin: 'SOL', sortIndex: 4 },
        ],
      }),
    );
  });

  it('reconciles missing perps favorites on top, newest first', async () => {
    mockPerpsFavorites.favorites = ['BTC', 'ETH'];
    const { service, addSpy } = createService();

    await service.reconcilePerpsFavorites();

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        watchList: [
          { chainId: '', contractAddress: '', perpsCoin: 'BTC', sortIndex: 4 },
          { chainId: '', contractAddress: '', perpsCoin: 'ETH', sortIndex: 3 },
        ],
      }),
    );
  });
});
