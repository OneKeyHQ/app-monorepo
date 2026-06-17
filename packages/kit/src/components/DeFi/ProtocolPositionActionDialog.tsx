import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { PerpsSlider } from '@onekeyhq/kit/src/views/Perp/components/PerpsSlider';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { buildDeFiActionBps } from '@onekeyhq/shared/src/utils/defiActionUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
  type IDeFiActionTxConfirmInfo,
  type IDeFiAsset,
  type IResolvedDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import {
  ProtocolValueCell,
  isProtocolAssetValueUnavailable,
} from './ProtocolValueCell';

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
  if (action === EDeFiPositionAction.Claim) {
    return intl.formatMessage({ id: ETranslations.earn_claim_rewards__action });
  }
  if (action === EDeFiPositionAction.ClaimWithdrawal) {
    return intl.formatMessage({
      id: ETranslations.earn_claim_redemption__action,
    });
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

const DEFAULT_ACTION_PERCENT = 100;
const PERCENTAGE_SLIDER_SEGMENTS = 4;

type IProtocolPositionActionPreviewAsset = {
  asset: IDeFiAsset;
  amount: string;
  symbol: string;
  value: number;
};

function normalizeActionPercent(percent?: number) {
  if (!Number.isFinite(percent)) return DEFAULT_ACTION_PERCENT;
  return Math.max(
    0,
    Math.min(100, Math.round(percent ?? DEFAULT_ACTION_PERCENT)),
  );
}

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

function getPreviewSourceAssets({
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
  return getPreviewSourceAssets({ action, selectedAsset }).map((asset) => ({
    asset,
    amount: isPercentAction
      ? scaleAmountByPercent(asset.amount, percent)
      : asset.amount,
    symbol: asset.symbol,
    value: isPercentAction
      ? scaleValueByPercent(asset.value, percent)
      : asset.value,
  }));
}

function getPreviewAssetsValueState(
  assets: IProtocolPositionActionPreviewAsset[],
) {
  return {
    value: assets.reduce((total, item) => total + item.value, 0),
    isUnavailable:
      assets.length > 0 &&
      assets.every((item) => isProtocolAssetValueUnavailable(item.asset)),
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

function getPositiveAmount(value?: string) {
  if (!value) return undefined;
  const amountBN = new BigNumber(value);
  return amountBN.isFinite() && amountBN.gt(0) ? value : undefined;
}

function isPercentageAction(action: EDeFiPositionAction) {
  return (
    action === EDeFiPositionAction.Withdraw ||
    action === EDeFiPositionAction.RemoveLiquidity
  );
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

type IProtocolPositionActionSuccessParams = {
  accountId: string;
  networkId: string;
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
  delete extraParams['unbondNonces'];
  // oxlint-disable-next-line @cspell/spellchecker
  delete extraParams['unbond_nonces'];

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

          if (resp.approvalTx) {
            throw new OneKeyLocalError(
              'DeFi approval transaction is not supported',
            );
          }

          if (!resp.tx) {
            throw new OneKeyLocalError('DeFi transaction is missing');
          }

          const unsignedTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              accountId,
              networkId,
              encodedTx: resp.tx as IEncodedTx,
              prevNonce,
              withUuid: selectedAssets.length > 1,
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
            onSuccess: async () => {
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.feedback_transaction_submitted,
                }),
                message: intl.formatMessage({
                  id: ETranslations.earn_pending_transactions_data_out_of_sync,
                }),
              });
              await onSuccess?.({ accountId, networkId });
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

function ProtocolPositionActionPreviewRow({
  asset,
  currencySymbol,
  priceUnavailableLabel,
}: {
  asset: IProtocolPositionActionPreviewAsset;
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  return (
    <XStack alignItems="center" gap="$2.5" minHeight={36}>
      <Token size="xs" tokenImageUri={asset.asset.meta?.logoUrl} bg="$bg" />
      <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
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
      <ProtocolValueCell
        value={asset.value}
        currencySymbol={currencySymbol}
        priceUnavailableLabel={priceUnavailableLabel}
        isUnavailable={isProtocolAssetValueUnavailable(asset.asset)}
        size="$bodySm"
        color="$textSubdued"
        textAlign="right"
        numberOfLines={1}
      />
    </XStack>
  );
}

function ProtocolPositionActionPreviewPanel({
  label,
  assets,
  currencySymbol,
  priceUnavailableLabel,
}: {
  label: string;
  assets: IProtocolPositionActionPreviewAsset[];
  currencySymbol: string;
  priceUnavailableLabel: string;
}) {
  const valueState = getPreviewAssetsValueState(assets);

  return (
    <YStack
      gap="$2"
      p="$3"
      borderRadius="$2"
      bg="$bgSubdued"
      borderWidth="$px"
      borderColor="$borderSubdued"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {label}
        </SizableText>
        <ProtocolValueCell
          value={valueState.value}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          isUnavailable={valueState.isUnavailable}
          size="$bodyMdMedium"
          textAlign="right"
          numberOfLines={1}
        />
      </XStack>
      <YStack gap="$1">
        {assets.map((asset, index) => (
          <ProtocolPositionActionPreviewRow
            key={`${asset.asset.address}-${asset.symbol}-${index}`}
            asset={asset}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
          />
        ))}
      </YStack>
    </YStack>
  );
}

function ProtocolPositionActionPercentControl({
  percent,
  onChange,
}: {
  percent: number;
  onChange: (percent: number) => void;
}) {
  return (
    <YStack gap="$2">
      <PerpsSlider
        value={percent}
        onChange={(value) => onChange(normalizeActionPercent(value))}
        min={0}
        max={100}
        segments={PERCENTAGE_SLIDER_SEGMENTS}
        sliderHeight={4}
        showBubble
        snapTapToSegment
      />
      <XStack justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          0%
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          100%
        </SizableText>
      </XStack>
    </YStack>
  );
}

function ProtocolPositionActionModelSection({
  label,
  assets,
  currencySymbol,
  priceUnavailableLabel,
  emphasized,
}: {
  label: string;
  assets: IProtocolPositionActionPreviewAsset[];
  currencySymbol: string;
  priceUnavailableLabel: string;
  emphasized?: boolean;
}) {
  const valueState = getPreviewAssetsValueState(assets);

  return (
    <YStack gap="$2">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {label}
        </SizableText>
        <ProtocolValueCell
          value={valueState.value}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          isUnavailable={valueState.isUnavailable}
          size={emphasized ? '$bodyLgMedium' : '$bodyMdMedium'}
          textAlign="right"
          numberOfLines={1}
        />
      </XStack>
      <YStack gap="$1">
        {assets.map((asset, index) => (
          <ProtocolPositionActionPreviewRow
            key={`${asset.asset.address}-${asset.symbol}-${index}`}
            asset={asset}
            currencySymbol={currencySymbol}
            priceUnavailableLabel={priceUnavailableLabel}
          />
        ))}
      </YStack>
    </YStack>
  );
}

function ProtocolPositionPercentageActionModel({
  actionLabel,
  percent,
  availableLabel,
  outputLabel,
  availableAssets,
  outputAssets,
  currencySymbol,
  priceUnavailableLabel,
  onPercentChange,
}: {
  actionLabel: string;
  percent: number;
  availableLabel: string;
  outputLabel: string;
  availableAssets: IProtocolPositionActionPreviewAsset[];
  outputAssets: IProtocolPositionActionPreviewAsset[];
  currencySymbol: string;
  priceUnavailableLabel: string;
  onPercentChange: (percent: number) => void;
}) {
  return (
    <YStack gap="$5">
      <YStack gap="$1.5">
        <SizableText size="$heading2xl" color="$text">
          {actionLabel} {percent}%
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {outputLabel}
        </SizableText>
      </YStack>

      <ProtocolPositionActionPercentControl
        percent={percent}
        onChange={onPercentChange}
      />

      <YStack gap="$3" p="$4" borderRadius="$3" bg="$bgSubdued">
        <ProtocolPositionActionModelSection
          label={availableLabel}
          assets={availableAssets}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
        />
        <Divider />
        <ProtocolPositionActionModelSection
          label={outputLabel}
          assets={outputAssets}
          currencySymbol={currencySymbol}
          priceUnavailableLabel={priceUnavailableLabel}
          emphasized
        />
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
  const availablePreviewAssets = useMemo(
    () =>
      selectedAssets.flatMap((selectedAsset) =>
        buildSelectedAssetPreviewAssets({
          action: action.action,
          selectedAsset,
          percent: DEFAULT_ACTION_PERCENT,
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
  const selectAllLabel = intl.formatMessage({
    id: allSelected
      ? ETranslations.global_deselect_all
      : ETranslations.global_select_all,
  });
  const availableLabel =
    action.action === EDeFiPositionAction.Claim
      ? intl.formatMessage({ id: ETranslations.earn_claimable })
      : intl.formatMessage({ id: ETranslations.global_available });
  const currentLabel = intl.formatMessage({
    id: ETranslations.global_current,
  });
  const outputLabel = isPercentAction
    ? intl.formatMessage({ id: ETranslations.perp_you_will_get })
    : actionLabel;

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
  }: {
    close: (extra?: { flag?: string }) => Promise<void> | void;
  }) => {
    if (selectedAssets.length === 0) {
      throw new OneKeyLocalError('DeFi action asset is missing');
    }

    await close({ flag: 'confirm' });
    void submitProtocolPositionAction({
      action,
      selectedAssets,
      percent: isPercentAction ? actionPercent : undefined,
    }).catch(() => undefined);
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
    <YStack gap={isPercentAction ? '$5' : '$4'}>
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {isPercentAction ? (
        <>
          {selectable ? assetSelector : null}
          {selectedAssets.length > 0 ? (
            <ProtocolPositionPercentageActionModel
              actionLabel={actionLabel}
              percent={actionPercent}
              availableLabel={currentLabel}
              outputLabel={outputLabel}
              availableAssets={availablePreviewAssets}
              outputAssets={outputPreviewAssets}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              onPercentChange={setActionPercent}
            />
          ) : null}
        </>
      ) : (
        <>
          {assetSelector}
          {selectedAssets.length > 0 ? (
            <>
              <Divider />
              <ProtocolPositionActionPreviewPanel
                label={availableLabel}
                assets={availablePreviewAssets}
                currencySymbol={currencySymbol}
                priceUnavailableLabel={priceUnavailableLabel}
              />
              <ProtocolPositionActionPreviewPanel
                label={outputLabel}
                assets={outputPreviewAssets}
                currencySymbol={currencySymbol}
                priceUnavailableLabel={priceUnavailableLabel}
              />
            </>
          ) : null}
        </>
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
