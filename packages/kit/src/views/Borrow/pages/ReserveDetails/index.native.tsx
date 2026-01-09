import { useCallback, useMemo } from 'react';

import {
  IconButton,
  Page,
  SizableText,
  XStack,
  YStack,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalStakingRoutes,
  ETabEarnRoutes,
  IModalStakingParamList,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BorrowNavigation } from '../../borrowUtils';

import { DetailsPart } from './components/DetailsPart';
import { useBorrowReserveDetailData } from './hooks/useBorrowReserveDetailData';

const ReserveDetailsPage = () => {
  // Support both tab route and modal route
  const route = useAppRoute<
    ITabEarnParamList & IModalStakingParamList,
    | ETabEarnRoutes.BorrowReserveDetails
    | EModalStakingRoutes.BorrowReserveDetails
  >();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();

  const {
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
    accountId: routeAccountId,
    indexedAccountId,
  } = route.params;

  const { details, isLoading, refreshData } = useBorrowReserveDetailData({
    accountId: routeAccountId,
    networkId,
    indexedAccountId,
    provider,
    marketAddress,
    reserveAddress,
  });

  const shareUrl = useMemo(() => {
    if (!symbol || !provider || !networkId || !marketAddress || !reserveAddress)
      return undefined;
    return BorrowNavigation.generateBorrowShareLink({
      networkId,
      symbol,
      provider,
      marketAddress,
      reserveAddress,
      isDevMode: devSettings.enabled,
    });
  }, [
    symbol,
    provider,
    networkId,
    marketAddress,
    reserveAddress,
    devSettings.enabled,
  ]);

  const handleShare = useCallback(() => {
    if (!shareUrl) return;
    void shareText(shareUrl);
  }, [shareUrl, shareText]);

  // Native modal header: Token icon + Symbol
  const headerTitle = useCallback(
    () => (
      <XStack gap="$2" alignItems="center">
        <Token size="sm" tokenImageUri={logoURI} />
        <SizableText size="$headingLg" numberOfLines={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [symbol, logoURI],
  );

  const headerRight = useCallback(
    () => (
      <IconButton
        icon="ShareOutline"
        size="small"
        variant="tertiary"
        iconColor="$iconSubdued"
        onPress={handleShare}
      />
    ),
    [handleShare],
  );

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} headerRight={headerRight} />
      <Page.Body>
        <YStack flex={1}>
          <DetailsPart
            details={details}
            isLoading={isLoading ?? false}
            onRefresh={refreshData}
            networkId={networkId}
            provider={provider}
            marketAddress={marketAddress}
            reserveAddress={reserveAddress}
            symbol={symbol}
            logoURI={logoURI}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
};

function ReserveDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ReserveDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default ReserveDetailsPageWithProvider;
