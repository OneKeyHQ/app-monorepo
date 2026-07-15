import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Input,
  Keyboard,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useIsKeyboardShown,
  useMedia,
} from '@onekeyhq/components';
import type { useInPageDialog } from '@onekeyhq/components';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { SendAutoSizeAmountInput } from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  buildDeFiActionBps,
  resolveDeFiActionTxAmount,
} from '@onekeyhq/shared/src/utils/defiActionUtils';
import defiPermitUtils from '@onekeyhq/shared/src/utils/defiPermitUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  DEFI_PORTFOLIO_ACTION_STAKING_TAG,
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
  type IDeFiActionTxConfirmInfo,
  type IDeFiAsset,
  type IResolvedDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  type IDeFiActionTxConfirmDialogResult,
  showDeFiActionTxConfirmDialog,
} from './DeFiActionTxConfirmResult';
import { resolveProtocolLendingDefiFillableAmountState } from './protocolLendingActionUtils';
import {
  resolveProtocolPositionActionAssetBalanceLabel,
  resolveProtocolPositionActionAssetPill,
} from './protocolPositionActionAssetUtils';
import { shouldShowProtocolPositionActionInlineSubmitError } from './protocolPositionActionErrorUtils';
import { resolveProtocolPositionActionDialogLayout } from './protocolPositionActionLayoutUtils';
import {
  getProtocolPositionActionPercentInputMaxLength,
  resolveProtocolPositionActionPercentInput,
  resolveProtocolPositionActionPercentKeyPress,
  resolveProtocolPositionActionPercentValue,
  shouldClearProtocolPositionActionInitialPercentValue,
} from './protocolPositionActionPercentUtils';
import { ProtocolPositionAssetPill } from './ProtocolPositionAssetPill';
import {
  ProtocolValueCell,
  isProtocolAssetValueUnavailable,
} from './ProtocolValueCell';

const DEFAULT_ACTION_PERCENT = 100;
const PERCENTAGE_PRESET_VALUES = [25, 50, 75, 100] as const;

type IRepayWalletBalanceLoadState = {
  balance?: string;
  errorMessage?: string;
};

// Both action heroes (typed-amount and percentage) reserve this height and
// center their content, so the Dialog stays the same size in either mode and
// never resizes as the typed amount changes length. 128px matches the
// percentage hero's natural height ($heading5xl value + fiat row + $6 breathing).
const DEFI_ACTION_HERO_MIN_HEIGHT = 128;

// Cap the typed-amount font to the percentage hero's $heading5xl (40px) so the
// two heroes read as one, and so a short amount can't grow past the reserved
// height (SendAutoSizeAmountInput otherwise ramps up to ~84px on desktop).
const MANUAL_AMOUNT_INPUT_MAX_FONT_SIZE = 40;
const resolveActionTxAmount = resolveDeFiActionTxAmount as (params: {
  percentageAction: boolean;
  percent?: number;
  amount?: string;
  isMaxAmount?: boolean;
}) => { amount?: string; bps?: string };

export function ProtocolPositionActionKeyboardDismissFooter() {
  const intl = useIntl();
  const isKeyboardShown = useIsKeyboardShown();

  if (!platformEnv.isNativeIOS || !isKeyboardShown) return null;

  return (
    <XStack
      p="$2.5"
      px="$5"
      justifyContent="flex-end"
      bg="$bgSubdued"
      borderTopWidth="$px"
      borderTopColor="$borderSubduedLight"
    >
      <Button
        variant="tertiary"
        testID="defi-action-keyboard-done-btn"
        onPress={Keyboard.dismiss}
      >
        {intl.formatMessage({ id: ETranslations.global_done })}
      </Button>
    </XStack>
  );
}

function normalizeActionPercent(percent?: number) {
  if (!Number.isFinite(percent)) return DEFAULT_ACTION_PERCENT;
  return Math.max(
    0,
    Math.min(100, Math.round(percent ?? DEFAULT_ACTION_PERCENT)),
  );
}

function isPercentageAction(action: EDeFiPositionAction) {
  return (
    action === EDeFiPositionAction.Withdraw ||
    action === EDeFiPositionAction.Repay ||
    action === EDeFiPositionAction.RemoveLiquidity
  );
}

function getActionLabel({
  action,
  intl,
  hasRewards = false,
}: {
  action: EDeFiPositionAction;
  intl: ReturnType<typeof useIntl>;
  // Remove-liquidity only "& Claim rewards" when the position holds rewards;
  // a plain LP with no rewards stays "Remove".
  hasRewards?: boolean;
}) {
  if (action === EDeFiPositionAction.Withdraw) {
    return intl.formatMessage({ id: ETranslations.global_withdraw });
  }
  if (action === EDeFiPositionAction.Repay) {
    return intl.formatMessage({ id: ETranslations.defi_repay });
  }
  if (action === EDeFiPositionAction.Claim) {
    return intl.formatMessage({ id: ETranslations.earn_claim });
  }
  if (action === EDeFiPositionAction.ClaimWithdrawal) {
    return intl.formatMessage({ id: ETranslations.earn_claim });
  }
  if (action === EDeFiPositionAction.RemoveLiquidity) {
    return intl.formatMessage({
      id: hasRewards
        ? ETranslations.earn_remove_and_claim_rewards__action
        : ETranslations.dexmarket_details_liquidity_change_remove,
    });
  }
  return action;
}

function getActionAssetExtraLabel(asset: IResolvedDeFiPositionActionAsset) {
  const tokenId = asset.extraParams?.tokenId?.trim();
  if (tokenId) return `#${tokenId}`;
  return undefined;
}

function getActionExtraLabel({
  action,
  asset,
  percent,
  hidePercent,
}: {
  action: EDeFiPositionAction;
  asset: IResolvedDeFiPositionActionAsset;
  percent?: number;
  // A manual amount entry already shows the exact quantity, so the "%" tag would
  // be misleading — suppress it.
  hidePercent?: boolean;
}) {
  const labels = [
    getActionAssetExtraLabel(asset),
    isPercentageAction(action) && !hidePercent
      ? `${normalizeActionPercent(percent)}%`
      : undefined,
  ].filter((label): label is string => Boolean(label));

  return labels.length > 0 ? labels.join(' / ') : undefined;
}

type IProtocolPositionActionPreviewAsset = {
  asset: IDeFiAsset;
  amount: string;
  symbol: string;
  value: number;
  metaLabel?: string;
  minAmount?: string;
};

function getPercentScale(percent?: number) {
  return new BigNumber(normalizeActionPercent(percent)).div(100);
}

function scaleAmountByPercent(amount: string, percent?: number) {
  const amountBN = new BigNumber(amount);
  if (!amountBN.isFinite()) return '0';
  return amountBN.multipliedBy(getPercentScale(percent)).toFixed();
}

function scaleValueByPercent(value: number, percent?: number) {
  if (!Number.isFinite(value)) return 0;
  return new BigNumber(value).multipliedBy(getPercentScale(percent)).toNumber();
}

// Floor an amount to the token's decimals, following the Send convention
// (SendAmountInputContainer uses BigNumber.ROUND_FLOOR). Used to seed the Max /
// default value cleanly; live typing is gated by validateAmountInput.
function clampAmountDecimals(amount: string, decimals?: number) {
  const amountBN = new BigNumber(amount);
  if (!amountBN.isFinite()) return '';
  if (
    decimals !== undefined &&
    Number.isInteger(decimals) &&
    decimals >= 0 &&
    (amountBN.decimalPlaces() ?? 0) > decimals
  ) {
    return amountBN.toFixed(decimals, BigNumber.ROUND_FLOOR);
  }
  return amountBN.toFixed();
}

function getOutputPreviewSourceAssets({
  action,
  selectedAsset,
}: {
  action: EDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
}) {
  if (
    action === EDeFiPositionAction.RemoveLiquidity &&
    selectedAsset.underlyingAssets?.length
  ) {
    return selectedAsset.underlyingAssets;
  }
  return [selectedAsset.asset];
}

