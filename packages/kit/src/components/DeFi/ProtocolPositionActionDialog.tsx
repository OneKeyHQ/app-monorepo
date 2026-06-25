import { useCallback, useMemo, useState } from 'react';

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
import { PerpsSlider } from '@onekeyhq/kit/src/views/Perp/components/PerpsSlider';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EthereumStETH,
  EthereumStETHWithdrawalQueue,
} from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { buildDeFiActionBps } from '@onekeyhq/shared/src/utils/defiActionUtils';
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
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  ProtocolValueCell,
  isProtocolAssetValueUnavailable,
} from './ProtocolValueCell';

const DEFAULT_ACTION_PERCENT = 100;
const PERCENTAGE_SLIDER_SEGMENTS = 4;
const PERCENTAGE_PRESET_VALUES = [25, 50, 75, 100] as const;

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
}: {
  action: EDeFiPositionAction;
  intl: ReturnType<typeof useIntl>;
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
      id: ETranslations.dexmarket_details_liquidity_change_remove,
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
}: {
  action: EDeFiPositionAction;
  asset: IResolvedDeFiPositionActionAsset;
  percent?: number;
}) {
  const labels = [
    getActionAssetExtraLabel(asset),
    isPercentageAction(action)
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

function getSourceAssetMetaLabel({
  action,
  selectedAsset,
}: {
  action: EDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
}) {
  const extraLabel = getActionAssetExtraLabel(selectedAsset);
  const underlyingLabel =
    action === EDeFiPositionAction.RemoveLiquidity
      ? getSelectedAssetDisplaySymbol({ action, selectedAsset })
      : undefined;
  const labels = [underlyingLabel, extraLabel].filter(
    (label): label is string => Boolean(label),
  );
  return labels.length > 0 ? labels.join(' / ') : undefined;
}

function buildSelectedAssetSourcePreviewAssets({
  action,
  selectedAsset,
}: {
  action: EDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
}): IProtocolPositionActionPreviewAsset[] {
  return [
    {
      asset: selectedAsset.asset,
      amount: selectedAsset.amount,
      symbol: selectedAsset.symbol,
      value: selectedAsset.asset.value,
      metaLabel: getSourceAssetMetaLabel({ action, selectedAsset }),
    },
  ];
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
  intl,
}: {
  action: IResolvedDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
  percent?: number;
  intl: ReturnType<typeof useIntl>;
}): IDeFiActionTxConfirmInfo {
  const assetAmount = isPercentageAction(action.action)
    ? scaleAmountByPercent(selectedAsset.amount, percent)
    : selectedAsset.amount;

  return {
    actionLabel: getActionLabel({ action: action.action, intl }),
    protocolId: action.protocolId,
    assetAmount,
    assetSymbol: selectedAsset.symbol,
    assetLogoUrl: selectedAsset.asset.meta?.logoUrl,
    extraLabel: getActionExtraLabel({
      action: action.action,
      asset: selectedAsset,
      percent,
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
    }: IProtocolPositionActionSubmitParams) => {
      if (selectedAssets.length === 0) {
        throw new OneKeyLocalError('DeFi action asset is missing');
      }

      const isWithdraw = action.action === EDeFiPositionAction.Withdraw;
      const isRemoveLiquidity =
        action.action === EDeFiPositionAction.RemoveLiquidity;
      const percentageAction = isPercentageAction(action.action);
      const bps = percentageAction ? buildDeFiActionBps(percent) : undefined;
      if (percentageAction && !bps) {
        throw new OneKeyLocalError('Invalid DeFi action percentage');
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
            amount: undefined,
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
              amount: undefined,
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
          unsignedTxs.push(
            attachDeFiActionTxConfirmInfo({
              unsignedTx,
              info: buildDeFiActionTxConfirmInfo({
                action,
                selectedAsset,
                percent,
                intl,
              }),
            }),
          );
        }

        let txConfirmInitError: Error | undefined;
        let isTxConfirmInitializing = true;
        try {
          await navigationToTxConfirm({
            unsignedTxs,
            gasAccountScenario: 'earn',
            onSuccess: async (data: ISendTxOnSuccessData[]) => {
              await addDeFiActionEarnOrders({
                action,
                networkId,
                data,
              });
              await onSuccess?.({ accountId, networkId, data });
            },
            onFail: (error: Error) => {
              if (isTxConfirmInitializing) {
                txConfirmInitError = error;
                return;
              }
              Toast.error({
                title: getErrorMessage(error),
              });
            },
          });
        } finally {
          isTxConfirmInitializing = false;
        }
        if (txConfirmInitError) {
          throw new OneKeyLocalError(getErrorMessage(txConfirmInitError));
        }
      } catch (error) {
        Toast.error({
          title: getErrorMessage(error),
        });
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

function ProtocolPositionActionCurrentLine({
  label,
  action,
  asset,
  selectedAsset,
  currencySymbol,
  priceUnavailableLabel,
}: {
  label: string;
  action: EDeFiPositionAction;
  asset: IProtocolPositionActionPreviewAsset;
  selectedAsset: IResolvedDeFiPositionActionAsset;
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  const isLiquidity =
    action === EDeFiPositionAction.RemoveLiquidity &&
    (selectedAsset.underlyingAssets?.length ?? 0) > 0;
  const displaySymbol = getSelectedAssetDisplaySymbol({
    action,
    selectedAsset,
  });
  const underlyingTokens =
    selectedAsset.underlyingAssets?.map((item) => ({
      tokenImageUri: item.meta?.logoUrl,
    })) ?? [];
  return (
    <XStack alignItems="center" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack flex={1} alignItems="center" gap="$2" minWidth={0}>
        {isLiquidity ? (
          <>
            <TokenGroup
              tokens={underlyingTokens}
              size="xs"
              variant="overlapped"
              wrapperStyle="border"
              wrapperBorderColor="$bg"
              flexShrink={0}
            />
            <SizableText
              size="$bodyMdMedium"
              color="$text"
              numberOfLines={1}
              flexShrink={1}
            >
              {displaySymbol}
            </SizableText>
          </>
        ) : (
          <>
            <Token
              size="xs"
              tokenImageUri={asset.asset.meta?.logoUrl}
              bg="$bg"
            />
            <XStack alignItems="center" gap="$1" flexShrink={1} minWidth={0}>
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
                {asset.symbol}
              </SizableText>
            </XStack>
          </>
        )}
      </XStack>
      <ProtocolValueCell
        value={asset.asset.value}
        currencySymbol={currencySymbol}
        priceUnavailableLabel={priceUnavailableLabel}
        isUnavailable={isProtocolAssetValueUnavailable(asset.asset)}
        size="$bodyMdMedium"
        color="$text"
        textAlign="right"
        numberOfLines={1}
      />
    </XStack>
  );
}

function ProtocolPositionActionReceiveAmountRow({
  asset,
}: {
  asset: IProtocolPositionActionPreviewAsset;
}) {
  return (
    <XStack alignItems="center" gap="$2" minWidth={0}>
      <Token size="xs" tokenImageUri={asset.asset.meta?.logoUrl} bg="$bg" />
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
  );
}

// The received token amounts under the value hero. A single token sits inline
// and centered; multiple tokens (LP) stack into a left-aligned list — one
// amount per line, icons aligned — which scans far better than amounts floating
// side by side and scales cleanly past two tokens.
function ProtocolPositionActionReceiveAmount({
  assets,
}: {
  assets: IProtocolPositionActionPreviewAsset[];
}) {
  if (assets.length === 0) return null;
  if (assets.length === 1) {
    return <ProtocolPositionActionReceiveAmountRow asset={assets[0]} />;
  }
  return (
    <YStack alignItems="flex-start" gap="$2.5">
      {assets.map((asset, index) => (
        <ProtocolPositionActionReceiveAmountRow
          key={`${asset.asset.address}-${asset.symbol}-${index}`}
          asset={asset}
        />
      ))}
    </YStack>
  );
}

function ProtocolPositionActionReceiveHero({
  label,
  value,
  isUnavailable,
  showPriceUnavailableTooltip,
  estimated,
  assets,
  currencySymbol,
  priceUnavailableLabel,
}: {
  label: string;
  value: number;
  isUnavailable: boolean;
  showPriceUnavailableTooltip: boolean;
  estimated: boolean;
  assets: IProtocolPositionActionPreviewAsset[];
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  return (
    <YStack gap="$3" alignItems="center">
      <YStack gap="$1.5" alignItems="center">
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          {label}
        </SizableText>
        <XStack
          alignItems="center"
          justifyContent="center"
          gap="$1"
          minWidth={0}
        >
          {estimated ? (
            <SizableText size="$headingXl" color="$textSubdued">
              ≈
            </SizableText>
          ) : null}
          <ProtocolValueCell
            value={value}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
            isUnavailable={isUnavailable}
            showPriceUnavailableTooltip={showPriceUnavailableTooltip}
            size="$heading4xl"
            color="$text"
            textAlign="center"
            numberOfLines={1}
            fontVariant={['tabular-nums']}
          />
        </XStack>
      </YStack>
      <ProtocolPositionActionReceiveAmount assets={assets} />
    </YStack>
  );
}

function ProtocolPositionActionPercentSlider({
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
    <YStack gap="$3">
      <XStack alignItems="center" gap="$3">
        <Stack flex={1} minWidth={0}>
          <PerpsSlider
            value={normalizedPercent}
            onChange={(value) => onChange(normalizeActionPercent(value))}
            min={0}
            max={100}
            segments={PERCENTAGE_SLIDER_SEGMENTS}
            sliderHeight={6}
            snapTapToSegment
          />
        </Stack>
        <SizableText
          size="$headingLg"
          color="$text"
          textAlign="right"
          minWidth={48}
          flexShrink={0}
          fontVariant={['tabular-nums']}
        >
          {`${normalizedPercent}%`}
        </SizableText>
      </XStack>
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
              hoverStyle={{
                bg: selected ? '$bgActive' : '$bgStrong',
              }}
              pressStyle={{
                bg: selected ? '$bgActive' : '$bgStrong',
              }}
              onPress={() => onChange(presetPercent)}
            >
              {presetLabel}
            </Button>
          );
        })}
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

function ProtocolPositionActionDialogContent({
  accountId,
  networkId,
  action,
  onSuccess,
}: {
  accountId: string;
  networkId: string;
  action: IResolvedDeFiPositionAction;
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
  const actionLabel = getActionLabel({ action: action.action, intl });
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const isPercentAction = isPercentageAction(action.action);
  const actionPercentBps = isPercentAction
    ? buildDeFiActionBps(actionPercent)
    : undefined;
  const isConfirmDisabled =
    selectedAssets.length === 0 || (isPercentAction && !actionPercentBps);
  const selectable = action.assets.length > 1;
  const allSelected = selectedAssetIndexes.length === action.assets.length;
  const sourcePreviewAssets = useMemo(
    () =>
      selectedAssets.flatMap((selectedAsset) =>
        buildSelectedAssetSourcePreviewAssets({
          action: action.action,
          selectedAsset,
        }),
      ),
    [action.action, selectedAssets],
  );
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
  const receiveLabel = isPercentAction ? resultLabel : sourceLabel;
  const currentSourceAsset = sourcePreviewAssets[0];
  const currentSelectedAsset = selectedAssets[0];

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
    preventClose,
  }: {
    preventClose: () => void;
  }) => {
    if (selectedAssets.length === 0) {
      preventClose();
      return;
    }

    // Build + navigate WHILE the dialog stays open. The footer keeps the
    // confirm button in its loading state for the whole await and only
    // auto-closes once this resolves — so the server-side buildDeFiTransaction
    // call happens with the dialog (and a spinner) still on screen, handing
    // straight off to the tx-confirm modal. Closing first instead left a blank
    // gap until the modal mounted.
    try {
      await submitProtocolPositionAction({
        action,
        selectedAssets,
        percent: isPercentAction ? actionPercent : undefined,
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

  return (
    <YStack gap="$5">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {selectable ? assetSelector : null}
      {selectedAssets.length > 0 ? (
        <YStack gap="$6">
          {isPercentAction ? (
            <YStack gap="$5">
              {!selectable && currentSourceAsset && currentSelectedAsset ? (
                <ProtocolPositionActionCurrentLine
                  label={sourceLabel}
                  action={action.action}
                  asset={currentSourceAsset}
                  selectedAsset={currentSelectedAsset}
                  currencySymbol={currencySymbol}
                  priceUnavailableLabel={priceUnavailableLabel}
                />
              ) : null}
              <YStack gap="$4">
                <ProtocolPositionActionReceiveHero
                  label={resultLabel}
                  value={outputValueState.value}
                  isUnavailable={outputValueState.isUnavailable}
                  showPriceUnavailableTooltip={
                    outputValueState.showPriceUnavailableTooltip
                  }
                  estimated
                  assets={aggregatedOutputPreviewAssets}
                  currencySymbol={currencySymbol}
                  priceUnavailableLabel={priceUnavailableLabel}
                />
                <ProtocolPositionActionPercentSlider
                  percent={actionPercent}
                  maxLabel={maxLabel}
                  onChange={setActionPercent}
                />
              </YStack>
            </YStack>
          ) : (
            <ProtocolPositionActionReceive
              label={receiveLabel}
              assets={aggregatedOutputPreviewAssets}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              estimated={isPercentAction}
            />
          )}
        </YStack>
      ) : (
        <YStack py="$6" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_no_data })}
          </SizableText>
        </YStack>
      )}

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
  onSuccess,
}: {
  accountId: string;
  networkId: string;
  action: IResolvedDeFiPositionAction;
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
