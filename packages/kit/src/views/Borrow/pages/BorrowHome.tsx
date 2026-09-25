import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Empty,
  ScrollView,
  Tabs,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';
import type { IBorrowToken } from '@onekeyhq/shared/types/staking';

import { useToOnBoardingPage } from '../../Onboarding/hooks/useToOnBoardingPage';
import { NoAddressWarning } from '../../Staking/components/ProtocolDetails/NoAddressWarning';
import { EManagePositionType } from '../../Staking/pages/ManagePosition/hooks/useManagePage';
import {
  EBorrowDataStatus,
  hasBorrowReservesForMarket,
  isBorrowReservesPending,
} from '../borrowDataStatus';
import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import {
  BorrowProvider,
  buildBorrowMarketKey,
  useBorrowContext,
  useBorrowMarketRequestContext,
} from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { BorrowAlerts } from '../components/BorrowAlerts';
import { BorrowCard } from '../components/BorrowCard';
import { BorrowDataGate } from '../components/BorrowDataGate';
import { BorrowedCard } from '../components/BorrowedCard';
import { BorrowEModeMetric } from '../components/BorrowEModeMetric';
import {
  getBorrowVisibleAssetIconSources,
  prewarmBorrowImages,
} from '../components/borrowImagePrewarm';
import {
  BORROW_MOBILE_ACTION_BAR_SCROLL_INSET,
  BorrowMobileActionBar,
} from '../components/BorrowMobileActionBar';
import { BorrowMobileEmptyState } from '../components/BorrowMobileEmptyState';
import { BorrowMobilePositions } from '../components/BorrowMobilePositions';
import { BorrowMobileSummary } from '../components/BorrowMobileSummary';
import { filterUnsupportedAaveNativeReserveAssets } from '../components/borrowRepayPosition.utils';
import { Overview } from '../components/Overview';
import { SuppliedCard } from '../components/SuppliedCard';
import { SupplyCard } from '../components/SupplyCard';
import { useBorrowEModeStatus } from '../hooks/useBorrowEModeStatus';
import { useBorrowOverviewData } from '../hooks/useBorrowOverviewData';
import { useBorrowPositionEntries } from '../hooks/useBorrowPositionEntries';
import { BorrowTestIDs } from '../testIDs';

import type { IStakePendingTx } from '../../Earn/hooks/useStakingPendingTxs';

const SUPPLY_COLUMN_FLEX = 1.15;
const BORROW_COLUMN_FLEX = 1;
const MemoBorrowMobilePositions = memo(BorrowMobilePositions);

type IBorrowSection = 'supply' | 'borrow';

type IBorrowManageAsset = {
  reserveAddress: string;
  token: Pick<IBorrowToken, 'logoURI' | 'symbol'>;
};

const SECTION_TAB_BAR_CONTAINER_STYLE = {
  testID: BorrowTestIDs.sectionTabs,
  position: 'relative',
  zIndex: 0,
  bg: 'transparent',
} as const;

type IBorrowHomeProps = {
  header?: React.ReactNode;
  isActive?: boolean;
  pendingTxs?: IStakePendingTx[];
  onRegisterBorrowRefresh?: (handler: (() => Promise<void>) | null) => void;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
  onBorrowHistoryActionChange?: (
    handler: (() => void) | null,
    visible: boolean,
  ) => void;
};

const BorrowPendingBridge = ({
  pendingTxs,
  onRegisterBorrowRefresh,
}: {
  pendingTxs?: IStakePendingTx[];
  onRegisterBorrowRefresh?: (handler: (() => Promise<void>) | null) => void;
}) => {
  const { setPendingTxs, refreshAllBorrowData } = useBorrowContext();

  useEffect(() => {
    setPendingTxs(pendingTxs ?? []);
  }, [pendingTxs, setPendingTxs]);

  const handleRefresh = useCallback(async () => {
    await refreshAllBorrowData();
  }, [refreshAllBorrowData]);

  useEffect(() => {
    if (!onRegisterBorrowRefresh) return undefined;
    onRegisterBorrowRefresh(handleRefresh);
    return () => {
      onRegisterBorrowRefresh(null);
    };
  }, [handleRefresh, onRegisterBorrowRefresh]);

  return null;
};

