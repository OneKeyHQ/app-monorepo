import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';

import {
  formatPercentage,
  formatPriceToSignificantDigits,
  validatePriceInput,
} from '../../../utils/tokenUtils';

interface ITpslInputProps {
  price: string;
  side: 'long' | 'short';
  szDecimals: number;
  tpsl: {
    tpPrice: string;
    slPrice: string;
  };
  onChange: (data: { tpPrice: string; slPrice: string }) => void;
  disabled?: boolean;
}

export const TpslInput = memo(
  ({
    price,
    side,
    szDecimals,
    tpsl,
    onChange,
    disabled = false,
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

    const calculateTpPrice = useCallback(
      (gainPercent: string) => {
        if (!gainPercent || referencePrice.isZero()) return '';
        const gain = new BigNumber(gainPercent).dividedBy(100);
        const multiplier =
          side === 'long'
            ? new BigNumber(1).plus(gain)
            : new BigNumber(1).minus(gain);
        const result = referencePrice.multipliedBy(multiplier);
        return formatPriceToSignificantDigits(result.toNumber(), szDecimals);
      },
      [referencePrice, side, szDecimals],
    );

    const calculateSlPrice = useCallback(
      (lossPercent: string) => {
        if (!lossPercent || referencePrice.isZero()) return '';
        const loss = new BigNumber(lossPercent).dividedBy(100);
        const multiplier =
          side === 'long'
            ? new BigNumber(1).minus(loss)
            : new BigNumber(1).plus(loss);
        const result = referencePrice.multipliedBy(multiplier);
        return formatPriceToSignificantDigits(result.toNumber(), szDecimals);
      },
      [referencePrice, side, szDecimals],
    );

    const calculateTpPercent = useCallback(
      (tpPrice: string) => {
        if (!tpPrice || referencePrice.isZero()) return '';
        const tp = new BigNumber(tpPrice);
        const diff =
          side === 'long' ? tp.minus(referencePrice) : referencePrice.minus(tp);
        const percent = diff.dividedBy(referencePrice).multipliedBy(100);
        return formatPercentage(percent.toNumber());
      },
      [referencePrice, side],
    );

    const calculateSlPercent = useCallback(
      (slPrice: string) => {
        if (!slPrice || referencePrice.isZero()) return '';
        const sl = new BigNumber(slPrice);
        const diff =
          side === 'long' ? referencePrice.minus(sl) : sl.minus(referencePrice);
        const percent = diff.dividedBy(referencePrice).multipliedBy(100);
        return formatPercentage(percent.toNumber());
      },
      [referencePrice, side],
    );

    useEffect(() => {
      setInternalState((prev) => ({
        ...prev,
        tpTriggerPx: tpsl.tpPrice,
        slTriggerPx: tpsl.slPrice,
      }));

      const tpPercent = calculateTpPercent(tpsl.tpPrice);
      const slPercent = calculateSlPercent(tpsl.slPrice);
      setInternalState((prev) => ({
        ...prev,
        tpGainPercent: tpPercent,
        slLossPercent: slPercent,
      }));
    }, [tpsl.tpPrice, tpsl.slPrice, calculateTpPercent, calculateSlPercent]);

    const handleTpPriceChange = useCallback(
      (value: string) => {
        const _value = value.replace(/。/g, '.');
        if (!validatePriceInput(_value, szDecimals)) return;
        const percent = calculateTpPercent(_value);
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
      [calculateTpPercent, onChange, internalState.slTriggerPx, szDecimals],
    );

    const handleTpPercentChange = useCallback(
      (value: string) => {
        if (!/^-?[0-9]*\.?[0-9]*$/.test(value) && value !== '') return;
        const calculatedPrice = calculateTpPrice(value);
        const formattedPrice = formatPriceToSignificantDigits(
          Number(calculatedPrice),
          szDecimals,
        );
        setInternalState((prev) => ({
          ...prev,
          tpTriggerPx: formattedPrice,
          tpGainPercent: value,
        }));

        onChange({
          tpPrice: formattedPrice,
          slPrice: internalState.slTriggerPx,
        });
      },
      [calculateTpPrice, onChange, internalState.slTriggerPx, szDecimals],
    );

    const handleSlPriceChange = useCallback(
      (value: string) => {
        const _value = value.replace(/。/g, '.');
        if (!validatePriceInput(_value, szDecimals)) return;
        const percent = calculateSlPercent(_value);
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
      [calculateSlPercent, onChange, internalState.tpTriggerPx, szDecimals],
    );

    const handleSlPercentChange = useCallback(
      (value: string) => {
        if (!/^-?[0-9]*\.?[0-9]*$/.test(value) && value !== '') return;
        const calculatedPrice = calculateSlPrice(value);
        const formattedPrice = formatPriceToSignificantDigits(
          Number(calculatedPrice),
          szDecimals,
        );
        setInternalState((prev) => ({
          ...prev,
          slTriggerPx: formattedPrice,
          slLossPercent: value,
        }));

        onChange({
          tpPrice: internalState.tpTriggerPx,
          slPrice: formattedPrice,
        });
      },
      [calculateSlPrice, onChange, internalState.tpTriggerPx, szDecimals],
    );

    return (
      <YStack gap="$3">
        <XStack gap="$3">
          <YStack flex={1}>
            <Input
              h={40}
              placeholder="TP Price"
              value={internalState.tpTriggerPx}
              onChangeText={handleTpPriceChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              borderWidth={0}
              containerProps={{
                bg: '$bgSubdued',
                borderRadius: '$2',
                borderWidth: 0,
              }}
            />
          </YStack>
          <YStack width={100}>
            <Input
              h={40}
              placeholder="Gain"
              value={internalState.tpGainPercent}
              onChangeText={handleTpPercentChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              containerProps={{
                bg: '$bgSubdued',
                borderRadius: '$2',
                borderWidth: 0,
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
              placeholder="SL Price"
              value={internalState.slTriggerPx}
              onChangeText={handleSlPriceChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              containerProps={{
                bg: '$bgSubdued',
                borderRadius: '$2',
                borderWidth: 0,
              }}
            />
          </YStack>
          <YStack width={100}>
            <Input
              h={40}
              placeholder="Loss"
              value={internalState.slLossPercent}
              onChangeText={handleSlPercentChange}
              disabled={disabled}
              keyboardType="decimal-pad"
              size="small"
              containerProps={{
                bg: '$bgSubdued',
                borderRadius: '$2',
                borderWidth: 0,
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
