import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { MDUniversalSearchInput } from './LegacyUniversalSearchInput';

import type { ITabPageHeaderProp } from './type';

export function HeaderMDSearch({
  sceneName: _sceneName,
  tabRoute,
}: ITabPageHeaderProp) {
  return tabRoute === ETabRoutes.Home || tabRoute === ETabRoutes.Market ? (
    <MDUniversalSearchInput />
  ) : null;
}
