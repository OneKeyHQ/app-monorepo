import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { isEmpty } from 'lodash';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';

import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { NoAddressWarning } from '../../../components/ProtocolDetails/NoAddressWarning';
import { useManagePage } from '../hooks/useManagePage';

import { NormalManageContent } from './NormalManageContent';
import { USDEManageContent } from './USDEManageContent';

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
  onStakeWithdrawSuccess?: () => void;
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
  onStakeWithdrawSuccess,
}: IManagePositionContentProps) {
  const appNavigation = useAppNavigation();
  const navigation = useNavigation();

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
    alertsHolding,
    alertsStake,
    alertsWithdraw,
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

  // Determine if we're in a modal context
  const isInModalContext = useMemo(() => {
    try {
      const state = navigation.getState?.();
      const currentRoute = state?.routes?.[state.index];
      return currentRoute?.name?.includes('Modal') ?? false;
    } catch {
      return false;
    }
  }, [navigation]);

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

      if (isInModalContext) {
        // We're already in a modal, use push to navigate within the modal stack
        appNavigation.push(EModalStakingRoutes.HistoryList, historyParams);
      } else {
        // We're in a regular page (like EarnProtocolDetails), use pushModal
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
    isInModalContext,
  ]);

  const handleStakeWithdrawSuccess = useCallback(() => {
    if (isInModalContext) {
      appNavigation.pop();
    }
    // If not in modal, don't navigate (stay on current page)
    // Call parent refresh callback to update data
    onStakeWithdrawSuccess?.();
  }, [isInModalContext, appNavigation, onStakeWithdrawSuccess]);

  // Create beforeFooter content for stake section
  const stakeBeforeFooter = useMemo(() => {
    if (hasNoAccount || hasNoAddress) {
      return null;
    }
    if (!isEmpty(alertsStake) || !isEmpty(alerts)) {
      return (
        <YStack>
          <EarnAlert alerts={alerts} />
          <EarnAlert alerts={alertsStake} />
        </YStack>
      );
    }
    return null;
  }, [hasNoAccount, hasNoAddress, alertsStake, alerts]);

  // Create beforeFooter content for withdraw section
  const withdrawBeforeFooter = useMemo(() => {
    if (hasNoAccount || hasNoAddress) {
      return null;
    }
    if (!isEmpty(alertsWithdraw) || !isEmpty(alerts)) {
      return (
        <YStack>
          <EarnAlert alerts={alerts} />
          <EarnAlert alerts={alertsWithdraw} />
        </YStack>
      );
    }
    return null;
  }, [hasNoAccount, hasNoAddress, alertsWithdraw, alerts]);

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

  // USDe special rendering
  if (symbol.toLowerCase() === 'usde') {
    if (!managePageData?.holdings) {
      return null;
    }

    return (
      <USDEManageContent
        managePageData={managePageData}
        networkId={networkId}
        symbol={symbol as ISupportedSymbol}
        provider={provider}
        vault={vault}
        alertsHolding={alertsHolding}
        onHistory={onHistory}
        earnAccount={earnAccount}
      />
    );
  }

  // Normal deposit/withdraw rendering
  return (
    <NormalManageContent
      networkId={networkId}
      symbol={symbol}
      provider={provider}
      vault={vault}
      tokenInfo={tokenInfo}
      protocolInfo={protocolInfo}
      earnAccount={earnAccount}
      depositDisabled={depositDisabled}
      withdrawDisabled={withdrawDisabled}
      stakeBeforeFooter={stakeBeforeFooter}
      withdrawBeforeFooter={withdrawBeforeFooter}
      historyAction={historyAction}
      onHistory={onHistory}
      onSuccess={handleStakeWithdrawSuccess}
      defaultTab={defaultTab}
      onTabChange={onTabChange}
      isInModalContext={isInModalContext}
      appNavigation={appNavigation}
    />
  );
}
