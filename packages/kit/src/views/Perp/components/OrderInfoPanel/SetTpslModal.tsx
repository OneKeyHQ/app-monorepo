import { memo, useCallback, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  Slider,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useAllMidsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
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
import { TpslInput } from '../TradingPanel/inputs/TpslInput';
import { TradingFormInput } from '../TradingPanel/inputs/TradingFormInput';

type IPosition =
  IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];

interface ISetTpslParams {
  position: IPosition;
  szDecimals: number;
  assetId: number;
  hyperliquidActions: {
    current: {
      setPositionTpsl: (params: {
        assetId: number;
        positionSize: string;
        isBuy: boolean;
        tpTriggerPx?: string;
        slTriggerPx?: string;
        slippage?: number;
      }) => Promise<IOrderResponse>;
    };
  };
}

interface ISetTpslFormProps extends ISetTpslParams {
  onClose: () => void;
}

const SetTpslForm = memo(
  ({
    position,
    szDecimals,
    assetId,
    hyperliquidActions,
    onClose,
  }: ISetTpslFormProps) => {
    const [allMids] = useAllMidsAtom();
    const getMidPrice = useCallback(() => {
      if (!allMids?.mids) return '0';
      const midPrice = formatPriceToSignificantDigits(
        allMids.mids[position.coin],
        szDecimals,
      );
      return midPrice || '0';
    }, [allMids, position.coin, szDecimals]);

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

    const entryPrice = useMemo(() => {
      return position.entryPx || '0';
    }, [position.entryPx]);

    const leverage = useMemo(() => {
      const positionValue = new BigNumber(position.positionValue || '0').abs();
      const marginUsed = new BigNumber(position.marginUsed || '0');
      if (marginUsed.gt(0) && positionValue.gt(0)) {
        return Math.round(positionValue.dividedBy(marginUsed).toNumber());
      }
      return 1; // Default leverage if calculation fails
    }, [position.positionValue, position.marginUsed]);

    const [formData, setFormData] = useState({
      tpPrice: '',
      slPrice: '',
      amount: '',
      percentage: 100,
    });

    const [configureAmount, setConfigureAmount] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const calculatedAmount = useMemo(() => {
      const percentage = Number.isNaN(formData.percentage)
        ? 0
        : formData.percentage;
      const amount = positionSize.multipliedBy(percentage).dividedBy(100);
      return formatWithPrecision(amount.toNumber(), szDecimals, true);
    }, [positionSize, formData.percentage, szDecimals]);

    const handleTpslChange = useCallback(
      (data: { tpPrice: string; slPrice: string }) => {
        setFormData((prev) => ({
          ...prev,
          tpPrice: data.tpPrice,
          slPrice: data.slPrice,
        }));
      },
      [],
    );

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

    const handleSubmit = useCallback(async () => {
      try {
        setIsSubmitting(true);

        const tpslAmount = configureAmount
          ? formData.amount || calculatedAmount
          : '0';
        const tpslAmountBN = new BigNumber(tpslAmount);

        if (configureAmount) {
          if (!tpslAmount || tpslAmountBN.lte(0)) {
            throw new OneKeyLocalError({
              message: 'Please enter a valid amount',
            });
          }

          if (tpslAmountBN.gt(positionSize)) {
            throw new OneKeyLocalError({
              message: 'Amount cannot exceed position size',
            });
          }
        }

        if (!formData.tpPrice && !formData.slPrice) {
          throw new OneKeyLocalError({
            message: 'Please set at least TP or SL price',
          });
        }

        // Call the actual setPositionTpsl action
        await hyperliquidActions.current.setPositionTpsl({
          assetId,
          positionSize: tpslAmount,
          isBuy: isLongPosition,
          tpTriggerPx: formData.tpPrice || undefined,
          slTriggerPx: formData.slPrice || undefined,
        });

        onClose();
      } catch (error) {
        // Error toast is handled in the action
        console.error('SetTpslModal handleSubmit error:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    }, [
      configureAmount,
      formData.amount,
      calculatedAmount,
      formData.tpPrice,
      formData.slPrice,
      positionSize,
      assetId,
      isLongPosition,
      hyperliquidActions,
      onClose,
    ]);

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
                id: ETranslations.perp_position_entry_price,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">{entryPrice}</SizableText>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyMd" color="$textSubdued">
              {appLocale.intl.formatMessage({
                id: ETranslations.perp_position_mark_price,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium">{markPrice}</SizableText>
          </XStack>
        </YStack>

        <TpslInput
          price={entryPrice}
          side={isLongPosition ? 'long' : 'short'}
          szDecimals={szDecimals}
          leverage={leverage}
          tpsl={{ tpPrice: formData.tpPrice, slPrice: formData.slPrice }}
          onChange={handleTpslChange}
          amount={
            configureAmount
              ? formData.amount || calculatedAmount
              : positionSize.toFixed(szDecimals)
          }
          ifOnDialog
        />

        <XStack alignItems="center" gap="$3">
          <Checkbox
            value={configureAmount}
            onChange={(checked) => setConfigureAmount(Boolean(checked))}
            label="Configure Amount"
          />
        </XStack>

        {configureAmount ? (
          <>
            <TradingFormInput
              label={appLocale.intl.formatMessage({
                id: ETranslations.dexmarket_details_history_amount,
              })}
              value={
                formData.amount ||
                (formData.percentage > 0 ? calculatedAmount : '')
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
          </>
        ) : null}
        <TradingGuardWrapper>
          <Button
            size="large"
            variant="primary"
            onPress={handleSubmit}
            disabled={isSubmitting}
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

SetTpslForm.displayName = 'SetTpslForm';

export function showSetTpslDialog({
  position,
  szDecimals,
  assetId,
  hyperliquidActions,
}: ISetTpslParams) {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_tp_sl_position,
    }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.perp_tp_sl_position_desc,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <SetTpslForm
          position={position}
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
