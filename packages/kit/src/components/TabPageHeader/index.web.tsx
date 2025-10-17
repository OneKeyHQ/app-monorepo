import { Page } from '@onekeyhq/components';

import { DexHeaderContainer } from './DexHeader';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({
  sceneName: _sceneName,
  tabRoute: _tabRoute,
  renderCustomHeaderRightItems: _renderCustomHeaderRightItems,
  customHeaderRightItems: _customHeaderRightItems,
  customHeaderLeftItems: _customHeaderLeftItems,
  hideSearch: _hideSearch = false,
}: ITabPageHeaderProp) {
  return (
    <>
      <Page.Header headerShown={false} />
      <DexHeaderContainer />
    </>
  );
}
