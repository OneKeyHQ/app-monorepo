import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Button,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components/src/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalStakingRoutes,
} from '@onekeyhq/shared/src/routes';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';

import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { EarnText } from '../../../components/ProtocolDetails/EarnText';
import { NoAddressWarning } from '../../../components/ProtocolDetails/NoAddressWarning';
import { useHandleSwap } from '../../../hooks/useHandleSwap';
import { useManagePage } from '../hooks/useManagePage';

import { HeaderRight } from './HeaderRight';
import { buildCustomContent } from './protocolConfigs';
import { StakeSection } from './StakeSection';
import { WithdrawSection } from './WithdrawSection';

export interface IManagePositionContentProps {
  // Essential params
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  accountId: string;
  indexedAccountId?: string;

  // Optional configurations
  defaultTab?: 'deposit' | 'withdraw';
  onTabChange?: (tab: 'deposit' | 'withdraw') => void;

  // Optional callbacks
  onCreateAddress?: () => Promise<void>;
}

export function ManagePositionContent({
  networkId,
  symbol,
  provider,
  vault,
  accountId,
  indexedAccountId,
  defaultTab,
  onTabChange,
  onCreateAddress,
}: IManagePositionContentProps) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const navigation = useNavigation();
  const { gtMd } = useMedia();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { handleSwap } = useHandleSwap();

  const { account, indexedAccount: activeIndexedAccount } = activeAccount;

  // Use managePage hook to fetch all data
  const {
    isLoading,
    tokenInfo,
    earnAccount,
    protocolInfo,
    managePageData,
    depositDisabled,
    withdrawDisabled,
    alerts,
    subscriptionValue,
    detailActions,
    refreshAccount: refreshManageAccount,
    run: refreshManageData,
  } = useManagePage({
    accountId,
    networkId,
    indexedAccountId,
    symbol: symbol as ISupportedSymbol,
    provider,
    vault,
  });

  // Handle create address
  const handleCreateAddress = useCallback(async () => {
    if (onCreateAddress) {
      await onCreateAddress();
    }
    await refreshManageAccount();
    await refreshManageData();
  }, [onCreateAddress, refreshManageAccount, refreshManageData]);

  const hasNoAccount = !accountId && !indexedAccountId;
  const hasNoAddress = !earnAccount?.accountAddress;

  // USDe handlers
  const handleReceive = useCallback(() => {
    if (!subscriptionValue?.token?.info || !earnAccount) return;
    appNavigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId,
        accountId: earnAccount.accountId,
        walletId: earnAccount.walletId,
        token: subscriptionValue.token.info,
      },
    });
  }, [appNavigation, networkId, earnAccount, subscriptionValue?.token?.info]);

  const handleTrade = useCallback(async () => {
    if (!subscriptionValue?.token?.info) return;
    await handleSwap({
      token: subscriptionValue.token.info,
      networkId,
    });
  }, [handleSwap, networkId, subscriptionValue?.token?.info]);

  // Build custom content
  const customContent = useMemo(
    () =>
      buildCustomContent(
        { symbol, provider, vault },
        {
          subscriptionValue,
          detailActions,
          handlers: {
            onReceive: handleReceive,
            onTrade: handleTrade,
          },
        },
      ),
    [
      symbol,
      provider,
      vault,
      subscriptionValue,
      detailActions,
      handleReceive,
      handleTrade,
    ],
  );

  const renderNoAddressWarning = useCallback(
    () =>
      hasNoAccount || hasNoAddress ? (
        <Stack px="$5">
          <NoAddressWarning
            accountId={accountId || ''}
            networkId={networkId}
            indexedAccountId={indexedAccountId}
            onCreateAddress={handleCreateAddress}
          />
        </Stack>
      ) : null,
    [
      hasNoAccount,
      hasNoAddress,
      accountId,
      networkId,
      indexedAccountId,
      handleCreateAddress,
    ],
  );

  const historyAction = useMemo(
    () => managePageData?.history,
    [managePageData?.history],
  );

  const onHistory = useMemo(() => {
    if (historyAction?.disabled || !earnAccount?.accountId) return undefined;
    return (params?: { filterType?: string }) => {
      const { filterType } = params || {};
      const historyParams = {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: protocolInfo?.stakeTag || '',
        protocolVault: vault,
        filterType,
      };

      // Check if we're in a modal navigation context by checking the current route
      // If navigation.getState() returns a route with modal-related info, use push
      // Otherwise, use pushModal
      try {
        const state = navigation.getState?.();
        const currentRoute = state?.routes?.[state.index];
        const isInModal = currentRoute?.name?.includes('Modal');

        if (isInModal) {
          // We're already in a modal, use push to navigate within the modal stack
          appNavigation.push(EModalStakingRoutes.HistoryList, historyParams);
        } else {
          // We're in a regular page (like EarnProtocolDetails), use pushModal
          appNavigation.pushModal(EModalRoutes.StakingModal, {
            screen: EModalStakingRoutes.HistoryList,
            params: historyParams,
          });
        }
      } catch {
        // Fallback: if we can't determine context, use pushModal
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.HistoryList,
          params: historyParams,
        });
      }
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
    navigation,
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
          appNavigation.push(EModalStakingRoutes.WithdrawOptions, {
            accountId: earnAccount?.accountId || '',
            networkId,
            protocolInfo,
            tokenInfo,
            symbol,
            provider,
          });
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
    ],
  );

  // Custom content rendering for special protocols
  const customActions = useMemo(() => {
    if (!customContent?.actions) return [];
    return customContent.actions;
  }, [customContent?.actions]);

  const renderCustomActionButtons = useCallback(() => {
    if (!gtMd || !customActions.length || !customContent?.handlers) {
      return null;
    }

    return (
      <XStack gap="$2">
        {customActions.map((action) => {
          const handlerKey = `on${action.type
            .charAt(0)
            .toUpperCase()}${action.type.slice(1)}`;
          const handler = customContent.handlers?.[handlerKey];

          if (!handler || action.disabled) return null;

          const isReceive = action.type === EStakingActionType.Receive;
          const isTrade = action.type === EStakingActionType.Trade;

          // Determine translation key
          let translationKey = ETranslations.global_continue;
          if (isReceive) {
            translationKey = ETranslations.global_receive;
          } else if (isTrade) {
            translationKey = ETranslations.global_trade;
          }

          return (
            <Button
              key={action.type}
              variant={isTrade ? 'primary' : undefined}
              onPress={handler}
            >
              {intl.formatMessage({ id: translationKey })}
            </Button>
          );
        })}
      </XStack>
    );
  }, [gtMd, customActions, customContent?.handlers, intl]);

  // Show loading skeleton
  if (isLoading && !hasNoAccount) {
    return (
      <YStack px="$5" pt="$4" gap="$6">
        {/* Tabs skeleton */}
        <XStack gap="$2">
          <Skeleton w="$20" h="$9" borderRadius="$2" />
          <Skeleton w="$20" h="$9" borderRadius="$2" />
        </XStack>

        {/* Input section skeleton */}
        <YStack gap="$4">
          <YStack gap="$3" p="$4" bg="$bgSubdued" borderRadius="$3">
            <XStack jc="space-between" ai="center">
              <Skeleton.BodyMd w="$20" />
              <Skeleton.BodySm w="$24" />
            </XStack>
            <XStack jc="space-between" ai="center">
              <Skeleton w="$32" h="$12" />
              <XStack gap="$2" ai="center">
                <Skeleton w="$10" h="$10" borderRadius="$full" />
                <Skeleton.BodyLg w="$16" />
              </XStack>
            </XStack>
          </YStack>

          {/* Info cards skeleton */}
          <YStack gap="$3">
            <XStack jc="space-between" ai="center">
              <Skeleton.BodyMd w="$24" />
              <Skeleton.BodyMd w="$20" />
            </XStack>
            <XStack jc="space-between" ai="center">
              <Skeleton.BodyMd w="$28" />
              <Skeleton.BodyMd w="$16" />
            </XStack>
            <XStack jc="space-between" ai="center">
              <Skeleton.BodyMd w="$20" />
              <Skeleton.BodyMd w="$24" />
            </XStack>
          </YStack>

          {/* Button skeleton */}
          <Skeleton w="100%" h="$11" borderRadius="$3" />
        </YStack>
      </YStack>
    );
  }

  if (hasNoAccount || hasNoAddress) {
    // Show NoAddressWarning instead of content
    return <>{renderNoAddressWarning()}</>;
  }

  // Custom content rendering (e.g., USDe or other special protocols)
  if (customContent?.data) {
    const data = customContent.data;
    return (
      <>
        <YStack px="$5">
          <YStack gap="$8">
            <YStack>
              <XStack ai="center" gap="$2" pt="$2">
                <EarnText text={data.title} size="$headingLg" />
              </XStack>
              <XStack gap="$2" pt="$2" pb="$1" jc="space-between">
                <EarnText text={{ text: data.fiatValue }} size="$heading4xl" />
                {renderCustomActionButtons()}
              </XStack>
              <EarnText
                text={{
                  text: `${data.formattedValue || 0} ${
                    data?.token?.info?.symbol || ''
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
  // If no tokenInfo, return null (loading state should have been handled above)
  if (!tokenInfo) {
    return null;
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
        </>
      ) : null}
      {selectedTabIndex === 1 ? (
        <>
          <WithdrawSection
            accountId={earnAccount?.accountId || ''}
            networkId={networkId}
            tokenInfo={tokenInfo}
            protocolInfo={protocolInfo}
            isDisabled={withdrawDisabled || hasNoAccount || hasNoAddress}
          />
          {renderNoAddressWarning()}
        </>
      ) : null}
      <YStack px="$5">
        <EarnAlert alerts={alerts} />
      </YStack>
    </>
  );
}
