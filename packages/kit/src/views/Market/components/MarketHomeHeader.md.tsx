import { Stack } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';

import { MarketHomeHeaderSearchBar } from './MarketHomeHeaderSearchBar';

export function MarketHomeHeader() {
  return (
    <>
      <TabPageHeader sceneName={EAccountSelectorSceneName.home} />
      <Stack px="$5" py="$3">
        <MarketHomeHeaderSearchBar />
      </Stack>
    </>
  );
}
