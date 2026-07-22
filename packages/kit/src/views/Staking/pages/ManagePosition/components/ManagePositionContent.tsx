import { useCallback, useMemo, useRef } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { Token } from '@onekeyhq/kit/src/components/Token';
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

// Loading shell for the manage panel. Instead of masking the whole panel with
// gray blocks, render the fixed chrome — the tab bar (real labels), the amount
// input frame, and the token — immediately, and reserve skeletons only for the
// values that depend on the (slow) getManagePage response. This keeps the
// layout stable (no jump when data lands) and makes the wait feel smoother.
const ManageSectionShell = ({
  type,
  symbol,
  defaultTab,
  fallbackTokenImageUri,
  hasProtocolSwitch,
  isInModalContext,
}: {
  type: EManagePositionType;
  symbol: string;
  defaultTab?: 'deposit' | 'withdraw';
  fallbackTokenImageUri?: string;
  // Trending entry (with a protocol switcher) renders a different card stack
  // than the details entry, so the skeleton mirrors whichever will land.
  hasProtocolSwitch?: boolean;
  // In the modal the action button lives in Page.Footer (bottom-right), so the
  // shell must not render an inline full-width button there.
  isInModalContext?: boolean;
}) => {
  const intl = useIntl();
  const { primaryLabel, secondaryLabel } = useMemo(() => {
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return {
        primaryLabel: intl.formatMessage({ id: ETranslations.global_borrow }),
        secondaryLabel: intl.formatMessage({ id: ETranslations.defi_repay }),
      };
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return {
        primaryLabel: intl.formatMessage({ id: ETranslations.defi_supply }),
        secondaryLabel: intl.formatMessage({
          id: ETranslations.global_withdraw,
        }),
      };
    }
    return {
      primaryLabel: intl.formatMessage({ id: ETranslations.earn_deposit }),
      secondaryLabel: intl.formatMessage({ id: ETranslations.global_withdraw }),
    };
  }, [intl, type]);

  const activeIndex = defaultTab === 'withdraw' ? 1 : 0;
  const tabLabels = [primaryLabel, secondaryLabel];
  const activeLabel = activeIndex === 1 ? secondaryLabel : primaryLabel;

  // The loaded layout has gap $1.5 between the tab bar and the content: in the
  // details panel that comes from ManagePositionPart's <YStack gap="$1.5">
  // wrapping the (fragment) NormalManageContent; in the modal there is no such
  // wrapper. Reproduce that gap deterministically here (a single wrapping YStack
  // means the parent gap can't apply to us), so the tab→input spacing matches
  // the loaded state exactly and doesn't jump on load.
  return (
    <YStack gap={isInModalContext ? undefined : '$1.5'}>
      {/* Real tab bar — fixed, renders immediately */}
      <XStack px="$5">
        {tabLabels.map((label, index) => {
          const isFocused = index === activeIndex;
          return (
            <XStack
              key={label}
              px="$2"
              py="$1.5"
              mr="$1"
              bg={isFocused ? '$bgActive' : '$bg'}
              borderRadius="$2"
              borderCurve="continuous"
            >
              <SizableText
                size="$headingMd"
                color={isFocused ? '$text' : '$textSubdued'}
                letterSpacing={-0.15}
              >
                {label}
              </SizableText>
            </XStack>
          );
        })}
      </XStack>

      {/* Form body — mirrors StakingFormWrapper (px $5 / py $2.5 / gap $4) so
          the layout is identical when real data lands. */}
      <YStack px="$5" py="$2.5" gap="$4">
        {/* Amount input frame — fixed chrome, only the value pends. Dimensions
            mirror StakingAmountInput/AmountInput so nothing shifts on load. */}
        <YStack borderRadius="$3" bg="$bgSubdued" px="$3.5" py="$2.5" gap="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            {activeLabel}
          </SizableText>
          <XStack h="$11" ai="center" jc="space-between">
            <Skeleton h="$6" w="$24" borderRadius="$2" />
            <XStack ai="center" gap="$1.5">
              <Token size="sm" tokenImageUri={fallbackTokenImageUri} />
              <SizableText size="$headingXl">{symbol}</SizableText>
            </XStack>
          </XStack>
          <XStack jc="space-between" ai="center">
            <Skeleton h="$3" w="$16" borderRadius="$2" />
            <Skeleton h="$3" w="$20" borderRadius="$2" />
          </XStack>
        </YStack>

        {hasProtocolSwitch ? (
          <>
            {/* Protocol switcher card — filled, mirrors ProtocolSwitchTriggerRow */}
            <XStack
              ai="center"
              jc="space-between"
              gap="$3"
              px="$3"
              py="$2"
              bg="$bgSubdued"
              borderRadius="$2"
            >
              <XStack flex={1} minWidth={0} gap="$3" ai="center">
                <Skeleton w="$9" h="$9" borderRadius="$full" />
                {/* Mirrors ProtocolSwitchTriggerRow text column: bodyLgMedium
                    title + bodyMd subtitle with gap $0.5 (46px total). */}
                <YStack flex={1} minWidth={0} gap="$0.5">
                  <Skeleton.BodyLg w={80} />
                  <Skeleton.BodyMd w={140} />
                </YStack>
              </XStack>
              <XStack ai="center" gap="$1" flexShrink={0}>
                <Skeleton h="$5" w={72} borderRadius="$2" />
                <Skeleton w="$5" h="$5" borderRadius="$1" />
              </XStack>
            </XStack>

            {/* Trade / buy card — static content, not loading. Render the real
                (disabled) labels so it matches the loaded state exactly. The
                loaded card holds only this row, so its padding is symmetric. */}
            <YStack
              p="$3.5"
              borderRadius="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
            >
              <XStack jc="space-between" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage(
                    { id: ETranslations.earn_not_enough_token },
                    { token: symbol },
                  )}
                </SizableText>
                <XStack gap="$2">
                  <Button
                    testID="earn-manage-shell-trade"
                    size="small"
                    disabled
                  >
                    {intl.formatMessage({ id: ETranslations.global_trade })}
                  </Button>
                  <Button testID="earn-manage-shell-buy" size="small" disabled>
                    {intl.formatMessage({ id: ETranslations.global_buy })}
                  </Button>
                </XStack>
              </XStack>
            </YStack>
          </>
        ) : (
          /* Summary card — single bordered box (details entry): est. rewards +
             provider + trade/buy. Interior spacing mirrors the real card
             (Divider my $5, inner gap $5) so nothing shifts on load. */
          <YStack
            p="$3.5"
            pt="$5"
            borderRadius="$3"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
          >
            <YStack gap="$1.5">
              <Skeleton.BodyMd w={100} />
              <Skeleton.BodyLg w={140} />
            </YStack>
            <Divider my="$5" />
            <YStack gap="$5">
              {/* Provider accordion-trigger placeholder. minHeight matches the
                  measured rendered height of the real Accordion.Trigger row
                  (22px — the web button element renders slightly taller than
                  its 20px content), so nothing shifts when it loads. */}
              <XStack jc="space-between" ai="center" minHeight={22}>
                <XStack ai="center" gap="$1.5">
                  <Skeleton w="$5" h="$5" borderRadius="$2" />
                  <Skeleton.BodyMd w={60} />
                </XStack>
                <Skeleton w="$5" h="$5" borderRadius="$1" />
              </XStack>
              <XStack jc="space-between" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage(
                    { id: ETranslations.earn_not_enough_token },
                    { token: symbol },
                  )}
                </SizableText>
                <XStack gap="$2">
                  <Button
                    testID="earn-manage-shell-trade"
                    size="small"
                    disabled
                  >
                    {intl.formatMessage({ id: ETranslations.global_trade })}
                  </Button>
                  <Button testID="earn-manage-shell-buy" size="small" disabled>
                    {intl.formatMessage({ id: ETranslations.global_buy })}
                  </Button>
                </XStack>
              </XStack>
            </YStack>
          </YStack>
        )}

        {/* Inline action button only for the non-modal (details) layout. In the
            modal the real button sits in Page.Footer, so we render nothing here
            to avoid a stray full-width button that vanishes on load. */}
        {isInModalContext ? null : (
          <Button
            testID="earn-manage-shell-confirm"
            size="medium"
            variant="primary"
            disabled
            width="100%"
          >
            {activeLabel}
          </Button>
        )}
      </YStack>
    </YStack>
  );
};

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
    isStaleData,
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

  const networkSupportCheckTarget = useMemo(
    () => ({
      accountId: accountId || earnAccount?.accountId || '',
      walletId: earnAccount?.walletId || '',
      accountImpl: earnAccount?.account?.impl,
    }),
    [
      accountId,
      earnAccount?.account?.impl,
      earnAccount?.accountId,
      earnAccount?.walletId,
    ],
  );

  // Check if Bitcoin Only firmware is trying to access non-BTC network
  const { result: accountNetworkNotSupported } = usePromiseResult(
    async () => {
      if (
        !networkSupportCheckTarget.accountId &&
        !networkSupportCheckTarget.walletId
      ) {
        return undefined;
      }
      return backgroundApiProxy.serviceAccount.checkAccountNetworkNotSupported({
        accountId: networkSupportCheckTarget.accountId || undefined,
        walletId: networkSupportCheckTarget.walletId || undefined,
        accountImpl: networkSupportCheckTarget.accountImpl,
        activeNetworkId: networkId,
      });
    },
    [
      networkId,
      networkSupportCheckTarget.accountId,
      networkSupportCheckTarget.accountImpl,
      networkSupportCheckTarget.walletId,
    ],
    { initResult: undefined, undefinedResultIfError: true },
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

  // Label shown on the confirm button while switching protocols.
  const switchLoadingActionLabel = useMemo(() => {
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return intl.formatMessage({
        id:
          defaultTab === 'withdraw'
            ? ETranslations.defi_repay
            : ETranslations.global_borrow,
      });
    }
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return intl.formatMessage({
        id:
          defaultTab === 'withdraw'
            ? ETranslations.global_withdraw
            : ETranslations.defi_supply,
      });
    }
    return intl.formatMessage({
      id:
        defaultTab === 'withdraw'
          ? ETranslations.global_withdraw
          : ETranslations.earn_deposit,
    });
  }, [intl, type, defaultTab]);

  // When switching protocols, useManagePage re-fetches while keeping the
  // previous (stale) data on screen. Surface that whole refetch as one loading
  // on the confirm button — instead of letting it surface late/scattered on a
  // downstream request — and disable the button so stale data can't be acted on.
  // isStaleData flips synchronously on the very render the params change (before
  // any effect runs), so downstream fetch gates see it in time; isLoading covers
  // any same-key refresh tail.
  const isSwitchingProtocol = Boolean(
    stakeProtocolSwitchConfig && (isStaleData || isLoading) && managePageData,
  );
  const switchingFooterAction = useMemo<
    IManagePositionFooterAction | undefined
  >(
    () =>
      isSwitchingProtocol
        ? {
            text: switchLoadingActionLabel,
            onPress: () => {},
            loading: true,
            disabled: true,
          }
        : undefined,
    [isSwitchingProtocol, switchLoadingActionLabel],
  );

  // No-wallet CTA takes priority; otherwise the switch-loading state (if any).
  const footerAction = noConnectedWalletFooterAction ?? switchingFooterAction;

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
    return (
      <ManageSectionShell
        type={type}
        symbol={symbol}
        defaultTab={defaultTab}
        fallbackTokenImageUri={fallbackTokenImageUri}
        hasProtocolSwitch={Boolean(stakeProtocolSwitchConfig)}
        isInModalContext={isInModalContext}
      />
    );
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
        footerActionOverride={footerAction}
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
        footerActionOverride={footerAction}
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
        footerActionOverride={footerAction}
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
      footerActionOverride={footerAction}
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
