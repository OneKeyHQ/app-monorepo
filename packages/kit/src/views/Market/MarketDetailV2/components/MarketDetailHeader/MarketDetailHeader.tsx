import { useMemo } from 'react';

import { NavBackButton, XStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MarketWatchListProviderMirrorV2 } from '../../../MarketWatchListProviderMirrorV2';
import { useMarketDetailBackNavigation } from '../../hooks/useMarketDetailBackNavigation';
import { TokenDetailHeader } from '../TokenDetailHeader/TokenDetailHeader';

import { TabPageHeaderContainer } from './TabPageHeaderContainer';

export function MarketDetailHeader() {
  const media = useMedia();
  const { handleBackPress } = useMarketDetailBackNavigation();

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <NavBackButton onPress={handleBackPress} />
        {platformEnv.isWeb || platformEnv.isExtensionUiExpandTab ? null : (
          <AccountSelectorTriggerHome num={0} />
        )}
      </XStack>
    ),
    [handleBackPress],
  );

  const customHeaderRight = useMemo(() => null, []);

  return (
    <>
      {media.md ? (
        <TabPageHeaderContainer>
          <NavBackButton onPress={handleBackPress} />

          <MarketWatchListProviderMirrorV2
            storeName={EJotaiContextStoreNames.marketWatchListV2}
          >
            <TokenDetailHeader
              containerProps={{ p: '$0' }}
              showStats={false}
              showMediaAndSecurity={false}
            />
          </MarketWatchListProviderMirrorV2>
        </TabPageHeaderContainer>
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.Market}
          customHeaderLeftItems={customHeaderLeft}
          customHeaderRightItems={
            platformEnv.isNative ? customHeaderRight : null
          }
          hideSearch={!media.gtMd}
        />
      )}
    </>
  );
}