function buildSelectedAssetPreviewAssets({
  action,
  selectedAsset,
  percent,
}: {
  action: EDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
  percent?: number;
}): IProtocolPositionActionPreviewAsset[] {
  const isPercentAction = isPercentageAction(action);
  const sourceAssets = getOutputPreviewSourceAssets({ action, selectedAsset });
  // Uniswap-style removes carry human-decimal slippage floors positionally:
  // amount0Min -> underlyingAssets[0], amount1Min -> underlyingAssets[1].
  // The underlying list is positive-amount filtered, so positional trust
  // requires exactly the pool's two tokens to be present.
  const minAmounts =
    action === EDeFiPositionAction.RemoveLiquidity && sourceAssets.length === 2
      ? [
          getPositiveAmount(selectedAsset.extraParams?.amount0Min),
          getPositiveAmount(selectedAsset.extraParams?.amount1Min),
        ]
      : [];
  return sourceAssets.map((asset, index) => {
    const minAmount = minAmounts[index];
    return {
      asset,
      amount: isPercentAction
        ? scaleAmountByPercent(asset.amount, percent)
        : asset.amount,
      symbol: asset.symbol,
      value: isPercentAction
        ? scaleValueByPercent(asset.value, percent)
        : asset.value,
      minAmount:
        isPercentAction && minAmount
          ? getPositiveAmount(scaleAmountByPercent(minAmount, percent))
          : minAmount,
    };
  });
}

function getPreviewAssetKey(asset: IProtocolPositionActionPreviewAsset) {
  const address = asset.asset.address.trim().toLowerCase();
  return address || asset.symbol.trim().toLowerCase();
}

function aggregatePreviewAssets(assets: IProtocolPositionActionPreviewAsset[]) {
  const result: IProtocolPositionActionPreviewAsset[] = [];
  const indexByKey = new Map<string, number>();

  assets.forEach((asset) => {
    const key = getPreviewAssetKey(asset);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push({ ...asset, metaLabel: undefined });
      return;
    }

    const existing = result[existingIndex];
    const amount = new BigNumber(existing.amount).plus(asset.amount);
    const value = existing.value + asset.value;
    result[existingIndex] = {
      ...existing,
      // A merged row sums amounts across pools; a single pool's floor no
      // longer applies, so it is dropped rather than shown misleadingly.
      minAmount: undefined,
      amount: amount.isFinite() ? amount.toFixed() : existing.amount,
      value,
      asset: {
        ...existing.asset,
        amount: amount.isFinite() ? amount.toFixed() : existing.asset.amount,
        value,
      },
    };
  });

  return result;
}

function getPreviewAssetsValueState(
  assets: IProtocolPositionActionPreviewAsset[],
) {
  let value = 0;
  let hasAvailableValue = false;
  let hasUnavailableValue = false;

  assets.forEach((item) => {
    if (isProtocolAssetValueUnavailable(item.asset)) {
      hasUnavailableValue = true;
      return;
    }

    value += item.value;
    hasAvailableValue = true;
  });

  return {
    value,
    isUnavailable: !hasAvailableValue && hasUnavailableValue,
    showPriceUnavailableTooltip: hasAvailableValue && hasUnavailableValue,
  };
}

function getSelectedAssetDisplaySymbol({
  action,
  selectedAsset,
}: {
  action: EDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
}) {
  return resolveProtocolPositionActionAssetPill({
    action,
    selectedAsset,
  }).symbol;
}

