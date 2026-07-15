import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  ButtonFrame,
  Dialog,
  Icon,
  Keyboard,
  Page,
  Popover,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { useInPageDialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useBorrowApproveAndSubmit } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproveAndSubmit';
import type { IManagePositionApproveTarget } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/types';
import { isSamePositiveAmount } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/utils';
import { useUniversalBorrowAction } from '@onekeyhq/kit/src/views/Borrow/components/UniversalBorrowAction';
import {
  useUniversalBorrowRepay,
  useUniversalBorrowWithdraw,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowWithdrawRepayHooks';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useManagePage } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDeFiProtocolLendingActionSource } from '@onekeyhq/shared/src/routes/assetDetails';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  EDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  EBorrowActionsEnum,
  EEarnLabels,
  EManagePositionType,
  type IBorrowAsset,
  type IBorrowAssetsList,
  type ICheckAmountAlert,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  type IProtocolLendingPrimaryBalanceLabel,
  resolveProtocolLendingBalanceContext,
  resolveProtocolLendingDefiFillableAmountState,
  resolveProtocolLendingRemainingDebtState,
  resolveProtocolLendingRepayAmountState,
  resolveProtocolLendingRepayDebtState,
  resolveProtocolLendingWithdrawAmountState,
} from './protocolLendingActionUtils';
import {
  type IProtocolPositionActionSuccessParams,
  ProtocolPositionActionAmountInput,
  ProtocolPositionActionAnchor,
  ProtocolPositionActionKeyboardDismissFooter,
  clampAmountDecimals,
  getActionLabel,
  getErrorMessage,
  isUserRejectedErrorMessage,
  useProtocolPositionActionSubmit,
} from './ProtocolPositionActionDialog';
import { shouldShowProtocolPositionActionInlineSubmitError } from './protocolPositionActionErrorUtils';
import { resolveProtocolPositionActionDialogLayout } from './protocolPositionActionLayoutUtils';
import { ProtocolPositionAssetPill } from './ProtocolPositionAssetPill';
import { getProtocolProviderDisplayName } from './protocolProviderDisplayUtils';

// Withdraw/Repay only — the portfolio dialog is exit-side (Supply/Borrow stay on
// the full manage page).
type IProtocolLendingActionType = 'withdraw' | 'repay';

// `defi` reuses the resolved-action build path (Compound/Morpho/...); `borrow`
// drives the Aave manage hooks (simulation, health factor, approve). `selectable`
// false = a desktop row already named the asset, so no dropdown / assets fetch.
type IProtocolLendingActionSource = IDeFiProtocolLendingActionSource;

// Normalized selector-row data, source-agnostic so the row/popover is shared.
type ILendingSelectorItem = {
  key: string;
  symbol: string;
  logoURI?: string;
  balanceText: string;
  descriptionText?: string;
};

type IRepayWalletBalanceLoadState = {
  balance?: string;
  errorMessage?: string;
};

type IBorrowAssetsListLoadState = {
  assetsList: IBorrowAssetsList;
  errorMessage?: string;
};

