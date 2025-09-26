import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  calculateProfitLoss,
  formatPriceToSignificantDigits,
  formatWithPrecision,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IOrderResponse,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../TradingGuardWrapper';
import { PriceInput } from '../TradingPanel/inputs/PriceInput';
import { TradingFormInput } from '../TradingPanel/inputs/TradingFormInput';

type IPosition =
  IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];

type ICloseType = 'market' | 'limit';

const DIALOG_TITLES = {
  market: appLocale.intl.formatMessage({
    id: ETranslations.perp_close_position_button_market,
  }),
  limit: appLocale.intl.formatMessage({
    id: ETranslations.perp_close_position_button_limit,
  }),
};

const getClosePositionDialogTitle = (currentType: ICloseType) =>
  DIALOG_TITLES[currentType];

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
    // TODO should refresh UI realtime
    const { result: midPrice } = usePromiseResult(async () => {
      return backgroundApiProxy.serviceHyperliquid.getSymbolMidValue({
        coin: position.coin,
      });
    }, [position.coin]);

    const markPrice = useMemo(() => {
      const currentMidPrice = midPrice || '0';
      return currentMidPrice;
    }, [midPrice]);

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
      amount: formatWithPrecision(position.szi, szDecimals, true),
      limitPrice: '',
      percentage: 100,
    });

    const [userSetPrice, setUserSetPrice] = useState(false);
    const initPriceRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
      if (!markPrice) return;

      if (!initPriceRef.current && !userSetPrice && isMountedRef.current) {
        setFormData((prev) => ({
          ...prev,
          limitPrice: formatPriceToSignificantDigits(markPrice),
        }));
        initPriceRef.current = true;
      }
    }, [markPrice, userSetPrice]);

    useEffect(() => {
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const calculatedAmount = useMemo(() => {
      const percentage = Number.isNaN(formData.percentage)
        ? 0
        : formData.percentage;
      const amount = positionSize.multipliedBy(percentage).dividedBy(100);
      return formatWithPrecision(amount.toNumber(), szDecimals, true);
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
          amount: formatWithPrecision(amount, szDecimals, true),
        }));
      },
      [positionSize, szDecimals],
    );

    const handleAmountChange = useCallback(
      (value: string) => {
        const processedValue = value.replace(/。/g, '.');

        if (processedValue === '' || processedValue === '.') {
          setFormData((prev) => ({
            ...prev,
            amount: processedValue,
            percentage: processedValue === '' ? 0 : prev.percentage,
          }));
          return;
        }

        const numericValue = new BigNumber(processedValue);
        if (numericValue.isNaN()) {
          return;
        }

        if (numericValue.gt(positionSize)) {
          setFormData((prev) => ({
            ...prev,
            amount: formatWithPrecision(position.szi, szDecimals, true),
            percentage: 100,
          }));
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
      [positionSize, position.szi, szDecimals],
    );

    const handleLimitPriceChange = useCallback(
      (value: string) => {
        const processedValue = value.replace(/。/g, '.');
        setFormData((prev) => ({
          ...prev,
          limitPrice: processedValue,
        }));

        if (!userSetPrice) {
          setUserSetPrice(true);
        }
      },
      [userSetPrice],
    );

    const handleUseMid = useCallback(() => {
      const latestMarkPrice = midPrice;
      if (latestMarkPrice && latestMarkPrice !== '0') {
        setFormData((prev) => ({
          ...prev,
          limitPrice: formatPriceToSignificantDigits(latestMarkPrice),
        }));
        setUserSetPrice(false);
        initPriceRef.current = true;
      }
    }, [midPrice]);

    const handleTypeChange = useCallback((value: string) => {
      setFormData((prev) => ({
        ...prev,
        type: value as ICloseType,
      }));
    }, []);

    const handleSubmit = useCallback(async () => {
      try {
        if (isMountedRef.current) {
          setIsSubmitting(true);
        }

        const closeAmount = formData.amount || calculatedAmount;
        const closeAmountBN = new BigNumber(closeAmount);

        if (!closeAmount || closeAmountBN.lte(0)) {
          throw new OneKeyLocalError({
            message: 'Please enter a valid amount',
          });
        }

        if (formData.type === 'market') {
          const latestMarkPrice = midPrice;
          if (!latestMarkPrice || latestMarkPrice === '0') {
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
        }

        hyperliquidActions.current.resetTradingForm();
        if (isMountedRef.current) {
          onClose();
        }
      } catch (error) {
        if (isMountedRef.current) {
          Toast.error({
            title: 'Close Position Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to close position',
          });
        }
        throw error;
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    }, [
      formData.amount,
      formData.type,
      formData.limitPrice,
      calculatedAmount,
      assetId,
      midPrice,
      isLongPosition,
      hyperliquidActions,
      onClose,
    ]);

    const estimatedProfit = useMemo(() => {
      const exitPrice = formData.limitPrice;
      if (!exitPrice || !position.entryPx) return '$0.00';

      const amount = formData.amount || Math.abs(+position.szi);
      if (!amount) return '$0.00';

      return calculateProfitLoss({
        entryPrice: position.entryPx,
        exitPrice,
        amount,
        side: isLongPosition ? 'long' : 'short',
        formatOptions: {
          currency: '$',
          decimals: 2,
          showSign: false,
        },
      });
    }, [
      formData.amount,
      formData.limitPrice,
      position.entryPx,
      position.szi,
      isLongPosition,
    ]);

    const isAmountValid = useMemo(() => {
      const amount = formData.amount || calculatedAmount;
      if (!amount) return false;

      const amountBN = new BigNumber(amount);
      if (!amountBN.isFinite()) return false;

      return amountBN.gt(0) && amountBN.lte(positionSize);
    }, [formData.amount, calculatedAmount, positionSize]);

    const isPriceValid = useMemo(() => {
      if (formData.type === 'market') {
        return Boolean(markPrice);
      }

      const limitPrice = new BigNumber(formData.limitPrice || '0');
      if (!limitPrice.isFinite() || limitPrice.isZero()) return false;

      const liquidationPrice = position.liquidationPx;
      if (liquidationPrice) {
        if (
          (!isLongPosition && limitPrice.gt(liquidationPrice)) ||
          (isLongPosition && limitPrice.lt(liquidationPrice))
        ) {
          return false;
        }
      }

      return limitPrice.gt(0);
    }, [
      formData.type,
      formData.limitPrice,
      markPrice,
      isLongPosition,
      position.liquidationPx,
    ]);

    const isFormValid = useMemo(() => {
      return isAmountValid && isPriceValid;
    }, [isAmountValid, isPriceValid]);

    return (
      <YStack gap="$4">
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_token_selector_asset,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">{position.coin}</SizableText>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_position_position_size,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">
              {positionSize.toNumber()} {position.coin}
            </SizableText>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_trade_order_type,
              })}
            </SizableText>
            <XStack
              alignItems="center"
              onPress={() =>
                handleTypeChange(formData.type === 'limit' ? 'market' : 'limit')
              }
              cursor="pointer"
              gap="$1"
            >
              <SizableText size="$bodyMdMedium">
                {formData.type === 'limit'
                  ? appLocale.intl.formatMessage({
                      id: ETranslations.perp_trade_limit,
                    })
                  : appLocale.intl.formatMessage({
                      id: ETranslations.perp_trade_market,
                    })}
              </SizableText>
              <Icon
                name="RepeatOutline"
                size="$3.5"
                color="$text"
                fontWeight="600"
              />
            </XStack>
          </XStack>
        </YStack>

        {formData.type === 'limit' ? (
          <PriceInput
            label={appLocale.intl.formatMessage({
              id: ETranslations.perp_trade_limit_pirce,
            })}
            value={formData.limitPrice}
            onChange={handleLimitPriceChange}
            onUseMarketPrice={handleUseMid}
            disabled={!markPrice}
            szDecimals={szDecimals}
            ifOnDialog
          />
        ) : null}

        <TradingFormInput
          label={appLocale.intl.formatMessage({
            id: ETranslations.dexmarket_details_history_amount,
          })}
          value={
            formData.amount || (formData.percentage > 0 ? calculatedAmount : '')
          }
          onChange={handleAmountChange}
          suffix={position.coin}
          validator={(value: string) => {
            const processedValue = value.replace(/。/g, '.');
            return validateSizeInput(processedValue, szDecimals);
          }}
          ifOnDialog
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
        <XStack justifyContent="space-between" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            Estimated Profit
          </SizableText>
          <SizableText size="$bodyMdMedium">{estimatedProfit}</SizableText>
        </XStack>
        <TradingGuardWrapper>
          <Button
            size="large"
            variant="primary"
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            loading={isSubmitting}
          >
            {appLocale.intl.formatMessage({
              id: ETranslations.perp_confirm_order,
            })}
          </Button>{' '}
        </TradingGuardWrapper>
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
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_close_position_title,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <ClosePositionForm
          position={position}
          type={type}
          szDecimals={szDecimals}
          assetId={assetId}
          hyperliquidActions={hyperliquidActions}
          onClose={() => dialogInstance.close()}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
  });

  return dialogInstance;
}
