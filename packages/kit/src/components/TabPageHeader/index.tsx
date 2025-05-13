import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { HeaderLeft } from './HeaderLeft';
import { HeaderMDSearch } from './HeaderMDSearch';
import { HeaderRight } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({ sceneName, tabRoute }: ITabPageHeaderProp) {
  const renderHeaderLeft = useCallback(
    () => <HeaderLeft sceneName={sceneName} tabRoute={tabRoute} />,
    [sceneName, tabRoute],
  );

  const { config } = useAccountSelectorContextData();

  const renderHeaderRight = useCallback(
    () =>
      config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <HeaderRight sceneName={sceneName} tabRoute={tabRoute} />
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [config, sceneName, tabRoute],
  );

  const renderHeaderTitle = useCallback(
    () => <HeaderTitle sceneName={sceneName} />,
    [sceneName],
  );

  return (
    <>
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerLeft={renderHeaderLeft}
        headerRight={renderHeaderRight}
      />
      <HeaderMDSearch tabRoute={tabRoute} sceneName={sceneName} />
    </>
  );
}