type IShowProtocolLendingActionDialogParams = {
  accountId: string;
  networkId: string;
  actionType: IProtocolLendingActionType;
  source: IProtocolLendingActionSource;
  hasDebts?: boolean;
  dialog?: ReturnType<typeof useInPageDialog>;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

const LENDING_PERCENT_PRESETS = [25, 50, 75, 100] as const;
const EMPTY_BORROW_ASSETS_LIST: IBorrowAssetsList = {
  assets: [] as IBorrowAsset[],
};

// Mirrors DEFI_ACTION_HERO_MIN_HEIGHT in ProtocolPositionActionDialog so the
// loading skeleton reserves the same amount-hero height.
const BORROW_HERO_SKELETON_HEIGHT = 128;

// Focus ring for the keyboard-focusable asset selector rows (matches Button).
const LENDING_SELECTOR_FOCUS_STYLE = {
  outlineColor: '$focusRing',
  outlineStyle: 'solid',
  outlineWidth: 2,
} as const;

const LENDING_ACTION_TO_DEFI_ACTION: Record<
  IProtocolLendingActionType,
  EDeFiPositionAction
> = {
  withdraw: EDeFiPositionAction.Withdraw,
  repay: EDeFiPositionAction.Repay,
};

const LENDING_ACTION_TO_BORROW_ACTION: Record<
  IProtocolLendingActionType,
  EBorrowActionsEnum
> = {
  withdraw: EBorrowActionsEnum.Withdraw,
  repay: EBorrowActionsEnum.Repay,
};

const LENDING_BALANCE_LABEL_TRANSLATION_IDS: Record<
  IProtocolLendingPrimaryBalanceLabel,
  ETranslations
> = {
  available: ETranslations.global_available,
  availableToWithdraw: ETranslations.available_to_withdraw__title,
  remainingDebt: ETranslations.defi_borrow_repay_remaining_debt,
};

function getLendingColumnHeaderLabel({
  actionType,
  intl,
}: {
  actionType: IProtocolLendingActionType;
  intl: ReturnType<typeof useIntl>;
}) {
  return intl.formatMessage({
    id:
      actionType === 'withdraw'
        ? ETranslations.wallet_defi_asset_type_supplied
        : ETranslations.wallet_defi_asset_type_borrowed,
  });
}

// Highlight a percent preset only when the typed amount lands exactly on it
// (Max → 100%); a free-typed amount matches nothing. `maxBN` is the actionable
// max the percent is measured against (supplied balance or fillable repay).
function resolveSelectedAmountPercent({
  isMaxAmount,
  isAmountPositive,
  amountBN,
  maxBN,
}: {
  isMaxAmount: boolean;
  isAmountPositive: boolean;
  amountBN: BigNumber;
  maxBN: BigNumber;
}): number {
  if (isMaxAmount) return 100;
  if (!isAmountPositive || !maxBN.gt(0)) return 0;
  const pct = amountBN.div(maxBN).multipliedBy(100);
  return (
    LENDING_PERCENT_PRESETS.find((preset) => pct.minus(preset).abs().lt(0.5)) ??
    0
  );
}

// The fiat sub-line for a defi selector row: the balance's value at the asset's
// price, formatted to the display currency. Undefined when the price is missing
// so the row falls back to the balance alone.
function buildDefiSelectorFiatText({
  amount,
  price,
  currencySymbol,
}: {
  amount: string;
  price?: number;
  currencySymbol: string;
}): string | undefined {
  if (price === undefined || !Number.isFinite(price)) return undefined;
  const amountBN = new BigNumber(amount || '0');
  if (!amountBN.isFinite() || amountBN.lte(0)) return undefined;
  return numberFormat(amountBN.multipliedBy(price).toFixed(), {
    formatter: 'value',
    formatterOptions: { currency: currencySymbol },
  });
}

function normalizeBorrowReserveAddress({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  return earnUtils.normalizeBorrowAddress({ networkId, address });
}

function LendingAmountValue({
  amount,
  symbol,
  color = '$text',
}: {
  amount: string;
  symbol: string;
  color?: '$text' | '$textSubdued';
}) {
  return (
    <XStack alignItems="center" gap="$1" flexShrink={0} minWidth={0}>
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyMdMedium"
        color={color}
        formatter="balance"
        numberOfLines={1}
      >
        {amount}
      </NumberSizeableTextWrapper>
      <SizableText size="$bodyMdMedium" color={color} numberOfLines={1}>
        {symbol}
      </SizableText>
    </XStack>
  );
}

function RemainingDebtChangeRow({
  label,
  currentDebt,
  remainingDebt,
  symbol,
}: {
  label: string;
  currentDebt: string;
  remainingDebt: string;
  symbol: string;
}) {
  return (
    <ProtocolPositionActionAnchor
      label={label}
      valueNode={
        <XStack alignItems="center" gap="$2" flexShrink={0}>
          <LendingAmountValue
            amount={currentDebt}
            symbol={symbol}
            color="$textSubdued"
          />
          <Icon name="ArrowRightSolid" size="$4" color="$iconDisabled" />
          <LendingAmountValue amount={remainingDebt} symbol={symbol} />
        </XStack>
      }
    />
  );
}

function LendingSelectorRowContent({ item }: { item: ILendingSelectorItem }) {
  return (
    <>
      <Token size="sm" tokenImageUri={item.logoURI} bg="$bg" />
      <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
        {item.symbol}
      </SizableText>
      <YStack flex={1} alignItems="flex-end" minWidth={0}>
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyMdMedium"
          formatter="balance"
          numberOfLines={1}
        >
          {item.balanceText}
        </NumberSizeableTextWrapper>
        {item.descriptionText ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {item.descriptionText}
          </SizableText>
        ) : null}
      </YStack>
    </>
  );
}

// The asset selector at the top of the dialog. In `selectable` mode it is a
// compact pill (token + symbol + chevron) that triggers a popover listing every
// asset (supplied for withdraw, borrowed for repay) — the semantics of Borrow's
// asset-select popover. Fixed mode renders the same pill with no chevron and no
// affordance. The per-asset balance is not repeated on the pill; it lives on the
// balance or debt row under the amount field.
function LendingAssetSelectorRow({
  item,
  items,
  selectable,
  onSelect,
  columnHeaderLabel,
}: {
  item: ILendingSelectorItem;
  items: ILendingSelectorItem[];
  selectable: boolean;
  onSelect: (key: string) => void;
  columnHeaderLabel: string;
}) {
  const intl = useIntl();

  if (!selectable) {
    return (
      <ProtocolPositionAssetPill symbol={item.symbol} logoURI={item.logoURI} />
    );
  }

  return (
    // Wrap the popover so its trigger hugs the pill and centers on the dialog's
    // vertical axis (aligning with the amount hero below). The Popover's internal
    // Trigger frame is a full-width Stack carrying both the tap target and the
    // popover anchor, so only a content-sized row parent keeps them on the pill.
    <XStack alignSelf="center">
      <Popover
        title={intl.formatMessage({ id: ETranslations.token_selector_title })}
        renderTrigger={
          <ProtocolPositionAssetPill
            symbol={item.symbol}
            logoURI={item.logoURI}
            interactive
          />
        }
        renderContent={({ closePopover }) => (
          <YStack p="$2">
            <XStack px="$3" pb="$1">
              <SizableText size="$bodySmMedium" color="$textSubdued">
                {columnHeaderLabel}
              </SizableText>
            </XStack>
            {items.map((selectorItem) => {
              const isSelected = selectorItem.key === item.key;
              // The current asset is a non-actionable state row (plain XStack);
              // every other asset is a keyboard-focusable option button.
              if (isSelected) {
                return (
                  <XStack
                    key={selectorItem.key}
                    alignItems="center"
                    gap="$2"
                    px="$3"
                    py="$2"
                    borderRadius="$2"
                    bg="$bgHover"
                  >
                    <LendingSelectorRowContent item={selectorItem} />
                  </XStack>
                );
              }
              return (
                <ButtonFrame
                  key={selectorItem.key}
                  alignItems="center"
                  justifyContent="flex-start"
                  gap="$2"
                  px="$3"
                  py="$2"
                  borderWidth={0}
                  borderRadius="$2"
                  bg="$transparent"
                  hoverStyle={{ bg: '$bgHover' }}
                  pressStyle={{ bg: '$bgActive' }}
                  focusable
                  focusVisibleStyle={LENDING_SELECTOR_FOCUS_STYLE}
                  onPress={() => {
                    onSelect(selectorItem.key);
                    closePopover();
                  }}
                >
                  <LendingSelectorRowContent item={selectorItem} />
                </ButtonFrame>
              );
            })}
          </YStack>
        )}
      />
    </XStack>
  );
}

// Shared exit-side warning + inline error block. `hasDebts` withdraws surface the
// liquidation note; a build/submit failure renders in the critical slot the same
// way the generic portfolio dialog does.
function LendingActionAlerts({
  showLiquidationWarning,
  errorMessage,
  checkAmountAlerts = [],
  riskOfLiquidationAlert,
}: {
  showLiquidationWarning: boolean;
  errorMessage?: string;
  checkAmountAlerts?: ICheckAmountAlert[];
  riskOfLiquidationAlert?: boolean;
}) {
  const intl = useIntl();
  const liquidationWarningText = intl.formatMessage({
    id: ETranslations.defi_liquidation_withdraw_desc,
  });
  const visibleCheckAmountAlerts = checkAmountAlerts.filter((alert) => {
    if (!showLiquidationWarning) {
      return true;
    }
    if (riskOfLiquidationAlert && checkAmountAlerts.length === 1) {
      return false;
    }
    return ![alert.title?.text, alert.text?.text, alert.description?.text].some(
      (text) => text?.trim() === liquidationWarningText.trim(),
    );
  });
  const hasVisibleAlert =
    showLiquidationWarning ||
    Boolean(errorMessage) ||
    visibleCheckAmountAlerts.length > 0;

  if (!hasVisibleAlert) {
    return null;
  }

  return (
    <YStack gap="$3">
      {showLiquidationWarning ? (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          description={liquidationWarningText}
        />
      ) : null}
      {errorMessage ? (
        <Alert
          type="critical"
          icon="ErrorOutline"
          title={intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          })}
          description={errorMessage}
        />
      ) : null}
      {visibleCheckAmountAlerts.map((alert, index) => (
        <Alert
          key={index}
          type="warning"
          renderTitle={() => (
            <YStack>
              <EarnText text={alert.title} size="$bodyMdMedium" />
              <EarnText text={alert.text} size="$bodyMdMedium" />
              <EarnText text={alert.description} size="$bodyMdMedium" />
            </YStack>
          )}
          action={
            alert.button
              ? {
                  primary: alert.button.text.text,
                  onPrimaryPress: () => {
                    const link = alert.button?.data?.link;
                    if (!link) return;
                    openUrlInDiscovery({ url: link, title: link });
                  },
                }
              : undefined
          }
        />
      ))}
    </YStack>
  );
}

