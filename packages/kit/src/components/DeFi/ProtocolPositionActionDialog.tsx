import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
  type IResolvedDeFiPositionAction,
} from '@onekeyhq/shared/types/defi';

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
    return intl.formatMessage({ id: ETranslations.earn_claim });
  }
  if (action === EDeFiPositionAction.RemoveLiquidity) {
    return intl.formatMessage({
      id: ETranslations.dexmarket_details_liquidity_change_remove,
    });
  }
  return action;
}

function isValidAmount({
  amount,
  maxAmount,
}: {
  amount: string;
  maxAmount: string;
}) {
  const amountBN = new BigNumber(amount);
  const maxBN = new BigNumber(maxAmount);
  return (
    amountBN.isFinite() &&
    maxBN.isFinite() &&
    amountBN.gt(0) &&
    amountBN.lte(maxBN)
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

type IProtocolPositionActionSuccessParams = {
  accountId: string;
  networkId: string;
};

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
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [percent, setPercent] = useState(100);

  const selectedAsset = action.assets[selectedAssetIndex] ?? action.assets[0];
  const actionLabel = getActionLabel({ action: action.action, intl });
  const isWithdraw = action.action === EDeFiPositionAction.Withdraw;
  const isRemoveLiquidity =
    action.action === EDeFiPositionAction.RemoveLiquidity;
  const amountValid = useMemo(
    () =>
      !isWithdraw ||
      withdrawAll ||
      isValidAmount({
        amount,
        maxAmount: selectedAsset?.amount ?? '0',
      }),
    [amount, isWithdraw, selectedAsset?.amount, withdrawAll],
  );
  const isConfirmDisabled = !selectedAsset || !amountValid;

  const handleConfirm = async () => {
    if (!selectedAsset) {
      throw new OneKeyLocalError('DeFi action asset is missing');
    }

    const extraParams: IDeFiActionExtraParams = {
      ...selectedAsset.extraParams,
    };

    if (isRemoveLiquidity) {
      const amount0Min = getPositiveAmount(extraParams.amount0Min);
      const amount1Min = getPositiveAmount(extraParams.amount1Min);
      delete extraParams.amount0Min;
      delete extraParams.amount1Min;
      extraParams.percent = String(percent);
      if (amount0Min) {
        extraParams.amount0Min = amount0Min;
      }
      if (amount1Min) {
        extraParams.amount1Min = amount1Min;
      }
    }

    try {
      const resp = await backgroundApiProxy.serviceDeFi.buildDeFiTransaction({
        accountId,
        networkId,
        protocolId: action.protocolId,
        action: action.action,
        tokenAddress: isRemoveLiquidity
          ? undefined
          : selectedAsset.tokenAddress,
        amount: isWithdraw && !withdrawAll ? amount : undefined,
        withdrawAll: isWithdraw ? withdrawAll : undefined,
        extraParams,
      });

      if (resp.approvalTx) {
        throw new OneKeyLocalError(
          'DeFi approval transaction is not supported',
        );
      }

      if (!resp.tx) {
        throw new OneKeyLocalError('DeFi transaction is missing');
      }

      await navigationToTxConfirm({
        encodedTx: resp.tx as IEncodedTx,
        gasAccountScenario: 'earn',
        onSuccess: async () => {
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
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
  };

  return (
    <YStack gap="$4">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {action.assets.length > 1 && !isRemoveLiquidity ? (
        <XStack gap="$2" flexWrap="wrap">
          {action.assets.map((asset, index) => (
            <Button
              key={`${asset.tokenAddress ?? asset.symbol}-${index}`}
              testID={`defi-position-action-asset-${index}`}
              size="small"
              variant={selectedAssetIndex === index ? 'primary' : 'secondary'}
              onPress={() => {
                setSelectedAssetIndex(index);
                setAmount('');
                setWithdrawAll(false);
              }}
            >
              {asset.symbol}
            </Button>
          ))}
        </XStack>
      ) : null}

      {isWithdraw ? (
        <YStack gap="$2">
          <XStack gap="$2" alignItems="center">
            <Input
              testID="defi-position-action-amount-input"
              flex={1}
              value={amount}
              keyboardType="decimal-pad"
              placeholder={intl.formatMessage({
                id: ETranslations.content__amount,
              })}
              onChangeText={(value) => {
                setAmount(value);
                setWithdrawAll(false);
              }}
            />
            <Button
              testID="defi-position-action-max-button"
              size="medium"
              variant="secondary"
              onPress={() => {
                setAmount(selectedAsset?.amount ?? '');
                setWithdrawAll(true);
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_max })}
            </Button>
          </XStack>
          {selectedAsset ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`${selectedAsset.amount} ${selectedAsset.symbol}`}
            </SizableText>
          ) : null}
        </YStack>
      ) : null}

      {isRemoveLiquidity ? (
        <XStack gap="$2" flexWrap="wrap">
          {[25, 50, 75, 100].map((value) => (
            <Button
              key={value}
              testID={`defi-position-action-percent-${value}`}
              size="small"
              variant={percent === value ? 'primary' : 'secondary'}
              onPress={() => setPercent(value)}
            >
              {`${value}%`}
            </Button>
          ))}
        </XStack>
      ) : null}

      {!isWithdraw && !isRemoveLiquidity && selectedAsset ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {`${selectedAsset.amount} ${selectedAsset.symbol}`}
        </SizableText>
      ) : null}

      <Dialog.Footer
        showCancelButton
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
  type IProtocolPositionActionSuccessParams,
};
