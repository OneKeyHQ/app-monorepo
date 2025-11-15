import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Button,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components/src/hooks';
import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnAlert,
  IEarnManagePageResponse,
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';

import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { EarnText } from '../../../components/ProtocolDetails/EarnText';

import { HeaderRight } from './HeaderRight';
import { StakeSection } from './StakeSection';
import { WithdrawSection } from './WithdrawSection';

type IEarnAccountWithId = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceStaking.getEarnAccount>
>;

export interface IManagePositionContentProps {
  // Network and token info
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;

  // Account info
  account: { id: string } | undefined;
  indexedAccount: { id: string } | undefined;

  // Data from useManagePage
  earnAccount: IEarnAccountWithId | null | undefined;
  tokenInfo: IEarnTokenInfo | undefined;
  protocolInfo: IProtocolInfo | undefined;
  managePageData: IEarnManagePageResponse | undefined;
  depositDisabled: boolean;
  withdrawDisabled: boolean;
  alerts: IEarnAlert[];
  isLoading: boolean | undefined;

  // Optional tab control
  defaultTab?: 'deposit' | 'withdraw';
  onTabChange?: (tab: 'deposit' | 'withdraw') => void;

  // Optional extra content after sections
  renderAfterDeposit?: () => React.ReactNode;
  renderAfterWithdraw?: () => React.ReactNode;

  // Optional custom navigation handler for WithdrawOptions
  onNavigateToWithdrawOptions?: (params: {
    accountId: string;
    networkId: string;
    protocolInfo: IProtocolInfo | undefined;
    tokenInfo: IEarnTokenInfo | undefined;
    symbol: string;
    provider: string;
  }) => void;

  // USDe-specific props
  subscriptionValue?: IStakeEarnDetail['subscriptionValue'];
  detailActions?: IStakeEarnDetail['actions'];
  onReceive?: () => void;
  onTrade?: () => void;
}