function ProtocolLendingActionDefiContent({
  accountId,
  networkId,
  actionType,
  source,
  hasDebts,
  onSuccess,
  renderMode = 'dialog',
}: {
  accountId: string;
  networkId: string;
  actionType: IProtocolLendingActionType;
  source: Extract<IProtocolLendingActionSource, { type: 'defi' }>;
  hasDebts?: boolean;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
  renderMode?: 'dialog' | 'page';
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { bodyMaxHeight, feedbackMaxHeight } =
    resolveProtocolPositionActionDialogLayout({ gtMd });
  const submitProtocolPositionAction = useProtocolPositionActionSubmit({
    accountId,
    networkId,
    onSuccess,
  });
  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();

  const assets = useMemo(
    () => defiActionUtils.filterPositiveActionAssets(source.action.assets),
    [source.action.assets],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedAsset = assets[selectedIndex];
  const isWithdraw = actionType === 'withdraw';
  // Withdraw prefills the full balance as an untouched Max default (submit sends
  // bps=10000, no dust); repay starts empty — the user types how much debt to
  // pay down.
  const [amount, setAmount] = useState(() =>
    isWithdraw
      ? clampAmountDecimals(
          assets[0]?.amount ?? '',
          assets[0]?.asset.meta?.decimals,
        )
      : '',
  );
  const [isMaxAmount, setIsMaxAmount] = useState(isWithdraw);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const closeRef = useRef<(() => void | Promise<void>) | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const releaseSubmitGuard = useCallback(() => {
    submittingRef.current = false;
    setSubmitting(false);
  }, []);

  // Editing the amount or switching the asset is a fresh intent — drop any
  // stale build/submit error so it doesn't linger over new input.
  useEffect(() => {
    setSubmitError(undefined);
  }, [amount, selectedIndex]);

  const amountDecimals = selectedAsset?.asset.meta?.decimals;
  const availableAmount = selectedAsset?.amount ?? '0';

  // Repay spends wallet tokens, but `availableAmount` above is the DEBT size —
  // the user may hold less than the debt. Fetch the wallet balance so an
  // over-spend fails here instead of at tx-confirm simulation. `address` is ''
  // for the native token; the API handles both uniformly.
  const isRepay = actionType === 'repay';
  const repayTokenAddress =
    selectedAsset?.tokenAddress ?? selectedAsset?.asset.address;
  const {
    result: repayWalletBalanceState,
    isLoading: repayWalletBalanceLoading,
  } = usePromiseResult<IRepayWalletBalanceLoadState>(
    async () => {
      if (!isRepay || repayTokenAddress === undefined) return {};
      try {
        const details =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId,
            networkId,
            contractList: [repayTokenAddress],
          });
        return { balance: details?.[0]?.balanceParsed };
      } catch (error) {
        return { errorMessage: getErrorMessage(error) };
      }
    },
    [accountId, isRepay, networkId, repayTokenAddress],
    { watchLoading: true, undefinedResultIfReRun: true },
  );
  const repayWalletBalance = repayWalletBalanceState?.balance;
  const repayWalletBalanceError = repayWalletBalanceState?.errorMessage;
  const isRepayWalletBalancePending =
    isRepay &&
    (repayWalletBalanceLoading || repayWalletBalanceState === undefined);

  const amountBN = new BigNumber(amount || '0');
  const availableBN = new BigNumber(availableAmount || '0');
  const isAmountPositive = amountBN.isFinite() && amountBN.gt(0);
  const repayWalletBalanceBN =
    isRepay && repayWalletBalance !== undefined
      ? new BigNumber(repayWalletBalance)
      : undefined;
  const isAmountInsufficient =
    (amountBN.isFinite() &&
      availableBN.isFinite() &&
      amountBN.gt(availableBN)) ||
    Boolean(
      repayWalletBalanceBN?.isFinite() &&
      amountBN.isFinite() &&
      amountBN.gt(repayWalletBalanceBN),
    );
  const isAmountValid = isAmountPositive && !isAmountInsufficient;
  const amountFiatValue = isAmountPositive
    ? amountBN.multipliedBy(selectedAsset?.asset.price ?? 0).toFixed()
    : '0';

  const {
    fillableMaxBN,
    fillableMax,
    isRepayWalletBalanceReady,
    isFillableMaxFullClose,
  } = resolveProtocolLendingDefiFillableAmountState({
    isRepay,
    availableAmount,
    repayWalletBalance,
  });

  const selectedAmountPercent = resolveSelectedAmountPercent({
    isMaxAmount,
    isAmountPositive,
    amountBN,
    maxBN: fillableMaxBN,
  });

  // The withdraw prefill is an untouched Max default; first focus clears it so
  // the user can type. A Max the user pressed deliberately (preset row) is never
  // cleared — the ref marks that intent. Mirrors the generic portfolio dialog.
  const hasUserSetMaxRef = useRef(false);

  const resetAmountForAsset = (asset?: IResolvedDeFiPositionActionAsset) => {
    hasUserSetMaxRef.current = false;
    if (isWithdraw) {
      setAmount(
        clampAmountDecimals(asset?.amount ?? '', asset?.asset.meta?.decimals),
      );
      setIsMaxAmount(true);
    } else {
      setAmount('');
      setIsMaxAmount(false);
    }
  };

  const handleAmountChange = (next: string) => {
    if (!validateAmountInput(next, amountDecimals)) {
      return;
    }
    setAmount(next);
    setIsMaxAmount(false);
  };

  const handleAmountInputFocus = () => {
    if (isMaxAmount && !hasUserSetMaxRef.current) {
      setAmount('');
      setIsMaxAmount(false);
    }
  };

  const handleMaxAmount = () => {
    if (
      isRepayWalletBalancePending ||
      repayWalletBalanceError ||
      !isRepayWalletBalanceReady
    ) {
      return;
    }
    hasUserSetMaxRef.current = true;
    setAmount(clampAmountDecimals(fillableMax, amountDecimals));
    setIsMaxAmount(isFillableMaxFullClose);
  };

  const handleSelectPercent = (percent: number) => {
    // Max routes through handleMaxAmount so a full close still submits bps=10000
    // (no dust); 25/50/75 fill an exact token amount of the fillable max.
    if (
      isRepayWalletBalancePending ||
      repayWalletBalanceError ||
      !isRepayWalletBalanceReady
    ) {
      return;
    }
    if (percent >= 100) {
      handleMaxAmount();
      return;
    }
    const next = fillableMaxBN.multipliedBy(percent).div(100);
    setAmount(clampAmountDecimals(next.toFixed(), amountDecimals));
    setIsMaxAmount(false);
  };

  const handleSelectAsset = (key: string) => {
    const index = Number(key);
    if (!Number.isInteger(index) || !assets[index]) return;
    setSelectedIndex(index);
    resetAmountForAsset(assets[index]);
  };

  const handleConfirm = async ({
    close,
    preventClose,
  }: {
    close?: () => void | Promise<void>;
    preventClose: () => void;
  }) => {
    preventClose();
    if (!selectedAsset || submittingRef.current) return;
    closeRef.current = close;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(undefined);
    let isActionDialogClosed = false;
    const closeActionDialogBeforeConfirm = async () => {
      if (isActionDialogClosed) return;
      isActionDialogClosed = true;
      await closeRef.current?.();
    };
    let submitGuardReleased = false;
    const releaseSubmitGuardOnce = () => {
      if (submitGuardReleased) return;
      submitGuardReleased = true;
      releaseSubmitGuard();
    };
    const releaseSubmitGuardOnceWithError = (error: unknown) => {
      if (
        !submitGuardReleased &&
        !isActionDialogClosed &&
        !isUserRejectedErrorMessage({ error, intl }) &&
        shouldShowProtocolPositionActionInlineSubmitError(error)
      ) {
        setSubmitError(getErrorMessage(error));
      }
      releaseSubmitGuardOnce();
    };
    try {
      await Keyboard.dismissWithDelay(80);
      await submitProtocolPositionAction({
        action: source.action,
        selectedAssets: [selectedAsset],
        amount,
        isMaxAmount,
        isErrorToastSuppressed: (error) =>
          !isActionDialogClosed &&
          shouldShowProtocolPositionActionInlineSubmitError(error),
        onBeforeNavigateConfirm: closeActionDialogBeforeConfirm,
        onSettleResult: async ({ status }) => {
          releaseSubmitGuardOnce();
          await closeActionDialogBeforeConfirm();
          if (status !== EOnChainHistoryTxStatus.Success) {
            return false;
          }
        },
        onConfirmFail: releaseSubmitGuardOnceWithError,
        onConfirmCancel: releaseSubmitGuardOnce,
      });
    } catch (error) {
      if (
        !isActionDialogClosed &&
        !isUserRejectedErrorMessage({ error, intl }) &&
        shouldShowProtocolPositionActionInlineSubmitError(error)
      ) {
        setSubmitError(getErrorMessage(error));
      }
      releaseSubmitGuardOnce();
    }
  };

  const actionLabel = getActionLabel({
    action: LENDING_ACTION_TO_DEFI_ACTION[actionType],
    intl,
  });
  const balanceContext = resolveProtocolLendingBalanceContext({
    isRepay,
    hasKnownDebt: Boolean(selectedAsset),
    walletBalance: repayWalletBalance,
  });
  const availableLabel = intl.formatMessage({
    id: LENDING_BALANCE_LABEL_TRANSLATION_IDS[balanceContext.primaryLabel],
  });
  const walletBalanceLabel = intl.formatMessage({
    id: ETranslations.global_wallet_balance,
  });
  const maxLabel = intl.formatMessage({ id: ETranslations.global_max });
  const insufficientLabel = intl.formatMessage({
    id: ETranslations.earn_insufficient_balance,
  });
  const columnHeaderLabel = getLendingColumnHeaderLabel({ actionType, intl });
  const selectable = assets.length > 1;
  const selectorItems = useMemo<ILendingSelectorItem[]>(
    () =>
      assets.map((asset, index) => ({
        key: String(index),
        symbol: asset.symbol,
        logoURI: asset.asset.meta?.logoUrl,
        balanceText: asset.amount,
        descriptionText: buildDefiSelectorFiatText({
          amount: asset.amount,
          price: asset.asset.price,
          currencySymbol,
        }),
      })),
    [assets, currencySymbol],
  );
  const selectedItem = selectorItems[selectedIndex];
  const isConfirmDisabled =
    !selectedAsset ||
    !isAmountValid ||
    !isRepayWalletBalanceReady ||
    isRepayWalletBalancePending ||
    Boolean(repayWalletBalanceError);
  const inlineErrorMessage = submitError ?? repayWalletBalanceError;
  const showFeedbackRegion =
    (Boolean(hasDebts) && isWithdraw) || Boolean(inlineErrorMessage);
  const bodyNode = (
    <YStack gap="$5">
      {selectedAsset && selectedItem ? (
        <ProtocolPositionActionAmountInput
          assetSelector={
            <LendingAssetSelectorRow
              item={selectedItem}
              items={selectorItems}
              selectable={selectable}
              onSelect={handleSelectAsset}
              columnHeaderLabel={columnHeaderLabel}
            />
          }
          amount={amount}
          onChangeAmount={handleAmountChange}
          onSelectPercent={handleSelectPercent}
          selectedPercent={selectedAmountPercent}
          symbol={selectedAsset.symbol}
          availableAmount={availableAmount}
          fiatValue={amountFiatValue}
          currencySymbol={currencySymbol}
          isInsufficient={isAmountInsufficient}
          availableLabel={availableLabel}
          maxLabel={maxLabel}
          insufficientLabel={insufficientLabel}
          onFocus={handleAmountInputFocus}
          secondaryLabel={walletBalanceLabel}
          secondaryAmount={balanceContext.secondaryWalletBalance}
        />
      ) : (
        <YStack py="$6" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_select_crypto,
            })}
          </SizableText>
        </YStack>
      )}
    </YStack>
  );
  const feedbackNode = showFeedbackRegion ? (
    <LendingActionAlerts
      showLiquidationWarning={Boolean(hasDebts) && isWithdraw}
      errorMessage={inlineErrorMessage}
    />
  ) : null;
  const contentNode = (
    <>
      <ScrollView
        maxHeight={bodyMaxHeight}
        mx="$-5"
        px="$5"
        nestedScrollEnabled
      >
        {bodyNode}
      </ScrollView>

      {feedbackNode ? (
        <ScrollView
          maxHeight={feedbackMaxHeight}
          mx="$-5"
          px="$5"
          nestedScrollEnabled
        >
          {feedbackNode}
        </ScrollView>
      ) : null}
    </>
  );
  const confirmButtonProps = {
    disabled: isConfirmDisabled || submitting,
    loading: submitting || isRepayWalletBalancePending,
  };

  if (renderMode === 'page') {
    return (
      <>
        <Page.Header title={actionLabel} />
        <Page.Body>
          <ScrollView flex={1} nestedScrollEnabled>
            <YStack p="$5" gap="$5">
              {bodyNode}
              {feedbackNode}
            </YStack>
          </ScrollView>
        </Page.Body>
        <Page.Footer>
          <YStack bg="$bgApp">
            <Page.FooterActions
              onConfirmText={actionLabel}
              onConfirm={(close) => {
                void handleConfirm({
                  close,
                  preventClose: () => undefined,
                });
              }}
              confirmButtonProps={confirmButtonProps}
            />
            <ProtocolPositionActionKeyboardDismissFooter />
          </YStack>
        </Page.Footer>
      </>
    );
  }

  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {contentNode}

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        onConfirmText={actionLabel}
        onConfirm={handleConfirm}
        confirmButtonProps={confirmButtonProps}
        extraContent={<ProtocolPositionActionKeyboardDismissFooter />}
      />
    </YStack>
  );
}

