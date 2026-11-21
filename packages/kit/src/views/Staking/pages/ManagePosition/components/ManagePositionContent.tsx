import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { BorrowInfoSectionSkeleton } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/BorrowInfoSectionSkeleton';
import { useEarnDesktopHomeCopy } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type {
  IEarnUtmParams,
  IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';

import {
  EarnFormFooter,
  useIsEarnActionInline,
} from '../../../components/EarnFormFooter';
import { EarnAlert } from '../../../components/ProtocolDetails/EarnAlert';
import { NetworkUnsupportedWarning } from '../../../components/ProtocolDetails/NetworkUnsupportedWarning';
import { NoAddressWarning } from '../../../components/ProtocolDetails/NoAddressWarning';
import { StakingAmountResultLine } from '../../../components/StakingAmountResultLine';
import {
  EarnFormRow,
  EarnFormSummary,
} from '../../../components/UniversalStake/EarnFormSummary';
import { EManagePositionType, useManagePage } from '../hooks/useManagePage';
import { shouldBlockManagePageAction } from '../hooks/useManagePage.utils';

import { AdaManageContent } from './AdaManageContent';
import { ManagePageV2Content } from './ManagePageV2Content';
import { NormalManageContent } from './NormalManageContent';
import { USDEManageContent } from './USDEManageContent';

import type { IHeaderRightViewProps } from './HeaderRight';
import type { IWithdrawSuccessInfo } from './WithdrawSection';
import type { IEarnConfirmWordId } from '../../../components/UniversalStake/earnConfirmWord';

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

export type IManagePositionPayWith = {
  preferDepositToken?: boolean;
  selectedKey?: string;
  preferSymbol?: string;
  onSelectedKeyChange?: (key: string) => void;
  pickerHeight?: number;
  onTokenChange?: (token?: {
    symbol: string;
    networkId?: string;
    isPicked: boolean;
  }) => void;
  acrossNetworks?: boolean;
};

export type IManagePositionFooterAction = {
  text: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  isPressOnly?: boolean;
  isSwitchWait?: boolean;
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
  depositOnly?: boolean;
  withdrawOnly?: boolean;
  isEarnLending?: boolean;
  payWith?: IManagePositionPayWith;
  initialAmount?: string;
  offerSwitch?: ReactNode;
  onAmountChange?: (amount: string) => void;
  onHeaderRightChange?: (view: IHeaderRightViewProps | null) => void;
  hidesTabLine?: boolean;
  onWithdrawn?: (info: { amount: string; tokenImageUri?: string }) => void;
  onDeposited?: (amount?: string, info?: IWithdrawSuccessInfo) => void;
  footerActionOverride?: IManagePositionFooterAction;

  // Optional callbacks
  onCreateAddress?: () => Promise<void>;
  onStakeWithdrawSuccess?: () => void;
  // Campaign attribution for the stake / withdraw request (Unitas reports by
  // campaign); undefined unless the page was opened from a campaign link.
  utm?: IEarnUtmParams;
}

// Loading shell for the manage panel. Instead of masking the whole panel with
// gray blocks, render the fixed chrome — the type switcher when applicable and
// the amount input frame — immediately, and reserve skeletons
// only for the values that depend on the (slow) getManagePage response. This
// keeps the layout stable (no jump when data lands) and makes the wait feel
// smoother.
export const ManageSectionShell = ({
  type,
  symbol,
  defaultTab,
  fallbackTokenImageUri,
  isPendleProvider,
  hasProtocolSwitch,
  isInModalContext,
  depositOnly,
  withdrawOnly,
  hasPayWith,
  offerSwitch,
  liftsHeaderControls,
  hidesTabLine,
  rewardTokens,
  confirmWordId,
}: {
  type: EManagePositionType;
  symbol: string;
  // The tokens the offer's rewards come in, as last read: the result holds a
  // line for each, as the form will
  rewardTokens?: string[];
  // The deposit button's word as the offer's form last showed it
  confirmWordId?: IEarnConfirmWordId;
  defaultTab?: 'deposit' | 'withdraw';
  // As the loaded form: Pay with leaves out the "Not enough X?" row
  hasPayWith?: boolean;
  offerSwitch?: ReactNode;
  // A one-side modal has its controls in its header and no tab line
  liftsHeaderControls?: boolean;
  // The caller draws the tab line, as the loaded form leaves it to it
  hidesTabLine?: boolean;
  depositOnly?: boolean;
  withdrawOnly?: boolean;
  fallbackTokenImageUri?: string;
  isPendleProvider: boolean;
  // Trending entry (with a protocol switcher) renders a different card stack
  // than the details entry, so the skeleton mirrors whichever will land.
  hasProtocolSwitch?: boolean;
  // In the modal the action button lives in the footer (the form's full
  // width), so the shell must not render one under the form there.
  isInModalContext?: boolean;
}) => {
  const intl = useIntl();
  const copy = useEarnDesktopHomeCopy();
  const isActionInline = useIsEarnActionInline(Boolean(isInModalContext));
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

  const activeIndex = defaultTab === 'withdraw' || withdrawOnly ? 1 : 0;
  let tabLabels = [primaryLabel, secondaryLabel];
  if (depositOnly) {
    tabLabels = [primaryLabel];
  } else if (withdrawOnly) {
    tabLabels = [secondaryLabel];
  }
  let activeLabel = activeIndex === 1 ? secondaryLabel : primaryLabel;
  if (isPendleProvider) {
    activeLabel = intl.formatMessage({ id: ETranslations.content__amount });
  }
  // The Earn deposit form (with Pay with) as it lands before an amount: its
  // box's title, then the result and its rows, each with a dash
  const isEarnDepositForm =
    hasPayWith && activeIndex === 0 && !isPendleProvider;
  // Pendle's buy with Pay with, as it lands: the line under the box, what
  // you get at maturity, its rows and "Details", and its button
  const isPendleDepositForm =
    hasPayWith && activeIndex === 0 && isPendleProvider;
  const boxTitle =
    isEarnDepositForm || isPendleDepositForm ? copy.payWith : activeLabel;
  // A deposit says "Deposit" or "Continue" by whether it approves first,
  // which only its form knows: the word it showed last time, or none (the
  // word drawn transparent) until the form has it
  const isStakeDeposit =
    type === EManagePositionType.Staking &&
    activeIndex === 0 &&
    !isPendleProvider;
  const holdsConfirmWord = isStakeDeposit && !confirmWordId;
  let confirmLabel = activeLabel;
  if (isPendleDepositForm) {
    confirmLabel = intl.formatMessage({ id: ETranslations.global_buy });
  } else if (isStakeDeposit && confirmWordId) {
    confirmLabel = intl.formatMessage({ id: confirmWordId });
  }
  const borrowAction = useMemo(() => {
    if (
      [EManagePositionType.Supply, EManagePositionType.Withdraw].includes(type)
    ) {
      return activeIndex === 1 ? 'withdraw' : 'supply';
    }
    if (
      [EManagePositionType.Borrow, EManagePositionType.Repay].includes(type)
    ) {
      return activeIndex === 1 ? 'repay' : 'borrow';
    }
    return undefined;
  }, [activeIndex, type]);

  // The loaded layout has gap $1.5 between the type switcher and the content:
  // in the details panel that comes from
  // ManagePositionPart's <YStack gap="$1.5"> wrapping the (fragment)
  // NormalManageContent; in the modal there is no such wrapper. Reproduce that
  // gap deterministically here (a single wrapping YStack means the parent gap
  // can't apply to us), so the tab→input spacing matches the loaded state
  // exactly and doesn't jump on load.
  const reserveKeyboardAccessorySpace = type === EManagePositionType.Staking;

  const showsTabLine =
    !hidesTabLine &&
    !(isInModalContext && liftsHeaderControls && tabLabels.length === 1);
  // The loaded deposit form shows "Not enough X?" only without Pay with, and
  // the withdraw form never; its Details row waits for an amount
  const showsTradeOrBuy = !hasPayWith && activeIndex === 0;
  const shellAction = (
    <EarnFormFooter
      isInModalContext={Boolean(isInModalContext)}
      confirmText={confirmLabel}
      confirmButtonProps={{
        testID: 'earn-manage-shell-confirm',
        disabled: true,
        color: holdsConfirmWord ? '$transparent' : undefined,
      }}
      keyboardStage={
        platformEnv.isNativeIOSPhone ? null : (
          <PercentageStageOnKeyboard
            reserveSpaceUntilKeyboardShown={reserveKeyboardAccessorySpace}
          />
        )
      }
    />
  );

  return (
    <YStack gap={isInModalContext ? undefined : '$1.5'}>
      {showsTabLine ? (
        <XStack px="$5">
          {tabLabels.map((label, index) => {
            // A lone tab is the one in use
            const isFocused = tabLabels.length === 1 || index === activeIndex;
            let tabBackground: '$bg' | '$bgActive' | 'transparent' = '$bg';
            if (isPendleProvider) {
              tabBackground = 'transparent';
            } else if (isFocused) {
              tabBackground = '$bgActive';
            }
            return (
              <XStack
                key={label}
                px="$2"
                py="$1.5"
                mr="$1"
                bg={tabBackground}
                borderRadius="$2"
                borderCurve="continuous"
              >
                {isPendleProvider ? (
                  <Skeleton.HeadingMd
                    w={index === 0 ? '$8' : '$12'}
                    borderRadius="$2"
                  />
                ) : (
                  <SizableText
                    size="$headingMd"
                    color={isFocused ? '$text' : '$textSubdued'}
                    letterSpacing={-0.15}
                  >
                    {label}
                  </SizableText>
                )}
              </XStack>
            );
          })}
        </XStack>
      ) : null}

      {/* Form body — mirrors StakingFormWrapper (px $5 / py $2.5 / gap $4) so
          the layout is identical when real data lands. */}
      <YStack px="$5" py="$2.5" gap="$4">
        {/* Amount input frame — fixed chrome, only the value pends. Dimensions
            mirror StakingAmountInput/AmountInput so nothing shifts on load. */}
        <YStack>
          <YStack
            borderRadius="$3"
            bg="$bgSubdued"
            px="$3.5"
            py="$2.5"
            gap="$2"
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {boxTitle}
            </SizableText>
            <XStack h="$11" ai="center" jc="space-between">
              <Skeleton h="$6" w="$24" borderRadius="$2" />
              <XStack ai="center" m="$1.5" mb="$0" p="$2" gap="$2">
                {/* Pendle resolves the actual pair after this shell renders, so
                  its route image is not authoritative during loading. Keep the
                  icon as a skeleton until token metadata arrives; this also
                  matches AmountInput's $7 token trigger size (OK-63661). */}
                {fallbackTokenImageUri && !isPendleProvider ? (
                  <Token
                    size="sm"
                    w="$7"
                    h="$7"
                    tokenImageUri={fallbackTokenImageUri}
                  />
                ) : (
                  <Skeleton w="$7" h="$7" radius="round" />
                )}
                {/* The symbol is the one real string this frame used to draw, and
                  a vault symbol can be as long as "Morpho-cbBTC-USDC-wrapper" —
                  a full-width name sitting among skeleton bars reads worse than
                  no name at all, and the page title already carries it. Skeleton
                  it like everything else and let the real symbol land with the
                  rest of the data. */}
                <Skeleton h="$6" w="$20" borderRadius="$2" />
              </XStack>
            </XStack>
            <XStack jc="space-between" ai="center">
              <Skeleton h="$3" w="$16" borderRadius="$2" />
              <Skeleton h="$3" w="$20" borderRadius="$2" />
            </XStack>
          </YStack>
          {isPendleDepositForm ? (
            <YStack pt="$2">
              <StakingAmountResultLine
                label={intl.formatMessage({
                  id: ETranslations.swap_review_you_receive,
                })}
                value="–"
                isPlaceholder
              />
            </YStack>
          ) : null}
        </YStack>

        {/* The caller's own selector stands where the protocol switcher
            card goes */}
        {offerSwitch}
        {!offerSwitch && hasProtocolSwitch ? (
          // Protocol switcher card — filled, mirrors ProtocolSwitchTriggerRow
          <XStack
            ai="center"
            jc="space-between"
            gap="$3"
            px="$3"
            py="$2"
            bg="$bgSubdued"
            borderRadius="$3"
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
        ) : null}

        {(hasProtocolSwitch || !borrowAction) && showsTradeOrBuy ? (
          // Only what the loaded card shows with an empty amount: the
          // trade-or-buy row. The Details row and quote-only content wait for
          // an amount, so they must not take a height that disappears on load
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
                <Button testID="earn-manage-shell-trade" size="small" disabled>
                  {intl.formatMessage({ id: ETranslations.global_trade })}
                </Button>
                <Button testID="earn-manage-shell-buy" size="small" disabled>
                  {intl.formatMessage({ id: ETranslations.global_buy })}
                </Button>
              </XStack>
            </XStack>
          </YStack>
        ) : null}

        {isEarnDepositForm ? (
          <EarnFormSummary
            outcome={{
              label: copy.estAnnualRewards,
              values: [],
              isEarning: true,
              tokens: rewardTokens,
            }}
            rows={
              borrowAction
                ? [
                    <EarnFormRow
                      key="my-supply"
                      label={intl.formatMessage({
                        id: ETranslations.defi_my_supply,
                      })}
                    />,
                    <EarnFormRow
                      key="collateral"
                      label={intl.formatMessage({
                        id: ETranslations.defi_use_as_collateral,
                      })}
                    />,
                  ]
                : [
                    <EarnFormRow
                      key="receive"
                      label={intl.formatMessage({
                        id: ETranslations.earn_est_receive,
                      })}
                    />,
                  ]
            }
          />
        ) : null}
        {isPendleDepositForm ? (
          <EarnFormSummary
            outcome={{
              label: copy.atMaturityYouGet,
              values: [],
              isEarning: true,
              hasNoteLine: true,
            }}
            rows={copy.pendleRowTitles.map((title) => (
              <EarnFormRow key={title} label={title} />
            ))}
            detailsPlaceholder
          />
        ) : null}
        {!hasProtocolSwitch && borrowAction && !isEarnDepositForm ? (
          <BorrowInfoSectionSkeleton action={borrowAction} />
        ) : null}

        {/* The loading form's button where the loaded form's will be: under
            the form on a page and in a wide window, else the modal's footer */}
        {isActionInline ? shellAction : null}
      </YStack>
      {isActionInline ? null : shellAction}
    </YStack>
  );
};

// USDe and ADA eventually render SpecialManageContent rather than the tabbed
// manage form. Keep their loading shell on that same holdings layout so the
// first data response does not replace an unrelated tab bar and form.
const SpecialManageSectionShell = ({
  fallbackTokenImageUri,
  isInModalContext,
}: {
  fallbackTokenImageUri?: string;
  isInModalContext?: boolean;
}) => {
  const intl = useIntl();

  return (
    <>
      <YStack px="$5" gap="$5">
        <XStack
          jc="space-between"
          ai="center"
          mt={isInModalContext ? '$1' : undefined}
        >
          <SizableText size="$headingMd" color="$text">
            {intl.formatMessage({ id: ETranslations.earn_holdings })}
          </SizableText>
          <Skeleton w="$5" h="$5" borderRadius="$1" />
        </XStack>

        <XStack jc="space-between" ai="center">
          <YStack flex={1} gap="$1">
            <Skeleton h="$9" w="$32" borderRadius="$2" />
            <Skeleton h="$5" w="$24" borderRadius="$2" />
          </YStack>
          {fallbackTokenImageUri ? (
            <Token
              size="lg"
              tokenImageUri={fallbackTokenImageUri}
              w="$10"
              h="$10"
            />
          ) : (
            <Skeleton w="$10" h="$10" radius="round" />
          )}
        </XStack>

        {!isInModalContext ? (
          <XStack gap="$2.5">
            <YStack flex={1}>
              <Skeleton h="$12" w="100%" borderRadius="$3" />
            </YStack>
            <YStack flex={1}>
              <Skeleton h="$12" w="100%" borderRadius="$3" />
            </YStack>
          </XStack>
        ) : null}
      </YStack>

      {isInModalContext ? (
        <Page.Footer>
          <XStack p="$5" gap="$2.5" bg="$bgApp">
            <YStack flex={1}>
              <Skeleton h="$12" w="100%" borderRadius="$3" />
            </YStack>
            <YStack flex={1}>
              <Skeleton h="$12" w="100%" borderRadius="$3" />
            </YStack>
          </XStack>
        </Page.Footer>
      ) : null}
    </>
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
  depositOnly,
  withdrawOnly,
  isEarnLending,
  payWith,
  initialAmount,
  offerSwitch,
  onAmountChange,
  onHeaderRightChange,
  hidesTabLine,
  onCreateAddress,
  onStakeWithdrawSuccess,
  onWithdrawn,
  onDeposited,
  footerActionOverride,
  utm,
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
    withdrawApprovalUnavailable,
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

  // Stale request identity must always block actions, including account
  // switches on pages without a protocol switcher. The loading tail remains
  // specific to protocol switching so ordinary same-scope refreshes stay usable.
  const isSwitchingProtocol = shouldBlockManagePageAction({
    hasManagePageData: !!managePageData,
    isStaleData,
    isLoading,
    hasProtocolSwitch: !!stakeProtocolSwitchConfig,
  });
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
  const footerAction =
    noConnectedWalletFooterAction ??
    switchingFooterAction ??
    footerActionOverride;

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
  const normalizedSymbol = symbol.toLowerCase();
  const isSpecialManage =
    !isBorrowType && ['usde', 'ada'].includes(normalizedSymbol);
  const isUSDEManage = !isBorrowType && normalizedSymbol === 'usde';
  const isADAManage = !isBorrowType && normalizedSymbol === 'ada';

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

  const handleOperationSuccess = useCallback(
    (info?: IWithdrawSuccessInfo) => {
      void refreshManageData();
      // Immediately refresh pending transactions after operation
      void refreshPendingRef.current?.();
      onStakeWithdrawSuccess?.();
      if (withdrawOnly && onWithdrawn && info?.amount && !info.isQueued) {
        onWithdrawn({
          amount: info.amount,
          tokenImageUri: info.logoURI || resolvedTokenImageUri,
        });
        return;
      }
      if (depositOnly && onDeposited) {
        onDeposited(info?.amount, info);
        return;
      }
      if (isInModalContext) {
        appNavigation.popStack();
      }
    },
    [
      refreshManageData,
      onStakeWithdrawSuccess,
      withdrawOnly,
      onWithdrawn,
      depositOnly,
      onDeposited,
      resolvedTokenImageUri,
      isInModalContext,
      appNavigation,
    ],
  );

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
    if (isSpecialManage) {
      return (
        <SpecialManageSectionShell
          fallbackTokenImageUri={fallbackTokenImageUri}
          isInModalContext={isInModalContext}
        />
      );
    }

    return (
      <ManageSectionShell
        type={type}
        symbol={symbol}
        defaultTab={defaultTab}
        isPendleProvider={
          getEarnProtocol(provider).getStakePresentation().transactionLayout ===
          'market'
        }
        fallbackTokenImageUri={fallbackTokenImageUri}
        depositOnly={depositOnly}
        withdrawOnly={withdrawOnly}
        hasPayWith={Boolean(payWith)}
        offerSwitch={offerSwitch}
        liftsHeaderControls={
          Boolean(onHeaderRightChange) && Boolean(depositOnly || withdrawOnly)
        }
        hidesTabLine={hidesTabLine}
        hasProtocolSwitch={Boolean(stakeProtocolSwitchConfig)}
        isInModalContext={isInModalContext}
      />
    );
  }

  if (
    getEarnProtocol(provider).getStakePresentation().transactionLayout ===
    'market'
  ) {
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
  if (isUSDEManage) {
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
  if (isADAManage) {
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
      actionsBlocked={isSwitchingProtocol}
      withdrawApprovalUnavailable={withdrawApprovalUnavailable}
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
      depositOnly={depositOnly}
      withdrawOnly={withdrawOnly}
      isEarnLending={isEarnLending}
      payWith={payWith}
      initialAmount={initialAmount}
      offerSwitch={offerSwitch}
      onAmountChange={onAmountChange}
      onHeaderRightChange={onHeaderRightChange}
      hidesTabLine={hidesTabLine}
      utm={utm}
      ongoingValidator={ongoingValidator}
      managePageData={managePageData}
    />
  );
}
