import { useCallback, useMemo } from 'react';

import { isEmpty } from 'lodash';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';

import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { NoAddressWarning } from '../../../components/ProtocolDetails/NoAddressWarning';
import { useManagePage } from '../hooks/useManagePage';

import { AdaManageContent } from './AdaManageContent';
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
  isInModalContext?: boolean;

  // Optional configurations
  defaultTab?: 'deposit' | 'withdraw';
  onTabChange?: (tab: 'deposit' | 'withdraw') => void;
  showApyDetail?: boolean;
  fallbackTokenImageUri?: string;

  // Optional callbacks
  onCreateAddress?: () => Promise<void>;
  onStakeWithdrawSuccess?: () => void;
}

const SectionSkeleton = () => (
  <YStack px="$5" gap="$5">
    {/* Tab bar skeleton */}
    <XStack gap="$4">
      <Skeleton w={80} h="$10" borderRadius="$2" />
      <Skeleton w={80} h="$10" borderRadius="$2" />
    </XStack>

    {/* Main content area skeleton */}
    <YStack gap="$4" pt="$3">
      {/* Amount input section */}
      <YStack gap="$3" pt="$4">
        <Stack bg="$bgSubdued" borderRadius="$3" p="$4">
          <Skeleton h="$10" w="60%" borderRadius="$2" />
        </Stack>
      </YStack>

      {/* Info cards */}
      <YStack gap="$3" pt="$3">
        <XStack jc="space-between">
          <Skeleton.BodyMd w={80} />
          <Skeleton.BodyMd w={60} />
        </XStack>
        <XStack jc="space-between">
          <Skeleton.BodyMd w={90} />
          <Skeleton.BodyMd w={70} />
        </XStack>
        <XStack jc="space-between">
          <Skeleton.BodyMd w={70} />
          <Skeleton.BodyMd w={50} />
        </XStack>
      </YStack>

      {/* Action button */}
      <Stack pt="$4">
        <Skeleton h="$12" w="100%" borderRadius="$3" />
      </Stack>
    </YStack>
  </YStack>
);

export function ManagePositionContent({
  networkId,
  symbol,
  provider,
  vault,
  accountId,
  indexedAccountId,
  defaultTab,
  onTabChange,
  showApyDetail = false,
  fallbackTokenImageUri,
  onCreateAddress,
  onStakeWithdrawSuccess,
  isInModalContext = false,
}: IManagePositionContentProps) {
  const appNavigation = useAppNavigation();

  const {
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
    isLoading,
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

  const noAddressOrAccount = useMemo(
    () => (!accountId && !indexedAccountId) || !earnAccount?.accountAddress,
    [accountId, indexedAccountId, earnAccount?.accountAddress],
  );
  const resolvedTokenImageUri =
    tokenInfo?.token?.logoURI || fallbackTokenImageUri;

  const resolvedTokenInfo = useMemo(() => {
    if (tokenInfo?.token) {
      return tokenInfo;
    }

    const fallbackToken = {
      uniqueKey: `${networkId}-${symbol}`,
      address: '',
      name: symbol,
      symbol,
      decimals: 0,
      logoURI: fallbackTokenImageUri || '',
      isNative: false,
      totalSupply: '0',
      riskLevel: 0,
      coingeckoId: '',
    };

    if (tokenInfo) {
      return {
        ...tokenInfo,
        token: fallbackToken,
      };
    }

    const fallbackTokenInfo = {
      networkId,
      provider,
      vault: vault || '',
      accountId: accountId || '',
      indexedAccountId,
      token: fallbackToken,
      balanceParsed: '0',
      price: '0',
    };

    return fallbackTokenInfo;
  }, [
    tokenInfo,
    symbol,
    fallbackTokenImageUri,
    networkId,
    provider,
    vault,
    accountId,
    indexedAccountId,
  ]);

  const noAddressWarningElement = useMemo(
    () =>
      noAddressOrAccount ? (
        <NoAddressWarning
          accountId={accountId || ''}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          onCreateAddress={handleCreateAddress}
        />
      ) : null,
    [
      noAddressOrAccount,
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
    if (noAddressOrAccount) {
      return noAddressWarningElement;
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
  }, [noAddressOrAccount, alertsStake, alerts, noAddressWarningElement]);

  // Create beforeFooter content for withdraw section
  const withdrawBeforeFooter = useMemo(() => {
    if (noAddressOrAccount) {
      return noAddressWarningElement;
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
  }, [noAddressOrAccount, alertsWithdraw, alerts, noAddressWarningElement]);

  // Create beforeFooter content for special layout (USDe, ADA)
  const specialBeforeFooter = useMemo(() => {
    if (noAddressOrAccount) {
      return noAddressWarningElement;
    }
    if (!isEmpty(alertsHolding) || !isEmpty(alerts)) {
      return (
        <YStack>
          <EarnAlert alerts={alerts} />
          <EarnAlert alerts={alertsHolding} />
        </YStack>
      );
    }
    return null;
  }, [noAddressOrAccount, alertsHolding, alerts, noAddressWarningElement]);

  if (isLoading) {
    return <SectionSkeleton />;
  }

  // USDe special rendering
  if (symbol.toLowerCase() === 'usde') {
    return (
      <USDEManageContent
        managePageData={managePageData}
        networkId={networkId}
        symbol={symbol as ISupportedSymbol}
        provider={provider}
        vault={vault}
        onHistory={onHistory}
        earnAccount={earnAccount}
        showApyDetail={showApyDetail}
        isInModalContext={isInModalContext}
        beforeFooter={specialBeforeFooter}
        fallbackTokenImageUri={fallbackTokenImageUri}
      />
    );
  }

  // ADA special rendering (Stakefish provider)
  if (symbol.toLowerCase() === 'ada') {
    return (
      <AdaManageContent
        managePageData={managePageData}
        networkId={networkId}
        symbol={symbol as ISupportedSymbol}
        provider={provider}
        vault={vault}
        onHistory={onHistory}
        earnAccount={earnAccount}
        showApyDetail={showApyDetail}
        isInModalContext={isInModalContext}
        beforeFooter={specialBeforeFooter}
        fallbackTokenImageUri={fallbackTokenImageUri}
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
      tokenInfo={resolvedTokenInfo}
      fallbackTokenImageUri={resolvedTokenImageUri}
      protocolInfo={protocolInfo}
      earnAccount={earnAccount ?? undefined}
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
      showApyDetail={showApyDetail}
    />
  );
}
