import { useCallback } from 'react';

import {
  NavBackButton,
  Page,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { InformationPanelSkeleton } from '../../../views/Market/MarketDetailV2/components/InformationPanel';
import { TabPageHeaderContainer } from '../../../views/Market/MarketDetailV2/components/MarketDetailHeader/TabPageHeaderContainer';
import { MarketTradingViewLoading } from '../../../views/Market/MarketDetailV2/components/MarketTradingView/MarketTradingViewLoading';
import { useMarketDetailBackNavigation } from '../../../views/Market/MarketDetailV2/hooks/useMarketDetailBackNavigation';
import { MarketTestIDs } from '../../../views/Market/testIDs';

function MarketDetailLoadingHeader() {
  const { handleBackPress } = useMarketDetailBackNavigation();
  const renderHeaderLeft = useCallback(
    () => <NavBackButton onPress={handleBackPress} />,
    [handleBackPress],
  );
  const renderHeaderTitle = useCallback(
    () => (
      <XStack alignItems="center" gap="$2">
        <Skeleton width="$8" height="$8" radius="round" />
        <YStack gap="$1">
          <Skeleton width="$16" height="$4" />
          <Skeleton width="$24" height="$3" />
        </YStack>
      </XStack>
    ),
    [],
  );

  if (platformEnv.isNativeIOS26Plus) {
    return (
      <Page.Header
        headerShown
        headerLeft={renderHeaderLeft}
        headerTitle={renderHeaderTitle}
      />
    );
  }

  return (
    <TabPageHeaderContainer>
      <NavBackButton onPress={handleBackPress} />
      <XStack flex={1} alignItems="center" gap="$2">
        <Skeleton width="$8" height="$8" radius="round" />
        <YStack gap="$1">
          <Skeleton width="$16" height="$4" />
          <Skeleton width="$24" height="$3" />
        </YStack>
      </XStack>
      <XStack gap="$3">
        <Skeleton width="$8" height="$8" radius="round" />
        <Skeleton width="$8" height="$8" radius="round" />
      </XStack>
    </TabPageHeaderContainer>
  );
}

export function MarketDetailV2LoadingFallback() {
  return (
    <>
      <MarketDetailLoadingHeader />
      <YStack testID={MarketTestIDs.detailPageLoading} flex={1} bg="$bgApp">
        <XStack
          minHeight="$11"
          alignItems="center"
          gap="$6"
          px="$5"
          borderBottomWidth={1}
          borderColor="$borderSubdued"
        >
          <Skeleton width="$12" height="$4" />
          <Skeleton width="$12" height="$4" />
        </XStack>
        <InformationPanelSkeleton />
        <MarketTradingViewLoading minHeight={240} />
      </YStack>
    </>
  );
}
