import { Fragment, useCallback, useMemo } from 'react';

import {
  IconButton,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { EarnPageContainer } from '../../../Earn/components/EarnPageContainer';
import { BorrowNavigation } from '../../borrowUtils';

import { DetailsPart } from './components/DetailsPart';
import { ManagePositionPart } from './components/ManagePositionPart';
import { useBorrowReserveDetailBreadcrumb } from './hooks/useBorrowReserveDetailBreadcrumb';
import { useBorrowReserveDetailData } from './hooks/useBorrowReserveDetailData';

function ManagersSection({
  managers,
}: {
  managers: IBorrowReserveDetail['managers'] | undefined;
}) {
  return managers?.items?.length ? (
    <XStack gap="$1" alignItems="center">
      {managers.items.map((item, index) => (
        <Fragment key={index}>
          <XStack gap="$1" alignItems="center">
            <Image size="$4" borderRadius="$1" src={item.logoURI} />
            <EarnText text={item.title} size="$bodySm" />
            <EarnText text={item.description} size="$bodySm" />
          </XStack>
          {index !== managers.items.length - 1 ? (
            <XStack w="$4" h="$4" ai="center" jc="center">
              <XStack w="$1" h="$1" borderRadius="$full" bg="$iconSubdued" />
            </XStack>
          ) : null}
        </Fragment>
      ))}
    </XStack>
  ) : null;
}

const ReserveDetailsPage = () => {
  const route = useAppRoute<
    ITabEarnParamList,
    | ETabEarnRoutes.BorrowReserveDetails
    | ETabEarnRoutes.BorrowReserveDetailsShare
  >();
  const { gtMd } = useMedia();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();

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

  if (!gtMd) {
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
  }

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      header={
        <XStack ml="auto" pr="$2">
          <ManagersSection managers={details?.managers} />
        </XStack>
      }
    >
      <XStack flexDirection="row">
        <Stack w="100%" width="65%">
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
