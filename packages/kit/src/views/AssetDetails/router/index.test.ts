import { ModalAssetDetailsStack } from '.';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes/assetDetails';

jest.mock('../../../components/LazyLoadPage', () => ({
  LazyLoadPage: (load: () => Promise<unknown>) => load,
}));
jest.mock('../pages/NativeMarketDetail', () => ({
  __esModule: true,
  default: 'native-asset-market-modal',
}));
jest.mock('../../Market/LegacyMarketDetailRoute', () => ({
  __esModule: true,
  default: 'legacy-market-v2',
}));
jest.mock('../pages/MarketChart', () => ({
  __esModule: true,
  default: 'asset-market-chart',
}));

describe('asset market modal routes', () => {
  const originalIsNative = platformEnv.isNative;
  afterEach(() => {
    platformEnv.isNative = originalIsNative;
  });

  async function loadRoute(name: EModalAssetDetailRoutes) {
    const route = ModalAssetDetailsStack.find((item) => item.name === name);
    // LazyLoadPage is replaced with its loader so this tests the real route registration.
    const load = route?.component as unknown as () => Promise<{
      default: string;
    }>;
    return (await load()).default;
  }

  it('preserves the existing desktop/web detail entry', async () => {
    platformEnv.isNative = false;
    expect(await loadRoute(EModalAssetDetailRoutes.MarketDetail)).toBe(
      'legacy-market-v2',
    );
  });

  it('opens the simple asset modal on native phones and tablets', async () => {
    platformEnv.isNative = true;
    expect(await loadRoute(EModalAssetDetailRoutes.MarketDetail)).toBe(
      'native-asset-market-modal',
    );
  });

  it('preserves the chart-only route for tokens without a CoinGecko ID', async () => {
    expect(await loadRoute(EModalAssetDetailRoutes.MarketChart)).toBe(
      'asset-market-chart',
    );
  });
});
