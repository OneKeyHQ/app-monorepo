import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { HeaderLeft } from './HeaderLeft';
import { HeaderRight } from './HeaderRight';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({
  sceneName,
  showHeaderRight,
}: ITabPageHeaderProp) {
  const renderHeaderLeft = useCallback(
    () => <HeaderLeft sceneName={sceneName} />,
    [sceneName],
  );

  const { config } = useAccountSelectorContextData();

  const renderHeaderRight = useCallback(
    () =>
      showHeaderRight && config ? (
        <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
          <HeaderRight sceneName={sceneName} />
        </AccountSelectorProviderMirror>
      ) : null,
    [config, sceneName, showHeaderRight],
  );

  return (
    <Page.Header
      headerLeft={renderHeaderLeft}
      headerRight={renderHeaderRight}
    />
  );
}