function ProtocolPositionActionAssetRow({
  action,
  asset,
  index,
  isSelected,
  selectable,
  currencySymbol,
  priceUnavailableLabel,
  onSelect,
}: {
  action: EDeFiPositionAction;
  asset: IResolvedDeFiPositionActionAsset;
  index: number;
  isSelected: boolean;
  selectable: boolean;
  currencySymbol: string;
  priceUnavailableLabel: string;
  onSelect: (index: number, selected: boolean) => void;
}) {
  const intl = useIntl();
  const extraLabel = getActionExtraLabel({ action, asset });
  const displaySymbol = getSelectedAssetDisplaySymbol({
    action,
    selectedAsset: asset,
  });
  const isLiquidityPosition =
    action === EDeFiPositionAction.RemoveLiquidity &&
    (asset.underlyingAssets?.length ?? 0) > 1;

  return (
    <XStack
      testID={`defi-position-action-asset-${index}`}
      alignItems="center"
      gap="$3"
      py="$3"
      px="$3"
      borderRadius="$3"
      bg={isSelected ? '$bgActive' : '$bgSubdued'}
      borderWidth="$px"
      borderColor={isSelected ? '$borderActive' : '$borderSubdued'}
      cursor={selectable ? 'pointer' : 'default'}
      userSelect="none"
      {...(selectable && {
        hoverStyle: { bg: isSelected ? '$bgActive' : '$bgStrong' },
        pressStyle: { bg: isSelected ? '$bgActive' : '$bgStrong' },
      })}
      onPress={() => {
        if (selectable) {
          onSelect(index, !isSelected);
        }
      }}
    >
      <Token
        size="md"
        tokenImageUri={asset.asset.meta?.logoUrl}
        bg="$bgStrong"
      />
      <YStack flex={1} minWidth={0} justifyContent="center" gap="$0.5">
        {isLiquidityPosition ? (
          <>
            <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
              {intl.formatMessage({ id: ETranslations.global_liquidity })}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {displaySymbol}
            </SizableText>
          </>
        ) : (
          <XStack alignItems="center" gap="$1" minWidth={0}>
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyMdMedium"
              formatter="balance"
              numberOfLines={1}
            >
              {asset.amount}
            </NumberSizeableTextWrapper>
            <SizableText
              size="$bodyMdMedium"
              color="$text"
              numberOfLines={1}
              flexShrink={1}
            >
              {displaySymbol}
            </SizableText>
          </XStack>
        )}
        <ProtocolValueCell
          value={asset.asset.value}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          isUnavailable={isProtocolAssetValueUnavailable(asset.asset)}
          justifyContent="flex-start"
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
        />
        {extraLabel ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {extraLabel}
          </SizableText>
        ) : null}
      </YStack>
      {selectable ? (
        <Stack
          onPress={(event) => {
            event.stopPropagation();
          }}
        >
          <Checkbox
            testID={`defi-position-action-asset-checkbox-${index}`}
            value={isSelected}
            onChange={(checked) => {
              onSelect(index, checked === true);
            }}
          />
        </Stack>
      ) : null}
    </XStack>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function isUserRejectedErrorMessage({
  error,
  intl,
}: {
  error: unknown;
  intl: ReturnType<typeof useIntl>;
}) {
  return (
    getErrorMessage(error) ===
    intl.formatMessage({ id: ETranslations.feedback_user_rejected })
  );
}

function showProtocolPositionActionErrorToast(error: unknown) {
  errorToastUtils.toastIfError(error);
  if (error && typeof error === 'object') {
    // DeFi action submit owns the visible operation boundary. Some backend or
    // tx-confirm errors intentionally set autoToast=false for generic callers,
    // but this dialog must still show the failure and keep diagnostic actions.
    (error as IOneKeyError).autoToast = true;
  }
  errorToastUtils.showToastOfError(error);
}

function normalizeProtocolPositionActionError(error: unknown) {
  if (!(error instanceof Error)) {
    return new OneKeyLocalError(getErrorMessage(error));
  }
  const oneKeyError = error as IOneKeyError;
  const normalizedError = new OneKeyLocalError({
    message: getErrorMessage(error),
    code: oneKeyError.code,
    data: oneKeyError.data,
    key: oneKeyError.key,
    info: oneKeyError.info,
    autoToast: oneKeyError.autoToast,
    requestId: oneKeyError.requestId,
    httpStatusCode: oneKeyError.httpStatusCode,
  });
  normalizedError.cause = error;
  return normalizedError;
}

function getPositiveAmount(value?: string) {
  if (!value) return undefined;
  const amountBN = new BigNumber(value);
  return amountBN.isFinite() && amountBN.gt(0) ? value : undefined;
}

function getActionSourceLabel({
  action,
  intl,
}: {
  action: EDeFiPositionAction;
  intl: ReturnType<typeof useIntl>;
}) {
  if (action === EDeFiPositionAction.Claim) {
    return intl.formatMessage({ id: ETranslations.defi_claimable_rewards });
  }
  if (action === EDeFiPositionAction.ClaimWithdrawal) {
    return intl.formatMessage({ id: ETranslations.earn_claimable });
  }
  if (action === EDeFiPositionAction.Repay) {
    return intl.formatMessage({ id: ETranslations.defi_borrowed });
  }
  return intl.formatMessage({ id: ETranslations.global_current });
}

function getActionResultLabel({
  action,
  actionLabel,
  intl,
}: {
  action: EDeFiPositionAction;
  actionLabel: string;
  intl: ReturnType<typeof useIntl>;
}) {
  if (action === EDeFiPositionAction.Claim) {
    return actionLabel;
  }
  if (action === EDeFiPositionAction.Repay) {
    return actionLabel;
  }
  if (isPercentageAction(action)) {
    return intl.formatMessage({ id: ETranslations.earn_est_receive });
  }
  return intl.formatMessage({
    id: ETranslations.redemption_btc_confirm_you_will_receive,
  });
}

function isLidoProtocol(protocolId: string) {
  return (
    protocolId
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') === 'lido'
  );
}

function buildDeFiActionTxConfirmInfo({
  action,
  selectedAsset,
  percent,
  amount,
  intl,
  hasRewards,
}: {
  action: IResolvedDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
  percent?: number;
  // Explicit token amount to display (manual entry / Max full balance). When
  // absent, the amount is derived from `percent`.
  amount?: string;
  intl: ReturnType<typeof useIntl>;
  hasRewards?: boolean;
}): IDeFiActionTxConfirmInfo {
  // LP removes redeem the position as one unit; any per-token amount here is
  // a preview estimate, so show only the pool pair + percent and let the
  // decoded tx details carry the real amounts.
  if (action.action === EDeFiPositionAction.RemoveLiquidity) {
    const underlyingAssets = selectedAsset.underlyingAssets ?? [];
    const underlyingLogoUrls = underlyingAssets
      .map((item) => item.meta?.logoUrl)
      .filter((logoUrl): logoUrl is string => Boolean(logoUrl));
    return {
      actionLabel: getActionLabel({ action: action.action, intl, hasRewards }),
      protocolId: action.protocolId,
      assetSymbol: getSelectedAssetDisplaySymbol({
        action: action.action,
        selectedAsset,
      }),
      assetLogoUrl: selectedAsset.asset.meta?.logoUrl,
      // Same threshold as the joined pair symbol (>1 underlying), so the
      // icons always match the text; missing logos degrade to fewer icons.
      assetLogoUrls:
        underlyingAssets.length > 1 && underlyingLogoUrls.length > 0
          ? underlyingLogoUrls
          : undefined,
      extraLabel: getActionExtraLabel({
        action: action.action,
        asset: selectedAsset,
        percent,
      }),
    };
  }

  const explicitAmount = amount !== undefined && amount.trim() !== '';
  let assetAmount: string;
  if (explicitAmount) {
    assetAmount = amount.trim();
  } else if (isPercentageAction(action.action)) {
    assetAmount = scaleAmountByPercent(selectedAsset.amount, percent);
  } else {
    assetAmount = selectedAsset.amount;
  }

  return {
    actionLabel: getActionLabel({ action: action.action, intl, hasRewards }),
    protocolId: action.protocolId,
    assetAmount,
    assetSymbol: selectedAsset.symbol,
    assetLogoUrl: selectedAsset.asset.meta?.logoUrl,
    extraLabel: getActionExtraLabel({
      action: action.action,
      asset: selectedAsset,
      percent,
      hidePercent: explicitAmount,
    }),
  };
}

function attachDeFiActionTxConfirmInfo({
  unsignedTx,
  info,
}: {
  unsignedTx: IUnsignedTxPro;
  info: IDeFiActionTxConfirmInfo;
}): IUnsignedTxPro {
  return {
    ...unsignedTx,
    payload: {
      ...unsignedTx.payload,
      defiActionInfo: info,
    },
  };
}

function getDeFiActionEarnLabel(action: EDeFiPositionAction) {
  if (
    action === EDeFiPositionAction.Claim ||
    action === EDeFiPositionAction.ClaimWithdrawal
  ) {
    return EEarnLabels.Claim;
  }
  if (
    action === EDeFiPositionAction.Withdraw ||
    action === EDeFiPositionAction.Repay ||
    action === EDeFiPositionAction.RemoveLiquidity
  ) {
    return action === EDeFiPositionAction.Repay
      ? EEarnLabels.Repay
      : EEarnLabels.Withdraw;
  }
  return EEarnLabels.Unknown;
}

function logDeFiActionEarnOrderError(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  defaultLogger.app.error.log(
    `DeFi action earn order registration failed: ${errorMessage}`,
  );
}

async function addDeFiActionEarnOrders({
  action,
  networkId,
  data,
  orderIdsByBusinessTxIndex,
}: {
  action: IResolvedDeFiPositionAction;
  networkId: string;
  data: ISendTxOnSuccessData[];
  orderIdsByBusinessTxIndex: string[];
}) {
  for (
    let txIndex = 0;
    txIndex < orderIdsByBusinessTxIndex.length;
    txIndex += 1
  ) {
    const orderId = orderIdsByBusinessTxIndex[txIndex];
    const orderTx = data[txIndex];
    if (!orderTx) {
      logDeFiActionEarnOrderError(
        new OneKeyLocalError('DeFi transaction result is missing'),
      );
    } else {
      const txId = orderTx?.signedTx?.txid ?? orderTx?.decodedTx?.txid;
      if (!txId) {
        logDeFiActionEarnOrderError(
          new OneKeyLocalError('DeFi transaction hash is missing'),
        );
      } else {
        try {
          await backgroundApiProxy.serviceStaking.addEarnOrder({
            orderId,
            networkId,
            txId,
            status: orderTx.decodedTx.status,
            stakingLabel: getDeFiActionEarnLabel(action.action),
            stakingProtocol: action.protocolId,
            stakingTags: [
              DEFI_PORTFOLIO_ACTION_STAKING_TAG,
              action.protocolId,
              // Tag what actually executed on the wire.
              action.buildAction ?? action.action,
            ],
          });
        } catch (error) {
          logDeFiActionEarnOrderError(error);
        }
      }
    }
  }
}

type IProtocolPositionActionSuccessParams = {
  accountId: string;
  networkId: string;
  data: ISendTxOnSuccessData[];
};

type IProtocolPositionActionSubmitParams = {
  action: IResolvedDeFiPositionAction;
  selectedAssets: IResolvedDeFiPositionActionAsset[];
  percent?: number;
  // Manual single-token entry: the exact token amount (human-decimal). Sent
  // instead of bps unless `isMaxAmount` is set.
  amount?: string;
  // Full close via Max: send bps=10000 so an accruing balance can't leave dust.
  isMaxAmount?: boolean;
  // Position holds rewards — drives the "Remove & Claim rewards" tx label.
  hasRewards?: boolean;
  // When provided and returning true for a specific failure, the hook skips
  // its error Toast because the caller renders that error inline instead.
  isErrorToastSuppressed?: (error: unknown) => boolean;
  onBeforeNavigateConfirm?: () => void | Promise<void>;
  onSettleResult?: (result: {
    status: IDeFiActionTxConfirmDialogResult;
    data: ISendTxOnSuccessData[];
  }) => boolean | void | Promise<boolean | void>;
  onConfirmFail?: (error: Error) => void;
  onConfirmCancel?: () => void;
};

function buildDeFiActionExtraParams({
  action,
  selectedAsset,
  percent,
}: {
  action: IResolvedDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
  percent?: number;
}): IDeFiActionExtraParams {
  const extraParams: IDeFiActionExtraParams = {
    ...selectedAsset.extraParams,
  };
  // The DeFi build API now resolves Polygon withdrawals by groupId.
  // oxlint-disable-next-line @cspell/spellchecker
  delete extraParams.unbondNonces;
  // oxlint-disable-next-line @cspell/spellchecker
  delete extraParams.unbond_nonces;

  if (action.action === EDeFiPositionAction.RemoveLiquidity) {
    const amount0Min = getPositiveAmount(extraParams.amount0Min);
    const amount1Min = getPositiveAmount(extraParams.amount1Min);
    delete extraParams.amount0Min;
    delete extraParams.amount1Min;
    if (amount0Min) {
      extraParams.amount0Min = scaleAmountByPercent(amount0Min, percent);
    }
    if (amount1Min) {
      extraParams.amount1Min = scaleAmountByPercent(amount1Min, percent);
    }
  }

  return extraParams;
}

function useProtocolPositionActionSubmit({
  accountId,
  networkId,
  onSuccess,
}: {
  accountId: string;
  networkId: string;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
}) {
  const intl = useIntl();
  const { navigationToMessageConfirmAsync, navigationToTxConfirm } =
    useSignatureConfirm({
      accountId,
      networkId,
    });

  return useCallback(
    async ({
      action,
      selectedAssets,
      percent,
      amount,
      isMaxAmount,
      hasRewards,
      isErrorToastSuppressed,
      onBeforeNavigateConfirm,
      onSettleResult,
      onConfirmFail,
      onConfirmCancel,
    }: IProtocolPositionActionSubmitParams) => {
      if (selectedAssets.length === 0) {
        throw new OneKeyLocalError('DeFi action asset is missing');
      }

      // The wire action for build-transaction; `action.action` keeps the
      // displayed semantics (e.g. Stake DAO shows Remove but builds withdraw).
      const buildActionType = action.buildAction ?? action.action;
      const isWithdraw = buildActionType === EDeFiPositionAction.Withdraw;
      const isRemoveLiquidity =
        buildActionType === EDeFiPositionAction.RemoveLiquidity;
      const isLpWithdraw =
        isWithdraw && action.action === EDeFiPositionAction.RemoveLiquidity;
      const percentageAction = isPercentageAction(action.action);
      const { amount: amountForApi, bps } = resolveActionTxAmount({
        percentageAction,
        percent,
        amount,
        isMaxAmount,
      });
      if (percentageAction && !amountForApi && !bps) {
        throw new OneKeyLocalError('Invalid DeFi action amount');
      }

      // Lido withdraw goes through the permit two-step flow, and its build API
      // expects an EMPTY tokenAddress — passing the stETH cert address is
      // rejected on the amount path ("Token does not exist"). bps happened to
      // work only because it ignores tokenAddress. amount stays human-readable;
      // the backend scales it by the token decimals.
      const isLidoWithdraw = isLidoProtocol(action.protocolId) && isWithdraw;

      try {
        const unsignedTxs: IUnsignedTxPro[] = [];
        const orderIdsByBusinessTxIndex: string[] = [];
        let prevNonce: number | undefined;

        for (const selectedAsset of selectedAssets) {
          const extraParams = buildDeFiActionExtraParams({
            action,
            selectedAsset,
            percent,
          });
          // RemoveLiquidity omits tokenAddress; Lido withdraw and LP-unit
          // withdraws (Stake DAO) must send it EMPTY — the build API requires
          // the field but resolves the tx from poolAddress, and an LP unit has
          // no single token to name. Everything else uses the asset's token.
          let buildTokenAddress: string | undefined =
            selectedAsset.tokenAddress;
          if (isRemoveLiquidity) {
            buildTokenAddress = undefined;
          } else if (isLidoWithdraw || isLpWithdraw) {
            buildTokenAddress = '';
          }
          let resp = await backgroundApiProxy.serviceDeFi.buildDeFiTransaction({
            accountId,
            networkId,
            protocolId: action.protocolId,
            action: isLidoWithdraw
              ? EDeFiPositionAction.Permit
              : buildActionType,
            tokenAddress: buildTokenAddress,
            amount: amountForApi,
            bps,
            extraParams,
          });

          if (isLidoWithdraw) {
            if (!resp.permit) {
              throw new OneKeyLocalError('DeFi permit response is missing');
            }
            const account = await backgroundApiProxy.serviceAccount.getAccount({
              accountId,
              networkId,
            });
            defiPermitUtils.validateLidoWithdrawPermitTypedData({
              message: resp.permit.message,
              accountAddress: account.address,
              networkId,
              selectedAsset,
            });
            const unsignedMessage =
              typeof resp.permit.message === 'string'
                ? resp.permit.message
                : stableStringify(resp.permit.message);
            await onBeforeNavigateConfirm?.();
            const signature = await navigationToMessageConfirmAsync({
              accountId,
              networkId,
              unsignedMessage: {
                type: EMessageTypesEth.TYPED_DATA_V4,
                message: unsignedMessage,
                payload: [account.address, unsignedMessage],
              },
              walletInternalSign: true,
            });
            resp = await backgroundApiProxy.serviceDeFi.buildDeFiTransaction({
              accountId,
              networkId,
              protocolId: action.protocolId,
              action: buildActionType,
              tokenAddress: buildTokenAddress,
              amount: amountForApi,
              bps,
              extraParams: {
                ...extraParams,
                signature,
                deadline: resp.permit.deadline,
              },
            });
          }

          if (!resp.tx) {
            throw new OneKeyLocalError('DeFi transaction is missing');
          }
          const orderId = resp.orderId || generateUUID();

          const withUuid =
            selectedAssets.length > 1 || Boolean(resp.approvalTx);
          if (resp.approvalTx) {
            const approvalUnsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  accountId,
                  networkId,
                  encodedTx: resp.approvalTx as IEncodedTx,
                  prevNonce,
                  withUuid,
                },
              );
            prevNonce = approvalUnsignedTx.nonce;
            unsignedTxs.push(approvalUnsignedTx);
          }

          const unsignedTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              accountId,
              networkId,
              encodedTx: resp.tx as IEncodedTx,
              prevNonce,
              withUuid,
            });
          prevNonce = unsignedTx.nonce;
          // Show the exact amount the user committed to: the typed amount for a
          // manual partial, the full balance for a Max close, otherwise let the
          // confirm info scale by percent.
          const displayAmount =
            amountForApi ?? (isMaxAmount ? selectedAsset.amount : undefined);
          orderIdsByBusinessTxIndex.push(orderId);
          unsignedTxs.push(
            attachDeFiActionTxConfirmInfo({
              unsignedTx,
              info: buildDeFiActionTxConfirmInfo({
                action,
                selectedAsset,
                percent,
                amount: displayAmount,
                intl,
                hasRewards,
              }),
            }),
          );
        }

        let txConfirmInitError: Error | undefined;
        let isTxConfirmInitializing = true;
        try {
          await onBeforeNavigateConfirm?.();
          await navigationToTxConfirm({
            unsignedTxs,
            // DeFi Portfolio actions use the normal tx-confirm flow, but must
            // not request Gas Account sponsorship.
            gasAccountScenario: 'defi',
            onSuccess: async (data: ISendTxOnSuccessData[]) => {
              void addDeFiActionEarnOrders({
                action,
                networkId,
                data,
                orderIdsByBusinessTxIndex,
              }).catch(logDeFiActionEarnOrderError);
              // Block on the confirming sheet until the tx settles, then run
              // the caller's refresh so the position reflects the result.
              const finalStatus = await showDeFiActionTxConfirmDialog({
                accountId,
                networkId,
                data,
              });
              const shouldContinueSuccess = await onSettleResult?.({
                status: finalStatus,
                data,
              });
              if (shouldContinueSuccess === false) {
                return;
              }
              if (finalStatus !== EOnChainHistoryTxStatus.Success) {
                return;
              }
              await onSuccess?.({ accountId, networkId, data });
            },
            onFail: (error: Error) => {
              onConfirmFail?.(error);
              if (isTxConfirmInitializing) {
                txConfirmInitError = error;
              }
            },
            onCancel: onConfirmCancel,
          });
        } finally {
          isTxConfirmInitializing = false;
        }
        if (txConfirmInitError) {
          throw normalizeProtocolPositionActionError(txConfirmInitError);
        }
      } catch (error) {
        if (!isUserRejectedErrorMessage({ error, intl })) {
          if (isErrorToastSuppressed?.(error)) {
            errorToastUtils.toastIfErrorDisable(error);
          } else {
            showProtocolPositionActionErrorToast(error);
          }
        }
        throw error;
      }
    },
    [
      accountId,
      intl,
      navigationToMessageConfirmAsync,
      navigationToTxConfirm,
      networkId,
      onSuccess,
    ],
  );
}

