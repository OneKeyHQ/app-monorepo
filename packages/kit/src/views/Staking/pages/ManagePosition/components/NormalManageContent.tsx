import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import { Dialog, SizableText, Tabs, XStack } from '@onekeyhq/components';
import SlippageSettingDialog from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import {
  EManagePageActionType,
  EStakingActionType,
} from '@onekeyhq/shared/types/staking';
import type {
  IEarnHistoryActionIcon,
  IEarnManagePageActionData,
  IEarnManagePageResponse,
  IEarnSelectField,
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';
import { swapSlippageAutoValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { useIsPendleProvider } from '../../../hooks/useIsPendleProvider';
import { useQuoteCountdown } from '../../../hooks/useQuoteCountdown';
import { EManagePositionType } from '../hooks/useManagePage';

import { HeaderRight } from './HeaderRight';
import { StakeSection } from './StakeSection';
import { WithdrawSection } from './WithdrawSection';

type IBorrowAction = 'supply' | 'withdraw' | 'borrow' | 'repay';
type IManageActionData = IEarnManagePageActionData | undefined;

interface INormalManageContentProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  marketAddress?: string;
  reserveAddress?: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  earnAccount?: {
    accountId: string;
  };
  depositDisabled: boolean;
  withdrawDisabled: boolean;
  stakeBeforeFooter: React.ReactElement | null;
  withdrawBeforeFooter: React.ReactElement | null;
  historyAction?: IEarnHistoryActionIcon;
  onHistory?: (params?: { filterType?: string }) => void;
  indicatorAccountId?: string;
  stakeTag?: IStakeTag;
  onIndicatorRefresh?: () => void;
  onRefreshPendingRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onSuccess?: () => void;
  defaultTab?: 'deposit' | 'withdraw';
  onTabChange?: (tab: 'deposit' | 'withdraw') => void;
  isInModalContext: boolean;
  appNavigation: IAppNavigation;
  showApyDetail?: boolean;
  fallbackTokenImageUri?: string;
  ongoingValidator?: IEarnSelectField;
  managePageData?: IEarnManagePageResponse;
  type?: EManagePositionType;
  preferManagePageActionText?: boolean;
}

export function NormalManageContent({
  networkId,
  symbol,
  provider,
  vault: _vault,
  marketAddress,
  reserveAddress,
  tokenInfo,
  protocolInfo,
  earnAccount,
  depositDisabled,
  withdrawDisabled,
  stakeBeforeFooter,
  withdrawBeforeFooter,
  historyAction,
  onHistory,
  indicatorAccountId,
  stakeTag,
  onIndicatorRefresh,
  onRefreshPendingRef,
  onSuccess,
  defaultTab,
  onTabChange,
  isInModalContext,
  appNavigation,
  showApyDetail,
  fallbackTokenImageUri,
  ongoingValidator,
  managePageData,
  type = EManagePositionType.Staking,
  preferManagePageActionText = false,
}: INormalManageContentProps) {
  const intl = useIntl();
  const useBorrowApi = useMemo(
    () => type !== EManagePositionType.Staking,
    [type],
  );
  const borrowActionPrimary = useMemo<IBorrowAction | undefined>(() => {
    if (!useBorrowApi) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return 'supply';
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return 'borrow';
    }
    return undefined;
  }, [type, useBorrowApi]);

  const borrowActionSecondary = useMemo<IBorrowAction | undefined>(() => {
    if (!useBorrowApi) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return 'withdraw';
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return 'repay';
    }
    return undefined;
  }, [type, useBorrowApi]);

  const borrowActionLabelPrimary = useMemo<string | undefined>(() => {
    if (!useBorrowApi || !managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.supply?.text?.text;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.borrow?.text?.text;
    }
    return undefined;
  }, [type, useBorrowApi, managePageData]);

  const borrowActionLabelSecondary = useMemo<string | undefined>(() => {
    if (!useBorrowApi || !managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.withdraw?.text?.text;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.repay?.text?.text;
    }
    return undefined;
  }, [type, useBorrowApi, managePageData]);

  const resolveManageActionTitle = useCallback(
    ({
      actionData,
      fallbackId,
      fallbackType,
    }: {
      actionData?: IManageActionData;
      fallbackId: ETranslations;
      fallbackType?: string;
    }) => {
      if (actionData?.text?.text) {
        return actionData.text.text;
      }

      const normalizedActionType = (actionData?.type || fallbackType || '')
        .trim()
        .toLowerCase();

      switch (normalizedActionType) {
        case EManagePageActionType.Buy:
          return intl.formatMessage({ id: ETranslations.global_buy });
        case EManagePageActionType.SellEarly:
          return intl.formatMessage({ id: ETranslations.defi_sell_early });
        case EManagePageActionType.Redeem:
          return intl.formatMessage({ id: ETranslations.global_redeem });
        case EManagePageActionType.Sell:
          return intl.formatMessage({ id: ETranslations.global_sell });
        case EStakingActionType.Withdraw:
          return intl.formatMessage({ id: ETranslations.global_withdraw });
        case EStakingActionType.Borrow:
          return intl.formatMessage({ id: ETranslations.global_borrow });
        case EStakingActionType.Repay:
          return intl.formatMessage({ id: ETranslations.defi_repay });
        case EStakingActionType.Supply:
          return intl.formatMessage({ id: ETranslations.defi_supply });
        default:
          return intl.formatMessage({ id: fallbackId });
      }
    },
    [intl],
  );

  const isSwapManagePage = useMemo(
    () => !!(managePageData?.buy || managePageData?.sell),
    [managePageData?.buy, managePageData?.sell],
  );

  const stakeActionData = useMemo<IManageActionData>(() => {
    if (!managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.supply ?? managePageData.deposit;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.borrow ?? managePageData.deposit;
    }
    if (preferManagePageActionText && isSwapManagePage) {
      return managePageData.buy?.payButton ?? managePageData.deposit;
    }
    return managePageData.deposit ?? managePageData.buy?.payButton;
  }, [isSwapManagePage, managePageData, preferManagePageActionText, type]);

  const withdrawActionData = useMemo<IManageActionData>(() => {
    if (!managePageData) {
      return undefined;
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return managePageData.withdraw;
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return managePageData.repay ?? managePageData.withdraw;
    }
    if (preferManagePageActionText && isSwapManagePage) {
      return managePageData.sell?.payButton ?? managePageData.withdraw;
    }
    return managePageData.withdraw ?? managePageData.sell?.payButton;
  }, [isSwapManagePage, managePageData, preferManagePageActionText, type]);

  const stakeReceiveActionData = useMemo<IManageActionData>(
    () =>
      preferManagePageActionText && isSwapManagePage
        ? managePageData?.buy?.receiveButton
        : (managePageData?.buy?.receiveButton ?? withdrawActionData),
    [
      isSwapManagePage,
      managePageData?.buy?.receiveButton,
      preferManagePageActionText,
      withdrawActionData,
    ],
  );

  const withdrawReceiveActionData = useMemo<IManageActionData>(
    () =>
      preferManagePageActionText && isSwapManagePage
        ? managePageData?.sell?.receiveButton
        : (managePageData?.sell?.receiveButton ?? stakeActionData),
    [
      isSwapManagePage,
      managePageData?.sell?.receiveButton,
      preferManagePageActionText,
      stakeActionData,
    ],
  );

  const buildTokenInfoFromActionData = useCallback(
    (actionData?: IManageActionData): IEarnTokenInfo | undefined => {
      if (!actionData?.data?.token) {
        return undefined;
      }

      return {
        networkId,
        provider,
        vault: _vault,
        accountId: tokenInfo?.accountId ?? earnAccount?.accountId ?? '',
        indexedAccountId: tokenInfo?.indexedAccountId,
        nativeToken: tokenInfo?.nativeToken,
        balanceParsed:
          actionData.data.balance ?? tokenInfo?.balanceParsed ?? '0',
        token: actionData.data.token.info,
        price: actionData.data.token.price,
      };
    },
    [
      networkId,
      provider,
      _vault,
      tokenInfo?.accountId,
      tokenInfo?.indexedAccountId,
      tokenInfo?.nativeToken,
      tokenInfo?.balanceParsed,
      earnAccount?.accountId,
    ],
  );

  const stakeTokenInfo = useMemo(
    () => buildTokenInfoFromActionData(stakeActionData) ?? tokenInfo,
    [buildTokenInfoFromActionData, stakeActionData, tokenInfo],
  );

  const withdrawTokenInfo = useMemo(
    () => buildTokenInfoFromActionData(withdrawActionData) ?? tokenInfo,
    [buildTokenInfoFromActionData, withdrawActionData, tokenInfo],
  );

  const stakeReceiveInputConfig = useMemo(
    () =>
      preferManagePageActionText
        ? {
            enabled: !!stakeReceiveActionData?.data?.token,
            tokenImageUri: stakeReceiveActionData?.data?.token?.info?.logoURI,
            tokenSymbol: stakeReceiveActionData?.data?.token?.info?.symbol,
            tokenAddress: stakeReceiveActionData?.data?.token?.info?.address,
            balance: stakeReceiveActionData?.data?.balance,
            price: stakeReceiveActionData?.data?.token?.price,
          }
        : undefined,
    [preferManagePageActionText, stakeReceiveActionData],
  );

  const withdrawReceiveInputConfig = useMemo(
    () =>
      preferManagePageActionText
        ? {
            enabled: !!withdrawReceiveActionData?.data?.token,
            tokenImageUri:
              withdrawReceiveActionData?.data?.token?.info?.logoURI,
            tokenSymbol: withdrawReceiveActionData?.data?.token?.info?.symbol,
            tokenAddress: withdrawReceiveActionData?.data?.token?.info?.address,
            balance: withdrawReceiveActionData?.data?.balance,
            price: withdrawReceiveActionData?.data?.token?.price,
          }
        : undefined,
    [preferManagePageActionText, withdrawReceiveActionData],
  );

  const [selectedTabIndex, setSelectedTabIndex] = useState(() => {
    if (defaultTab === 'withdraw') return 1;
    return 0;
  });
  const shouldDisablePrimaryTab = depositDisabled;

  // Pendle: slippage state + countdown
  const isPendleProvider = useIsPendleProvider(provider);

  const [pendleSlippage, setPendleSlippage] =
    useState<ISwapSlippageSegmentItem>({
      key: ESwapSlippageSegmentKey.AUTO,
      value: swapSlippageAutoValue,
    });

  const pendleSlippageValue = useMemo(
    () => (isPendleProvider ? pendleSlippage.value : undefined),
    [isPendleProvider, pendleSlippage.value],
  );

  const stakeCountdown = useQuoteCountdown({
    enabled: isPendleProvider && selectedTabIndex === 0,
  });

  const withdrawCountdown = useQuoteCountdown({
    enabled: isPendleProvider && selectedTabIndex === 1,
  });

  // refreshKey: incremented by header refresh button to signal child components to re-quote
  const [stakeRefreshKey, setStakeRefreshKey] = useState(0);
  const [withdrawRefreshKey, setWithdrawRefreshKey] = useState(0);
  const [stakeQuoteRefreshing, setStakeQuoteRefreshing] = useState(false);
  const [withdrawQuoteRefreshing, setWithdrawQuoteRefreshing] = useState(false);
  const activeQuoteRefreshing =
    selectedTabIndex === 0 ? stakeQuoteRefreshing : withdrawQuoteRefreshing;

  // Cooldown trigger: increments when a quote is successfully fetched, drives 5s header refresh cooldown
  const [refreshCooldownTrigger, setRefreshCooldownTrigger] = useState(0);

  const handleStakeQuoteReset = useCallback(() => {
    stakeCountdown.reset();
    setRefreshCooldownTrigger((prev) => prev + 1);
  }, [stakeCountdown]);

  const handleWithdrawQuoteReset = useCallback(() => {
    withdrawCountdown.reset();
    setRefreshCooldownTrigger((prev) => prev + 1);
  }, [withdrawCountdown]);

  const handleHeaderRefreshQuote = useCallback(() => {
    // Don't reset countdown here — let onQuoteReset do it after successful fetch
    if (selectedTabIndex === 0) {
      setStakeRefreshKey((prev) => prev + 1);
    } else {
      setWithdrawRefreshKey((prev) => prev + 1);
    }
  }, [selectedTabIndex]);

  const handleStakeQuoteRefreshingChange = useCallback((loading: boolean) => {
    setStakeQuoteRefreshing(loading);
  }, []);

  const handleWithdrawQuoteRefreshingChange = useCallback(
    (loading: boolean) => {
      setWithdrawQuoteRefreshing(loading);
    },
    [],
  );

  const handleOpenSlippage = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.slippage_tolerance_title,
      }),
      renderContent: (
        <SlippageSettingDialog
          swapSlippage={pendleSlippage}
          autoValue={swapSlippageAutoValue}
          onSave={(item, close) => {
            setPendleSlippage(item);
            handleHeaderRefreshQuote();
            void close({ flag: 'save' });
          }}
          isMEV={false}
        />
      ),
    });
  }, [intl, pendleSlippage, handleHeaderRefreshQuote]);

  useEffect(() => {
    if (defaultTab === 'withdraw') {
      setSelectedTabIndex(1);
    } else if (defaultTab === 'deposit') {
      setSelectedTabIndex(0);
    }
  }, [defaultTab]);

  const tabData = useMemo(() => {
    if (managePageData) {
      if (
        [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(
          type,
        )
      ) {
        return [
          {
            title: resolveManageActionTitle({
              actionData: managePageData.supply,
              fallbackId: ETranslations.defi_supply,
              fallbackType: 'supply',
            }),
            type: EStakingActionType.Supply,
          },
          {
            title: resolveManageActionTitle({
              actionData: managePageData.withdraw,
              fallbackId: ETranslations.global_withdraw,
              fallbackType: 'withdraw',
            }),
            type: EStakingActionType.Withdraw,
          },
        ];
      }
      if (
        [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
      ) {
        return [
          {
            title: resolveManageActionTitle({
              actionData: managePageData.borrow,
              fallbackId: ETranslations.global_borrow,
              fallbackType: 'borrow',
            }),
            type: EStakingActionType.Borrow,
          },
          {
            title: resolveManageActionTitle({
              actionData: managePageData.repay,
              fallbackId: ETranslations.defi_repay,
              fallbackType: 'repay',
            }),
            type: EStakingActionType.Repay,
          },
        ];
      }

      if (preferManagePageActionText) {
        return [
          {
            title: resolveManageActionTitle({
              actionData: stakeActionData,
              fallbackId: ETranslations.earn_deposit,
              fallbackType: 'deposit',
            }),
            type: EStakingActionType.Deposit,
          },
          {
            title: resolveManageActionTitle({
              actionData: withdrawActionData,
              fallbackId: ETranslations.global_withdraw,
              fallbackType: 'withdraw',
            }),
            type: EStakingActionType.Withdraw,
          },
        ];
      }
    }

    return [
      {
        title: intl.formatMessage({ id: ETranslations.earn_deposit }),
        type: EStakingActionType.Deposit,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_withdraw }),
        type: EStakingActionType.Withdraw,
      },
    ];
  }, [
    intl,
    managePageData,
    type,
    preferManagePageActionText,
    resolveManageActionTitle,
    stakeActionData,
    withdrawActionData,
  ]);

  const tabNames = useMemo(() => tabData.map((item) => item.title), [tabData]);

  const initialTabName = useMemo(() => {
    if (defaultTab === 'withdraw') return tabNames[1];
    return tabNames[0];
  }, [defaultTab, tabNames]);

  const focusedTab = useSharedValue(initialTabName);

  useEffect(() => {
    if (depositDisabled && selectedTabIndex === 0) {
      setSelectedTabIndex(1);
      focusedTab.value = tabNames[1];
    }
  }, [depositDisabled, selectedTabIndex, focusedTab, tabNames]);

  const isWithdrawOrder = useMemo(() => {
    return (
      protocolInfo?.withdrawAction?.type === EStakingActionType.WithdrawOrder
    );
  }, [protocolInfo?.withdrawAction?.type]);

  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        if (index === 0 && shouldDisablePrimaryTab) {
          return;
        }
        if (index === 1 && isWithdrawOrder) {
          const withdrawParams = {
            accountId: earnAccount?.accountId || '',
            networkId,
            protocolInfo,
            tokenInfo: withdrawTokenInfo,
            symbol,
            provider,
            onSuccess,
            isInModalContext,
          };

          if (isInModalContext) {
            appNavigation.push(
              EModalStakingRoutes.WithdrawOptions,
              withdrawParams,
            );
          } else {
            appNavigation.pushModal(EModalRoutes.StakingModal, {
              screen: EModalStakingRoutes.WithdrawOptions,
              params: withdrawParams,
            });
          }
          return;
        }

        focusedTab.value = name;
        setSelectedTabIndex(index);

        const newTab = index === 0 ? 'deposit' : 'withdraw';
        onTabChange?.(newTab);
      }
    },
    [
      isWithdrawOrder,
      shouldDisablePrimaryTab,
      earnAccount?.accountId,
      focusedTab,
      tabData,
      protocolInfo,
      appNavigation,
      networkId,
      withdrawTokenInfo,
      symbol,
      provider,
      onTabChange,
      isInModalContext,
      onSuccess,
    ],
  );

  return (
    <>
      <XStack jc="space-between" px="$5">
        <Tabs.TabBar
          divider={false}
          onTabPress={handleTabChange}
          tabNames={tabNames}
          focusedTab={focusedTab}
          renderItem={({ name, isFocused }) => {
            const isDisabled = shouldDisablePrimaryTab && name === tabNames[0];
            let textColor: '$textDisabled' | '$text' | '$textSubdued' =
              '$textSubdued';

            if (isDisabled) {
              textColor = '$textDisabled';
            } else if (isFocused) {
              textColor = '$text';
            }

            return (
              <XStack
                px="$2"
                py="$1.5"
                mr="$1"
                bg={isFocused ? '$bgActive' : '$bg'}
                borderRadius="$2"
                borderCurve="continuous"
                opacity={isDisabled ? 0.4 : 1}
                hoverStyle={
                  !isFocused && !isDisabled
                    ? {
                        bg: '$bgHover',
                      }
                    : null
                }
                onPress={() => {
                  if (isDisabled) {
                    return;
                  }
                  handleTabChange(name);
                }}
              >
                <SizableText
                  size="$headingMd"
                  color={textColor}
                  letterSpacing={-0.15}
                >
                  {name}
                </SizableText>
              </XStack>
            );
          }}
        />
        <HeaderRight
          accountId={indicatorAccountId || earnAccount?.accountId}
          networkId={networkId}
          stakeTag={stakeTag || protocolInfo?.stakeTag}
          historyAction={historyAction}
          onHistory={onHistory}
          onRefresh={onIndicatorRefresh}
          onRefreshPending={(refreshFn) => {
            if (onRefreshPendingRef) {
              onRefreshPendingRef.current = refreshFn;
            }
          }}
          isPendleProvider={isPendleProvider}
          onRefreshQuote={handleHeaderRefreshQuote}
          refreshLoading={activeQuoteRefreshing}
          refreshCooldownTrigger={refreshCooldownTrigger}
          onOpenSlippage={handleOpenSlippage}
        />
      </XStack>
      {selectedTabIndex === 0 ? (
        <StakeSection
          accountId={earnAccount?.accountId || ''}
          networkId={networkId}
          tokenInfo={stakeTokenInfo}
          protocolInfo={protocolInfo}
          isDisabled={depositDisabled}
          onSuccess={onSuccess}
          beforeFooter={stakeBeforeFooter}
          showApyDetail={showApyDetail}
          isInModalContext={isInModalContext}
          fallbackTokenImageUri={fallbackTokenImageUri}
          ongoingValidator={ongoingValidator}
          useBorrowApi={useBorrowApi}
          borrowMarketAddress={marketAddress}
          borrowReserveAddress={reserveAddress}
          borrowAction={borrowActionPrimary}
          borrowActionLabel={borrowActionLabelPrimary}
          receiveInputConfig={stakeReceiveInputConfig}
          pendleSlippage={pendleSlippageValue}
          isQuoteExpired={stakeCountdown.isExpired}
          onQuoteReset={handleStakeQuoteReset}
          refreshKey={stakeRefreshKey}
          onQuoteRefreshingChange={handleStakeQuoteRefreshingChange}
        />
      ) : null}
      {selectedTabIndex === 1 ? (
        <WithdrawSection
          accountId={earnAccount?.accountId || ''}
          networkId={networkId}
          tokenInfo={withdrawTokenInfo}
          protocolInfo={protocolInfo}
          isDisabled={withdrawDisabled}
          onSuccess={onSuccess}
          beforeFooter={withdrawBeforeFooter}
          showApyDetail={showApyDetail}
          isInModalContext={isInModalContext}
          fallbackTokenImageUri={fallbackTokenImageUri}
          useBorrowApi={useBorrowApi}
          borrowMarketAddress={marketAddress}
          borrowReserveAddress={reserveAddress}
          borrowAction={borrowActionSecondary}
          defaultCollateralReserveAddress={
            managePageData?.collateral?.data?.reserveAddress
          }
          borrowActionLabel={borrowActionLabelSecondary}
          receiveInputConfig={withdrawReceiveInputConfig}
          pendleSlippage={pendleSlippageValue}
          isQuoteExpired={withdrawCountdown.isExpired}
          onQuoteReset={handleWithdrawQuoteReset}
          refreshKey={withdrawRefreshKey}
          onQuoteRefreshingChange={handleWithdrawQuoteRefreshingChange}
        />
      ) : null}
    </>
  );
}
