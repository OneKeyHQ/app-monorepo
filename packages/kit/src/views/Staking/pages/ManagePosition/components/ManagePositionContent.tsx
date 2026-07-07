import { useCallback, useMemo, useRef } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { NetworkUnsupportedWarning } from '../../../components/ProtocolDetails/NetworkUnsupportedWarning';
import { NoAddressWarning } from '../../../components/ProtocolDetails/NoAddressWarning';
import { EManagePositionType, useManagePage } from '../hooks/useManagePage';

import { AdaManageContent } from './AdaManageContent';
import { ManagePageV2Content } from './ManagePageV2Content';
import { NormalManageContent } from './NormalManageContent';
import { USDEManageContent } from './USDEManageContent';

export type IManagePositionSelectedProtocol = {
  networkId: string;
  provider: string;
  vault?: string;
};

export type IManagePositionProtocolSwitchConfig = {
  currentProtocol?: IStakeProtocolListItem;
  isLoading?: boolean;
  protocols: IStakeProtocolListItem[];
  selectedProtocol: IManagePositionSelectedProtocol;
  indexedAccountId?: string;
  onProtocolSelect: (protocol: IStakeProtocolListItem) => void | Promise<void>;
};

export type IManagePositionFooterAction = {
  text: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

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
  providerDisplayName?: string;
  providerLogoUri?: string;
  stakeProtocolSwitchConfig?: IManagePositionProtocolSwitchConfig;
  suppressPlatformBonus?: boolean;

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
  providerDisplayName,
  providerLogoUri,
  stakeProtocolSwitchConfig,
  suppressPlatformBonus,
  onCreateAddress,
  onStakeWithdrawSuccess,
  isInModalContext = false,
}: IManagePositionContentProps) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });

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
    revalidateOnFocus: !isInModalContext,
  });

  const resolvedProtocolInfo = useMemo(() => {
    if (!protocolInfo) {
      return undefined;
    }
    if (!providerDisplayName && !providerLogoUri) {
      return protocolInfo;
    }
    const providerDetailName =
      providerDisplayName || protocolInfo.providerDetail?.name;
    const providerDetailLogoURI =
      protocolInfo.providerDetail?.logoURI || providerLogoUri || '';
    if (
      providerDetailName === protocolInfo.providerDetail?.name &&
      providerDetailLogoURI === protocolInfo.providerDetail?.logoURI
    ) {
      return protocolInfo;
    }
    return {
      ...protocolInfo,
      providerDetail: {
        ...protocolInfo.providerDetail,
        name: providerDetailName,
        logoURI: providerDetailLogoURI,
      },
    };
  }, [protocolInfo, providerDisplayName, providerLogoUri]);

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

  const noConnectedWallet = useMemo(
    () => !accountId && !indexedAccountId,
    [accountId, indexedAccountId],
  );

  const noConnectedWalletFooterAction = useMemo<
    IManagePositionFooterAction | undefined
  >(() => {
    if (!noConnectedWallet) {
      return undefined;
    }
    return {
      text: intl.formatMessage({ id: ETranslations.global_connect_wallet }),
      onPress: showAccountSelector,
    };
  }, [intl, noConnectedWallet, showAccountSelector]);

  // In the normal form footer, no-wallet state is represented by the primary
  // connect-wallet CTA. Keep warnings for connected wallets that need address
  // creation, and for BTC-only firmware on unsupported networks.
  const shouldShowWarning = useMemo(
    () =>
      (!noConnectedWallet && noAddressOrAccount) ||
      !!accountNetworkNotSupported,
    [noConnectedWallet, noAddressOrAccount, accountNetworkNotSupported],
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
    if (shouldShowWarning && warningElement) {
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
  }, [alertsHolding, alerts, shouldShowWarning, warningElement]);

  if (isLoading && !managePageData) {
    return <SectionSkeleton />;
  }

  // Pendle special rendering: use ManagePageV2 for future shared layouts.
  if (earnUtils.isPendleProvider({ providerName: provider })) {
    if (shouldShowWarning && warningElement) {
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
        footerActionOverride={noConnectedWalletFooterAction}
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

  // USDe special rendering is for Earn/Staking manage pages. Borrow manage
  // pages use the regular borrow action contract and do not return holdings.
  if (!isBorrowType && symbol.toLowerCase() === 'usde') {
    // Show warnings that still require explicit remediation, such as BTC-only
    // firmware on unsupported networks or connected wallets missing an address.
    if (shouldShowWarning && warningElement) {
      return <YStack px="$5">{warningElement}</YStack>;
    }
    if (!managePageData?.holdings && !noConnectedWalletFooterAction) {
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
        footerActionOverride={noConnectedWalletFooterAction}
        fallbackTokenImageUri={fallbackTokenImageUri}
      />
    );
  }

  // ADA special rendering (Stakefish provider)
  if (!isBorrowType && symbol.toLowerCase() === 'ada') {
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
        footerActionOverride={noConnectedWalletFooterAction}
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
      footerActionOverride={noConnectedWalletFooterAction}
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
      stakeProtocolSwitchConfig={stakeProtocolSwitchConfig}
      suppressPlatformBonus={suppressPlatformBonus}
      ongoingValidator={ongoingValidator}
      managePageData={managePageData}
    />
  );
}
