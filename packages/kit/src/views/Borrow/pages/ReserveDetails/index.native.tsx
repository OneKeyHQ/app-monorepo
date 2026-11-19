import { useCallback, useMemo } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';

import {
  IconButton,
  Page,
  SizableText,
  XStack,
  YStack,
  useIsModalPage,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
    | ETabEarnRoutes.BorrowReserveDetailsShare
    | EModalStakingRoutes.BorrowReserveDetails
  >();
  const { shareText } = useShare();
  const isModalPage = useIsModalPage();
  const headerHeight = useHeaderHeight();
  const bodyPaddingTop =
    platformEnv.isNativeIOS26Plus && !isModalPage ? headerHeight : 0;
  const [devSettings] = useDevSettingsPersistAtom();

  const {
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol: routeSymbol,
    logoURI: routeLogoURI,
    accountId: routeAccountId,
    indexedAccountId,
  } = route.params;

  const { details, reserveToken, isLoading, refreshData } =
    useBorrowReserveDetailData({
      accountId: routeAccountId,
      networkId,
      indexedAccountId,
      provider,
      marketAddress,
      reserveAddress,
      resolveTokenMetadata: !routeLogoURI,
    });

  const symbol = reserveToken?.symbol || routeSymbol;
  const logoURI = reserveToken?.logoURI || routeLogoURI;
  const isShareMetadataReady = Boolean(routeLogoURI || reserveToken?.logoURI);

  const shareUrl = useMemo(() => {
    if (
      !symbol ||
      !provider ||
      !networkId ||
      !marketAddress ||
      reserveAddress === undefined
    ) {
      return undefined;
    }
    return BorrowNavigation.generateBorrowShareLink({
      networkId,
      symbol,
      provider,
      marketAddress,
      reserveAddress,
      logoURI,
      isDevMode: devSettings.enabled,
    });
  }, [
    symbol,
    provider,
    networkId,
    marketAddress,
    reserveAddress,
    logoURI,
    devSettings.enabled,
  ]);

  const handleShare = useCallback(() => {
    if (!shareUrl || !isShareMetadataReady) return;
    void shareText(shareUrl);
  }, [isShareMetadataReady, shareUrl, shareText]);

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
        testID="borrow-header-right-icon-btn"
        icon="ShareOutline"
        size="small"
        variant="tertiary"
        iconColor="$iconSubdued"
        disabled={!shareUrl || !isShareMetadataReady}
        onPress={handleShare}
      />
    ),
    [handleShare, isShareMetadataReady, shareUrl],
  );

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} headerRight={headerRight} />
      <Page.Body pt={bodyPaddingTop}>
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
