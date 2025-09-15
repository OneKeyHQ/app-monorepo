import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Slider,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useAllMidsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  formatWithPrecision,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IOrderResponse,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { PriceInput } from '../TradingPanel/inputs/PriceInput';
import { TradingFormInput } from '../TradingPanel/inputs/TradingFormInput';

type IPosition =
  IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];

type ICloseType = 'market' | 'limit';

interface IClosePositionFormData {
  type: ICloseType;
  amount: string;
  limitPrice: string;
  percentage: number;
}

interface IClosePositionParams {
  position: IPosition;
  type: ICloseType;
  szDecimals: number;
  assetId: number;
  hyperliquidActions: {
    current: {
      orderClose: (params: {
        assetId: number;
        isBuy: boolean;
        size: string;
        midPx: string;
      }) => Promise<IOrderResponse>;
      limitOrderClose: (params: {
        assetId: number;
        isBuy: boolean;
        size: string;
        limitPrice: string;
      }) => Promise<IOrderResponse>;
      resetTradingForm: () => void;
    };
  };
}

interface IClosePositionFormProps extends IClosePositionParams {
  onClose: () => void;
}

const ClosePositionForm = memo(
  ({
    position,
    type,
    szDecimals,
    assetId,
    hyperliquidActions,
    onClose,
  }: IClosePositionFormProps) => {
    const [allMids] = useAllMidsAtom();

    const getMidPrice = useCallback(() => {
      if (!allMids?.mids) return '0';
      const midPrice = allMids.mids[position.coin];
      return midPrice || '0';
    }, [allMids, position.coin]);

    const markPrice = useMemo(() => {
      const currentMidPrice = getMidPrice() || '0';
      return currentMidPrice;
    }, [getMidPrice]);

    const positionSize = useMemo(() => {
      const size = new BigNumber(position.szi || '0').abs();
      return size;
    }, [position.szi]);

    const isLongPosition = useMemo(
      () => new BigNumber(position.szi || '0').gte(0),
      [position.szi],
    );

    const [formData, setFormData] = useState<IClosePositionFormData>({
      type,
      amount: '',
      limitPrice: '',
      percentage: 100,
    });

    useEffect(() => {
      if (markPrice && !formData.limitPrice) {
        setFormData((prev) => ({
          ...prev,
          limitPrice: markPrice,
        }));
      }
    }, [markPrice, formData.limitPrice]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const calculatedAmount = useMemo(() => {
      const percentage = Number.isNaN(formData.percentage)
        ? 0
        : formData.percentage;
      const amount = positionSize.multipliedBy(percentage).dividedBy(100);
      return formatWithPrecision(amount.toNumber(), szDecimals);
    }, [positionSize, formData.percentage, szDecimals]);

    const handlePercentageChange = useCallback(
      (percentage: number) => {
        const amount = positionSize
          .multipliedBy(percentage)
          .dividedBy(100)
          .toFixed(szDecimals);
        setFormData((prev) => ({
          ...prev,
          percentage,
          amount,
        }));
      },
      [positionSize, szDecimals],
    );

    const handleAmountChange = useCallback(
      (value: string) => {
        const processedValue = value.replace(/。/g, '.');
        if (processedValue === '') {
          setFormData((prev) => ({
            ...prev,
            amount: '',
            percentage: 0,
          }));
          return;
        }
        if (processedValue === '.') {
          setFormData((prev) => ({
            ...prev,
            amount: processedValue,
            percentage: 0,
          }));
          return;
        }

        const numericValue = new BigNumber(processedValue);
        if (numericValue.isNaN()) {
          return;
        }

        const percentage = positionSize.gt(0)
          ? numericValue.dividedBy(positionSize).multipliedBy(100).toNumber()
          : 0;

        setFormData((prev) => ({
          ...prev,
          amount: processedValue,
          percentage: Math.min(100, Math.max(0, percentage)),
        }));
      },
      [positionSize],
    );

    const handleLimitPriceChange = useCallback((value: string) => {
      const processedValue = value.replace(/。/g, '.');
      setFormData((prev) => ({
        ...prev,
        limitPrice: processedValue,
      }));
    }, []);

    const handleUseMid = useCallback(() => {
      const latestMarkPrice = getMidPrice();
      if (latestMarkPrice) {
        setFormData((prev) => ({
          ...prev,
          limitPrice: latestMarkPrice,
        }));
      }
    }, [getMidPrice]);

    const handleTypeChange = useCallback((value: string) => {
      setFormData((prev) => ({
        ...prev,
        type: value as ICloseType,
      }));
    }, []);

    const handleSubmit = useCallback(async () => {
      try {
        setIsSubmitting(true);

        const closeAmount = formData.amount || calculatedAmount;
        const closeAmountBN = new BigNumber(closeAmount);

        if (!closeAmount || closeAmountBN.lte(0)) {
          throw new OneKeyLocalError({
            message: 'Please enter a valid amount',
          });
        }

        if (formData.type === 'market') {
          const latestMarkPrice = getMidPrice();
          if (!latestMarkPrice) {
            throw new OneKeyLocalError({
              message: 'Unable to get current market price',
            });
          }

          await hyperliquidActions.current.orderClose({
            assetId,
            isBuy: isLongPosition,
            size: closeAmount,
            midPx: latestMarkPrice,
          });

          Toast.success({
            title: 'Position Closed Successfully',
            message: `Market close for ${closeAmount} ${position.coin} has been submitted`,
          });
        } else {
          const limitPriceBN = new BigNumber(formData.limitPrice || '0');
          if (!formData.limitPrice || limitPriceBN.lte(0)) {
            throw new OneKeyLocalError({
              message: 'Please enter a valid limit price',
            });
          }

          await hyperliquidActions.current.limitOrderClose({
            assetId,
            isBuy: isLongPosition,
            size: closeAmount,
            limitPrice: formData.limitPrice,
          });

          Toast.success({
            title: 'Limit Close Order Placed',
            message: `Limit close for ${closeAmount} ${position.coin} at $${formData.limitPrice} has been submitted`,
          });
        }

        hyperliquidActions.current.resetTradingForm();
        onClose();
      } catch (error) {
        Toast.error({
          title: 'Close Position Failed',
          message:
            error instanceof Error ? error.message : 'Failed to close position',
        });
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    }, [
      formData,
      calculatedAmount,
      assetId,
      getMidPrice,
      isLongPosition,
      position.coin,
      hyperliquidActions,
      onClose,
    ]);

    const isFormValid = useMemo(() => {
      const amount = formData.amount || calculatedAmount;
      const amountBN = new BigNumber(amount || '0');

      if (!amount || amountBN.lte(0)) return false;
      if (amountBN.gt(positionSize)) return false;

      if (formData.type === 'market') {
        return Boolean(markPrice);
      }

      const limitPriceBN = new BigNumber(formData.limitPrice || '0');
      return Boolean(formData.limitPrice) && limitPriceBN.gt(0);
    }, [formData, calculatedAmount, positionSize, markPrice]);

    return (
      <YStack gap="$4">
        <SizableText size="$bodyLg">
          {formData.type === 'market'
            ? 'This will attempt to immediately close the position.'
            : 'This will send an order to close your position at the limit price.'}
        </SizableText>
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              Coin
            </SizableText>
            <SizableText size="$bodyMd" fontWeight="600">
              {position.coin}
            </SizableText>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              Position Size
            </SizableText>
            <SizableText size="$bodyMd" fontWeight="600">
              {positionSize.toNumber()} {position.coin}
            </SizableText>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              Price
            </SizableText>
            <XStack
              alignItems="center"
              onPress={() =>
                handleTypeChange(formData.type === 'limit' ? 'market' : 'limit')
              }
              cursor="pointer"
            >
              <SizableText size="$bodyMd">
                {formData.type === 'limit' ? 'Limit' : 'Market'}
              </SizableText>
              <Icon
                name="SwapVerOutline"
                size="$3.5"
                color="$text"
                fontWeight="600"
              />
            </XStack>
          </XStack>
        </YStack>

        {formData.type === 'limit' ? (
          <PriceInput
            label="Limit Price"
            value={formData.limitPrice}
            onChange={handleLimitPriceChange}
            onUseMarketPrice={handleUseMid}
            disabled={!markPrice}
            szDecimals={szDecimals}
          />
        ) : null}

        <TradingFormInput
          label="Amount"
          value={
            formData.amount || (formData.percentage > 0 ? calculatedAmount : '')
          }
          onChange={handleAmountChange}
          suffix={position.coin}
          validator={(value: string) => {
            const processedValue = value.replace(/。/g, '.');
            return validateSizeInput(processedValue, szDecimals);
          }}
          helper={{
            text: `Max: ${positionSize.toNumber()} ${position.coin}`,
            align: 'right',
          }}
        />

        <YStack gap="$2" p="$2">
          <Slider
            value={formData.percentage}
            onChange={handlePercentageChange}
            max={100}
            min={0}
            step={1}
          />
        </YStack>

        <Button
          size="large"
          variant="primary"
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          loading={isSubmitting}
        >
          {formData.type === 'market' ? 'Market Close' : 'Limit Close'}
        </Button>
      </YStack>
    );
  },
);

ClosePositionForm.displayName = 'ClosePositionForm';

export function showClosePositionDialog({
  position,
  type,
  szDecimals,
  assetId,
  hyperliquidActions,
}: IClosePositionParams) {
  const dialogInstance = Dialog.show({
    title: 'Close Position',
    renderContent: (
      <PerpsProviderMirror storeName={EJotaiContextStoreNames.perps}>
        <ClosePositionForm
          position={position}
          type={type}
          szDecimals={szDecimals}
          assetId={assetId}
          hyperliquidActions={hyperliquidActions}
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
