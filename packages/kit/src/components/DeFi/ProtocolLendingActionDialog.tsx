import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  ButtonFrame,
  Dialog,
  Icon,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
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
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useManagePage } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  EDeFiPositionAction,
  type IResolvedDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  EBorrowActionsEnum,
  EEarnLabels,
  EManagePositionType,
  type IBorrowAsset,
  type IBorrowAssetsList,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  resolveProtocolLendingDefiFillableAmountState,
  resolveProtocolLendingRepayAmountState,
} from './protocolLendingActionUtils';
import {
  type IProtocolPositionActionSuccessParams,
  ProtocolPositionActionAmountInput,
  ProtocolPositionActionAnchor,
  clampAmountDecimals,
  getActionLabel,
  getErrorMessage,
  isUserRejectedErrorMessage,
  useProtocolPositionActionSubmit,
} from './ProtocolPositionActionDialog';

// Withdraw/Repay only — the portfolio dialog is exit-side (Supply/Borrow stay on
// the full manage page).
type IProtocolLendingActionType = 'withdraw' | 'repay';

// `defi` reuses the resolved-action build path (Compound/Morpho/...); `borrow`
// drives the Aave manage hooks (simulation, health factor, approve). `selectable`
// false = a desktop row already named the asset, so no dropdown / assets fetch.
type IProtocolLendingActionSource =
  | { type: 'defi'; action: IResolvedDeFiPositionAction }
  | {
      type: 'borrow';
      provider: string;
      marketAddress: string;
      reserveAddress: string;
      symbol: string;
      logoURI?: string;
      providerDisplayName?: string;
      providerLogoURI?: string;
      indexedAccountId?: string;
      selectable: boolean;
    };

// Normalized selector-row data, source-agnostic so the row/popover is shared.
type ILendingSelectorItem = {
  key: string;
  symbol: string;
  logoURI?: string;
  balanceText: string;
  descriptionText?: string;
};

const LENDING_PERCENT_PRESETS = [25, 50, 75, 100] as const;

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

// The asset row at the top of the dialog. In `selectable` mode it is the trigger
// for a popover that lists every asset (supplied for withdraw, borrowed for
// repay) — the semantics of Borrow's asset-select popover. Fixed mode renders
// the plain row with no affordance.
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

  const rowInner = (
    <>
      <LendingSelectorRowContent item={item} />
      {selectable ? (
        <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
      ) : null}
    </>
  );

  if (!selectable) {
    return (
      <XStack
        alignItems="center"
        gap="$2"
        px="$3"
        py="$2.5"
        borderRadius="$3"
        bg="$bgSubdued"
      >
        {rowInner}
      </XStack>
    );
  }

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.token_selector_title })}
      renderTrigger={
        // ButtonFrame renders as a native <button> on web, so the asset picker
        // is keyboard-focusable and Enter/Space opens it — a plain onPress
        // XStack was mouse-only.
        <ButtonFrame
          alignItems="center"
          justifyContent="flex-start"
          gap="$2"
          px="$3"
          py="$2.5"
          borderWidth={0}
          borderRadius="$3"
          bg="$bgSubdued"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          focusable
          focusVisibleStyle={LENDING_SELECTOR_FOCUS_STYLE}
        >
          {rowInner}
        </ButtonFrame>
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
  );
}

