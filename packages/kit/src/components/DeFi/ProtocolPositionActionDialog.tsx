import { type ReactNode, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token, TokenGroup } from '@onekeyhq/kit/src/components/Token';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { PerpsSlider } from '@onekeyhq/kit/src/views/Perp/components/PerpsSlider';
import { SendAutoSizeAmountInput } from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EthereumStETH,
  EthereumStETHWithdrawalQueue,
} from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  buildDeFiActionBps,
  resolveDeFiActionTxAmount,
} from '@onekeyhq/shared/src/utils/defiActionUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
  type IDeFiActionTxConfirmInfo,
  type IDeFiAsset,
  type IDeFiUnknownRecord,
  type IResolvedDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { showDeFiActionTxConfirmDialog } from './DeFiActionTxConfirmResult';
import {
  ProtocolValueCell,
  isProtocolAssetValueUnavailable,
} from './ProtocolValueCell';

const DEFAULT_ACTION_PERCENT = 100;
const PERCENTAGE_SLIDER_SEGMENTS = 4;
const PERCENTAGE_PRESET_VALUES = [25, 50, 75, 100] as const;
const resolveActionTxAmount = resolveDeFiActionTxAmount as (params: {
  percentageAction: boolean;
  percent?: number;
  amount?: string;
  isMaxAmount?: boolean;
}) => { amount?: string; bps?: string };

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
  return getOutputPreviewSourceAssets({ action, selectedAsset }).map(
    (asset) => ({
      asset,
      amount: isPercentAction
        ? scaleAmountByPercent(asset.amount, percent)
        : asset.amount,
      symbol: asset.symbol,
      value: isPercentAction
        ? scaleValueByPercent(asset.value, percent)
        : asset.value,
    }),
  );
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
  if (
    action === EDeFiPositionAction.RemoveLiquidity &&
    selectedAsset.underlyingAssets?.length
  ) {
    return selectedAsset.underlyingAssets
      .map((asset) => asset.symbol)
      .filter(Boolean)
      .join(' / ');
  }
  return selectedAsset.symbol;
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
      borderRadius="$2"
      bg={isSelected ? '$bgActive' : '$bgSubdued'}
      borderWidth="$px"
      borderColor={isSelected ? '$borderActive' : '$borderSubdued'}
      cursor={selectable ? 'pointer' : 'default'}
      userSelect="none"
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

function asRecord(value: unknown): IDeFiUnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as IDeFiUnknownRecord;
}

function parsePermitTypedDataMessage(message: unknown): IDeFiUnknownRecord {
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message) as unknown;
      const record = asRecord(parsed);
      if (record) return record;
    } catch {
      // Throw a stable local error below.
    }
    throw new OneKeyLocalError('Invalid DeFi permit typed data');
  }

  const record = asRecord(message);
  if (record) return record;

  throw new OneKeyLocalError('Invalid DeFi permit typed data');
}

function normalizePermitAddress(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : undefined;
}

function assertPermitAddress({
  actual,
  expected,
  fieldName,
}: {
  actual: unknown;
  expected: string | undefined;
  fieldName: string;
}) {
  const normalizedActual = normalizePermitAddress(actual);
  const normalizedExpected = normalizePermitAddress(expected);
  if (
    !normalizedActual ||
    !normalizedExpected ||
    normalizedActual !== normalizedExpected
  ) {
    throw new OneKeyLocalError(`Invalid DeFi permit ${fieldName}`);
  }
}

