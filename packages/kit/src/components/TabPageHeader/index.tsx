import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { DiscoveryHeaderSegment, HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

export { DiscoveryHeaderSegment };

export function TabPageHeader({
  sceneName,
  tabRoute,
  selectedHeaderTab,
  renderCustomHeaderRightItems,
  customHeaderRightItems,
  customHeaderLeftItems,
  hideSearch = false,
  hideHeaderLeft = false,
}: ITabPageHeaderProp) {
  const renderHeaderLeft = useCallback(
    () => (
      <HeaderLeft
        selectedHeaderTab={selectedHeaderTab}
        sceneName={sceneName}
        tabRoute={tabRoute}
        customHeaderLeftItems={customHeaderLeftItems}
      />
    ),
    [selectedHeaderTab, sceneName, tabRoute, customHeaderLeftItems],
  );

  const { config } = useAccountSelectorContextData();

  const renderHeaderRight = useCallback(
    () =>
      config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <HeaderRight
              selectedHeaderTab={selectedHeaderTab}
              sceneName={sceneName}
              tabRoute={tabRoute}
              customHeaderRightItems={customHeaderRightItems}
              renderCustomHeaderRightItems={renderCustomHeaderRightItems}
            />
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [
      config,
      selectedHeaderTab,
      sceneName,
      tabRoute,
      customHeaderRightItems,
      renderCustomHeaderRightItems,
    ],
  );

  const renderHeaderTitle = useCallback(
    () => <HeaderTitle sceneName={sceneName} />,
    [sceneName],
  );

  return (
    <>
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerLeft={hideHeaderLeft ? undefined : renderHeaderLeft}
        headerRight={renderHeaderRight}
      />

      {!hideSearch ? (
        <HeaderMDSearch tabRoute={tabRoute} sceneName={sceneName} />
      ) : null}
    </>
  );
}
