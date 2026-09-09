import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

export type IExploreTabName = 'market' | 'earn' | 'browser';

const UNIVERSAL_SEARCH_TAB_ROUTE_MAP: Record<IExploreTabName, ETabRoutes> = {
  market: ETabRoutes.Market,
  earn: ETabRoutes.Earn,
  browser: ETabRoutes.Discovery,
};

export function getExploreTabName(tab: ETranslations): IExploreTabName {
  if (tab === ETranslations.global_market) {
    return 'market';
  }
  if (tab === ETranslations.global_earn) {
    return 'earn';
  }
  return 'browser';
}

export function getExploreUniversalSearchTabRoute(
  tab: ETranslations,
): ETabRoutes {
  return UNIVERSAL_SEARCH_TAB_ROUTE_MAP[getExploreTabName(tab)];
}