function ProtocolLendingActionBorrowContent({
  accountId,
  networkId,
  actionType,
  source,
  hasDebts,
  onSuccess,
  renderMode = 'dialog',
}: {
  accountId: string;
  networkId: string;
  actionType: IProtocolLendingActionType;
  source: Extract<IProtocolLendingActionSource, { type: 'borrow' }>;
  hasDebts?: boolean;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
  renderMode?: 'dialog' | 'page';
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { bodyMaxHeight, feedbackMaxHeight } =
    resolveProtocolPositionActionDialogLayout({ gtMd });
  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();
  const isWithdraw = actionType === 'withdraw';

  const [reserveAddress, setReserveAddress] = useState(source.reserveAddress);

  // Fixed mode (a desktop row already named the asset) skips the fetch — the
  // dropdown is only for the position-level entry.
  const { result: assetsLoadState, isLoading: assetsLoading } =
    usePromiseResult<IBorrowAssetsListLoadState>(
      async () => {
        if (!source.selectable) {
          return { assetsList: EMPTY_BORROW_ASSETS_LIST };
        }
        try {
          const assetsList =
            await backgroundApiProxy.serviceStaking.getBorrowAssetsList({
              accountId,
              networkId,
              provider: source.provider,
              marketAddress: source.marketAddress,
              action: LENDING_ACTION_TO_BORROW_ACTION[actionType],
            });
          return { assetsList };
        } catch (error) {
          return {
            assetsList: EMPTY_BORROW_ASSETS_LIST,
            errorMessage: getErrorMessage(error),
          };
        }
      },
      [
        accountId,
        networkId,
        actionType,
        source.selectable,
        source.provider,
        source.marketAddress,
      ],
      {
        initResult: { assetsList: EMPTY_BORROW_ASSETS_LIST },
        watchLoading: true,
        undefinedResultIfReRun: true,
      },
    );
  const assetsList = assetsLoadState?.assetsList ?? EMPTY_BORROW_ASSETS_LIST;
  const assetsError = assetsLoadState?.errorMessage;
  const normalizedReserveAddress = normalizeBorrowReserveAddress({
    networkId,
    address: reserveAddress,
  });
  const selectedBorrowAsset = assetsList.assets.find(
    (item) =>
      normalizeBorrowReserveAddress({
        networkId,
        address: item.reserveAddress,
      }) === normalizedReserveAddress,
  );

  // Approve target, decimals, price and balances for the selected reserve
  // (reloads when the reserve address changes).
  const {
    tokenInfo,
    protocolInfo,
    isLoading: manageLoading,
  } = useManagePage({
    accountId,
    indexedAccountId: source.indexedAccountId,
    networkId,
    // The borrow branch's request is keyed by reserveAddress, not symbol -
    // but the client-built stakeTag (pending-status sync id) is keyed by
    // symbol, so it must follow the dropdown selection.
    symbol: (selectedBorrowAsset?.token.symbol ??
      source.symbol) as ISupportedSymbol,
    provider: source.provider,
    vault: undefined,
    type: isWithdraw ? EManagePositionType.Withdraw : EManagePositionType.Repay,
    reserveAddress,
    marketAddress: source.marketAddress,
    revalidateOnFocus: false,
    undefinedResultIfReRun: true,
  });
  const baseToken = tokenInfo?.token as IToken | undefined;

  // Effective display values (mirror WithdrawSection's fallback chain).
  const effectiveSymbol = selectedBorrowAsset?.token.symbol ?? source.symbol;
  const effectiveLogo = selectedBorrowAsset?.token.logoURI ?? source.logoURI;
  const effectiveDecimals =
    selectedBorrowAsset?.token.decimals ??
    protocolInfo?.protocolInputDecimals ??
    baseToken?.decimals;
  const effectiveBalance = selectedBorrowAsset
    ? ((isWithdraw
        ? (selectedBorrowAsset.supplied?.number ??
          selectedBorrowAsset.supplied?.amount)
        : (selectedBorrowAsset.borrowed?.number ??
          selectedBorrowAsset.borrowed?.amount)) ?? '0')
    : (protocolInfo?.activeBalance ?? '0');
  // Fixed-mode portfolio rows already know the outstanding debt. Preserve that
  // amount because the manage-page max can be wallet-capped and therefore is not
  // authoritative for either the Remaining debt label or repayAll detection.
  const selectedBorrowAssetDebt = selectedBorrowAsset
    ? (selectedBorrowAsset.borrowed?.number ??
      selectedBorrowAsset.borrowed?.amount)
    : undefined;
  const repayDebtState = resolveProtocolLendingRepayDebtState({
    selectedBorrowAssetDebt,
    sourceDebtAmount: source.selectable ? undefined : source.debtAmount,
    protocolDebtBalance: protocolInfo?.debtBalance,
    maxRepayBalance: protocolInfo?.maxRepayBalance,
  });
  // The exit-side balance shown in the hero anchor and used as the full-close
  // target: supplied collateral for withdraw, the outstanding debt for repay.
  const referenceBalance = isWithdraw
    ? effectiveBalance
    : repayDebtState.referenceBalance;

  const [amount, setAmount] = useState('');
  // Withdraw with an open loan starts at 0, not Max: pulling collateral against
  // a debt lowers the health factor, so the full-balance default is the risky
  // path and must be a deliberate choice. Debt-free withdraw still defaults Max.
  const [isMaxAmount, setIsMaxAmount] = useState(isWithdraw && !hasDebts);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  // Footer confirm loading is overridden by confirmButtonProps and released
  // early by preventClose(), so the dialog owns the build spinner and guard.
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const hasUserTouchedRef = useRef(false);
  const prefilledReserveRef = useRef<string | undefined>(undefined);
  // Show the body only after the first load settles; later reserve-switch
  // reloads keep the frame (values update in place) instead of re-flashing.
  const hasLoadedOnceRef = useRef(false);

  // Withdraw prefills the full balance as an untouched Max default once the
  // balance resolves (it loads async here, unlike the defi source). Any user
  // touch freezes the field so the prefill can't clobber typing; switching
  // assets re-arms it.
  useEffect(() => {
    if (!isWithdraw) return;
    // With an open loan, leave withdraw at 0 (see isMaxAmount init above).
    if (hasDebts) return;
    if (hasUserTouchedRef.current) return;
    if (prefilledReserveRef.current === reserveAddress) return;
    const balanceBN = new BigNumber(effectiveBalance || '0');
    if (!balanceBN.isFinite() || balanceBN.lte(0)) return;
    prefilledReserveRef.current = reserveAddress;
    setAmount(clampAmountDecimals(effectiveBalance, effectiveDecimals));
    setIsMaxAmount(true);
  }, [
    effectiveBalance,
    effectiveDecimals,
    isWithdraw,
    reserveAddress,
    hasDebts,
  ]);

  // Editing the amount or switching the reserve is a fresh intent — drop any
  // stale build/submit error so it doesn't linger over new input.
  useEffect(() => {
    setSubmitError(undefined);
  }, [amount, reserveAddress]);

  const amountBN = new BigNumber(amount || '0');
  const isAmountPositive = amountBN.isFinite() && amountBN.gt(0);
  // Mirrors the defi source: fiat under the hero tracks amount x price. The
  // borrow manage-page response carries the selected reserve's price.
  const tokenPriceBN = new BigNumber(tokenInfo?.price ?? '0');
  const amountFiatValue =
    isAmountPositive && tokenPriceBN.isFinite() && tokenPriceBN.gt(0)
      ? amountBN.multipliedBy(tokenPriceBN).toFixed()
      : '0';
  // Repay spends wallet tokens, but referenceBalance above is the DEBT — the user
  // may hold less than they owe. Fetch the wallet balance of the debt's
  // underlying token directly (the same pattern the defi content uses), so this
  // never depends on the borrow asset-list carrying walletBalance and works in
  // both dropdown and fixed mode. '' address = native; the API handles both
  // uniformly. undefined = the token isn't resolved yet, so skip the fetch.
  const repayTokenAddress = selectedBorrowAsset
    ? (selectedBorrowAsset.token.address ?? '')
    : baseToken?.address;
  const {
    result: repayWalletBalanceState,
    isLoading: repayWalletBalanceLoading,
  } = usePromiseResult<IRepayWalletBalanceLoadState>(
    async () => {
      if (isWithdraw || repayTokenAddress === undefined) return {};
      try {
        const details =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId,
            networkId,
            contractList: [repayTokenAddress],
          });
        return { balance: details?.[0]?.balanceParsed };
      } catch (error) {
        return { errorMessage: getErrorMessage(error) };
      }
    },
    [accountId, isWithdraw, networkId, repayTokenAddress],
    { watchLoading: true, undefinedResultIfReRun: true },
  );
  const repayWalletBalance = repayWalletBalanceState?.balance;
  const repayWalletBalanceError = repayWalletBalanceState?.errorMessage;
  const isRepayWalletBalancePending =
    !isWithdraw &&
    (repayWalletBalanceLoading ||
      repayWalletBalanceState === undefined ||
      repayTokenAddress === undefined);
  const isBorrowDataLoading =
    manageLoading || (source.selectable && Boolean(assetsLoading));
  const hasBorrowLoadError = Boolean(assetsError || repayWalletBalanceError);
  // Show the wallet balance for repay whenever it has resolved — it tells the
  // user whether they can fully close the loan and why Max may cap below the debt.
  const walletBalanceText = isWithdraw ? undefined : repayWalletBalance;
  const repayAllTargetAmount = repayDebtState.repayAllTargetAmount;
  const repayAmountState = resolveProtocolLendingRepayAmountState({
    amount,
    referenceBalance,
    maxRepayBalance: protocolInfo?.maxRepayBalance,
    repayWalletBalance,
    repayAllTargetAmount,
  });
  const withdrawAmountState = resolveProtocolLendingWithdrawAmountState({
    amount,
    referenceBalance,
  });
  // Max fillable amount: withdraw → the full supplied balance; repay → the
  // server-provided maxRepayBalance first (debt capped by wallet), then direct
  // wallet balance if the server max is unavailable.
  const valueForMax = isWithdraw
    ? referenceBalance
    : repayAmountState.valueForMax;
  const valueForMaxBN = new BigNumber(valueForMax || '0');
  // Full close uses the real debt amount for repay, not the formatted display
  // balance. Wallet-capped Max can be 100% of the fillable amount without being
  // a protocol-level repayAll.
  const isFullClose = isWithdraw
    ? isSamePositiveAmount({
        amount,
        targetAmount: clampAmountDecimals(referenceBalance, effectiveDecimals),
      })
    : repayAmountState.isFullClose;
  const isAmountInsufficient =
    (isWithdraw && withdrawAmountState.isAmountInsufficient) ||
    (!isWithdraw && repayAmountState.isAmountInsufficient);
  const selectedAmountPercent = resolveSelectedAmountPercent({
    isMaxAmount,
    isAmountPositive,
    amountBN,
    maxBN: valueForMaxBN,
  });

  const handleAmountChange = (next: string) => {
    if (!validateAmountInput(next, effectiveDecimals)) return;
    hasUserTouchedRef.current = true;
    setAmount(next);
    setIsMaxAmount(false);
  };
  const handleAmountInputFocus = () => {
    if (isMaxAmount && !hasUserTouchedRef.current) {
      hasUserTouchedRef.current = true;
      setAmount('');
      setIsMaxAmount(false);
    }
  };
  const handleMaxAmount = () => {
    if (!isWithdraw && (isBorrowDataLoading || isRepayWalletBalancePending)) {
      return;
    }
    if (hasBorrowLoadError) {
      return;
    }
    hasUserTouchedRef.current = true;
    setAmount(clampAmountDecimals(valueForMax, effectiveDecimals));
    setIsMaxAmount(true);
  };
  const handleSelectPercent = (percent: number) => {
    // A full close (amount === debt/supplied balance) maps to
    // withdrawAll/repayAll via isFullClose; 25/50/75 fill an exact token
    // amount of the actionable max (wallet-capped for fixed-mode repay).
    if (!isWithdraw && (isBorrowDataLoading || isRepayWalletBalancePending)) {
      return;
    }
    if (hasBorrowLoadError) {
      return;
    }
    if (percent >= 100) {
      handleMaxAmount();
      return;
    }
    hasUserTouchedRef.current = true;
    const next = valueForMaxBN.multipliedBy(percent).div(100);
    setAmount(clampAmountDecimals(next.toFixed(), effectiveDecimals));
    setIsMaxAmount(false);
  };
  const handleSelectAsset = (key: string) => {
    setReserveAddress(key);
    hasUserTouchedRef.current = false;
    // Repay, and withdraw-with-debt (no prefill), reset to 0 on switch. Debt-free
    // withdraw leaves it for the prefill effect to refill once the reserve loads.
    if (!isWithdraw || hasDebts) {
      setAmount('');
      setIsMaxAmount(false);
    }
  };

  const actionResult = useUniversalBorrowAction({
    action: actionType,
    accountId,
    networkId,
    provider: source.provider,
    marketAddress: source.marketAddress,
    reserveAddress,
    amount,
    isDisabled:
      isBorrowDataLoading ||
      isRepayWalletBalancePending ||
      hasBorrowLoadError ||
      isAmountInsufficient,
    repayAll: actionType === 'repay' ? isFullClose : undefined,
  });

  // Approve target (mirror WithdrawSection's effectiveToken + approve target).
  const effectiveToken = useMemo<IToken | undefined>(() => {
    if (selectedBorrowAsset) {
      const tokenAddress = selectedBorrowAsset.token.address ?? '';
      return {
        ...selectedBorrowAsset.token,
        isNative: !tokenAddress,
        networkId,
      } as IToken;
    }
    return baseToken;
  }, [selectedBorrowAsset, baseToken, networkId]);

  const approveTarget = useMemo<
    IManagePositionApproveTarget | undefined
  >(() => {
    if (!effectiveToken) return undefined;
    const approveToken: IToken = protocolInfo?.approveAsset
      ? {
          ...effectiveToken,
          address: protocolInfo.approveAsset,
          isNative: false,
          networkId,
        }
      : effectiveToken;
    if (!protocolInfo?.approve?.approveTarget || approveToken.isNative) {
      return undefined;
    }
    return {
      accountId,
      networkId,
      spenderAddress: protocolInfo.approve.approveTarget,
      token: approveToken,
    };
  }, [
    accountId,
    effectiveToken,
    networkId,
    protocolInfo?.approve?.approveTarget,
    protocolInfo?.approveAsset,
  ]);

  const handleBorrowWithdraw = useUniversalBorrowWithdraw({
    accountId,
    networkId,
  });
  const handleBorrowRepay = useUniversalBorrowRepay({ accountId, networkId });
  const closeRef = useRef<(() => void | Promise<void>) | undefined>(undefined);
  const isActionDialogClosedRef = useRef(false);
  const businessSubmitCounterRef = useRef(0);
  const closeActionDialogBeforeConfirm = useCallback(async () => {
    if (isActionDialogClosedRef.current) return;
    isActionDialogClosedRef.current = true;
    await closeRef.current?.();
  }, []);
  const startSubmitGuard = useCallback(() => {
    submittingRef.current = true;
    if (!isActionDialogClosedRef.current) {
      setSubmitting(true);
      setSubmitError(undefined);
    }
  }, []);

  const releaseSubmitGuard = useCallback(() => {
    submittingRef.current = false;
    if (!isActionDialogClosedRef.current) {
      setSubmitting(false);
    }
  }, []);

  const submitBorrowTx = useCallback(async () => {
    businessSubmitCounterRef.current += 1;
    startSubmitGuard();
    let submitGuardReleased = false;
    const releaseSubmitGuardOnce = () => {
      if (submitGuardReleased) return;
      submitGuardReleased = true;
      releaseSubmitGuard();
    };
    const releaseSubmitGuardOnceWithError = (error: unknown) => {
      if (
        !submitGuardReleased &&
        !isActionDialogClosedRef.current &&
        !isUserRejectedErrorMessage({ error, intl }) &&
        shouldShowProtocolPositionActionInlineSubmitError(error)
      ) {
        setSubmitError(getErrorMessage(error));
      }
      releaseSubmitGuardOnce();
    };
    try {
      const { provider, marketAddress } = source;
      const tags: string[] = [
        EEarnLabels.Borrow,
        buildBorrowTag({ provider, action: actionType }),
      ];
      if (protocolInfo?.stakeTag) {
        tags.push(protocolInfo.stakeTag);
      }
      const protocolLogoURI =
        source.providerLogoURI ?? protocolInfo?.providerDetail.logoURI;
      const protocolLabel = getProtocolProviderDisplayName({
        provider,
        providerDisplayName: source.providerDisplayName,
        providerDetailName: protocolInfo?.providerDetail.name,
      });
      if (actionType === 'repay') {
        await handleBorrowRepay({
          amount,
          provider,
          marketAddress,
          reserveAddress,
          repayAll: isFullClose,
          stakingInfo: effectiveToken
            ? {
                label: EEarnLabels.Repay,
                protocol: protocolLabel,
                protocolLogoURI,
                send: { token: effectiveToken, amount },
                tags,
              }
            : undefined,
          onSuccess: (data) => {
            releaseSubmitGuardOnce();
            void onSuccess?.({ accountId, networkId, data });
          },
          onSettleResult: async () => {
            releaseSubmitGuardOnce();
            await closeActionDialogBeforeConfirm();
          },
          onFail: releaseSubmitGuardOnceWithError,
          onCancel: releaseSubmitGuardOnce,
        });
        return;
      }
      await handleBorrowWithdraw({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        withdrawAll: isFullClose,
        stakingInfo: effectiveToken
          ? {
              label: EEarnLabels.Withdraw,
              protocol: protocolLabel,
              protocolLogoURI,
              receive: { token: effectiveToken, amount },
              tags,
            }
          : undefined,
        onSuccess: (data) => {
          releaseSubmitGuardOnce();
          void onSuccess?.({ accountId, networkId, data });
        },
        onSettleResult: async () => {
          releaseSubmitGuardOnce();
          await closeActionDialogBeforeConfirm();
        },
        onFail: releaseSubmitGuardOnceWithError,
        onCancel: releaseSubmitGuardOnce,
      });
    } catch (error) {
      releaseSubmitGuardOnceWithError(error);
    }
  }, [
    accountId,
    actionType,
    amount,
    effectiveToken,
    handleBorrowRepay,
    handleBorrowWithdraw,
    isFullClose,
    intl,
    networkId,
    onSuccess,
    protocolInfo?.providerDetail.logoURI,
    protocolInfo?.providerDetail.name,
    protocolInfo?.stakeTag,
    reserveAddress,
    closeActionDialogBeforeConfirm,
    releaseSubmitGuard,
    source,
    startSubmitGuard,
  ]);

  const { needsApproval, approveLoading, onApprove } =
    useBorrowApproveAndSubmit({
      approveTarget,
      // useTrackTokenAllowance never fetches on mount - seed it with the
      // manage-page allowance, which tracks the selected reserve because
      // useManagePage loads again per reserveAddress.
      currentAllowance: protocolInfo?.approve?.allowance,
      amountValue: amount,
      onSubmit: submitBorrowTx,
      onBeforeNavigateConfirm: closeActionDialogBeforeConfirm,
    });

  const handleFooterConfirm = async ({
    close,
    preventClose,
  }: {
    close?: () => void | Promise<void>;
    preventClose: () => void;
  }) => {
    closeRef.current = close;
    isActionDialogClosedRef.current = false;
    preventClose();
    if (submittingRef.current) return;
    startSubmitGuard();
    setSubmitError(undefined);
    try {
      await Keyboard.dismissWithDelay(80);
      if (needsApproval) {
        const businessSubmitCounterBeforeApprove =
          businessSubmitCounterRef.current;
        await onApprove();
        if (
          businessSubmitCounterRef.current ===
          businessSubmitCounterBeforeApprove
        ) {
          releaseSubmitGuard();
        }
        return;
      }
      await submitBorrowTx();
    } catch (error) {
      if (
        !isUserRejectedErrorMessage({ error, intl }) &&
        shouldShowProtocolPositionActionInlineSubmitError(error)
      ) {
        setSubmitError(getErrorMessage(error));
      }
      releaseSubmitGuard();
    }
  };

  const actionLabel = getActionLabel({
    action: LENDING_ACTION_TO_DEFI_ACTION[actionType],
    intl,
  });
  // Withdraw's anchor shows the supplied balance as "Available to Withdraw";
  // repay's shows the "Remaining debt" being paid down (matches the manage
  // page), with the wallet balance as the secondary line beneath it.
  // Only call the reference "Remaining debt" when the real debt is known
  // (repayAllTargetAmount). Otherwise `referenceBalance` is the wallet-capped
  // fill cap — show the neutral "Available" label rather than mislabeling the
  // max repayable as remaining debt. Reuses the existing global_available key.
  const balanceContext = resolveProtocolLendingBalanceContext({
    isRepay: !isWithdraw,
    hasKnownDebt: Boolean(repayAllTargetAmount),
    walletBalance: walletBalanceText,
  });
  const availableLabel = intl.formatMessage({
    id: LENDING_BALANCE_LABEL_TRANSLATION_IDS[balanceContext.primaryLabel],
  });
  const walletBalanceLabel = intl.formatMessage({
    id: ETranslations.global_wallet_balance,
  });
  const maxLabel = intl.formatMessage({ id: ETranslations.global_max });
  const insufficientLabel = intl.formatMessage({
    id: ETranslations.earn_insufficient_balance,
  });
  const columnHeaderLabel = getLendingColumnHeaderLabel({ actionType, intl });

  const selectorItems = useMemo<ILendingSelectorItem[]>(
    () =>
      assetsList.assets.map((asset) => ({
        key: asset.reserveAddress,
        symbol: asset.token.symbol,
        logoURI: asset.token.logoURI,
        balanceText:
          (isWithdraw
            ? asset.supplied?.title?.text
            : asset.borrowed?.title?.text) ?? '0',
        descriptionText: isWithdraw
          ? asset.supplied?.description?.text
          : asset.borrowed?.description?.text,
      })),
    [assetsList.assets, isWithdraw],
  );
  const selectable = source.selectable && selectorItems.length > 1;
  const selectedItem: ILendingSelectorItem = selectedBorrowAsset
    ? {
        key: selectedBorrowAsset.reserveAddress,
        symbol: effectiveSymbol,
        logoURI: effectiveLogo,
        balanceText: effectiveBalance,
        descriptionText: isWithdraw
          ? selectedBorrowAsset.supplied?.description?.text
          : selectedBorrowAsset.borrowed?.description?.text,
      }
    : {
        key: reserveAddress,
        symbol: effectiveSymbol,
        logoURI: effectiveLogo,
        balanceText: effectiveBalance,
      };

  const remainingDebtChange = resolveProtocolLendingRemainingDebtState({
    amount,
    debtAmount: isWithdraw ? undefined : repayAllTargetAmount,
  });
  const healthFactor = actionResult.transactionConfirmation?.healthFactor;
  const confirmDisabled =
    isBorrowDataLoading ||
    isRepayWalletBalancePending ||
    hasBorrowLoadError ||
    !isAmountPositive ||
    isAmountInsufficient ||
    actionResult.isCheckAmountMessageError ||
    actionResult.checkAmountResult === false ||
    actionResult.checkAmountLoading;
  const shouldShowHealthFactorSkeleton =
    !healthFactor && isAmountPositive && !actionResult.transactionConfirmation;
  // Belt-and-suspenders: a selectable Aave entry whose asset fetch AND protocol
  // info both come back empty falls back to the empty state instead of crashing.
  const isEmpty =
    source.selectable &&
    !assetsLoading &&
    assetsList.assets.length === 0 &&
    !protocolInfo;

  // Wait for the asset list (dropdown mode) AND the manage-page fetch before
  // revealing the body, so balances/decimals/price land together instead of
  // popping in from '0'. Flips true once the first load settles (data or not),
  // so the empty state can still show and reserve switches don't re-flash.
  const isBusy = isBorrowDataLoading;
  if (!isBusy) {
    hasLoadedOnceRef.current = true;
  }
  const isInitialLoading = !hasLoadedOnceRef.current;
  const checkAmountAlerts = actionResult.checkAmountAlerts ?? [];
  const inlineErrorMessage =
    assetsError ??
    repayWalletBalanceError ??
    submitError ??
    (actionResult.isCheckAmountMessageError
      ? actionResult.checkAmountMessage
      : undefined);
  const showFeedbackRegion =
    !isInitialLoading &&
    ((Boolean(hasDebts) && isWithdraw) ||
      Boolean(inlineErrorMessage) ||
      checkAmountAlerts.length > 0);
  const bodyNode = (
    <YStack gap="$5">
      {isInitialLoading ? (
        <YStack gap="$5">
          <Skeleton height="$11" width="100%" borderRadius="$3" />
          <Skeleton
            height={BORROW_HERO_SKELETON_HEIGHT}
            width="100%"
            borderRadius="$3"
          />
          <Skeleton height="$11" width="100%" borderRadius="$3" />
          <XStack gap="$2">
            {LENDING_PERCENT_PRESETS.map((preset) => (
              <Skeleton key={preset} flex={1} height="$9" borderRadius="$2" />
            ))}
          </XStack>
        </YStack>
      ) : null}
      {!isInitialLoading && isEmpty ? (
        <YStack py="$6" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_select_crypto })}
          </SizableText>
        </YStack>
      ) : null}
      {!isInitialLoading && !isEmpty ? (
        <>
          <ProtocolPositionActionAmountInput
            assetSelector={
              <LendingAssetSelectorRow
                item={selectedItem}
                items={selectorItems}
                selectable={selectable}
                onSelect={handleSelectAsset}
                columnHeaderLabel={columnHeaderLabel}
              />
            }
            amount={amount}
            onChangeAmount={handleAmountChange}
            onSelectPercent={handleSelectPercent}
            selectedPercent={selectedAmountPercent}
            symbol={effectiveSymbol}
            availableAmount={referenceBalance}
            fiatValue={amountFiatValue}
            currencySymbol={currencySymbol}
            isInsufficient={isAmountInsufficient}
            availableLabel={availableLabel}
            maxLabel={maxLabel}
            insufficientLabel={insufficientLabel}
            onFocus={handleAmountInputFocus}
            secondaryLabel={walletBalanceLabel}
            secondaryAmount={balanceContext.secondaryWalletBalance}
          />
          {healthFactor ? (
            <YStack gap="$1">
              <ProtocolPositionActionAnchor
                label={intl.formatMessage({
                  id: ETranslations.defi_health_factor,
                })}
                valueNode={
                  <XStack alignItems="center" gap="$2" flexShrink={0}>
                    <Stack opacity={healthFactor.latest ? 0.5 : 1}>
                      <EarnText
                        text={healthFactor.current?.title}
                        size="$bodyMdMedium"
                      />
                    </Stack>
                    {healthFactor.latest ? (
                      <>
                        <Icon
                          name="ArrowRightSolid"
                          size="$4"
                          color="$iconDisabled"
                        />
                        <EarnText
                          text={healthFactor.latest?.title}
                          size="$bodyMdMedium"
                        />
                      </>
                    ) : null}
                  </XStack>
                }
              />
              {remainingDebtChange ? (
                <RemainingDebtChangeRow
                  label={availableLabel}
                  currentDebt={remainingDebtChange.currentDebt}
                  remainingDebt={remainingDebtChange.remainingDebt}
                  symbol={effectiveSymbol}
                />
              ) : null}
              <XStack justifyContent="flex-end">
                <EarnText
                  text={
                    actionResult.transactionConfirmation?.liquidationAt
                      ?.description ?? {
                      text: intl.formatMessage({
                        id: ETranslations.defi_liquidation_at_less_than_1_00,
                      }),
                    }
                  }
                  size="$bodySm"
                  color="$textSubdued"
                />
              </XStack>
            </YStack>
          ) : null}
          {shouldShowHealthFactorSkeleton ? (
            <YStack gap="$1">
              <ProtocolPositionActionAnchor
                label={intl.formatMessage({
                  id: ETranslations.defi_health_factor,
                })}
                valueNode={
                  <Skeleton height="$4" width="$16" borderRadius="$1" />
                }
              />
              {remainingDebtChange ? (
                <RemainingDebtChangeRow
                  label={availableLabel}
                  currentDebt={remainingDebtChange.currentDebt}
                  remainingDebt={remainingDebtChange.remainingDebt}
                  symbol={effectiveSymbol}
                />
              ) : null}
              <XStack justifyContent="flex-end">
                <Skeleton height="$4" width="$24" borderRadius="$1" />
              </XStack>
            </YStack>
          ) : null}
        </>
      ) : null}
    </YStack>
  );
  const feedbackNode = showFeedbackRegion ? (
    <LendingActionAlerts
      showLiquidationWarning={Boolean(hasDebts) && isWithdraw}
      errorMessage={inlineErrorMessage}
      checkAmountAlerts={checkAmountAlerts}
      riskOfLiquidationAlert={actionResult.riskOfLiquidationAlert}
    />
  ) : null;
  const contentNode = (
    <>
      <ScrollView
        maxHeight={bodyMaxHeight}
        mx="$-5"
        px="$5"
        nestedScrollEnabled
      >
        {bodyNode}
      </ScrollView>

      {feedbackNode ? (
        <ScrollView
          maxHeight={feedbackMaxHeight}
          mx="$-5"
          px="$5"
          nestedScrollEnabled
        >
          {feedbackNode}
        </ScrollView>
      ) : null}
    </>
  );
  const onConfirmText = needsApproval
    ? intl.formatMessage({ id: ETranslations.global_approve })
    : actionLabel;
  const confirmButtonProps = {
    disabled: confirmDisabled,
    loading:
      approveLoading ||
      actionResult.checkAmountLoading ||
      submitting ||
      isBorrowDataLoading ||
      isRepayWalletBalancePending,
  };

  if (renderMode === 'page') {
    return (
      <>
        <Page.Header title={actionLabel} />
        <Page.Body>
          <ScrollView flex={1} nestedScrollEnabled>
            <YStack p="$5" gap="$5">
              {bodyNode}
              {feedbackNode}
            </YStack>
          </ScrollView>
        </Page.Body>
        <Page.Footer>
          <YStack bg="$bgApp">
            <Page.FooterActions
              onConfirmText={onConfirmText}
              onConfirm={(close) => {
                void handleFooterConfirm({
                  close,
                  preventClose: () => undefined,
                });
              }}
              confirmButtonProps={confirmButtonProps}
            />
            <ProtocolPositionActionKeyboardDismissFooter />
          </YStack>
        </Page.Footer>
      </>
    );
  }

  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {contentNode}
      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        onConfirmText={onConfirmText}
        onConfirm={handleFooterConfirm}
        confirmButtonProps={confirmButtonProps}
        extraContent={<ProtocolPositionActionKeyboardDismissFooter />}
      />
    </YStack>
  );
}