const BorrowHomeContent = memo(
  ({
    header,
    isActive = true,
    onBorrowHistoryActionChange,
  }: IBorrowHomeProps) => {
    const intl = useIntl();
    const tabBarHeight = useScrollContentTabBarOffset();
    const { gtMd, gtXl } = useMedia();
    const navigation = useAppNavigation();
    const toOnBoardingPage = useToOnBoardingPage();
    const [activeSection, setActiveSection] =
      useState<IBorrowSection>('supply');
    const {
      reserves,
      market,
      markets,
      earnAccount,
      borrowDataStatus,
      refreshAllBorrowData,
    } = useBorrowContext();
    const { requestedMarket } = useBorrowMarketRequestContext();
    const visibleMarketKey = market ? buildBorrowMarketKey(market) : undefined;
    const isMarketSwitchPending = Boolean(
      requestedMarket &&
      buildBorrowMarketKey(requestedMarket) !== visibleMarketKey,
    );
    const hasVisibleReserves = hasBorrowReservesForMarket({
      data: reserves.data,
      ownerMarketKey: reserves.ownerMarketKey,
      marketKey: visibleMarketKey,
    });
    const isReservesError = borrowDataStatus === EBorrowDataStatus.Error;
    const isReservesPending =
      !isReservesError &&
      (isBorrowReservesPending(borrowDataStatus) ||
        !hasVisibleReserves ||
        (reserves.loading && !reserves.data));
    const isMarketInteractionBlocked =
      isMarketSwitchPending || isReservesPending;
    // renderCards short-circuits to its error block before it ever reaches the
    // empty state, so a failed load is not evidence of an empty market — it is
    // no evidence at all. Both states leave the market's contents undecided,
    // and the headline metrics stay up for either.
    const isPositionStateUnsettled = isReservesPending || isReservesError;
    const { activeAccount } = useActiveAccount({ num: 0 });
    const earnAccountId = getBorrowEarnAccountId(earnAccount.data);
    const inferredEModeProvider = market?.provider ?? markets[0]?.provider;
    const {
      eModeStatus,
      isError: isEModeStatusError,
      isInitialLoading: isEModeStatusInitialLoading,
      refresh: refreshEModeStatus,
    } = useBorrowEModeStatus({
      networkId: market?.networkId,
      provider: market?.provider,
      marketAddress: market?.marketAddress,
      accountId: earnAccountId,
      enabled:
        isActive &&
        Boolean(
          market?.networkId &&
          market.provider &&
          market.marketAddress &&
          earnAccountId,
        ),
    });
    const overviewData = useBorrowOverviewData({
      isActive,
      refreshEModeStatus,
    });
    const visibleEModeStatus = isEModeStatusError ? null : eModeStatus;
    const healthFactorAlerts = overviewData.healthFactorData?.alerts;
    // Keep the actionable health-factor alert alongside the summary metric.
    const alerts = useMemo(
      () => [...(reserves.data?.alerts ?? []), ...(healthFactorAlerts ?? [])],
      [reserves.data?.alerts, healthFactorAlerts],
    );
    const accountId = activeAccount.account?.id ?? '';
    const walletId = activeAccount.wallet?.id;
    const indexedAccountId = activeAccount.indexedAccount?.id;
    const hasConnectedWallet = useMemo(
      () =>
        activeAccount.ready &&
        Boolean(walletId || accountId || indexedAccountId),
      [activeAccount.ready, walletId, accountId, indexedAccountId],
    );
    const isAaveEModeProvider =
      inferredEModeProvider?.toLowerCase() === EBorrowProviderEnum.Aave;
    const isEModeInitialLoading =
      !eModeStatus &&
      !isEModeStatusError &&
      isActive &&
      isAaveEModeProvider &&
      (!activeAccount.ready ||
        (hasConnectedWallet &&
          (earnAccount.loading ||
            Boolean(earnAccountId && isEModeStatusInitialLoading))));
    const isEModeError = isActive && isAaveEModeProvider && isEModeStatusError;
    const noConnectedWallet = activeAccount.ready && !hasConnectedWallet;
    const showNoAddressWarning = useMemo(
      () =>
        hasConnectedWallet &&
        Boolean(accountId || indexedAccountId) &&
        Boolean(market?.networkId) &&
        borrowDataStatus !== EBorrowDataStatus.Error &&
        !earnAccount.loading &&
        !earnAccount.isError &&
        !earnAccount.data?.accountAddress,
      [
        hasConnectedWallet,
        accountId,
        indexedAccountId,
        market?.networkId,
        borrowDataStatus,
        earnAccount.loading,
        earnAccount.isError,
        earnAccount.data?.accountAddress,
      ],
    );
    const hasAlertsNow = Boolean(alerts.length) || showNoAddressWarning;
    // The two alert sources settle independently (reserves + health factor),
    // and each re-run briefly drops its result, so this flag flips more than
    // once during a single load. Every flip swaps Overview's $10 bottom
    // spacing for the alert block's own margins — a ~32pt gap that opens
    // below Claimable Rewards and is taken back again.
    //
    // Hold the last settled answer while a load is in flight, so the layout
    // moves once, when the data is actually final.
    const lastSettledHasAlertsRef = useRef(false);
    const isBorrowDataSettled = borrowDataStatus === EBorrowDataStatus.Ready;
    if (isBorrowDataSettled) {
      lastSettledHasAlertsRef.current = hasAlertsNow;
    }
    const hasAlerts = isBorrowDataSettled
      ? hasAlertsNow
      : lastSettledHasAlertsRef.current;

    const refreshEarnAccount = earnAccount.refresh;
    const refreshReserves = reserves.refresh;
    const handleCreateAddress = useCallback(async () => {
      await refreshEarnAccount();
      await refreshAllBorrowData();
    }, [refreshEarnAccount, refreshAllBorrowData]);
    const handleRetryReserves = useCallback(() => {
      void refreshReserves();
    }, [refreshReserves]);

    // Overview drops its metric row along with the metrics, and refresh rides
    // that row. The empty state takes it over on its own heading so the market
    // can still be refreshed by hand — the two rows never coexist, so the
    // button shows up exactly once either way.
    const requestRefresh = overviewData.requestRefresh;
    const handleEmptyStateRefresh = useCallback(() => {
      void requestRefresh();
    }, [requestRefresh]);

    const isMidWidth = gtMd && !gtXl;
    const isPhone = !gtMd;

    const sectionTabNames = useMemo(
      () => [
        intl.formatMessage({ id: ETranslations.defi_supply }),
        intl.formatMessage({ id: ETranslations.global_borrow }),
      ],
      [intl],
    );
    const focusedSectionTab = useSharedValue(sectionTabNames[0]);
    useEffect(() => {
      focusedSectionTab.value =
        activeSection === 'supply' ? sectionTabNames[0] : sectionTabNames[1];
    }, [activeSection, focusedSectionTab, sectionTabNames]);
    const handleSectionChange = useCallback(
      (name: string) => {
        focusedSectionTab.value = name;
        setActiveSection(name === sectionTabNames[1] ? 'borrow' : 'supply');
      },
      [focusedSectionTab, sectionTabNames],
    );

    const supplyAssets = useMemo(
      () =>
        filterUnsupportedAaveNativeReserveAssets({
          assets: reserves.data?.supply?.assets,
          networkId: market?.networkId,
          providerName: market?.provider,
        }),
      [market?.networkId, market?.provider, reserves.data?.supply?.assets],
    );
    const ownedReservesData =
      visibleMarketKey && reserves.ownerMarketKey === visibleMarketKey
        ? reserves.data
        : null;
    const canPrewarmVisibleIcons =
      isActive &&
      Boolean(ownedReservesData) &&
      (borrowDataStatus === EBorrowDataStatus.Ready ||
        borrowDataStatus === EBorrowDataStatus.Refreshing);
    useEffect(() => {
      if (!canPrewarmVisibleIcons || !ownedReservesData || !market) {
        return undefined;
      }
      return prewarmBorrowImages(
        getBorrowVisibleAssetIconSources({
          reserves: ownedReservesData,
          market,
          section: activeSection,
        }),
        { priority: true },
      );
    }, [
      activeSection,
      canPrewarmVisibleIcons,
      market,
      ownedReservesData,
      visibleMarketKey,
    ]);
    const hasPositions = useBorrowPositionEntries().length > 0;

    const hasResolvedMarket = Boolean(
      market?.networkId && market?.provider && market?.marketAddress,
    );
    const canOpenAssetList = Boolean(
      !isMarketInteractionBlocked &&
      activeAccount.ready &&
      hasResolvedMarket &&
      (noConnectedWallet || earnAccountId),
    );

    const openManagePosition = useCallback(
      (asset: IBorrowManageAsset, type: EManagePositionType) => {
        if (
          isMarketInteractionBlocked ||
          !market?.networkId ||
          !market.provider ||
          !market.marketAddress
        ) {
          return;
        }
        if (noConnectedWallet) {
          void toOnBoardingPage();
          return;
        }
        if (!earnAccountId) {
          return;
        }
        BorrowNavigation.pushToBorrowManagePosition(navigation, {
          accountId: earnAccountId,
          indexedAccountId,
          networkId: market.networkId,
          provider: market.provider,
          marketAddress: market.marketAddress,
          reserveAddress: asset.reserveAddress,
          symbol: asset.token.symbol,
          providerLogoURI: market.logoURI,
          logoURI: asset.token.logoURI,
          type,
        });
      },
      [
        earnAccountId,
        indexedAccountId,
        market?.networkId,
        market?.provider,
        market?.marketAddress,
        market?.logoURI,
        isMarketInteractionBlocked,
        navigation,
        noConnectedWallet,
        toOnBoardingPage,
      ],
    );

    const openAssetList = useCallback(
      (action: 'supply' | 'borrow') => {
        if (
          isMarketInteractionBlocked ||
          !market?.networkId ||
          !market.provider ||
          !market.marketAddress
        ) {
          return;
        }
        if (noConnectedWallet) {
          void toOnBoardingPage();
          return;
        }
        if (!earnAccountId) {
          return;
        }
        BorrowNavigation.pushToBorrowTokenSelect(navigation, {
          accountId: earnAccountId,
          indexedAccountId,
          networkId: market.networkId,
          provider: market.provider,
          marketAddress: market.marketAddress,
          action,
          navigateOnSelect: {
            screen: EModalStakingRoutes.BorrowManagePosition,
            params: {
              providerLogoURI: market.logoURI,
              type:
                action === 'supply'
                  ? EManagePositionType.Supply
                  : EManagePositionType.Borrow,
            },
          },
        });
      },
      [
        earnAccountId,
        indexedAccountId,
        market?.networkId,
        market?.provider,
        market?.marketAddress,
        market?.logoURI,
        isMarketInteractionBlocked,
        navigation,
        noConnectedWallet,
        toOnBoardingPage,
      ],
    );
    const handleOpenSupplyList = useCallback(
      () => openAssetList('supply'),
      [openAssetList],
    );
    const handleOpenBorrowList = useCallback(
      () => openAssetList('borrow'),
      [openAssetList],
    );

    const handleSupplyAsset = useCallback(
      (asset: IBorrowManageAsset) => {
        openManagePosition(asset, EManagePositionType.Supply);
      },
      [openManagePosition],
    );

    // E-Mode reads its own request and its screen never touches reserves, so it
    // stays reachable while the cards above it are in their error state.
    const eModeBar = (
      <BorrowEModeMetric
        eModeStatus={visibleEModeStatus}
        isError={isEModeError}
        isLoading={isEModeInitialLoading}
        variant="bar"
      />
    );

    const renderCards = () => {
      if (isReservesError) {
        const reservesError = (
          <Empty
            testID={BorrowTestIDs.reservesErrorState}
            py="$16"
            icon="ErrorOutline"
            title={intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            })}
            description={intl.formatMessage({
              id: ETranslations.global_an_error_occurred_desc,
            })}
            buttonProps={{
              testID: BorrowTestIDs.reservesRetryBtn,
              onPress: handleRetryReserves,
              children: intl.formatMessage({
                id: ETranslations.global_retry,
              }),
            }}
          />
        );
        return isPhone ? (
          <YStack flex={1} gap="$5">
            {reservesError}
            {eModeBar}
          </YStack>
        ) : (
          reservesError
        );
      }

      if (gtMd && !isMidWidth) {
        return (
          <XStack
            gap="$5"
            ai="flex-start"
            pointerEvents={isMarketInteractionBlocked ? 'none' : 'auto'}
          >
            <YStack
              flex={SUPPLY_COLUMN_FLEX}
              flexShrink={0}
              flexBasis={0}
              gap="$5"
            >
              <SuppliedCard eModeStatus={visibleEModeStatus} />
              <SupplyCard />
            </YStack>
            <YStack
              flex={BORROW_COLUMN_FLEX}
              flexShrink={0}
              flexBasis={0}
              gap="$5"
            >
              <BorrowedCard />
              <BorrowCard />
            </YStack>
          </XStack>
        );
      }

      if (isPhone) {
        return (
          <YStack
            flex={1}
            gap="$5"
            pointerEvents={isMarketInteractionBlocked ? 'none' : 'auto'}
          >
            {hasPositions || isReservesPending ? (
              <MemoBorrowMobilePositions
                eModeId={visibleEModeStatus?.eModeId}
                isPending={isReservesPending}
              />
            ) : (
              <BorrowMobileEmptyState
                assets={supplyAssets}
                isLoading={reserves.loading}
                onPressAsset={handleSupplyAsset}
                onRefresh={handleEmptyStateRefresh}
                isRefreshing={
                  reserves.loading || overviewData.isManualRefreshing
                }
              />
            )}
            <BorrowMobileSummary
              isPositionTotalsLoading={isReservesPending}
              overviewData={overviewData}
              showPositionTotals={hasPositions}
            />
            {/* E-Mode is a market-wide setting rather than a headline number,
                so on phones it closes the page under the positions and the
                summary instead of interrupting the metrics at the top. */}
            {eModeBar}
          </YStack>
        );
      }

      return (
        <YStack
          flex={1}
          gap="$5"
          pointerEvents={isMarketInteractionBlocked ? 'none' : 'auto'}
        >
          <Tabs.TabBar
            tabNames={sectionTabNames}
            focusedTab={focusedSectionTab}
            onTabPress={handleSectionChange}
            containerStyle={SECTION_TAB_BAR_CONTAINER_STYLE}
          />
          {activeSection === 'supply' ? (
            <>
              <SuppliedCard eModeStatus={visibleEModeStatus} />
              <SupplyCard />
            </>
          ) : (
            <>
              <BorrowedCard />
              <BorrowCard />
            </>
          )}
        </YStack>
      );
    };

    return (
      <YStack flex={1}>
        <ScrollView
          flex={1}
          contentContainerStyle={{
            paddingBottom:
              (tabBarHeight ?? 0) +
              (isPhone ? BORROW_MOBILE_ACTION_BAR_SCROLL_INSET : 0),
          }}
        >
          {header ? <YStack pb="$4">{header}</YStack> : null}
          <YStack flex={1} px="$5" pb="$10">
            <Overview
              isInteractionBlocked={isMarketInteractionBlocked}
              eModeStatus={visibleEModeStatus}
              isEModeError={isEModeError}
              isEModeLoading={isEModeInitialLoading}
              overviewData={overviewData}
              showBottomSpacing={!hasAlerts}
              showPositionMetrics={hasPositions}
              isPositionStateUnsettled={isPositionStateUnsettled}
              onBorrowHistoryActionChange={onBorrowHistoryActionChange}
            />
            {hasAlerts ? (
              <YStack
                {...(gtMd ? { my: '$7' } : { mt: '$2', mb: '$7' })}
                gap="$3"
                pointerEvents={isMarketInteractionBlocked ? 'none' : 'auto'}
              >
                {showNoAddressWarning ? (
                  <NoAddressWarning
                    accountId={accountId}
                    networkId={market?.networkId ?? ''}
                    indexedAccountId={indexedAccountId}
                    onCreateAddress={handleCreateAddress}
                  />
                ) : null}
                <BorrowAlerts
                  alerts={alerts}
                  accountId={accountId || undefined}
                  walletId={walletId}
                  indexedAccountId={indexedAccountId}
                  marketNetworkId={market?.networkId}
                />
              </YStack>
            ) : null}
            {renderCards()}
          </YStack>
        </ScrollView>
        {isPhone ? (
          <BorrowMobileActionBar
            isActive={isActive}
            disabled={!canOpenAssetList || isReservesError}
            bottomOffset={tabBarHeight ?? 0}
            onSupply={handleOpenSupplyList}
            onBorrow={handleOpenBorrowList}
          />
        ) : null}
      </YStack>
    );
  },
);

BorrowHomeContent.displayName = 'BorrowHomeContent';

const BorrowHomeCmp = memo(
  ({
    header,
    isActive = true,
    pendingTxs,
    onRegisterBorrowRefresh,
    onBorrowNetworksChange,
    onBorrowHistoryActionChange,
  }: IBorrowHomeProps) => {
    return (
      <BorrowProvider>
        <BorrowPendingBridge
          pendingTxs={pendingTxs}
          onRegisterBorrowRefresh={onRegisterBorrowRefresh}
        />
        <BorrowDataGate
          isActive={isActive}
          onBorrowNetworksChange={onBorrowNetworksChange}
        >
          <BorrowHomeContent
            header={header}
            isActive={isActive}
            onBorrowHistoryActionChange={onBorrowHistoryActionChange}
          />
        </BorrowDataGate>
      </BorrowProvider>
    );
  },
);

BorrowHomeCmp.displayName = 'BorrowHomeCmp';

export const BorrowHome = BorrowHomeCmp;