// Shared 25 / 50 / 75 / Max quick-select row. Withdraw uses it to fill the
// amount field; remove-liquidity uses it to set the removal percentage. The big
// value (amount or %) lives in the hero above, so this row carries no readout.
function ProtocolPositionActionPercentPresetRow({
  percent,
  maxLabel,
  onChange,
}: {
  percent: number;
  maxLabel: string;
  onChange: (percent: number) => void;
}) {
  const normalizedPercent = normalizeActionPercent(percent);
  return (
    <XStack gap="$2">
      {PERCENTAGE_PRESET_VALUES.map((presetPercent) => {
        const selected = normalizedPercent === presetPercent;
        const presetLabel =
          presetPercent === 100 ? maxLabel : `${presetPercent}%`;
        return (
          <Button
            key={presetPercent}
            testID={`defi-position-action-percent-${presetPercent}`}
            size="small"
            variant="secondary"
            flex={1}
            bg={selected ? '$bgActive' : '$bgSubdued'}
            borderColor={selected ? '$borderActive' : '$transparent'}
            hoverStyle={{ bg: selected ? '$bgActive' : '$bgStrong' }}
            pressStyle={{ bg: selected ? '$bgActive' : '$bgStrong' }}
            onPress={() => onChange(presetPercent)}
          >
            {presetLabel}
          </Button>
        );
      })}
    </XStack>
  );
}

