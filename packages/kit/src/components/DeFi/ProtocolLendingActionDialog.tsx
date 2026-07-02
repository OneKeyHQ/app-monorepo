import { useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  EDeFiPositionAction,
  type IResolvedDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';

import {
  type IProtocolPositionActionSuccessParams,
  ProtocolPositionActionAmountInput,
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

const LENDING_ACTION_TO_DEFI_ACTION: Record<
  IProtocolLendingActionType,
  EDeFiPositionAction
> = {
  withdraw: EDeFiPositionAction.Withdraw,
  repay: EDeFiPositionAction.Repay,
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

  const row = (
    <XStack
      alignItems="center"
      gap="$2"
      px="$3"
      py="$2.5"
      borderRadius="$3"
      bg="$bgSubdued"
    >
      <LendingSelectorRowContent item={item} />
      {selectable ? (
        <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
      ) : null}
    </XStack>
  );

  if (!selectable) {
    return row;
  }

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.token_selector_title })}
      renderTrigger={<Stack cursor="pointer">{row}</Stack>}
      renderContent={({ closePopover }) => (
        <YStack p="$2">
          <XStack px="$3" pb="$1">
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {columnHeaderLabel}
            </SizableText>
          </XStack>
          {items.map((selectorItem) => {
            const isSelected = selectorItem.key === item.key;
            return (
              <XStack
                key={selectorItem.key}
                alignItems="center"
                gap="$2"
                px="$3"
                py="$2"
                borderRadius="$2"
                bg={isSelected ? '$bgHover' : undefined}
                hoverStyle={isSelected ? undefined : { bg: '$bgHover' }}
                pressStyle={isSelected ? undefined : { bg: '$bgActive' }}
                cursor={isSelected ? 'default' : 'pointer'}
                onPress={
                  isSelected
                    ? undefined
                    : () => {
                        onSelect(selectorItem.key);
                        closePopover();
                      }
                }
              >
                <LendingSelectorRowContent item={selectorItem} />
              </XStack>
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

  // Highlight a preset only when the typed amount lands exactly on it (Max →
  // 100%); a free-typed amount highlights nothing.
  let selectedAmountPercent = 0;
  if (isMaxAmount) {
    selectedAmountPercent = 100;
  } else if (isAmountPositive && availableBN.gt(0)) {
    const pct = amountBN.div(availableBN).multipliedBy(100);
    selectedAmountPercent =
      LENDING_PERCENT_PRESETS.find((preset) =>
        pct.minus(preset).abs().lt(0.5),
      ) ?? 0;
  }

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
    hasUserSetMaxRef.current = true;
    setAmount(clampAmountDecimals(availableAmount, amountDecimals));
    setIsMaxAmount(true);
  };

  const handleSelectPercent = (percent: number) => {
    // Max routes through handleMaxAmount so a full close still submits bps=10000
    // (no dust); 25/50/75 fill an exact token amount.
    if (percent >= 100) {
      handleMaxAmount();
      return;
    }
    const next = availableBN.multipliedBy(percent).div(100);
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
        onBeforeNavigateConfirm: async () => {
          if (isActionDialogClosed) return;
          isActionDialogClosed = true;
          await close?.();
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
  const isConfirmDisabled = !selectedAsset || !isAmountValid;

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

// Placeholder so the dispatcher can narrow the discriminated `source` and the
// file compiles. ponytail: the full Aave borrow flow (dropdown data, health
// factor preview, approve, build) lands in the follow-up commit and replaces
// this body.
function ProtocolLendingActionBorrowContent({
  actionType,
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
  const actionLabel = getActionLabel({
    action: LENDING_ACTION_TO_DEFI_ACTION[actionType],
    intl,
  });
  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>
      <YStack py="$6" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_select_crypto })}
        </SizableText>
      </YStack>
      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        onConfirmText={actionLabel}
        confirmButtonProps={{ disabled: true }}
        onConfirm={({ preventClose }) => {
          preventClose();
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
