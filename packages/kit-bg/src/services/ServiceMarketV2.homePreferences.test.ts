import ServiceMarketV2 from './ServiceMarketV2';

import type { IMarketHomePreferences } from '../states/jotai/atoms';

let mockPreferences: IMarketHomePreferences;
const mockSetPreferences = jest.fn(
  async (update: (prev: IMarketHomePreferences) => IMarketHomePreferences) => {
    mockPreferences = update(mockPreferences);
  },
);

jest.mock('../states/jotai/atoms', () => ({
  marketHomePreferencesAtom: {
    set: (update: (prev: IMarketHomePreferences) => IMarketHomePreferences) =>
      mockSetPreferences(update),
  },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));

describe('market home preference updates in bg', () => {
  beforeEach(() => {
    mockSetPreferences.mockClear();
    mockPreferences = {
      timeRange: '1h',
      selectedNetworkId: 'onekeyall--0',
      selectedStockCategory: 'ai-tech',
      selectedTopCoinsCategory: 'defi',
      watchlistFilter: 'stocks',
    };
  });

  it('preserves independently selected filters when native updates arrive together', async () => {
    await Promise.all([
      ServiceMarketV2.prototype.updateMarketHomePreferences({
        timeRange: '24h',
      }),
      ServiceMarketV2.prototype.updateMarketHomePreferences({
        selectedNetworkId: 'evm--1',
      }),
      ServiceMarketV2.prototype.updateMarketHomePreferences({
        selectedStockCategory: 'consumer-tech',
      }),
    ]);

    expect(mockPreferences).toEqual({
      timeRange: '24h',
      selectedNetworkId: 'evm--1',
      selectedStockCategory: 'consumer-tech',
      selectedTopCoinsCategory: 'defi',
      watchlistFilter: 'stocks',
    });
  });
});