// The position/balance context row shared by amount actions and health-factor
// feedback. Asset identity lives in the pill above the hero, so these fact rows
// intentionally carry no leading token icon.
function ProtocolPositionActionAnchor({
  label,
  valueNode,
  secondaryLabel,
  secondaryValueNode,
}: {
  label: string;
  valueNode: ReactNode;
  // Optional second fact rendered inside the same box (e.g. repay shows the
  // remaining debt on top and the spendable wallet balance beneath it).
  secondaryLabel?: string;
  secondaryValueNode?: ReactNode;
}) {
  // A second fact (repay's wallet balance) stacks under the first and both
  // values right-align.
  return (
    <XStack
      alignItems="center"
      bg="$bgSubdued"
      borderRadius="$3"
      px="$3"
      py="$2.5"
    >
      <YStack flex={1} gap="$1.5" minWidth={0}>
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
            flexShrink={1}
          >
            {label}
          </SizableText>
          {valueNode}
        </XStack>
        {secondaryLabel !== undefined ? (
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {secondaryLabel}
            </SizableText>
            {secondaryValueNode}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
}

// The percentage hero for remove-liquidity (and other no-fungible-amount
// percentage actions): the % being removed is an editable auto-sizing input —
// the same control as the typed-amount hero — with the fiat value beneath.
// Presets fill it; free typing covers any integer 1..100.
function ProtocolPositionActionPercentHero({
  percentText,
  onChangePercentText,
  onFocus,
  value,
  isUnavailable,
  showPriceUnavailableTooltip,
  currencySymbol,
  priceUnavailableLabel,
}: {
  percentText: string;
  onChangePercentText: (value: string) => void;
  onFocus?: () => void;
  value: number;
  isUnavailable: boolean;
  showPriceUnavailableTooltip: boolean;
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  const shouldReplaceZeroInput = percentText === '0';
  const shouldCompleteHundredInput = percentText === '10';
  const maxLength =
    platformEnv.isNativeIOS &&
    (shouldReplaceZeroInput || shouldCompleteHundredInput)
      ? percentText.length
      : getProtocolPositionActionPercentInputMaxLength(percentText);
  const handleKeyPress = (event: { nativeEvent: { key?: string } }) => {
    if (!shouldReplaceZeroInput && !shouldCompleteHundredInput) return;
    const { key } = event.nativeEvent;
    const nextValue = resolveProtocolPositionActionPercentKeyPress({
      currentValue: percentText,
      key,
    });
    if (nextValue !== undefined) {
      onChangePercentText(nextValue);
    }
  };

  return (
    <YStack
      minHeight={DEFI_ACTION_HERO_MIN_HEIGHT}
      justifyContent="center"
      alignItems="center"
      gap="$2"
    >
      <XStack alignItems="center" justifyContent="center" gap="$1">
        <Input
          testID="defi-position-action-percent-input"
          value={percentText}
          onChangeText={onChangePercentText}
          keyboardType="number-pad"
          maxLength={maxLength}
          onFocus={onFocus}
          onKeyPress={handleKeyPress}
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          unstyled
          borderWidth={0}
          bg="transparent"
          p="$0"
          h={Math.ceil(MANUAL_AMOUNT_INPUT_MAX_FONT_SIZE * 1.4)}
          size="large"
          fontSize={MANUAL_AMOUNT_INPUT_MAX_FONT_SIZE}
          fontWeight="500"
          textAlign="right"
          placeholder="0"
          placeholderTextColor="$textDisabled"
          containerProps={{
            width: 96,
            borderWidth: 0,
            bg: 'transparent',
          }}
        />
        <SizableText
          fontSize={MANUAL_AMOUNT_INPUT_MAX_FONT_SIZE}
          lineHeight={Math.ceil(MANUAL_AMOUNT_INPUT_MAX_FONT_SIZE * 1.4)}
          fontWeight="500"
          color="$text"
        >
          %
        </SizableText>
      </XStack>
      <XStack alignItems="center" justifyContent="center" gap="$1" minWidth={0}>
        <SizableText size="$headingLg" color="$textSubdued">
          ≈
        </SizableText>
        <ProtocolValueCell
          value={value}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          isUnavailable={isUnavailable}
          showPriceUnavailableTooltip={showPriceUnavailableTooltip}
          size="$headingLg"
          color="$textSubdued"
          textAlign="center"
          numberOfLines={1}
          fontVariant={['tabular-nums']}
        />
      </XStack>
    </YStack>
  );
}

function ProtocolPositionActionReceiveRow({
  asset,
  currencySymbol,
  priceUnavailableLabel,
  showValue,
}: {
  asset: IProtocolPositionActionPreviewAsset;
  currencySymbol: string;
  priceUnavailableLabel: string;
  showValue: boolean;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      <XStack alignItems="center" gap="$2.5" flexShrink={1} minWidth={0}>
        <Token size="sm" tokenImageUri={asset.asset.meta?.logoUrl} bg="$bg" />
        <YStack flexShrink={1} minWidth={0} gap="$0.5">
          <XStack alignItems="center" gap="$1" flexShrink={1} minWidth={0}>
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyLgMedium"
              formatter="balance"
              numberOfLines={1}
            >
              {asset.amount}
            </NumberSizeableTextWrapper>
            <SizableText
              size="$bodyLgMedium"
              color="$text"
              numberOfLines={1}
              flexShrink={1}
            >
              {asset.symbol}
            </SizableText>
            {asset.metaLabel ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {asset.metaLabel}
              </SizableText>
            ) : null}
          </XStack>
          {asset.minAmount ? (
            <XStack alignItems="center" gap="$1" minWidth={0}>
              <SizableText size="$bodySm" color="$textSubdued">
                ≥
              </SizableText>
              <NumberSizeableTextWrapper
                hideValue
                size="$bodySm"
                color="$textSubdued"
                formatter="balance"
                numberOfLines={1}
              >
                {asset.minAmount}
              </NumberSizeableTextWrapper>
            </XStack>
          ) : null}
        </YStack>
      </XStack>
      {showValue ? (
        <ProtocolValueCell
          value={asset.value}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          isUnavailable={isProtocolAssetValueUnavailable(asset.asset)}
          size="$bodyMd"
          color="$textSubdued"
          textAlign="right"
          numberOfLines={1}
        />
      ) : null}
    </XStack>
  );
}

function ProtocolPositionActionReceive({
  label,
  assets,
  currencySymbol,
  priceUnavailableLabel,
  estimated,
}: {
  label: string;
  assets: IProtocolPositionActionPreviewAsset[];
  currencySymbol: string;
  priceUnavailableLabel: string;
  estimated: boolean;
}) {
  const valueState = getPreviewAssetsValueState(assets);
  const showPerRowValue = assets.length > 1;
  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SizableText
          size="$bodyMdMedium"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {label}
        </SizableText>
        <XStack alignItems="center" gap="$1" flexShrink={0}>
          {estimated ? (
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              ≈
            </SizableText>
          ) : null}
          <ProtocolValueCell
            value={valueState.value}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
            isUnavailable={valueState.isUnavailable}
            showPriceUnavailableTooltip={valueState.showPriceUnavailableTooltip}
            size="$headingMd"
            color="$text"
            textAlign="right"
            numberOfLines={1}
          />
        </XStack>
      </XStack>
      <YStack gap="$2.5">
        {assets.map((asset, index) => (
          <ProtocolPositionActionReceiveRow
            key={`${asset.asset.address}-${asset.symbol}-${index}`}
            asset={asset}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
            showValue={showPerRowValue}
          />
        ))}
      </YStack>
    </YStack>
  );
}

// Borderless "Enter Amount" entry (mirrors the Send flow) for single-token
// withdraw / repay: the typed amount is the hero, fiat sits beneath, an
// top pill identifies the asset, balance rows show availability/debt without
// repeating its icon, and a 25/50/75/Max preset row quick-fills the field — the
// same control vocabulary as remove-liquidity.
function ProtocolPositionActionAmountInput({
  assetSelector,
  amount,
  onChangeAmount,
  onSelectPercent,
  selectedPercent,
  symbol,
  availableAmount,
  fiatValue,
  currencySymbol,
  isInsufficient,
  availableLabel,
  maxLabel,
  insufficientLabel,
  validator,
  onFocus,
  secondaryLabel,
  secondaryAmount,
}: {
  assetSelector: ReactNode;
  amount: string;
  onChangeAmount: (value: string) => void;
  onSelectPercent: (percent: number) => void;
  selectedPercent: number;
  symbol: string;
  availableAmount: string;
  fiatValue: string;
  currencySymbol: string;
  isInsufficient: boolean;
  availableLabel: string;
  maxLabel: string;
  insufficientLabel: string;
  validator?: (value: string) => boolean;
  onFocus?: () => void;
  // Optional secondary balance line under the primary anchor (repay uses it for
  // the spendable wallet balance beneath the remaining debt).
  secondaryLabel?: string;
  secondaryAmount?: string;
}) {
  return (
    <YStack gap="$5">
      {assetSelector}
      <SendAutoSizeAmountInput
        minHeight={DEFI_ACTION_HERO_MIN_HEIGHT}
        justifyContent="center"
        maxFontSize={MANUAL_AMOUNT_INPUT_MAX_FONT_SIZE}
        value={amount}
        onChange={onChangeAmount}
        validator={validator}
        tokenSymbol={symbol}
        inputProps={{ onFocus }}
        valueProps={{
          value: fiatValue,
          currency: currencySymbol,
          formatter: 'value',
        }}
        extraContent={
          // Reserved-height error slot right under the amount (same shape as
          // the Perp deposit/withdraw modal): the message toggles without
          // shifting the hero, keeping the dialog height stable.
          <Stack h="$6" justifyContent="center" alignItems="center">
            {isInsufficient ? (
              <SizableText size="$bodySm" color="$textCritical">
                {insufficientLabel}
              </SizableText>
            ) : null}
          </Stack>
        }
      />
      <ProtocolPositionActionAnchor
        label={availableLabel}
        valueNode={
          <XStack alignItems="center" gap="$1" flexShrink={0} minWidth={0}>
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyMdMedium"
              formatter="balance"
              numberOfLines={1}
            >
              {availableAmount}
            </NumberSizeableTextWrapper>
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {symbol}
            </SizableText>
          </XStack>
        }
        secondaryLabel={
          secondaryAmount !== undefined ? secondaryLabel : undefined
        }
        secondaryValueNode={
          secondaryAmount !== undefined ? (
            <XStack alignItems="center" gap="$1" flexShrink={0} minWidth={0}>
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyMdMedium"
                color="$textSubdued"
                formatter="balance"
                numberOfLines={1}
              >
                {secondaryAmount}
              </NumberSizeableTextWrapper>
              <SizableText
                size="$bodyMdMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {symbol}
              </SizableText>
            </XStack>
          ) : null
        }
      />
      <ProtocolPositionActionPercentPresetRow
        percent={selectedPercent}
        maxLabel={maxLabel}
        onChange={onSelectPercent}
      />
    </YStack>
  );
}

function ProtocolPositionActionDialogContent({
  accountId,
  networkId,
  action,
  hasRewards,
  hasDebts,
  rewardAssets,
  onSuccess,
  renderMode = 'dialog',
}: {
  accountId: string;
  networkId: string;
  action: IResolvedDeFiPositionAction;
  hasRewards?: boolean;
  hasDebts?: boolean;
  rewardAssets?: IDeFiAsset[];
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
  const closeRef = useRef<(() => void | Promise<void>) | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // Percent as typed text so the hero is directly editable. Invalid or empty
  // text zeroes the preview and disables confirm (buildDeFiActionBps returns
  // undefined outside integer 1..100) while keeping the field editable.
  const [actionPercentText, setActionPercentText] = useState(
    String(DEFAULT_ACTION_PERCENT),
  );
  // Only the untouched default Max value clears on first focus; preset taps or
  // manual edits already carry user intent and should stay editable in place.
  const actionPercentHasUserIntentRef = useRef(false);
  const actionPercent =
    resolveProtocolPositionActionPercentValue(actionPercentText);
  // Manual single-token entry (withdraw / repay). `amount` is human-decimal;
  // `isMaxAmount` flags a full close so submit sends bps=10000 instead.
  //
  // Withdraw is always non-debt here (Aave debt withdraws route to the manage
  // page), so it defaults to Max: the full balance pre-filled with isMaxAmount
  // on, so an untouched submit sends bps=10000 and leaves no dust. Repay is a
  // debt action, so it stays empty and the user types how much of the loan to
  // pay down. Remove-liquidity defaults to Max via actionPercent (100%) above.
  const isWithdrawAction = action.action === EDeFiPositionAction.Withdraw;
  const [amount, setAmount] = useState(() =>
    isWithdrawAction
      ? clampAmountDecimals(
          action.assets[0]?.amount ?? '',
          action.assets[0]?.asset.meta?.decimals,
        )
      : '',
  );
  const [isMaxAmount, setIsMaxAmount] = useState(isWithdrawAction);
  const [selectedAssetIndexes, setSelectedAssetIndexes] = useState<number[]>(
    () => (action.assets[0] ? [0] : []),
  );
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const releaseSubmitGuard = useCallback(() => {
    submittingRef.current = false;
    setSubmitting(false);
  }, []);

  const selectedAssets = useMemo(
    () =>
      selectedAssetIndexes
        .map((index) => action.assets[index])
        .filter((asset): asset is IResolvedDeFiPositionActionAsset =>
          Boolean(asset),
        ),
    [action.assets, selectedAssetIndexes],
  );
  const actionLabel = getActionLabel({
    action: action.action,
    intl,
    hasRewards,
  });
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const isPercentAction = isPercentageAction(action.action);
  const actionPercentBps = isPercentAction
    ? buildDeFiActionBps(actionPercent)
    : undefined;
  const selectable = action.assets.length > 1;
  const isManualAmountAction =
    action.action === EDeFiPositionAction.Withdraw ||
    action.action === EDeFiPositionAction.Repay;
  const manualAmountAsset = selectedAssets[0];
  // Manual entry only applies to a single fungible token; a multi-asset
  // selection keeps the percentage slider. Lido's permit withdraw still uses
  // manual amount input — the permit signature is handled at submit time and
  // does not affect the input UI.
  const useManualAmountInput =
    isManualAmountAction && !selectable && Boolean(manualAmountAsset);
  const availableAmount = manualAmountAsset?.amount ?? '0';
  const amountDecimals = manualAmountAsset?.asset.meta?.decimals;
  const validateManualAmountInput = useCallback(
    (next: string) => validateAmountInput(next, amountDecimals),
    [amountDecimals],
  );
  // Repay spends tokens from the wallet, but `availableAmount` above is the
  // DEBT size — the user may hold less than the debt. Fetch the wallet
  // balance so over-spend fails here instead of at tx-confirm simulation.
  // `address` is '' for the native token; the API handles both uniformly.
  const isRepayAction = action.action === EDeFiPositionAction.Repay;
  const repayTokenAddress =
    manualAmountAsset?.tokenAddress ?? manualAmountAsset?.asset.address;
  const {
    result: repayWalletBalanceState,
    isLoading: repayWalletBalanceLoading,
  } = usePromiseResult<IRepayWalletBalanceLoadState>(
    async () => {
      if (!isRepayAction || repayTokenAddress === undefined) return {};
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
    [accountId, isRepayAction, networkId, repayTokenAddress],
    { watchLoading: true, undefinedResultIfReRun: true },
  );
  const repayWalletBalance = repayWalletBalanceState?.balance;
  const repayWalletBalanceError = repayWalletBalanceState?.errorMessage;
  const isRepayWalletBalancePending =
    isRepayAction &&
    (repayWalletBalanceLoading || repayWalletBalanceState === undefined);
  const amountBN = new BigNumber(amount || '0');
  const availableBN = new BigNumber(availableAmount || '0');
  const isAmountPositive = amountBN.isFinite() && amountBN.gt(0);
  const repayWalletBalanceBN =
    isRepayAction && repayWalletBalance !== undefined
      ? new BigNumber(repayWalletBalance)
      : undefined;
  const {
    fillableMaxBN,
    fillableMax,
    isFillableMaxFullClose,
    isRepayWalletBalanceReady,
  } = resolveProtocolLendingDefiFillableAmountState({
    isRepay: isRepayAction,
    availableAmount,
    repayWalletBalance,
  });
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
    ? amountBN.multipliedBy(manualAmountAsset?.asset.price ?? 0).toFixed()
    : '0';
  // Highlight a preset only when the typed amount lands exactly on it (Max →
  // 100%); a free-typed amount highlights nothing (0 matches no preset).
  let selectedAmountPercent = 0;
  if (isMaxAmount) {
    selectedAmountPercent = 100;
  } else if (isAmountPositive && fillableMaxBN.gt(0)) {
    const pct = amountBN.div(fillableMaxBN).multipliedBy(100);
    selectedAmountPercent =
      PERCENTAGE_PRESET_VALUES.find((preset) =>
        pct.minus(preset).abs().lt(0.5),
      ) ?? 0;
  }
  const isConfirmDisabled =
    selectedAssets.length === 0 ||
    (isRepayAction &&
      (isRepayWalletBalancePending ||
        Boolean(repayWalletBalanceError) ||
        !isRepayWalletBalanceReady)) ||
    (useManualAmountInput
      ? !isAmountValid
      : isPercentAction && !actionPercentBps);
  const allSelected = selectedAssetIndexes.length === action.assets.length;
  const outputPreviewAssets = useMemo(
    () =>
      selectedAssets.flatMap((selectedAsset) =>
        buildSelectedAssetPreviewAssets({
          action: action.action,
          selectedAsset,
          percent: isPercentAction ? actionPercent : DEFAULT_ACTION_PERCENT,
        }),
      ),
    [action.action, actionPercent, isPercentAction, selectedAssets],
  );
  const aggregatedOutputPreviewAssets = useMemo(
    () => aggregatePreviewAssets(outputPreviewAssets),
    [outputPreviewAssets],
  );
  // Removing an LP that holds rewards also claims them ("Remove & Claim
  // rewards"), so the preview must list the reward tokens too. Rewards are
  // claimed in FULL regardless of the removal percent, so they are not
  // percent-scaled — and they stay out of aggregatePreviewAssets so a reward
  // token that is also a pool underlying keeps its own "Rewards"-tagged row.
  const rewardsLabel = intl.formatMessage({ id: ETranslations.earn_rewards });
  const rewardPreviewAssets = useMemo<IProtocolPositionActionPreviewAsset[]>(
    () =>
      action.action === EDeFiPositionAction.RemoveLiquidity && hasRewards
        ? (rewardAssets ?? [])
            .filter((asset) => new BigNumber(asset.amount).gt(0))
            .map((asset) => ({
              asset,
              amount: asset.amount,
              symbol: asset.symbol,
              value: asset.value,
              metaLabel: rewardsLabel,
            }))
        : [],
    [action.action, hasRewards, rewardAssets, rewardsLabel],
  );
  const receivePreviewAssets = useMemo(
    () => [...aggregatedOutputPreviewAssets, ...rewardPreviewAssets],
    [aggregatedOutputPreviewAssets, rewardPreviewAssets],
  );
  const outputValueState = useMemo(
    () => getPreviewAssetsValueState(receivePreviewAssets),
    [receivePreviewAssets],
  );
  const selectAllLabel = intl.formatMessage({
    id: allSelected
      ? ETranslations.global_deselect_all
      : ETranslations.global_select_all,
  });
  const sourceLabel = getActionSourceLabel({
    action: action.action,
    intl,
  });
  const resultLabel = getActionResultLabel({
    action: action.action,
    actionLabel,
    intl,
  });
  const maxLabel = intl.formatMessage({ id: ETranslations.global_max });
  const assetBalanceLabel = resolveProtocolPositionActionAssetBalanceLabel(
    action.action,
  );
  let assetBalanceLabelTranslation = ETranslations.global_available;
  if (assetBalanceLabel === 'remainingDebt') {
    assetBalanceLabelTranslation =
      ETranslations.defi_borrow_repay_remaining_debt;
  } else if (assetBalanceLabel === 'availableToWithdraw') {
    assetBalanceLabelTranslation = ETranslations.available_to_withdraw__title;
  }
  const availableLabel = intl.formatMessage({
    id: assetBalanceLabelTranslation,
  });
  const walletBalanceLabel = intl.formatMessage({
    id: ETranslations.global_wallet_balance,
  });
  const insufficientLabel = intl.formatMessage({
    id: ETranslations.earn_insufficient_balance,
  });
  const receiveLabel = isPercentAction ? resultLabel : sourceLabel;
  const currentSelectedAsset = selectedAssets[0];

  const handleActionPercentChange = (next: string) => {
    actionPercentHasUserIntentRef.current = true;
    setActionPercentText((currentValue) =>
      resolveProtocolPositionActionPercentInput({
        currentValue,
        nextValue: next,
      }),
    );
  };
  const handleActionPercentFocus = () => {
    const shouldClearInitialValue =
      shouldClearProtocolPositionActionInitialPercentValue({
        value: actionPercentText,
        hasUserIntent: actionPercentHasUserIntentRef.current,
      });

    actionPercentHasUserIntentRef.current = true;
    if (shouldClearInitialValue) {
      setActionPercentText('');
    }
  };

  const handleAmountChange = (next: string) => {
    // Project convention: reject keystrokes that exceed the token's decimals
    // (same gate as Send), rather than silently truncating.
    if (!validateManualAmountInput(next)) {
      return;
    }
    setAmount(next);
    setIsMaxAmount(false);
  };

  // Withdraw prefills the full balance as an untouched Max default. First
  // focus clears it — the user is here to type a custom amount and would
  // otherwise delete the prefill by hand. A Max the user pressed deliberately
  // (preset row) is never cleared; the ref marks that intent.
  const hasUserSetMaxRef = useRef(false);
  const handleAmountInputFocus = () => {
    if (isMaxAmount && !hasUserSetMaxRef.current) {
      setAmount('');
      setIsMaxAmount(false);
    }
  };

  const handlePercentPresetChange = (presetPercent: number) => {
    actionPercentHasUserIntentRef.current = true;
    setActionPercentText(String(presetPercent));
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
    // (no dust); 25/50/75 fill an exact token amount.
    if (percent >= 100) {
      handleMaxAmount();
      return;
    }
    if (
      isRepayWalletBalancePending ||
      repayWalletBalanceError ||
      !isRepayWalletBalanceReady
    ) {
      return;
    }
    const next = fillableMaxBN.multipliedBy(percent).div(100);
    setAmount(clampAmountDecimals(next.toFixed(), amountDecimals));
    setIsMaxAmount(false);
  };

  const handleAssetSelect = (index: number, selected: boolean) => {
    setSelectedAssetIndexes((prev) => {
      if (selected) {
        if (prev.includes(index)) return prev;
        return action.assets
          .map((_asset, assetIndex) => assetIndex)
          .filter(
            (assetIndex) => assetIndex === index || prev.includes(assetIndex),
          );
      }
      return prev.filter((item) => item !== index);
    });
  };

  const handleToggleAll = () => {
    setSelectedAssetIndexes(() => {
      if (allSelected) return [];
      return action.assets.map((_asset, index) => index);
    });
  };

  const handleConfirm = async ({
    close,
    preventClose,
  }: {
    close?: () => void | Promise<void>;
    preventClose: () => void;
  }) => {
    preventClose();
    if (selectedAssets.length === 0 || submittingRef.current) return;
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
    const releaseSubmitGuardOnceWithError = (error: Error) => {
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
        action,
        selectedAssets,
        hasRewards,
        percent: isPercentAction ? actionPercent : undefined,
        amount: useManualAmountInput ? amount : undefined,
        isMaxAmount: useManualAmountInput ? isMaxAmount : undefined,
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

  const assetSelector =
    action.assets.length > 0 ? (
      <YStack gap="$2">
        {selectable ? (
          <XStack alignItems="center" justifyContent="space-between">
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.earn_positions })}
            </SizableText>
            <Button
              testID="defi-position-action-toggle-all-assets"
              size="small"
              variant="tertiary"
              onPress={handleToggleAll}
              disabled={action.assets.length === 0}
            >
              {selectAllLabel}
            </Button>
          </XStack>
        ) : null}
        {action.assets.map((asset, index) => (
          <ProtocolPositionActionAssetRow
            key={`${asset.tokenAddress ?? asset.symbol}-${index}`}
            action={action.action}
            asset={asset}
            index={index}
            isSelected={selectedAssetIndexes.includes(index)}
            selectable={selectable}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
            onSelect={handleAssetSelect}
          />
        ))}
      </YStack>
    ) : null;

  let actionBody: ReactNode;
  if (selectedAssets.length === 0) {
    actionBody = (
      <YStack py="$6" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_select_crypto })}
        </SizableText>
      </YStack>
    );
  } else if (useManualAmountInput) {
    actionBody = (
      <ProtocolPositionActionAmountInput
        assetSelector={
          <ProtocolPositionAssetPill
            symbol={manualAmountAsset?.symbol ?? ''}
            logoURI={manualAmountAsset?.asset.meta?.logoUrl}
          />
        }
        amount={amount}
        onChangeAmount={handleAmountChange}
        validator={validateManualAmountInput}
        onSelectPercent={handleSelectPercent}
        selectedPercent={selectedAmountPercent}
        symbol={manualAmountAsset?.symbol ?? ''}
        availableAmount={availableAmount}
        fiatValue={amountFiatValue}
        currencySymbol={currencySymbol}
        isInsufficient={isAmountInsufficient}
        availableLabel={availableLabel}
        maxLabel={maxLabel}
        insufficientLabel={insufficientLabel}
        onFocus={handleAmountInputFocus}
        secondaryLabel={walletBalanceLabel}
        secondaryAmount={isRepayAction ? repayWalletBalance : undefined}
      />
    );
  } else if (isPercentAction) {
    const assetPill = currentSelectedAsset
      ? resolveProtocolPositionActionAssetPill({
          action: action.action,
          selectedAsset: currentSelectedAsset,
        })
      : undefined;
    actionBody = (
      <YStack gap="$5">
        {!selectable && assetPill ? (
          <ProtocolPositionAssetPill
            testID="defi-position-action-liquidity-pool"
            symbol={assetPill.symbol}
            logoURI={assetPill.logoURI}
            logoURIs={assetPill.logoURIs}
          />
        ) : null}
        <ProtocolPositionActionPercentHero
          percentText={actionPercentText}
          onChangePercentText={handleActionPercentChange}
          onFocus={handleActionPercentFocus}
          value={outputValueState.value}
          isUnavailable={outputValueState.isUnavailable}
          showPriceUnavailableTooltip={
            outputValueState.showPriceUnavailableTooltip
          }
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
        />
        <ProtocolPositionActionPercentPresetRow
          percent={actionPercent}
          maxLabel={maxLabel}
          onChange={handlePercentPresetChange}
        />
        <ProtocolPositionActionReceive
          label={resultLabel}
          assets={receivePreviewAssets}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          estimated
        />
      </YStack>
    );
  } else {
    actionBody = (
      <ProtocolPositionActionReceive
        label={receiveLabel}
        assets={receivePreviewAssets}
        currencySymbol={currencySymbol}
        priceUnavailableLabel={priceUnavailableLabel}
        estimated={isPercentAction}
      />
    );
  }

  const showLiquidationWarning =
    Boolean(hasDebts) && action.action === EDeFiPositionAction.Withdraw;
  const inlineErrorMessage = submitError ?? repayWalletBalanceError;
  const showTransactionCountNotice = selectedAssets.length > 1;
  const showFeedbackRegion =
    showLiquidationWarning ||
    Boolean(inlineErrorMessage) ||
    showTransactionCountNotice;
  const bodyNode = (
    <YStack gap="$5">
      {selectable ? assetSelector : null}
      {actionBody}
    </YStack>
  );
  const feedbackNode = showFeedbackRegion ? (
    <YStack gap="$3">
      {showLiquidationWarning ? (
        <Alert
          type="warning"
          icon="InfoCircleOutline"
          description={intl.formatMessage({
            id: ETranslations.defi_liquidation_withdraw_desc,
          })}
        />
      ) : null}

      {inlineErrorMessage ? (
        <Alert
          type="critical"
          icon="ErrorOutline"
          title={intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          })}
          description={inlineErrorMessage}
        />
      ) : null}

      {showTransactionCountNotice ? (
        // Each selected asset builds its own transaction (approvals discovered
        // at build time may add more), so hardware-wallet users know how many
        // confirmations to expect. Count shown is the business-tx floor.
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          {intl.formatMessage(
            { id: ETranslations.address_risk_check_txs__msg },
            { count: selectedAssets.length },
          )}
        </SizableText>
      ) : null}
    </YStack>
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

function showProtocolPositionActionDialog({
  accountId,
  networkId,
  action,
  hasRewards,
  hasDebts,
  rewardAssets,
  onSuccess,
  dialog,
}: {
  accountId: string;
  networkId: string;
  action: IResolvedDeFiPositionAction;
  hasRewards?: boolean;
  hasDebts?: boolean;
  rewardAssets?: IDeFiAsset[];
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
  dialog?: ReturnType<typeof useInPageDialog>;
}) {
  const DialogInstance = dialog ?? Dialog;
  DialogInstance.show({
    showFooter: false,
    renderContent: (
      <ProtocolPositionActionDialogContent
        accountId={accountId}
        networkId={networkId}
        action={action}
        hasRewards={hasRewards}
        hasDebts={hasDebts}
        rewardAssets={rewardAssets}
        onSuccess={onSuccess}
      />
    ),
  });
}

export {
  clampAmountDecimals,
  getActionLabel,
  getErrorMessage,
  isUserRejectedErrorMessage,
  ProtocolPositionActionAmountInput,
  ProtocolPositionActionAnchor,
  ProtocolPositionActionDialogContent,
  showProtocolPositionActionDialog,
  useProtocolPositionActionSubmit,
  type IProtocolPositionActionSuccessParams,
};
