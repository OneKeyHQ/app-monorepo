import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  getExploreTabName,
  getExploreUniversalSearchTabRoute,
} from './exploreTabUtils';

describe('exploreTabUtils', () => {
  it.each([
    [ETranslations.global_market, 'market', ETabRoutes.Market],
    [ETranslations.global_earn, 'earn', ETabRoutes.Earn],
    [ETranslations.global_browser, 'browser', ETabRoutes.Discovery],
  ] as const)(
    'maps %s to %s and %s',
    (tab, expectedTabName, expectedTabRoute) => {
      expect(getExploreTabName(tab)).toBe(expectedTabName);
      expect(getExploreUniversalSearchTabRoute(tab)).toBe(expectedTabRoute);
    },
  );
});
