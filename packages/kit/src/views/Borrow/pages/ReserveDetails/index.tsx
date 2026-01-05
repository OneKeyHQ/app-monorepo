import { useCallback, useMemo } from 'react';

import {
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EarnPageContainer } from '../../../Earn/components/EarnPageContainer';
import { BorrowNavigation } from '../../borrowUtils';

import { DetailsPart } from './components/DetailsPart';
import { ManagePositionPart } from './components/ManagePositionPart';
import { useBorrowReserveDetailBreadcrumb } from './hooks/useBorrowReserveDetailBreadcrumb';
import { useBorrowReserveDetailData } from './hooks/useBorrowReserveDetailData';

const ReserveDetailsPage = () => {
  const route = useAppRoute<
    ITabEarnParamList,
    | ETabEarnRoutes.BorrowReserveDetails
    | ETabEarnRoutes.BorrowReserveDetailsShare
  >();
  const { gtMd } = useMedia();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();
  const navigation = useAppNavigation();

  // Parse route params, support both normal and share link routes
  const resolvedParams = useMemo<{
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    symbol: string;
    logoURI?: string;
    accountId?: string;
    indexedAccountId?: string;
  }>(() => {
    const routeParams = route.params;

    // For share link route, query params are passed as route params
    // Both path params (:networkId, :symbol, :provider) and query params
    // (?marketAddress=xxx&reserveAddress=xxx) are in route.params
    return {
      networkId: routeParams.networkId,
      provider: routeParams.provider,
      marketAddress: routeParams.marketAddress,
      reserveAddress: routeParams.reserveAddress,
      symbol: routeParams.symbol,
      logoURI: routeParams.logoURI,
      accountId: routeParams.accountId,
      indexedAccountId: routeParams.indexedAccountId,
    };
  }, [route.params]);

  const {
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
    accountId: routeAccountId,
    indexedAccountId,
  } = resolvedParams;

  const { earnAccount, details, userInfo, isLoading, refreshData } =
    useBorrowReserveDetailData({
      accountId: routeAccountId,
      networkId,
      indexedAccountId,
      provider,
      marketAddress,
      reserveAddress,
    });

  const accountId = routeAccountId || earnAccount?.account?.id || '';

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

  const { breadcrumbProps } = useBorrowReserveDetailBreadcrumb({
    symbol,
    provider,
  });

  const pageTitle = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <Token size="md" tokenImageUri={logoURI} />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [symbol, logoURI],
  );

  const handleSupply = useCallback(() => {
    BorrowNavigation.pushToBorrowManagePosition(navigation, {
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      symbol,
      logoURI,
      providerLogoURI: logoURI,
      type: EManagePositionType.Supply,
    });
  }, [
    navigation,
    accountId,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
  ]);

  const handleBorrow = useCallback(() => {
    BorrowNavigation.pushToBorrowManagePosition(navigation, {
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      symbol,
      logoURI,
      providerLogoURI: logoURI,
      type: EManagePositionType.Borrow,
    });
  }, [
    navigation,
    accountId,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
  ]);

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
    >
      <XStack flexDirection={gtMd ? 'row' : 'column'}>
        <Stack w="100%" width={gtMd ? '65%' : undefined}>
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
            onShare={handleShare}
          />
        </Stack>
        {gtMd ? (
          <Stack width="35%">
            <ManagePositionPart
              accountId={accountId}
              userInfo={userInfo}
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={reserveAddress}
              symbol={symbol}
              logoURI={logoURI}
            />
          </Stack>
        ) : null}
      </XStack>
    </EarnPageContainer>
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
