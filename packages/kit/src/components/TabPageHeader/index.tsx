import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { HeaderLeft } from './HeaderLeft';
import { HeaderRight } from './HeaderRight';
import { HeaderTitle } from './HeaderTitle';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({
  sceneName,
  showHeaderRight,
  showCustomHeaderRight,
  children,
}: ITabPageHeaderProp) {
  useDebugComponentRemountLog({
    name: `web TabPageHeader:${sceneName}:${String(showHeaderRight)}`,
  });

  const renderHeaderLeft = useCallback(
    () => <HeaderLeft sceneName={sceneName} />,
    [sceneName],
  );

  const { config } = useAccountSelectorContextData();

  const renderHeaderRight = useCallback(
    () =>
      showHeaderRight && config ? (
        <HomeTokenListProviderMirror>
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <HeaderRight sceneName={sceneName}>{children}</HeaderRight>
          </AccountSelectorProviderMirror>
        </HomeTokenListProviderMirror>
      ) : null,
    [children, config, sceneName, showHeaderRight],
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
        headerRight={showCustomHeaderRight || renderHeaderRight}
      />
    </>
  );
}
