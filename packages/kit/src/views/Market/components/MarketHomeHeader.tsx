import { useCallback } from 'react';

import { Page, Stack } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HeaderLeft } from '../../../components/TabPageHeader/HeaderLeft';
import { HeaderRight } from '../../../components/TabPageHeader/HeaderRight';

import { MarketHomeHeaderSearchBar } from './MarketHomeHeaderSearchBar';

export function MarketHomeHeader() {
  const renderHeaderLeft = useCallback(
    () => <HeaderLeft sceneName={EAccountSelectorSceneName.home} />,
    [],
  );
  const renderHeaderRight = useCallback(
    () => (
      <HeaderRight sceneName={EAccountSelectorSceneName.market}>
        <Stack width={184}>
          <MarketHomeHeaderSearchBar />
        </Stack>
      </HeaderRight>
    ),
    [],
  );
  return (
    <Page.Header
      headerLeft={renderHeaderLeft}
      headerRight={renderHeaderRight}
    />
  );
}
