import { Fragment, useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useIsModalPage,
  useMedia,
  useScrollContentTabBarOffset,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import {
  EJotaiContextStoreNames,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  ETabEarnRoutes,
  IBorrowReserveFormTab,
  IModalStakingParamList,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EManagePositionType,
  type IBorrowReserveDetail,
} from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnPageContainer } from '../../../Earn/components/EarnPageContainer';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { useEarnWindowReturn } from '../../../Earn/earnWindowReturn';
import { StickyFormColumn } from '../../../Earn/pages/EarnProtocolDetails/components/StickyFormColumn';
import { getBorrowMarketLabel } from '../../borrowMarketDisplayName';
import { buildBorrowMarketKey } from '../../borrowMarketKey';
import { BorrowNavigation } from '../../borrowUtils';
import { isUnsupportedAaveNativeReserve } from '../../components/borrowRepayPosition.utils';
import { useBorrowMarkets } from '../../hooks/useBorrowMarkets';

import { DetailsPart } from './components/DetailsPart';
import { ManagePositionPart } from './components/ManagePositionPart';
import { getReserveFooterActions } from './components/reserveFormSides';
import { useBorrowReserveDetailBreadcrumb } from './hooks/useBorrowReserveDetailBreadcrumb';
import { useBorrowReserveDetailData } from './hooks/useBorrowReserveDetailData';
import { useReserveAccountPosition } from './hooks/useReserveAccountPosition';
import { useReserveFormSide } from './hooks/useReserveFormSide';

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
    ITabEarnParamList & IModalStakingParamList,
    | ETabEarnRoutes.BorrowReserveDetails
    | ETabEarnRoutes.BorrowReserveDetailsShare
    | EModalStakingRoutes.BorrowReserveDetails
  >();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();
  const tabBarHeight = useScrollContentTabBarOffset();
  // Opened from the manage window's Reserve info: Back is the way to its
  // form, so the page offers none of its own
  const isModalPage = useIsModalPage();

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
    tab?: IBorrowReserveFormTab;
    amount?: string;
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
      tab: 'tab' in routeParams ? routeParams.tab : undefined,
      amount: 'amount' in routeParams ? routeParams.amount : undefined,
    };
  }, [route.params]);

  const {
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol: routeSymbol,
    logoURI: routeLogoURI,
    accountId: routeAccountId,
    indexedAccountId,
    tab: routeTab,
    amount: routeAmount,
  } = resolvedParams;

  const { earnAccount, details, reserveToken, isLoading, refreshData } =
    useBorrowReserveDetailData({
      accountId: routeAccountId,
      networkId,
      indexedAccountId,
      provider,
      marketAddress,
      reserveAddress,
      resolveTokenMetadata: !routeLogoURI,
    });

  // The account the forms act for, as the manage window takes it: the
  // market network's own account first
  const accountId = earnAccount?.account?.id || routeAccountId || '';
  const formIndexedAccountId =
    earnAccount?.account?.indexedAccountId ?? indexedAccountId;
  const symbol = reserveToken?.symbol || routeSymbol;
  const logoURI = reserveToken?.logoURI || routeLogoURI;
  const isShareMetadataReady = Boolean(routeLogoURI || reserveToken?.logoURI);

  // The market's name and logo, as the Earn pages show them: Aave Core
  const { markets } = useBorrowMarkets();
  const market = useMemo(() => {
    const key = buildBorrowMarketKey({ provider, networkId, marketAddress });
    return markets?.find((item) => buildBorrowMarketKey(item) === key);
  }, [marketAddress, markets, networkId, provider]);
  const marketLabel = market ? getBorrowMarketLabel(market) : undefined;

  // The sides the form offers: what the account holds of the reserve, and
  // whether the reserve lends
  const position = useReserveAccountPosition({
    accountId,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
  });
  const canBorrow = Boolean(details?.borrow?.canBeBorrowed);
  const { side, sides, selectSide, startAmount } = useReserveFormSide({
    requested: routeTab,
    amount: routeAmount,
    isReady: position.isReady && Boolean(details),
    scopeKey: position.scopeKey,
    hasSupplied: position.hasSupplied,
    canBorrow,
    hasBorrowed: position.hasBorrowed,
  });
  // The form lists the account's supply and loan only where there is one
  const formPosition = useMemo(
    () =>
      position.isReady
        ? { hasSupply: position.hasSupplied, hasBorrow: position.hasBorrowed }
        : undefined,
    [position.hasBorrowed, position.hasSupplied, position.isReady],
  );

  // Opened by the Loans window: Back opens the window again
  useEarnWindowReturn();

  // The reserve's figures and the account's position, read again together
  const { refresh: refreshPosition } = position;
  const refreshAll = useCallback(() => {
    void refreshData();
    void refreshPosition();
  }, [refreshData, refreshPosition]);
  // A transaction settling, from the form or elsewhere: read again once the
  // history says so, as the Earn lending page does
  useEffect(() => {
    const handleHistoryTxStatusChanged = () => {
      refreshAll();
    };
    const handleLocalPendingTxConfirmed = (
      payload: IAppEventBusPayload[EAppEventBusNames.LocalPendingTxConfirmed],
    ) => {
      if (payload.networkId === networkId) {
        refreshAll();
      }
    };
    appEventBus.on(
      EAppEventBusNames.HistoryTxStatusChanged,
      handleHistoryTxStatusChanged,
    );
    appEventBus.on(
      EAppEventBusNames.LocalPendingTxConfirmed,
      handleLocalPendingTxConfirmed,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.HistoryTxStatusChanged,
        handleHistoryTxStatusChanged,
      );
      appEventBus.off(
        EAppEventBusNames.LocalPendingTxConfirmed,
        handleLocalPendingTxConfirmed,
      );
    };
  }, [networkId, refreshAll]);

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

  const { breadcrumbProps } = useBorrowReserveDetailBreadcrumb({
    symbol,
    provider,
    networkId,
    marketAddress,
    marketLabel,
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

  // Narrow, the page's own footer, as the Earn lending page's: Supply, and
  // Borrow where the reserve lends, each opening the manage window
  const openManageWindow = useCallback(
    (type: EManagePositionType.Supply | EManagePositionType.Borrow) => {
      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId,
        indexedAccountId: formIndexedAccountId,
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        symbol,
        logoURI,
        providerDisplayName: marketLabel,
        providerLogoURI: market?.logoURI,
        type,
      });
    },
    [
      accountId,
      formIndexedAccountId,
      logoURI,
      market?.logoURI,
      marketAddress,
      marketLabel,
      navigation,
      networkId,
      provider,
      reserveAddress,
      symbol,
    ],
  );
  const pageFooter = useMemo(() => {
    // Until the reserve is in there is nothing to act on: no button over the
    // loading skeleton
    if (gtMd || isModalPage || !details) {
      return null;
    }
    const actions = getReserveFooterActions({
      canBorrow,
      // Rows for these reserves stay visible in the position tables, so this
      // page is reachable for them; the window would resolve the native
      // reserve to the wrong token
      isNativeActionUnsupported: isUnsupportedAaveNativeReserve({
        networkId,
        providerName: provider,
        reserveAddress,
      }),
    });
    return (
      <Page.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.defi_supply })}
        confirmButtonProps={{
          testID: 'borrow-reserve-footer-supply',
          variant: 'primary',
          disabled: actions.supply.disabled,
          onPress: () => openManageWindow(EManagePositionType.Supply),
          mb: tabBarHeight,
        }}
        {...(actions.borrow
          ? {
              onCancelText: intl.formatMessage({
                id: ETranslations.global_borrow,
              }),
              cancelButtonProps: {
                testID: 'borrow-reserve-footer-borrow',
                variant: 'secondary',
                disabled: actions.borrow.disabled,
                onPress: () => openManageWindow(EManagePositionType.Borrow),
                mb: tabBarHeight,
              },
            }
          : {})}
      />
    );
  }, [
    canBorrow,
    details,
    gtMd,
    intl,
    isModalPage,
    networkId,
    openManageWindow,
    provider,
    reserveAddress,
    tabBarHeight,
  ]);

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
        {pageFooter}
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
        <Stack w="100%" {...(isModalPage ? null : { flex: 1, minWidth: 0 })}>
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
            onShare={isShareMetadataReady ? handleShare : undefined}
          />
        </Stack>
        {isModalPage ? null : (
          <StickyFormColumn>
            <ManagePositionPart
              accountId={accountId}
              indexedAccountId={formIndexedAccountId}
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={reserveAddress}
              symbol={symbol}
              logoURI={logoURI}
              marketLabel={marketLabel}
              marketLogoURI={market?.logoURI}
              sides={sides}
              side={side}
              onSideChange={selectSide}
              startAmount={startAmount}
              position={formPosition}
              onActionSuccess={refreshAll}
            />
          </StickyFormColumn>
        )}
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
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <ReserveDetailsPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ReserveDetailsPageWithProvider;
