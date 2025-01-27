import { useMemo } from 'react';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';

import { MarketHomeHeaderSearchBar } from './MarketHomeHeaderSearchBar';

export function MarketHomeHeader() {
  const content = useMemo(
    () => (
      <>
        <TabPageHeader sceneName={EAccountSelectorSceneName.home} />
        <Stack px="$5" pt={platformEnv.isNativeIOSPad ? '$6' : '$3'} pb="$3">
          <MarketHomeHeaderSearchBar />
        </Stack>
      </>
    ),
    [],
  );
  return platformEnv.isNativeIOSPad ? (
    <Stack
      flexDirection={platformEnv.isNativeIOSPad ? 'row' : 'column'}
      ai="center"
      jc="space-between"
    >
      {content}
    </Stack>
  ) : (
    content
  );
}