// Shared exit-side warning + inline error block. `hasDebts` withdraws surface the
// liquidation note; a build/submit failure renders in the critical slot the same
// way the generic portfolio dialog does.
function LendingActionAlerts({
  showLiquidationWarning,
  errorMessage,
}: {
  showLiquidationWarning: boolean;
  errorMessage?: string;
}) {
  const intl = useIntl();
  return (
    <>
      {showLiquidationWarning ? (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          description={intl.formatMessage({
            id: ETranslations.defi_liquidation_withdraw_desc,
          })}
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
    </>
  );
}

function ProtocolLendingActionDefiContent({
  accountId,
  networkId,
  actionType,
  source,
  hasDebts,
  onSuccess,
}: {
  accountId: string;
  networkId: string;
  actionType: IProtocolLendingActionType;
  source: Extract<IProtocolLendingActionSource, { type: 'defi' }>;
  hasDebts?: boolean;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
}) {
  const intl = useIntl();
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
  const { result: repayWalletBalance } = usePromiseResult(async () => {
    if (!isRepay || repayTokenAddress === undefined) return undefined;
    const details = await backgroundApiProxy.serviceToken.fetchTokensDetails({
      accountId,
      networkId,
      contractList: [repayTokenAddress],
    });
    return details?.[0]?.balanceParsed;
  }, [accountId, isRepay, networkId, repayTokenAddress]);

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
    if (!isRepayWalletBalanceReady) return;
    hasUserSetMaxRef.current = true;
    setAmount(clampAmountDecimals(fillableMax, amountDecimals));
    setIsMaxAmount(isFillableMaxFullClose);
  };

  const handleSelectPercent = (percent: number) => {
    // Max routes through handleMaxAmount so a full close still submits bps=10000
    // (no dust); 25/50/75 fill an exact token amount of the fillable max.
    if (!isRepayWalletBalanceReady) return;
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
    if (!selectedAsset) {
      preventClose();
      return;
    }
    setSubmitError(undefined);
    // Keep the dialog open while the server builds the tx (button shows
    // loading); close it right before any signing/tx-confirm modal opens so the
    // old dialog doesn't stack above the confirm page.
    let isActionDialogClosed = false;
    try {
      await submitProtocolPositionAction({
        action: source.action,
        selectedAssets: [selectedAsset],
        amount,
        isMaxAmount,
        isErrorToastSuppressed: () => !isActionDialogClosed,
        onBeforeNavigateConfirm: () => {
          if (isActionDialogClosed) return;
          isActionDialogClosed = true;
          // Fire the close without awaiting it — Dialog.close resolves on a
          // fixed 300ms teardown timer that would delay tx-confirm opening.
          void close?.();
        },
      });
    } catch (error) {
      if (
        !isActionDialogClosed &&
        !isUserRejectedErrorMessage({ error, intl })
      ) {
        setSubmitError(getErrorMessage(error));
      }
      preventClose();
    }
  };

  const actionLabel = getActionLabel({
    action: LENDING_ACTION_TO_DEFI_ACTION[actionType],
    intl,
  });
  const availableLabel = intl.formatMessage({
    id: ETranslations.global_available,
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
    !selectedAsset || !isAmountValid || !isRepayWalletBalanceReady;

  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {selectedAsset && selectedItem ? (
        <>
          <LendingAssetSelectorRow
            item={selectedItem}
            items={selectorItems}
            selectable={selectable}
            onSelect={handleSelectAsset}
            columnHeaderLabel={columnHeaderLabel}
          />
          <ProtocolPositionActionAmountInput
            amount={amount}
            onChangeAmount={handleAmountChange}
            onSelectPercent={handleSelectPercent}
            selectedPercent={selectedAmountPercent}
            symbol={selectedAsset.symbol}
            tokenLogoUrl={selectedAsset.asset.meta?.logoUrl}
            availableAmount={availableAmount}
            fiatValue={amountFiatValue}
            currencySymbol={currencySymbol}
            isInsufficient={isAmountInsufficient}
            availableLabel={availableLabel}
            maxLabel={maxLabel}
            insufficientLabel={insufficientLabel}
            onFocus={handleAmountInputFocus}
          />
        </>
      ) : (
        <YStack py="$6" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_select_crypto })}
          </SizableText>
        </YStack>
      )}

      <LendingActionAlerts
        showLiquidationWarning={Boolean(hasDebts) && isWithdraw}
        errorMessage={submitError}
      />

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        onConfirmText={actionLabel}
        onConfirm={handleConfirm}
        confirmButtonProps={{ disabled: isConfirmDisabled }}
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
}: {
  accountId: string;
  networkId: string;
  actionType: IProtocolLendingActionType;
  source: Extract<IProtocolLendingActionSource, { type: 'borrow' }>;
  hasDebts?: boolean;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
}) {
  const intl = useIntl();
  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();
  const isWithdraw = actionType === 'withdraw';

  const [reserveAddress, setReserveAddress] = useState(source.reserveAddress);

  // Fixed mode (a desktop row already named the asset) skips the fetch — the
  // dropdown is only for the position-level entry.
  const { result: assetsList, isLoading: assetsLoading } = usePromiseResult(
    async (): Promise<IBorrowAssetsList> => {
      if (!source.selectable) return { assets: [] };
      return backgroundApiProxy.serviceStaking.getBorrowAssetsList({
        accountId,
        networkId,
        provider: source.provider,
        marketAddress: source.marketAddress,
        action: LENDING_ACTION_TO_BORROW_ACTION[actionType],
      });
    },
    [
      accountId,
      networkId,
      actionType,
      source.selectable,
      source.provider,
      source.marketAddress,
    ],
    { initResult: { assets: [] as IBorrowAsset[] }, watchLoading: true },
  );
  const selectedBorrowAsset = assetsList.assets.find(
    (item) => item.reserveAddress === reserveAddress,
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
          selectedBorrowAsset.supplied?.title?.text)
        : (selectedBorrowAsset.borrowed?.number ??
          selectedBorrowAsset.borrowed?.title?.text)) ?? '0')
    : (protocolInfo?.activeBalance ?? '0');
  // For repay the outstanding DEBT is NOT effectiveBalance: in fixed mode
  // effectiveBalance is the manage-page repay.balance, which is the WALLET
  // balance. Take the debt from the same fields the manage page's full-repay
  // uses — the selected asset's borrowed amount (dropdown) or the dedicated
  // debtBalance (fixed), falling back to maxRepayBalance so a missing debtBalance
  // never collapses the reference to 0 (which would zero out Max/percent).
  const debtText = selectedBorrowAsset
    ? (selectedBorrowAsset.borrowed?.number ??
      selectedBorrowAsset.borrowed?.title?.text)
    : (protocolInfo?.debtBalance ?? protocolInfo?.maxRepayBalance);
  // The exit-side balance shown in the hero anchor and used as the full-close
  // target: supplied collateral for withdraw, the outstanding debt for repay.
  const referenceBalance = isWithdraw ? effectiveBalance : (debtText ?? '0');

  const [amount, setAmount] = useState('');
  // Withdraw with an open loan starts at 0, not Max: pulling collateral against
  // a debt lowers the health factor, so the full-balance default is the risky
  // path and must be a deliberate choice. Debt-free withdraw still defaults Max.
  const [isMaxAmount, setIsMaxAmount] = useState(isWithdraw && !hasDebts);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  // Footer confirm loading is overridden by confirmButtonProps and released
  // early by preventClose(), so the dialog owns the build spinner and guard.
  const [submitting, setSubmitting] = useState(false);
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
  const { result: repayWalletBalance } = usePromiseResult(async () => {
    if (isWithdraw || repayTokenAddress === undefined) return undefined;
    const details = await backgroundApiProxy.serviceToken.fetchTokensDetails({
      accountId,
      networkId,
      contractList: [repayTokenAddress],
    });
    return details?.[0]?.balanceParsed;
  }, [accountId, isWithdraw, networkId, repayTokenAddress]);
  // Show the wallet balance for repay whenever it has resolved — it tells the
  // user whether they can fully close the loan and why Max may cap below the debt.
  const walletBalanceText = isWithdraw ? undefined : repayWalletBalance;
  const repayAllTargetAmount = selectedBorrowAsset
    ? (selectedBorrowAsset.borrowed?.number ??
      selectedBorrowAsset.borrowed?.amount)
    : protocolInfo?.debtBalance;
  const repayAmountState = resolveProtocolLendingRepayAmountState({
    amount,
    referenceBalance,
    maxRepayBalance: protocolInfo?.maxRepayBalance,
    repayWalletBalance,
    repayAllTargetAmount,
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
    !isWithdraw && repayAmountState.isAmountInsufficient;
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
    hasUserTouchedRef.current = true;
    setAmount(clampAmountDecimals(valueForMax, effectiveDecimals));
    setIsMaxAmount(true);
  };
  const handleSelectPercent = (percent: number) => {
    // A full close (amount === debt/supplied balance) maps to
    // withdrawAll/repayAll via isFullClose; 25/50/75 fill an exact token
    // amount of the actionable max (wallet-capped for fixed-mode repay).
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
  const isBorrowDialogClosedRef = useRef(false);

  // The dialog stays open (confirm button spinning) while the server builds
  // the tx; onBeforeNavigate closes it right as tx-confirm opens, so a build
  // failure lands as an inline alert with the user's input intact.
  const submitBorrowTx = useCallback(async () => {
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
    const protocolLabel = earnUtils.getEarnProviderName({
      providerName: source.providerDisplayName ?? provider,
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
          void onSuccess?.({ accountId, networkId, data });
        },
        onBeforeNavigate: () => {
          if (isBorrowDialogClosedRef.current) return;
          isBorrowDialogClosedRef.current = true;
          // Fire the close without awaiting it: Dialog.close resolves on a
          // fixed 300ms teardown timer, which would sit serially between the
          // build response and tx-confirm opening.
          void closeRef.current?.();
        },
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
        void onSuccess?.({ accountId, networkId, data });
      },
      onBeforeNavigate: () => {
        if (isBorrowDialogClosedRef.current) return;
        isBorrowDialogClosedRef.current = true;
        // Same as the repay call: don't serially pay Dialog.close's 300ms
        // teardown timer before tx-confirm opens.
        void closeRef.current?.();
      },
    });
  }, [
    accountId,
    actionType,
    amount,
    effectiveToken,
    handleBorrowRepay,
    handleBorrowWithdraw,
    isFullClose,
    networkId,
    onSuccess,
    protocolInfo?.providerDetail.logoURI,
    protocolInfo?.stakeTag,
    reserveAddress,
    source,
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
    });

  const handleFooterConfirm = async ({
    close,
    preventClose,
  }: {
    close?: () => void | Promise<void>;
    preventClose: () => void;
  }) => {
    closeRef.current = close;
    isBorrowDialogClosedRef.current = false;
    // We own the close timing: onBeforeNavigate closes right before the
    // tx-confirm page opens, and the approve hop keeps the dialog open until
    // it auto-submits.
    preventClose();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      if (needsApproval) {
        await onApprove();
        return;
      }
      await submitBorrowTx();
    } catch (error) {
      if (!isUserRejectedErrorMessage({ error, intl })) {
        const errorMessage = getErrorMessage(error);
        if (isBorrowDialogClosedRef.current) {
          Toast.error({ title: errorMessage });
        } else {
          setSubmitError(errorMessage);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const actionLabel = getActionLabel({
    action: LENDING_ACTION_TO_DEFI_ACTION[actionType],
    intl,
  });
  // Withdraw's anchor shows the suppliable "Available" balance; repay's shows the
  // "Remaining debt" being paid down (matches the manage page), with the wallet
  // balance as the secondary line beneath it.
  const availableLabel = intl.formatMessage({
    id: isWithdraw
      ? ETranslations.global_available
      : ETranslations.defi_borrow_repay_remaining_debt,
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

  const healthFactor = actionResult.transactionConfirmation?.healthFactor;
  const confirmDisabled =
    !isAmountPositive ||
    isAmountInsufficient ||
    actionResult.isCheckAmountMessageError ||
    actionResult.checkAmountResult === false ||
    actionResult.checkAmountLoading;
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
  const isBusy = manageLoading || (source.selectable && assetsLoading);
  if (!isBusy) {
    hasLoadedOnceRef.current = true;
  }
  const isInitialLoading = !hasLoadedOnceRef.current;

  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {isInitialLoading ? (
        <YStack gap="$5">
          {source.selectable ? (
            <Skeleton height="$11" width="100%" borderRadius="$3" />
          ) : null}
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
          {selectable ? (
            <LendingAssetSelectorRow
              item={selectedItem}
              items={selectorItems}
              selectable={selectable}
              onSelect={handleSelectAsset}
              columnHeaderLabel={columnHeaderLabel}
            />
          ) : null}
          <ProtocolPositionActionAmountInput
            amount={amount}
            onChangeAmount={handleAmountChange}
            onSelectPercent={handleSelectPercent}
            selectedPercent={selectedAmountPercent}
            symbol={effectiveSymbol}
            tokenLogoUrl={effectiveLogo}
            availableAmount={referenceBalance}
            fiatValue={amountFiatValue}
            currencySymbol={currencySymbol}
            isInsufficient={isAmountInsufficient}
            availableLabel={availableLabel}
            maxLabel={maxLabel}
            insufficientLabel={insufficientLabel}
            onFocus={handleAmountInputFocus}
            secondaryLabel={walletBalanceLabel}
            secondaryAmount={walletBalanceText}
          />
          {healthFactor ? (
            <YStack gap="$1">
              <ProtocolPositionActionAnchor
                label={intl.formatMessage({
                  id: ETranslations.defi_health_factor,
                })}
                iconNode={null}
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
          {/* Health factor arrives on the (separate) simulate stream after the
              amount is set — reserve its exact height with a skeleton so the
              dialog doesn't grow when it lands. Reuses the same anchor + label
              so the row height matches the loaded state byte-for-byte. */}
          {!healthFactor &&
          isAmountPositive &&
          !actionResult.transactionConfirmation ? (
            <YStack gap="$1">
              <ProtocolPositionActionAnchor
                label={intl.formatMessage({
                  id: ETranslations.defi_health_factor,
                })}
                iconNode={null}
                valueNode={
                  <Skeleton height="$4" width="$16" borderRadius="$1" />
                }
              />
              <XStack justifyContent="flex-end">
                <Skeleton height="$4" width="$24" borderRadius="$1" />
              </XStack>
            </YStack>
          ) : null}
        </>
      ) : null}

      {!isInitialLoading ? (
        <LendingActionAlerts
          showLiquidationWarning={Boolean(hasDebts) && isWithdraw}
          errorMessage={
            submitError ??
            (actionResult.isCheckAmountMessageError
              ? actionResult.checkAmountMessage
              : undefined)
          }
        />
      ) : null}
      {/* Server checkAmountAlerts are intentionally NOT rendered here: for the
          withdraw-with-debt case they duplicate the always-on client
          liquidation warning above (same copy), popping in after the
          checkAmount request and jumping the dialog height. The manage page
          keeps rendering them. */}

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        onConfirmText={
          needsApproval
            ? intl.formatMessage({ id: ETranslations.global_approve })
            : actionLabel
        }
        onConfirm={handleFooterConfirm}
        confirmButtonProps={{
          disabled: confirmDisabled,
          loading:
            approveLoading || actionResult.checkAmountLoading || submitting,
        }}
      />
    </YStack>
  );
}

function showProtocolLendingActionDialog({
  accountId,
  networkId,
  actionType,
  source,
  hasDebts,
  onSuccess,
}: {
  accountId: string;
  networkId: string;
  actionType: IProtocolLendingActionType;
  source: IProtocolLendingActionSource;
  hasDebts?: boolean;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
}) {
  Dialog.show({
    showFooter: false,
    renderContent:
      source.type === 'borrow' ? (
        <ProtocolLendingActionBorrowContent
          accountId={accountId}
          networkId={networkId}
          actionType={actionType}
          source={source}
          hasDebts={hasDebts}
          onSuccess={onSuccess}
        />
      ) : (
        <ProtocolLendingActionDefiContent
          accountId={accountId}
          networkId={networkId}
          actionType={actionType}
          source={source}
          hasDebts={hasDebts}
          onSuccess={onSuccess}
        />
      ),
  });
}

export { showProtocolLendingActionDialog };
export type { IProtocolLendingActionSource, IProtocolLendingActionType };
