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
  isBorrowReservesPending,
} from '../borrowDataStatus';
import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { BorrowProvider, useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { BorrowAlerts } from '../components/BorrowAlerts';
import { BorrowCard } from '../components/BorrowCard';
import { BorrowDataGate } from '../components/BorrowDataGate';
import { BorrowedCard } from '../components/BorrowedCard';
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
  const pendingIdsRef = useRef<string | null>(null);

  useEffect(() => {
    const nextIds = (pendingTxs ?? []).map((tx) => tx.id).join(',');
    if (pendingIdsRef.current !== nextIds) {
      pendingIdsRef.current = nextIds;
    }
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
    const isReservesPending =
      isBorrowReservesPending(borrowDataStatus) ||
      (reserves.loading && !reserves.data);
    const isReservesError =
      !isReservesPending && borrowDataStatus === EBorrowDataStatus.Error;
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
    const isEModeError =
      !eModeStatus && isActive && isAaveEModeProvider && isEModeStatusError;
    const noConnectedWallet = activeAccount.ready && !hasConnectedWallet;
    const showNoAddressWarning = useMemo(
      () =>
        hasConnectedWallet &&
        Boolean(accountId || indexedAccountId) &&
        Boolean(market?.networkId) &&
        !earnAccount.loading &&
        !earnAccount.data?.accountAddress,
      [
        hasConnectedWallet,
        accountId,
        indexedAccountId,
        market?.networkId,
        earnAccount.loading,
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
    const hasPositions = useBorrowPositionEntries().length > 0;

    const hasResolvedMarket = Boolean(
      market?.networkId && market?.provider && market?.marketAddress,
    );
    const canOpenAssetList = Boolean(
      activeAccount.ready &&
      hasResolvedMarket &&
      (noConnectedWallet || earnAccountId),
    );

    const openManagePosition = useCallback(
      (asset: IBorrowManageAsset, type: EManagePositionType) => {
        if (!market?.networkId || !market.provider || !market.marketAddress) {
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
        navigation,
        noConnectedWallet,
        toOnBoardingPage,
      ],
    );

    const openAssetList = useCallback(
      (action: 'supply' | 'borrow') => {
        if (!market?.networkId || !market.provider || !market.marketAddress) {
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

    const renderCards = () => {
      if (isReservesError) {
        return (
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
      }

      if (gtMd && !isMidWidth) {
        return (
          <XStack gap="$5" ai="flex-start">
            <YStack
              flex={SUPPLY_COLUMN_FLEX}
              flexShrink={0}
              flexBasis={0}
              gap="$5"
            >
              <SuppliedCard eModeStatus={eModeStatus} />
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
          <YStack flex={1} gap="$5">
            {hasPositions || isReservesPending ? (
              <BorrowMobilePositions eModeStatus={eModeStatus} />
            ) : (
              <BorrowMobileEmptyState
                assets={supplyAssets}
                isLoading={reserves.loading}
                onPressAsset={handleSupplyAsset}
              />
            )}
            <BorrowMobileSummary
              isPositionTotalsLoading={isReservesPending}
              overviewData={overviewData}
              showPositionTotals={hasPositions}
            />
          </YStack>
        );
      }

      return (
        <YStack flex={1} gap="$5">
          <Tabs.TabBar
            tabNames={sectionTabNames}
            focusedTab={focusedSectionTab}
            onTabPress={handleSectionChange}
            containerStyle={SECTION_TAB_BAR_CONTAINER_STYLE}
          />
          {activeSection === 'supply' ? (
            <>
              <SuppliedCard eModeStatus={eModeStatus} />
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
              eModeStatus={eModeStatus}
              isEModeError={isEModeError}
              isEModeLoading={isEModeInitialLoading}
              overviewData={overviewData}
              showBottomSpacing={!hasAlerts}
              onBorrowHistoryActionChange={onBorrowHistoryActionChange}
            />
            {hasAlerts ? (
              <YStack
                {...(gtMd ? { my: '$7' } : { mt: '$2', mb: '$7' })}
                gap="$3"
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
