import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatPercentage,
  formatPriceToSignificantDigits,
  validatePriceInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';

interface ITpslInputProps {
  price: string;
  side: 'long' | 'short';
  szDecimals: number;
  leverage?: number;
  tpsl: {
    tpPrice: string;
    slPrice: string;
  };
  onChange: (data: { tpPrice: string; slPrice: string }) => void;
  disabled?: boolean;
  ifOnDialog?: boolean;
}

export const TpslInput = memo(
  ({
    price,
    side,
    szDecimals,
    leverage = 1,
    tpsl,
    onChange,
    disabled = false,
    ifOnDialog = false,
  }: ITpslInputProps) => {
    const [internalState, setInternalState] = useState({
      tpTriggerPx: tpsl.tpPrice,
      tpGainPercent: '',
      slTriggerPx: tpsl.slPrice,
      slLossPercent: '',
    });

    const referencePrice = useMemo(() => {
      return new BigNumber(price || 0);
    }, [price]);

    const calculatePrice = useCallback(
      (percent: string, isTP: boolean) => {
        if (!percent || referencePrice.isZero()) return '';
        const percentNum = new BigNumber(percent).dividedBy(100);
        // Adjust percentage by leverage: actual price change is percentage / leverage
        const adjustedPercent = percentNum.dividedBy(leverage);
        const multiplier =
          (side === 'long') === isTP
            ? new BigNumber(1).plus(adjustedPercent)
            : new BigNumber(1).minus(adjustedPercent);
        return formatPriceToSignificantDigits(
          referencePrice.multipliedBy(multiplier).toNumber(),
          szDecimals,
        );
      },
      [referencePrice, side, szDecimals, leverage],
    );

    const calculatePercent = useCallback(
      (priceValue: string, isTP: boolean) => {
        if (!priceValue || referencePrice.isZero()) return '';
        const priceNum = new BigNumber(priceValue);
        const diff =
          (side === 'long') === isTP
            ? priceNum.minus(referencePrice)
            : referencePrice.minus(priceNum);
        return formatPercentage(
          diff
            .dividedBy(referencePrice)
            .multipliedBy(leverage)
            .multipliedBy(100)
            .toNumber(),
        );
      },
      [referencePrice, side, leverage],
    );
    useEffect(() => {
      const newTpPercent = tpsl.tpPrice
        ? calculatePercent(tpsl.tpPrice, true)
        : '';
      const newSlPercent = tpsl.slPrice
        ? calculatePercent(tpsl.slPrice, false)
        : '';

      setInternalState((prev) => {
        const shouldUpdateTp = prev.tpTriggerPx !== tpsl.tpPrice;
        const shouldUpdateSl = prev.slTriggerPx !== tpsl.slPrice;

        if (!shouldUpdateTp && !shouldUpdateSl) {
          return prev;
        }

        return {
          tpTriggerPx: tpsl.tpPrice,
          slTriggerPx: tpsl.slPrice,
          tpGainPercent: shouldUpdateTp ? newTpPercent : prev.tpGainPercent,
          slLossPercent: shouldUpdateSl ? newSlPercent : prev.slLossPercent,
        };
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tpsl.tpPrice, tpsl.slPrice, side]);

    const handleTpPriceChange = useCallback(
      (value: string) => {
        const _value = value.replace(/。/g, '.');
        if (!validatePriceInput(_value, szDecimals)) return;
        const percent = calculatePercent(_value, true);
        setInternalState((prev) => ({
          ...prev,
          tpTriggerPx: _value,
          tpGainPercent: percent,
        }));
        onChange({
          tpPrice: _value,
          slPrice: internalState.slTriggerPx,
        });
      },
      [calculatePercent, onChange, internalState.slTriggerPx, szDecimals],
    );

    const isValidPercent = useCallback(
      (value: string) =>
        value === '' || value === '-' || /^-?(\d+\.?\d*|\d*\.\d+)$/.test(value),
      [],
    );

    const canCalculate = useCallback(
      (value: string) =>
        value !== '' && value !== '-' && !Number.isNaN(Number(value)),
      [],
    );

    const handleTpPercentChange = useCallback(
      (value: string) => {
        if (!isValidPercent(value)) return;
        const calculatedPrice = canCalculate(value)
          ? calculatePrice(value, true)
          : '';
        setInternalState((prev) => ({
          ...prev,
          tpTriggerPx: calculatedPrice,
          tpGainPercent: value,
        }));
        onChange({
          tpPrice: calculatedPrice,
          slPrice: internalState.slTriggerPx,
        });
      },
      [
        calculatePrice,
        onChange,
        internalState.slTriggerPx,
        isValidPercent,
        canCalculate,
      ],
    );

    const handleSlPriceChange = useCallback(
      (value: string) => {
        const _value = value.replace(/。/g, '.');
        if (!validatePriceInput(_value, szDecimals)) return;
        const percent = calculatePercent(_value, false);
        setInternalState((prev) => ({
          ...prev,
          slTriggerPx: _value,
          slLossPercent: percent,
        }));
        onChange({
          tpPrice: internalState.tpTriggerPx,
          slPrice: _value,
        });
      },
      [calculatePercent, onChange, internalState.tpTriggerPx, szDecimals],
    );

    const handleSlPercentChange = useCallback(
      (value: string) => {
        if (!isValidPercent(value)) return;
        const calculatedPrice = canCalculate(value)
          ? calculatePrice(value, false)
          : '';
        setInternalState((prev) => ({
          ...prev,
          slTriggerPx: calculatedPrice,
          slLossPercent: value,
        }));
        onChange({
          tpPrice: internalState.tpTriggerPx,
          slPrice: calculatedPrice,
        });
      },
      [
        calculatePrice,
        onChange,
        internalState.tpTriggerPx,
        isValidPercent,
        canCalculate,
      ],
    );
    const intl = useIntl();

    return (
      <YStack gap="$3">
        <XStack gap="$3">
          <YStack flex={1}>
            <Input
              h={40}
              placeholder={intl.formatMessage({
                id: ETranslations.perp_trade_tp_price,
              })}
              value={internalState.tpTriggerPx}
              onChangeText={handleTpPriceChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              containerProps={{
                borderWidth: ifOnDialog ? '$px' : 0,
                borderColor: ifOnDialog ? '$borderSubdued' : undefined,
                bg: ifOnDialog ? '$bgApp' : '$bgSubdued',
                borderRadius: '$2',
              }}
            />
          </YStack>
          <YStack width={120}>
            <Input
              h={40}
              placeholder={intl.formatMessage({
                id: ETranslations.perp_trade_tp_price_gain,
              })}
              value={internalState.tpGainPercent}
              onChangeText={handleTpPercentChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              textAlign="right"
              leftIconName="PlusSmallOutline"
              containerProps={{
                borderWidth: ifOnDialog ? '$px' : 0,
                borderColor: ifOnDialog ? '$borderSubdued' : undefined,
                bg: ifOnDialog ? '$bgApp' : '$bgSubdued',
                borderRadius: '$2',
              }}
              addOns={[
                {
                  renderContent: (
                    <XStack alignItems="center" justifyContent="center" pr="$2">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        %
                      </SizableText>
                    </XStack>
                  ),
                },
              ]}
            />
          </YStack>
        </XStack>
        <XStack gap="$2">
          <YStack flex={1}>
            <Input
              h={40}
              placeholder={intl.formatMessage({
                id: ETranslations.perp_trade_sl_price,
              })}
              value={internalState.slTriggerPx}
              onChangeText={handleSlPriceChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              containerProps={{
                borderWidth: ifOnDialog ? '$px' : 0,
                borderColor: ifOnDialog ? '$borderSubdued' : undefined,
                bg: ifOnDialog ? '$bgApp' : '$bgSubdued',
                borderRadius: '$2',
              }}
            />
          </YStack>
          <YStack width={120}>
            <Input
              h={40}
              placeholder={intl.formatMessage({
                id: ETranslations.perp_trade_sl_price_loss,
              })}
              textAlign="right"
              leftIconName="MinusSmallOutline"
              value={internalState.slLossPercent}
              onChangeText={handleSlPercentChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              containerProps={{
                borderWidth: ifOnDialog ? '$px' : 0,
                borderColor: ifOnDialog ? '$borderSubdued' : undefined,
                bg: ifOnDialog ? '$bgApp' : '$bgSubdued',
                borderRadius: '$2',
              }}
              addOns={[
                {
                  renderContent: (
                    <XStack alignItems="center" justifyContent="center" pr="$2">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        %
                      </SizableText>
                    </XStack>
                  ),
                },
              ]}
            />
          </YStack>
        </XStack>
      </YStack>
    );
  },
);

TpslInput.displayName = 'TpslInput';
