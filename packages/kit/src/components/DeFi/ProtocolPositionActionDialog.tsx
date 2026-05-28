import { useCallback, useState } from 'react';

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
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
  type IResolvedDeFiPositionAction,
  type IResolvedDeFiPositionActionAsset,
} from '@onekeyhq/shared/types/defi';

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
    return intl.formatMessage({ id: ETranslations.earn_claim });
  }
  if (action === EDeFiPositionAction.RemoveLiquidity) {
    return intl.formatMessage({
      id: ETranslations.dexmarket_details_liquidity_change_remove,
    });
  }
  return action;
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
  return (
    <XStack
      testID={`defi-position-action-asset-${index}`}
      alignItems="center"
      gap="$3"
      minHeight={44}
      py="$2.5"
      cursor="pointer"
      userSelect="none"
      onPress={() => onSelect(index, true)}
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

type IProtocolPositionActionSuccessParams = {
  accountId: string;
  networkId: string;
};

type IProtocolPositionActionSubmitParams = {
  action: IResolvedDeFiPositionAction;
  selectedAsset: IResolvedDeFiPositionActionAsset;
  percent?: number;
};

function buildDeFiActionExtraParams({
  action,
  selectedAsset,
  percent,
}: IProtocolPositionActionSubmitParams): IDeFiActionExtraParams {
  const extraParams: IDeFiActionExtraParams = {
    ...selectedAsset.extraParams,
  };

  if (action.action === EDeFiPositionAction.RemoveLiquidity) {
    const amount0Min = getPositiveAmount(extraParams.amount0Min);
    const amount1Min = getPositiveAmount(extraParams.amount1Min);
    delete extraParams.amount0Min;
    delete extraParams.amount1Min;
    extraParams.percent = String(percent ?? 100);
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
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  return useCallback(
    async ({
      action,
      selectedAsset,
      percent,
    }: IProtocolPositionActionSubmitParams) => {
      const isWithdraw = action.action === EDeFiPositionAction.Withdraw;
      const isRemoveLiquidity =
        action.action === EDeFiPositionAction.RemoveLiquidity;
      const extraParams = buildDeFiActionExtraParams({
        action,
        selectedAsset,
        percent,
      });

      try {
        const resp = await backgroundApiProxy.serviceDeFi.buildDeFiTransaction({
          accountId,
          networkId,
          protocolId: action.protocolId,
          action: action.action,
          tokenAddress: isRemoveLiquidity
            ? undefined
            : selectedAsset.tokenAddress,
          amount: undefined,
          withdrawAll: isWithdraw ? true : undefined,
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
    },
    [accountId, intl, navigationToTxConfirm, networkId, onSuccess],
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
  const [selectedAssetIndex, setSelectedAssetIndex] = useState<
    number | undefined
  >(action.assets[0] ? 0 : undefined);
  const [percent, setPercent] = useState(100);

  const selectedAsset =
    typeof selectedAssetIndex === 'number'
      ? action.assets[selectedAssetIndex]
      : undefined;
  const actionLabel = getActionLabel({ action: action.action, intl });
  const isRemoveLiquidity =
    action.action === EDeFiPositionAction.RemoveLiquidity;
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const isConfirmDisabled = !selectedAsset;

  const handleAssetSelect = (index: number, selected: boolean) => {
    setSelectedAssetIndex(selected ? index : undefined);
  };

  const handleConfirm = async () => {
    if (!selectedAsset) {
      throw new OneKeyLocalError('DeFi action asset is missing');
    }

    await submitProtocolPositionAction({
      action,
      selectedAsset,
      percent,
    });
  };

  return (
    <YStack gap="$4">
      <Dialog.Header>
        <Dialog.Title>{actionLabel}</Dialog.Title>
      </Dialog.Header>

      {!isRemoveLiquidity ? (
        <YStack>
          {action.assets.map((asset, index) => (
            <ProtocolPositionActionAssetRow
              key={`${asset.tokenAddress ?? asset.symbol}-${index}`}
              asset={asset}
              index={index}
              isSelected={selectedAssetIndex === index}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              onSelect={handleAssetSelect}
            />
          ))}
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
