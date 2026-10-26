import { SimpleDbEntityWalletBanner } from '../dbs/simple/entity/SimpleDbEntityWalletBanner';

import ServiceWalletBanner from './ServiceWalletBanner';

import type { IWalletBannerDBData } from '../dbs/simple/entity/SimpleDbEntityWalletBanner';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => () => undefined,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

const NOW = 1_792_800_000_000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function createStorage(initial?: IWalletBannerDBData) {
  let stored = initial;
  const createService = () => {
    const entity = new SimpleDbEntityWalletBanner();
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => stored);
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation(async (dataOrBuilder) => {
        stored =
          typeof dataOrBuilder === 'function'
            ? await dataOrBuilder(stored)
            : dataOrBuilder;
        return stored;
      });
    const service = new ServiceWalletBanner({
      backgroundApi: { simpleDb: { walletBanner: entity } },
    });
    return { service, entity };
  };
  return { createService, getStored: () => stored };
}

describe('wallet banner snooze persistence', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads existing data without a snooze field', async () => {
    const { createService } = createStorage({
      closedForever: { wallet: true },
    });
    await expect(createService().service.getSnoozedBanners()).resolves.toEqual(
      {},
    );
  });

  it('persists exactly one week and preserves unrelated banner settings across service instances', async () => {
    const { createService, getStored } = createStorage({
      closedForever: { wallet: true },
      topBanners: [],
      snoozedUntil: { other: NOW + 1000 },
    });
    await expect(
      createService().service.snoozeBanner({
        bannerId: 'perps-recall:device:campaign',
      }),
    ).resolves.toBe(NOW + ONE_WEEK_MS);
    expect(getStored()).toEqual({
      closedForever: { wallet: true },
      topBanners: [],
      snoozedUntil: {
        other: NOW + 1000,
        'perps-recall:device:campaign': NOW + ONE_WEEK_MS,
      },
    });
    await expect(createService().service.getSnoozedBanners()).resolves.toEqual(
      getStored()?.snoozedUntil,
    );
  });

  it('does not report a successful snooze when persistence fails', async () => {
    const { createService } = createStorage();
    const { service, entity } = createService();
    jest
      .spyOn(entity, 'setRawData')
      .mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(service.snoozeBanner({ bannerId: 'current' })).rejects.toThrow(
      'Storage unavailable',
    );
  });
});
