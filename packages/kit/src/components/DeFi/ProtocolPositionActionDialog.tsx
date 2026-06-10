import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
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
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { buildDeFiActionBps } from '@onekeyhq/shared/src/utils/defiActionUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
  type IDeFiActionTxConfirmInfo,
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
  if (
    action === EDeFiPositionAction.Claim ||
    action === EDeFiPositionAction.ClaimWithdrawal
  ) {
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

function ProtocolPositionActionAssetRow({
  asset,
  index,
  isSelected,
  currencySymbol,
  priceUnavailableLabel,
  onSelect,
}: {
  asset: IResolvedDeFiPositionActionAsset;
  index: number;
  isSelected: boolean;
  currencySymbol: string;
  priceUnavailableLabel: string;
  onSelect: (index: number, selected: boolean) => void;
}) {
  const extraLabel = getActionAssetExtraLabel(asset);

  return (
    <XStack
      testID={`defi-position-action-asset-${index}`}
      alignItems="center"
      gap="$3"
      minHeight={44}
      py="$2.5"
      cursor="pointer"
      userSelect="none"
      onPress={() => onSelect(index, !isSelected)}
    >
      <Token
        size="md"
        tokenImageUri={asset.asset.meta?.logoUrl}
        bg="$bgStrong"
      />
      <YStack flex={1} minWidth={0} justifyContent="center" gap="$0.5">
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
            {asset.symbol}
          </SizableText>
        </XStack>
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
  intl,
}: {
  action: IResolvedDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
  intl: ReturnType<typeof useIntl>;
}): IDeFiActionTxConfirmInfo {
  return {
    actionLabel: getActionLabel({ action: action.action, intl }),
    protocolId: action.protocolId,
    assetAmount: selectedAsset.amount,
    assetSymbol: selectedAsset.symbol,
    assetLogoUrl: selectedAsset.asset.meta?.logoUrl,
    extraLabel: getActionAssetExtraLabel(selectedAsset),
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
};

function buildDeFiActionExtraParams({
  action,
  selectedAsset,
}: {
  action: IResolvedDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
}): IDeFiActionExtraParams {
  const extraParams: IDeFiActionExtraParams = {
    ...selectedAsset.extraParams,
  };

  if (action.action === EDeFiPositionAction.RemoveLiquidity) {
    const amount0Min = getPositiveAmount(extraParams.amount0Min);
    const amount1Min = getPositiveAmount(extraParams.amount1Min);
    delete extraParams.amount0Min;
    delete extraParams.amount1Min;
    if (amount0Min) {
      extraParams.amount0Min = amount0Min;
    }
    if (amount1Min) {
      extraParams.amount1Min = amount1Min;
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
    async ({ action, selectedAssets }: IProtocolPositionActionSubmitParams) => {
      if (selectedAssets.length === 0) {
        throw new OneKeyLocalError('DeFi action asset is missing');
      }

      const isWithdraw = action.action === EDeFiPositionAction.Withdraw;
      const isRemoveLiquidity =
        action.action === EDeFiPositionAction.RemoveLiquidity;
      const percentageAction = isPercentageAction(action.action);
      const bps = percentageAction ? buildDeFiActionBps() : undefined;
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
                intl,
              }),
            }),
          );
        }

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
            Toast.error({
              title: getErrorMessage(error),
            });
          },
        });
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
  const isConfirmDisabled = selectedAssets.length === 0;

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

  const handleConfirm = async () => {
    if (selectedAssets.length === 0) {
      throw new OneKeyLocalError('DeFi action asset is missing');
    }

    await submitProtocolPositionAction({
      action,
      selectedAssets,
    });
  };

  return (
    <YStack gap="$4">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {action.assets.length > 0 ? (
        <YStack>
          {action.assets.map((asset, index) => (
            <ProtocolPositionActionAssetRow
              key={`${asset.tokenAddress ?? asset.symbol}-${index}`}
              asset={asset}
              index={index}
              isSelected={selectedAssetIndexes.includes(index)}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              onSelect={handleAssetSelect}
            />
          ))}
        </YStack>
      ) : null}

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