export function ManagePositionContent({
  networkId,
  symbol,
  provider,
  vault,
  account,
  indexedAccount,
  earnAccount,
  tokenInfo,
  protocolInfo,
  managePageData,
  depositDisabled,
  withdrawDisabled,
  alerts,
  isLoading,
  defaultTab,
  onTabChange,
  renderAfterDeposit,
  renderAfterWithdraw,
  onNavigateToWithdrawOptions,
  subscriptionValue,
  detailActions,
  onReceive,
  onTrade,
}: IManagePositionContentProps) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const navigation = useNavigation();
  const { gtMd } = useMedia();

  const historyAction = useMemo(
    () => managePageData?.history,
    [managePageData?.history],
  );

  const onHistory = useMemo(() => {
    if (historyAction?.disabled || !earnAccount?.accountId) return undefined;
    return (params?: { filterType?: string }) => {
      const { filterType } = params || {};
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: protocolInfo?.stakeTag || '',
        protocolVault: vault,
        filterType,
      });
    };
  }, [
    historyAction?.disabled,
    appNavigation,
    earnAccount?.accountId,
    networkId,
    protocolInfo?.stakeTag,
    provider,
    symbol,
    vault,
  ]);

  // Initialize selectedTabIndex based on defaultTab
  const [selectedTabIndex, setSelectedTabIndex] = useState(() => {
    if (defaultTab === 'withdraw') return 1;
    return 0;
  });

  // Update selectedTabIndex when defaultTab changes from route
  useEffect(() => {
    if (defaultTab === 'withdraw') {
      setSelectedTabIndex(1);
    } else if (defaultTab === 'deposit') {
      setSelectedTabIndex(0);
    }
  }, [defaultTab]);

  const tabData = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.earn_deposit }),
        type: EStakingActionType.Deposit,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_withdraw }),
        type: EStakingActionType.Withdraw,
      },
    ],
    [intl],
  );

  const TabNames = useMemo(() => {
    return tabData.map((item) => item.title);
  }, [tabData]);

  // Initialize focusedTab based on defaultTab
  const initialTabName = useMemo(() => {
    if (defaultTab === 'withdraw') return TabNames[1];
    return TabNames[0];
  }, [defaultTab, TabNames]);

  const focusedTab = useSharedValue(initialTabName);

  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        // Check if clicking Withdraw tab and it's a withdrawOrder type
        if (
          index === 1 &&
          protocolInfo?.withdrawAction?.type ===
            EStakingActionType.WithdrawOrder
        ) {
          // Directly open WithdrawOptions modal instead of switching tab
          if (onNavigateToWithdrawOptions) {
            onNavigateToWithdrawOptions({
              accountId: earnAccount?.accountId || '',
              networkId,
              protocolInfo,
              tokenInfo,
              symbol,
              provider,
            });
          } else {
            // Default navigation for ManagePosition page (already in modal stack)
            appNavigation.push(EModalStakingRoutes.WithdrawOptions, {
              accountId: earnAccount?.accountId || '',
              networkId,
              protocolInfo,
              tokenInfo,
              symbol,
              provider,
            });
          }
          return;
        }

        focusedTab.value = name;
        setSelectedTabIndex(index);

        // Notify parent component if callback provided
        const newTab = index === 0 ? 'deposit' : 'withdraw';
        onTabChange?.(newTab);

        // Update route params if navigation is available
        if (navigation.setParams) {
          navigation.setParams({
            tab: newTab,
          } as any);
        }
      }
    },
    [
      earnAccount?.accountId,
      focusedTab,
      tabData,
      navigation,
      protocolInfo,
      appNavigation,
      networkId,
      tokenInfo,
      symbol,
      provider,
      onTabChange,
      onNavigateToWithdrawOptions,
    ],
  );

  // USDe-specific data
  const receiveAction = useMemo(
    () => detailActions?.find((a) => a.type === EStakingActionType.Receive),
    [detailActions],
  );
  const tradeAction = useMemo(
    () => detailActions?.find((a) => a.type === EStakingActionType.Trade),
    [detailActions],
  );

  const renderUSDActionButtons = useCallback(() => {
    if (!gtMd) {
      return null;
    }
    return (
      <XStack gap="$2">
        {receiveAction && onReceive ? (
          <Button onPress={onReceive}>
            {intl.formatMessage({ id: ETranslations.global_receive })}
          </Button>
        ) : null}
        {tradeAction && onTrade ? (
          <Button variant="primary" onPress={onTrade}>
            {intl.formatMessage({ id: ETranslations.global_trade })}
          </Button>
        ) : null}
      </XStack>
    );
  }, [gtMd, receiveAction, tradeAction, onReceive, onTrade, intl]);

  // For USDe, we don't need tokenInfo, but we need subscriptionValue
  if (isLoading) {
    return null; // Parent should handle loading state
  }

  // USDe rendering
  if (symbol === 'USDe' && subscriptionValue) {
    return (
      <>
        <YStack px="$5">
          <YStack gap="$8">
            <YStack>
              <XStack ai="center" gap="$2" pt="$2">
                <EarnText text={subscriptionValue.title} size="$headingLg" />
              </XStack>
              <XStack gap="$2" pt="$2" pb="$1" jc="space-between">
                <EarnText
                  text={{ text: subscriptionValue.fiatValue }}
                  size="$heading4xl"
                />
                {renderUSDActionButtons()}
              </XStack>
              <EarnText
                text={{
                  text: `${subscriptionValue.formattedValue || 0} ${
                    subscriptionValue?.token?.info?.symbol || ''
                  }`,
                }}
                size="$bodyLgMedium"
                color="$textSubdued"
              />
            </YStack>
          </YStack>
        </YStack>
        <YStack px="$5">
          <EarnAlert alerts={alerts} />
        </YStack>
      </>
    );
  }

  // Normal deposit/withdraw rendering
  // If no tokenInfo but we have renderAfterDeposit (for NoAddressWarning), show it
  if (!tokenInfo) {
    return <>{renderAfterDeposit?.()}</>;
  }

  return (
    <>
      <XStack jc="space-between" px="$5">
        <Tabs.TabBar
          divider={false}
          onTabPress={handleTabChange}
          tabNames={TabNames}
          focusedTab={focusedTab}
          renderItem={({ name, isFocused }) => (
            <XStack
              px="$2"
              py="$1.5"
              mr="$1"
              bg={isFocused ? '$bgActive' : '$bg'}
              borderRadius="$2"
              borderCurve="continuous"
              onPress={() => handleTabChange(name)}
            >
              <SizableText
                size="$bodyMdMedium"
                color={isFocused ? '$text' : '$textSubdued'}
                letterSpacing={-0.15}
              >
                {name}
              </SizableText>
            </XStack>
          )}
        />
        <HeaderRight historyAction={historyAction} onHistory={onHistory} />
      </XStack>
      {selectedTabIndex === 0 ? (
        <>
          <StakeSection
            accountId={earnAccount?.accountId || ''}
            networkId={networkId}
            tokenInfo={tokenInfo}
            protocolInfo={protocolInfo}
            isDisabled={depositDisabled}
          />
          {renderAfterDeposit?.()}
        </>
      ) : null}
      {selectedTabIndex === 1 ? (
        <>
          <WithdrawSection
            accountId={earnAccount?.accountId || ''}
            networkId={networkId}
            tokenInfo={tokenInfo}
            protocolInfo={protocolInfo}
            isDisabled={withdrawDisabled}
          />
          {renderAfterWithdraw?.()}
        </>
      ) : null}
      <YStack px="$5">
        <EarnAlert alerts={alerts} />
      </YStack>
    </>
  );
}
