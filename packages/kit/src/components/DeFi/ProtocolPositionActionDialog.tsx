import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  Input,
  SizableText,
  Slider,
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
  DEFI_ACTION_MAX_PERCENT,
  DEFI_ACTION_MIN_PERCENT,
  buildDeFiActionBps,
} from '@onekeyhq/shared/src/utils/defiActionUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  EDeFiPositionAction,
  type IDeFiActionExtraParams,
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

function isPercentageAction(action: EDeFiPositionAction) {
  return (
    action === EDeFiPositionAction.Withdraw ||
    action === EDeFiPositionAction.RemoveLiquidity
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return DEFI_ACTION_MAX_PERCENT;
  return Math.min(
    DEFI_ACTION_MAX_PERCENT,
    Math.max(DEFI_ACTION_MIN_PERCENT, Math.round(value)),
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
}: Pick<
  IProtocolPositionActionSubmitParams,
  'action' | 'selectedAsset'
>): IDeFiActionExtraParams {
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
    async ({
      action,
      selectedAsset,
      percent,
    }: IProtocolPositionActionSubmitParams) => {
      const isWithdraw = action.action === EDeFiPositionAction.Withdraw;
      const isRemoveLiquidity =
        action.action === EDeFiPositionAction.RemoveLiquidity;
      const percentageAction = isPercentageAction(action.action);
      const bps = percentageAction ? buildDeFiActionBps(percent) : undefined;
      if (percentageAction && !bps) {
        throw new OneKeyLocalError('Invalid DeFi action percentage');
      }
      const extraParams = buildDeFiActionExtraParams({
        action,
        selectedAsset,
      });

      try {
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

        await navigationToTxConfirm({
          encodedTx: resp.tx as IEncodedTx,
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

function ProtocolPositionActionPercentInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const [inputValue, setInputValue] = useState(
    String(value ?? DEFI_ACTION_MAX_PERCENT),
  );
  const sliderValue = value ?? DEFI_ACTION_MIN_PERCENT;
  const handlePercentChange = useCallback(
    (nextValue: number) => {
      const nextPercent = clampPercent(nextValue);
      setInputValue(String(nextPercent));
      onChange(nextPercent);
    },
    [onChange],
  );
  const handleInputChange = useCallback(
    (text: string) => {
      const sanitizedText = text.replace(/[^\d]/g, '');
      if (!sanitizedText) {
        setInputValue('');
        onChange(undefined);
        return;
      }
      const nextPercent = clampPercent(Number(sanitizedText));
      setInputValue(String(nextPercent));
      onChange(nextPercent);
    },
    [onChange],
  );

  return (
    <YStack gap="$3">
      <XStack gap="$3" alignItems="center">
        <Slider
          testID="defi-position-action-percent-slider"
          flex={1}
          minWidth={0}
          min={DEFI_ACTION_MIN_PERCENT}
          max={DEFI_ACTION_MAX_PERCENT}
          step={1}
          value={sliderValue}
          onChange={handlePercentChange}
        />
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          width={56}
          textAlign="right"
        >
          {value === undefined ? '--%' : `${value}%`}
        </SizableText>
      </XStack>
      <XStack gap="$2" alignItems="center">
        <Input
          testID="defi-position-action-percent-input"
          flex={1}
          minWidth={0}
          value={inputValue}
          onChangeText={handleInputChange}
          keyboardType="numeric"
          textAlign="right"
        />
        <SizableText size="$bodyMd" color="$textSubdued" width={20}>
          %
        </SizableText>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        {[25, 50, 75, 100].map((percentValue) => (
          <Button
            key={percentValue}
            testID={`defi-position-action-percent-${percentValue}`}
            size="small"
            variant={value === percentValue ? 'primary' : 'secondary'}
            onPress={() => handlePercentChange(percentValue)}
          >
            {`${percentValue}%`}
          </Button>
        ))}
      </XStack>
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
  const [selectedAssetIndex, setSelectedAssetIndex] = useState<
    number | undefined
  >(action.assets[0] ? 0 : undefined);
  const [percent, setPercent] = useState<number | undefined>(
    DEFI_ACTION_MAX_PERCENT,
  );

  const selectedAsset =
    typeof selectedAssetIndex === 'number'
      ? action.assets[selectedAssetIndex]
      : undefined;
  const actionLabel = getActionLabel({ action: action.action, intl });
  const percentageAction = isPercentageAction(action.action);
  const priceUnavailableLabel = intl.formatMessage({
    id: ETranslations.wallet_price_unavailable,
  });
  const isConfirmDisabled =
    !selectedAsset || (percentageAction && percent === undefined);

  const handleAssetSelect = (index: number, selected: boolean) => {
    setSelectedAssetIndex(selected ? index : undefined);
  };
  const showAssetSelector = useMemo(
    () => action.action !== EDeFiPositionAction.RemoveLiquidity,
    [action.action],
  );

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

      {showAssetSelector ? (
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

      {percentageAction ? (
        <ProtocolPositionActionPercentInput
          value={percent}
          onChange={setPercent}
        />
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