function ProtocolLendingActionContent({
  accountId,
  networkId,
  actionType,
  source,
  hasDebts,
  onSuccess,
  renderMode = 'dialog',
}: Omit<IShowProtocolLendingActionDialogParams, 'dialog'> & {
  renderMode?: 'dialog' | 'page';
}) {
  return source.type === 'borrow' ? (
    <ProtocolLendingActionBorrowContent
      accountId={accountId}
      networkId={networkId}
      actionType={actionType}
      source={source}
      hasDebts={hasDebts}
      onSuccess={onSuccess}
      renderMode={renderMode}
    />
  ) : (
    <ProtocolLendingActionDefiContent
      accountId={accountId}
      networkId={networkId}
      actionType={actionType}
      source={source}
      hasDebts={hasDebts}
      onSuccess={onSuccess}
      renderMode={renderMode}
    />
  );
}

function showProtocolLendingActionDialog({
  dialog,
  ...params
}: IShowProtocolLendingActionDialogParams) {
  const DialogInstance = dialog ?? Dialog;
  DialogInstance.show({
    showFooter: false,
    renderContent: <ProtocolLendingActionContent {...params} />,
  });
}

export { ProtocolLendingActionContent, showProtocolLendingActionDialog };
export type {
  IProtocolLendingActionSource,
  IProtocolLendingActionType,
  IShowProtocolLendingActionDialogParams,
};
