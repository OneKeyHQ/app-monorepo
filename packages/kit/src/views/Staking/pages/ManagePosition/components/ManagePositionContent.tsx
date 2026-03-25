import { useCallback, useMemo, useRef } from 'react';

import { isEmpty } from 'lodash';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';

import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { NetworkUnsupportedWarning } from '../../../components/ProtocolDetails/NetworkUnsupportedWarning';
import { NoAddressWarning } from '../../../components/ProtocolDetails/NoAddressWarning';
import { EManagePositionType, useManagePage } from '../hooks/useManagePage';

import { AdaManageContent } from './AdaManageContent';
import { ManagePageV2Content } from './ManagePageV2Content';
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

  // Type of manage position (Staking or Borrow)
  type?: EManagePositionType;

  // Borrow-specific params
  reserveAddress?: string;
  marketAddress?: string;
  // Optional configurations
  defaultTab?: 'deposit' | 'withdraw';
  onTabChange?: (tab: 'deposit' | 'withdraw') => void;
  showApyDetail?: boolean;
  fallbackTokenImageUri?: string;
  providerLogoUri?: string;

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
  type = EManagePositionType.Staking,
  reserveAddress,
  marketAddress,
  defaultTab,
  onTabChange,
  showApyDetail = false,
  fallbackTokenImageUri,
  providerLogoUri,
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
    ongoingValidator,
    run: refreshManageData,
    isLoading,
  } = useManagePage({
    accountId,
    networkId,
    indexedAccountId,
    symbol: symbol as ISupportedSymbol,
    provider,
    vault,
    type,
    reserveAddress,
    marketAddress,
  });

  const resolvedProtocolInfo = useMemo(() => {
    if (!protocolInfo) {
      return undefined;
    }
    if (!providerLogoUri) {
      return protocolInfo;
    }
    if (protocolInfo.providerDetail?.logoURI) {
      return protocolInfo;
    }
    return {
      ...protocolInfo,
      providerDetail: {
        ...protocolInfo.providerDetail,
        logoURI: providerLogoUri,
      },
    };
  }, [protocolInfo, providerLogoUri]);

  // Handle create address
  const handleCreateAddress = useCallback(async () => {
    if (onCreateAddress) {
      await onCreateAddress();
    }
    await refreshManageData();
  }, [onCreateAddress, refreshManageData]);

  // Check if Bitcoin Only firmware is trying to access non-BTC network
  const { result: accountNetworkNotSupported } = usePromiseResult(
    async () => {
      return backgroundApiProxy.serviceAccount.checkAccountNetworkNotSupported({
        accountId: accountId?.length > 0 ? accountId : (indexedAccountId ?? ''),
        activeNetworkId: networkId,
      });
    },
    [accountId, networkId, indexedAccountId],
    { initResult: undefined },
  );

  const noAddressOrAccount = useMemo(
    () => (!accountId && !indexedAccountId) || !earnAccount?.accountAddress,
    [accountId, indexedAccountId, earnAccount?.accountAddress],
  );

  // Determine if we should show warning instead of normal content
  // This includes: no address, no account, or BTC-only firmware on non-BTC network
  const shouldShowWarning = useMemo(
    () => noAddressOrAccount || !!accountNetworkNotSupported,
    [noAddressOrAccount, accountNetworkNotSupported],
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
      networkId,
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

  // Warning element: shows NoAddressWarning or NetworkMismatchWarning based on the situation
  const warningElement = useMemo(() => {
    // BTC-only firmware on non-BTC network - show network mismatch warning
    if (accountNetworkNotSupported) {
      return <NetworkUnsupportedWarning networkId={networkId} />;
    }

    // No address or account - show no address warning
    if (noAddressOrAccount) {
      return (
        <NoAddressWarning
          accountId={accountId || ''}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          onCreateAddress={handleCreateAddress}
        />
      );
    }

    return null;
  }, [
    accountNetworkNotSupported,
    noAddressOrAccount,
    accountId,
    networkId,
    indexedAccountId,
    handleCreateAddress,
  ]);

  const historyAction = useMemo(
    () => managePageData?.history,
    [managePageData?.history],
  );

  const isBorrowType = useMemo(
    () =>
      [
        EManagePositionType.Supply,
        EManagePositionType.Borrow,
        EManagePositionType.Withdraw,
        EManagePositionType.Repay,
      ].includes(type),
    [type],
  );

  const onHistory = useMemo(() => {
    // Return undefined if history is disabled or no account
    if (historyAction?.disabled || !earnAccount?.accountId) return undefined;

    if (isBorrowType && marketAddress) {
      return () => {
        BorrowNavigation.pushToBorrowHistory(appNavigation, {
          accountId: earnAccount.accountId,
          networkId,
          provider,
          marketAddress,
          isModal: isInModalContext,
        });
      };
    }

    if (!isBorrowType && historyAction) {
      return () => {
        BorrowNavigation.pushToStakingHistory(appNavigation, {
          accountId: earnAccount.accountId,
          networkId,
          symbol,
          provider,
          stakeTag: protocolInfo?.stakeTag,
          protocolVault: vault,
          isModal: isInModalContext,
        });
      };
    }

    return undefined;
  }, [
    historyAction,
    earnAccount?.accountId,
    isBorrowType,
    marketAddress,
    appNavigation,
    networkId,
    provider,
    isInModalContext,
    symbol,
    protocolInfo?.stakeTag,
    vault,
  ]);

  // Ref to store refreshPending function from useStakingPendingTxs hook
  const refreshPendingRef = useRef<(() => Promise<void>) | null>(null);

  const handleOperationSuccess = useCallback(() => {
    void refreshManageData();
    // Immediately refresh pending transactions after operation
    void refreshPendingRef.current?.();
    onStakeWithdrawSuccess?.();
    if (isInModalContext) {
      appNavigation.popStack();
    }
  }, [
    refreshManageData,
    onStakeWithdrawSuccess,
    isInModalContext,
    appNavigation,
  ]);

  // Create beforeFooter content for stake section
  const stakeBeforeFooter = useMemo(() => {
    // If should show warning (no address or BTC-only firmware), return the warning element
    if (shouldShowWarning) {
      return <YStack>{warningElement}</YStack>;
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
  }, [shouldShowWarning, warningElement, alertsStake, alerts]);

  // Create beforeFooter content for withdraw section
  const withdrawBeforeFooter = useMemo(() => {
    // If should show warning (no address or BTC-only firmware), return the warning element
    if (shouldShowWarning) {
      return <YStack>{warningElement}</YStack>;
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
  }, [shouldShowWarning, warningElement, alertsWithdraw, alerts]);

  // Create beforeFooter content for special layout (USDe, ADA)
  const specialBeforeFooter = useMemo(() => {
    if (warningElement) {
      return warningElement;
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
  }, [alertsHolding, alerts, warningElement]);

  if (isLoading && !managePageData) {
    return <SectionSkeleton />;
  }

  // Pendle special rendering: use ManagePageV2 for future shared layouts.
  if (earnUtils.isPendleProvider({ providerName: provider })) {
    if (warningElement) {
      return <YStack px="$5">{warningElement}</YStack>;
    }

    return (
      <ManagePageV2Content
        networkId={networkId}
        symbol={symbol}
        provider={provider}
        vault={vault}
        type={type}
        marketAddress={marketAddress}
        reserveAddress={reserveAddress}
        tokenInfo={resolvedTokenInfo}
        fallbackTokenImageUri={resolvedTokenImageUri}
        protocolInfo={resolvedProtocolInfo}
        earnAccount={earnAccount ?? undefined}
        depositDisabled={depositDisabled}
        withdrawDisabled={withdrawDisabled}
        stakeBeforeFooter={stakeBeforeFooter}
        withdrawBeforeFooter={withdrawBeforeFooter}
        historyAction={historyAction}
        onHistory={onHistory}
        indicatorAccountId={earnAccount?.accountId}
        stakeTag={resolvedProtocolInfo?.stakeTag}
        onIndicatorRefresh={refreshManageData}
        onRefreshPendingRef={refreshPendingRef}
        onSuccess={handleOperationSuccess}
        defaultTab={defaultTab}
        onTabChange={onTabChange}
        isInModalContext={isInModalContext}
        appNavigation={appNavigation}
        showApyDetail={showApyDetail}
        ongoingValidator={ongoingValidator}
        managePageData={managePageData}
      />
    );
  }

  // USDe special rendering
  if (symbol.toLowerCase() === 'usde') {
    // Show warning if needed (no address or BTC-only firmware)
    if (warningElement) {
      return <YStack px="$5">{warningElement}</YStack>;
    }
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
        onHistory={onHistory}
        indicatorAccountId={earnAccount?.accountId}
        stakeTag={resolvedProtocolInfo?.stakeTag}
        onIndicatorRefresh={refreshManageData}
        onRefreshPendingRef={refreshPendingRef}
        onActionSuccess={handleOperationSuccess}
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
        protocolInfo={resolvedProtocolInfo}
        tokenInfo={resolvedTokenInfo}
        indicatorAccountId={earnAccount?.accountId}
        stakeTag={resolvedProtocolInfo?.stakeTag}
        onIndicatorRefresh={refreshManageData}
        onRefreshPendingRef={refreshPendingRef}
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
      type={type}
      marketAddress={marketAddress}
      reserveAddress={reserveAddress}
      tokenInfo={resolvedTokenInfo}
      fallbackTokenImageUri={resolvedTokenImageUri}
      protocolInfo={resolvedProtocolInfo}
      earnAccount={earnAccount ?? undefined}
      depositDisabled={depositDisabled}
      withdrawDisabled={withdrawDisabled}
      stakeBeforeFooter={stakeBeforeFooter}
      withdrawBeforeFooter={withdrawBeforeFooter}
      historyAction={historyAction}
      onHistory={onHistory}
      indicatorAccountId={earnAccount?.accountId}
      stakeTag={resolvedProtocolInfo?.stakeTag}
      onIndicatorRefresh={refreshManageData}
      onRefreshPendingRef={refreshPendingRef}
      onSuccess={handleOperationSuccess}
      defaultTab={defaultTab}
      onTabChange={onTabChange}
      isInModalContext={isInModalContext}
      appNavigation={appNavigation}
      showApyDetail={showApyDetail}
      ongoingValidator={ongoingValidator}
      managePageData={managePageData}
    />
  );
}
