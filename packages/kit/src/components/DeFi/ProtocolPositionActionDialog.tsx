import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  Keyboard,
  SizableText,
  Stack,
  XStack,
  YStack,
  useIsKeyboardShown,
} from '@onekeyhq/components';
import type { useInPageDialog } from '@onekeyhq/components';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useEarnRiskWarningGate } from '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { resolveDeFiActionTxAmount } from '@onekeyhq/shared/src/utils/defiActionUtils';
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
import { resolveProtocolPositionActionAssetPill } from './protocolPositionActionAssetUtils';
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
const PERCENT_INPUT_HORIZONTAL_OVERFLOW = 12;
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

export function showProtocolPositionActionErrorToast(error: unknown) {
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
  const ensureRiskAccepted = useEarnRiskWarningGate();
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
    }: IProtocolPositionActionSubmitParams): Promise<boolean> => {
      if (selectedAssets.length === 0) {
        throw new OneKeyLocalError('DeFi action asset is missing');
      }

      // OK-59196: DeFi Portfolio one-click withdraw / claim / remove-liquidity
      // build their own transactions and never reach the earn or borrow hooks,
      // so this is the only place the one-time disclaimer can gate them.
      // Returns false so a caller holding a submit guard can release it: no
      // callback fires and nothing throws on this path.
      if (
        !(await ensureRiskAccepted({
          provider: action.protocolId,
          symbol: selectedAssets[0]?.symbol,
          networkId,
        }))
      ) {
        return false;
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

        return true;
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
      ensureRiskAccepted,
      intl,
      navigationToMessageConfirmAsync,
      navigationToTxConfirm,
      networkId,
      onSuccess,
    ],
  );
}

const ProtocolPositionActionAnchor = LazyLoad(async () => {
  const { ProtocolPositionActionAnchor: Component } =
    await import('./ProtocolPositionActionDialogContent');
  return { default: Component };
});

const ProtocolPositionActionAmountInput = LazyLoad(async () => {
  const { ProtocolPositionActionAmountInput: Component } =
    await import('./ProtocolPositionActionDialogContent');
  return { default: Component };
});

const ProtocolPositionActionDialogContent = LazyLoad(async () => {
  const { ProtocolPositionActionDialogContent: Component } =
    await import('./ProtocolPositionActionDialogContent');
  return { default: Component };
});

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

export {
  DEFAULT_ACTION_PERCENT,
  PERCENTAGE_PRESET_VALUES,
  DEFI_ACTION_HERO_MIN_HEIGHT,
  MANUAL_AMOUNT_INPUT_MAX_FONT_SIZE,
  PERCENT_INPUT_HORIZONTAL_OVERFLOW,
  normalizeActionPercent,
  isPercentageAction,
  buildSelectedAssetPreviewAssets,
  aggregatePreviewAssets,
  getPreviewAssetsValueState,
  ProtocolPositionActionAssetRow,
  getActionSourceLabel,
  getActionResultLabel,
  type IRepayWalletBalanceLoadState,
  type IProtocolPositionActionPreviewAsset,
};