function normalizePermitChainId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function validateLidoWithdrawPermitTypedData({
  message,
  accountAddress,
  networkId,
  selectedAsset,
}: {
  message: unknown;
  accountAddress: string;
  networkId: string;
  selectedAsset: IResolvedDeFiPositionActionAsset;
}) {
  if (networkId !== getNetworkIdsMap().eth) {
    throw new OneKeyLocalError('Invalid DeFi permit network');
  }

  const typedData = parsePermitTypedDataMessage(message);
  const domain = asRecord(typedData.domain);
  const permitMessage = asRecord(typedData.message);

  if (!domain || !permitMessage) {
    throw new OneKeyLocalError('Invalid DeFi permit typed data');
  }

  if (normalizePermitChainId(domain.chainId) !== '1') {
    throw new OneKeyLocalError('Invalid DeFi permit chainId');
  }

  assertPermitAddress({
    actual: permitMessage.owner,
    expected: accountAddress,
    fieldName: 'owner',
  });
  assertPermitAddress({
    actual: domain.verifyingContract,
    expected: EthereumStETH,
    fieldName: 'verifyingContract',
  });
  assertPermitAddress({
    actual: selectedAsset.tokenAddress,
    expected: EthereumStETH,
    fieldName: 'tokenAddress',
  });
  assertPermitAddress({
    actual: permitMessage.spender,
    expected: EthereumStETHWithdrawalQueue,
    fieldName: 'spender',
  });

  if (normalizePermitAddress(permitMessage.token)) {
    assertPermitAddress({
      actual: permitMessage.token,
      expected: selectedAsset.tokenAddress,
      fieldName: 'token',
    });
  }
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

async function addDeFiActionEarnOrders({
  action,
  networkId,
  data,
}: {
  action: IResolvedDeFiPositionAction;
  networkId: string;
  data: ISendTxOnSuccessData[];
}) {
  for (const orderTx of data) {
    if (orderTx?.signedTx?.txid) {
      await backgroundApiProxy.serviceStaking.addEarnOrder({
        orderId: generateUUID(),
        networkId,
        txId: orderTx.signedTx.txid,
        status: orderTx.decodedTx.status,
        stakingLabel: getDeFiActionEarnLabel(action.action),
        stakingProtocol: action.protocolId,
        stakingTags: [
          'defi-portfolio-action',
          action.protocolId,
          action.action,
        ],
      });
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
  onBeforeNavigateConfirm?: () => void | Promise<void>;
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
      onBeforeNavigateConfirm,
    }: IProtocolPositionActionSubmitParams) => {
      if (selectedAssets.length === 0) {
        throw new OneKeyLocalError('DeFi action asset is missing');
      }

      const isWithdraw = action.action === EDeFiPositionAction.Withdraw;
      const isRemoveLiquidity =
        action.action === EDeFiPositionAction.RemoveLiquidity;
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

      try {
        const unsignedTxs: IUnsignedTxPro[] = [];
        let prevNonce: number | undefined;

        for (const selectedAsset of selectedAssets) {
          const extraParams = buildDeFiActionExtraParams({
            action,
            selectedAsset,
            percent,
          });
          let resp = await backgroundApiProxy.serviceDeFi.buildDeFiTransaction({
            accountId,
            networkId,
            protocolId: action.protocolId,
            action:
              isLidoProtocol(action.protocolId) && isWithdraw
                ? EDeFiPositionAction.Permit
                : action.action,
            tokenAddress: isRemoveLiquidity
              ? undefined
              : selectedAsset.tokenAddress,
            amount: amountForApi,
            bps,
            extraParams,
          });

          if (isLidoProtocol(action.protocolId) && isWithdraw) {
            if (!resp.permit) {
              throw new OneKeyLocalError('DeFi permit response is missing');
            }
            const account = await backgroundApiProxy.serviceAccount.getAccount({
              accountId,
              networkId,
            });
            validateLidoWithdrawPermitTypedData({
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
              action: action.action,
              tokenAddress: selectedAsset.tokenAddress,
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
              // Tag the tx for pending tracking, but don't block the confirming
              // sheet on it: showing the sheet in the same tick the confirm
              // modal pops keeps the handoff smooth instead of flashing the page
              // underneath while the earn-order call resolves.
              void addDeFiActionEarnOrders({ action, networkId, data }).catch(
                () => undefined,
              );
              // Block on the confirming sheet until the tx settles, then run
              // the caller's refresh so the position reflects the result.
              const finalStatus = await showDeFiActionTxConfirmDialog({
                accountId,
                networkId,
                data,
              });
              if (finalStatus === EOnChainHistoryTxStatus.Failed) {
                return;
              }
              await onSuccess?.({ accountId, networkId, data });
            },
            onFail: (error: Error) => {
              if (isTxConfirmInitializing) {
                txConfirmInitError = error;
              }
            },
          });
        } finally {
          isTxConfirmInitializing = false;
        }
        if (txConfirmInitError) {
          throw new OneKeyLocalError(getErrorMessage(txConfirmInitError));
        }
      } catch (error) {
        if (!isUserRejectedErrorMessage({ error, intl })) {
          Toast.error({
            title: getErrorMessage(error),
          });
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

function ProtocolPositionActionPercentSlider({
  percent,
  onChange,
}: {
  percent: number;
  onChange: (percent: number) => void;
}) {
  const normalizedPercent = normalizeActionPercent(percent);
  return (
    <PerpsSlider
      value={normalizedPercent}
      onChange={(value) => onChange(normalizeActionPercent(value))}
      min={0}
      max={100}
      segments={PERCENTAGE_SLIDER_SEGMENTS}
      sliderHeight={6}
      snapTapToSegment
    />
  );
}

// The position/balance context row shared by both flows: an icon + label on the
// left, the value on the right. Withdraw shows the available token balance;
// remove-liquidity shows the pool it's drawing from. Going to the full amount is
// owned by the Max entry in the preset row below, so there's no button here.
function ProtocolPositionActionAnchor({
  label,
  iconNode,
  valueNode,
}: {
  label: string;
  iconNode: ReactNode;
  valueNode: ReactNode;
}) {
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      px="$3"
      py="$2.5"
    >
      <XStack alignItems="center" gap="$2" flexShrink={1} minWidth={0}>
        {iconNode}
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {label}
        </SizableText>
      </XStack>
      {valueNode}
    </XStack>
  );
}

// The percentage hero for remove-liquidity (and other no-fungible-amount
// percentage actions): the % being removed is the hero, the fiat value sits
// beneath — mirroring the typed-amount hero in withdraw.
function ProtocolPositionActionPercentHero({
  percent,
  value,
  isUnavailable,
  showPriceUnavailableTooltip,
  currencySymbol,
  priceUnavailableLabel,
}: {
  percent: number;
  value: number;
  isUnavailable: boolean;
  showPriceUnavailableTooltip: boolean;
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  const normalizedPercent = normalizeActionPercent(percent);
  // Mirror the typed-amount hero (SendAutoSizeAmountInput): no top label — the
  // Dialog.Title already carries the verb — a large centered value with the
  // fiat at $headingLg beneath, and the same py="$6" breathing room, so the
  // percentage and typed-amount flows read as one hero, not two screens.
  return (
    <YStack gap="$2" alignItems="center" py="$6">
      <SizableText
        size="$heading5xl"
        color="$text"
        fontVariant={['tabular-nums']}
      >
        {`${normalizedPercent}%`}
      </SizableText>
      <XStack alignItems="center" gap="$1" minWidth={0}>
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
        </XStack>
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
// Available context row shows the balance, and a 25/50/75/Max preset row
// quick-fills the field (Max included) — the same control vocabulary as
// remove-liquidity.
function ProtocolPositionActionAmountInput({
  amount,
  onChangeAmount,
  onSelectPercent,
  selectedPercent,
  symbol,
  tokenLogoUrl,
  availableAmount,
  fiatValue,
  currencySymbol,
  isInsufficient,
  availableLabel,
  maxLabel,
  insufficientLabel,
}: {
  amount: string;
  onChangeAmount: (value: string) => void;
  onSelectPercent: (percent: number) => void;
  selectedPercent: number;
  symbol: string;
  tokenLogoUrl?: string;
  availableAmount: string;
  fiatValue: string;
  currencySymbol: string;
  isInsufficient: boolean;
  availableLabel: string;
  maxLabel: string;
  insufficientLabel: string;
}) {
  return (
    <YStack gap="$5">
      <SendAutoSizeAmountInput
        py="$6"
        value={amount}
        onChange={onChangeAmount}
        tokenSymbol={symbol}
        valueProps={{
          value: fiatValue,
          currency: currencySymbol,
          formatter: 'value',
        }}
      />
      <ProtocolPositionActionAnchor
        label={availableLabel}
        iconNode={<Token size="sm" tokenImageUri={tokenLogoUrl} bg="$bg" />}
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
      />
      <ProtocolPositionActionPercentPresetRow
        percent={selectedPercent}
        maxLabel={maxLabel}
        onChange={onSelectPercent}
      />
      {isInsufficient ? (
        <SizableText size="$bodySm" color="$textCritical" textAlign="center">
          {insufficientLabel}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function ProtocolPositionActionDialogContent({
  accountId,
  networkId,
  action,
  hasRewards,
  onSuccess,
}: {
  accountId: string;
  networkId: string;
  action: IResolvedDeFiPositionAction;
  hasRewards?: boolean;
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
  const [actionPercent, setActionPercent] = useState(DEFAULT_ACTION_PERCENT);
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
  // selection or Lido's permit withdraw keep the percentage slider.
  const useManualAmountInput =
    isManualAmountAction &&
    !selectable &&
    !isLidoProtocol(action.protocolId) &&
    Boolean(manualAmountAsset);
  const availableAmount = manualAmountAsset?.amount ?? '0';
  const amountDecimals = manualAmountAsset?.asset.meta?.decimals;
  const amountBN = new BigNumber(amount || '0');
  const availableBN = new BigNumber(availableAmount || '0');
  const isAmountPositive = amountBN.isFinite() && amountBN.gt(0);
  const isAmountInsufficient =
    amountBN.isFinite() && availableBN.isFinite() && amountBN.gt(availableBN);
  const isAmountValid = isAmountPositive && !isAmountInsufficient;
  const amountFiatValue = isAmountPositive
    ? amountBN.multipliedBy(manualAmountAsset?.asset.price ?? 0).toFixed()
    : '0';
  // Highlight a preset only when the typed amount lands exactly on it (Max →
  // 100%); a free-typed amount highlights nothing (0 matches no preset).
  let selectedAmountPercent = 0;
  if (isMaxAmount) {
    selectedAmountPercent = 100;
  } else if (isAmountPositive && availableBN.gt(0)) {
    const pct = amountBN.div(availableBN).multipliedBy(100);
    selectedAmountPercent =
      PERCENTAGE_PRESET_VALUES.find((preset) =>
        pct.minus(preset).abs().lt(0.5),
      ) ?? 0;
  }
  const isConfirmDisabled =
    selectedAssets.length === 0 ||
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
  const outputValueState = useMemo(
    () => getPreviewAssetsValueState(aggregatedOutputPreviewAssets),
    [aggregatedOutputPreviewAssets],
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
  const availableLabel = intl.formatMessage({
    id: ETranslations.global_available,
  });
  const insufficientLabel = intl.formatMessage({
    id: ETranslations.earn_insufficient_balance,
  });
  const receiveLabel = isPercentAction ? resultLabel : sourceLabel;
  const currentSelectedAsset = selectedAssets[0];

  const handleAmountChange = (next: string) => {
    // Project convention: reject keystrokes that exceed the token's decimals
    // (same gate as Send), rather than silently truncating.
    if (!validateAmountInput(next, amountDecimals)) {
      return;
    }
    setAmount(next);
    setIsMaxAmount(false);
  };

  const handleMaxAmount = () => {
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
    if (selectedAssets.length === 0) {
      preventClose();
      return;
    }

    // Keep the action dialog open while the server builds the transaction so
    // the button can show loading. Close it immediately before opening any
    // signing/tx-confirm modal, otherwise the old dialog stays stacked above
    // the confirm page until the async submit finishes.
    try {
      let isActionDialogClosed = false;
      await submitProtocolPositionAction({
        action,
        selectedAssets,
        hasRewards,
        percent: isPercentAction ? actionPercent : undefined,
        amount: useManualAmountInput ? amount : undefined,
        isMaxAmount: useManualAmountInput ? isMaxAmount : undefined,
        onBeforeNavigateConfirm: async () => {
          if (isActionDialogClosed) return;
          isActionDialogClosed = true;
          await close?.();
        },
      });
    } catch {
      // submitProtocolPositionAction already surfaced the error via Toast;
      // keep the dialog open so the user can retry instead of auto-closing.
      preventClose();
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
        amount={amount}
        onChangeAmount={handleAmountChange}
        onSelectPercent={handleSelectPercent}
        selectedPercent={selectedAmountPercent}
        symbol={manualAmountAsset?.symbol ?? ''}
        tokenLogoUrl={manualAmountAsset?.asset.meta?.logoUrl}
        availableAmount={availableAmount}
        fiatValue={amountFiatValue}
        currencySymbol={currencySymbol}
        isInsufficient={isAmountInsufficient}
        availableLabel={availableLabel}
        maxLabel={maxLabel}
        insufficientLabel={insufficientLabel}
      />
    );
  } else if (isPercentAction) {
    const anchorUnderlyingTokens =
      currentSelectedAsset?.underlyingAssets?.map((item) => ({
        tokenImageUri: item.meta?.logoUrl,
      })) ?? [];
    actionBody = (
      <YStack gap="$5">
        <ProtocolPositionActionPercentHero
          percent={actionPercent}
          value={outputValueState.value}
          isUnavailable={outputValueState.isUnavailable}
          showPriceUnavailableTooltip={
            outputValueState.showPriceUnavailableTooltip
          }
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
        />
        {!selectable && currentSelectedAsset ? (
          <ProtocolPositionActionAnchor
            label={sourceLabel}
            iconNode={
              anchorUnderlyingTokens.length > 0 ? (
                <TokenGroup
                  tokens={anchorUnderlyingTokens}
                  size="xs"
                  variant="overlapped"
                  wrapperStyle="border"
                  wrapperBorderColor="$bgSubdued"
                />
              ) : (
                <Token
                  size="sm"
                  tokenImageUri={currentSelectedAsset.asset.meta?.logoUrl}
                  bg="$bg"
                />
              )
            }
            valueNode={
              <SizableText
                size="$bodyMdMedium"
                color="$text"
                numberOfLines={1}
                flexShrink={0}
              >
                {getSelectedAssetDisplaySymbol({
                  action: action.action,
                  selectedAsset: currentSelectedAsset,
                })}
              </SizableText>
            }
          />
        ) : null}
        <YStack gap="$3">
          <ProtocolPositionActionPercentSlider
            percent={actionPercent}
            onChange={setActionPercent}
          />
          <ProtocolPositionActionPercentPresetRow
            percent={actionPercent}
            maxLabel={maxLabel}
            onChange={setActionPercent}
          />
        </YStack>
        <ProtocolPositionActionReceive
          label={resultLabel}
          assets={aggregatedOutputPreviewAssets}
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
        assets={aggregatedOutputPreviewAssets}
        currencySymbol={currencySymbol}
        priceUnavailableLabel={priceUnavailableLabel}
        estimated={isPercentAction}
      />
    );
  }

  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {selectable ? assetSelector : null}
      {actionBody}

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        onConfirmText={actionLabel}
        onConfirm={handleConfirm}
        confirmButtonProps={{
          disabled: isConfirmDisabled,
        }}
      />
    </YStack>
  );
}

function showProtocolPositionActionDialog({
  accountId,
  networkId,
  action,
  hasRewards,
  onSuccess,
}: {
  accountId: string;
  networkId: string;
  action: IResolvedDeFiPositionAction;
  hasRewards?: boolean;
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
}) {
  Dialog.show({
    showFooter: false,
    renderContent: (
      <ProtocolPositionActionDialogContent
        accountId={accountId}
        networkId={networkId}
        action={action}
        hasRewards={hasRewards}
        onSuccess={onSuccess}
      />
    ),
  });
}

export {
  getActionLabel,
  showProtocolPositionActionDialog,
  useProtocolPositionActionSubmit,
  type IProtocolPositionActionSuccessParams,
};
