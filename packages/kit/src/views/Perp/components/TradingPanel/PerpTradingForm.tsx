import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  Checkbox,
  Input,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useCurrentTokenData } from '../../hooks';
import {
  formatPercentage,
  formatPriceToSignificantDigits,
  validatePriceInput,
} from '../../utils/tokenUtils';

import { LeverageAdjustModal } from './LeverageAdjustModal';
import { MarginModeSelector } from './MarginModeSelector';
import { OrderTypeSelector } from './OrderTypeSelector';
import { PriceInput } from './PriceInput';
import { SizeInput } from './SizeInput';
import { TradeSideToggle } from './TradeSideToggle';

import type { ISide } from './TradeSideToggle';

interface IPerpTradingFormProps {
  isSubmitting?: boolean;
}

function PerpTradingForm({ isSubmitting = false }: IPerpTradingFormProps) {
  const [formData] = useTradingFormAtom();
  const actions = useHyperliquidActions();
  const tokenInfo = useCurrentTokenData();

  const updateForm = useCallback(
    (updates: Partial<ITradingFormData>) => {
      actions.current.updateTradingForm(updates);
    },
    [actions],
  );

  const prevTypeRef = useRef<'market' | 'limit'>(formData.type);
  useEffect(() => {
    const prevType = prevTypeRef.current;
    const currentType = formData.type;

    if (
      prevType !== 'limit' &&
      currentType === 'limit' &&
      !formData.price &&
      tokenInfo?.markPx
    ) {
      updateForm({ price: tokenInfo.markPx });
    }

    prevTypeRef.current = currentType;
  }, [formData.type, formData.price, tokenInfo?.markPx, updateForm]);

  const leverage = useMemo(() => {
    return tokenInfo?.leverage?.value || tokenInfo?.maxLeverage;
  }, [tokenInfo]);

  const referencePrice = useMemo(() => {
    if (formData.type === 'limit' && formData.price) {
      return new BigNumber(formData.price);
    }
    if (formData.type === 'market' && tokenInfo?.markPx) {
      return new BigNumber(tokenInfo.markPx);
    }
    return new BigNumber(0);
  }, [formData.type, formData.price, tokenInfo?.markPx]);

  const totalValue = useMemo(() => {
    const size = new BigNumber(formData.size || 0);
    return size.multipliedBy(referencePrice);
  }, [formData.size, referencePrice]);

  const marginRequired = useMemo(() => {
    if (!leverage || leverage === 0) return new BigNumber(0);
    return totalValue.dividedBy(leverage);
  }, [totalValue, leverage]);

  const calculateTpPrice = useCallback(
    (gainPercent: string) => {
      if (!gainPercent || referencePrice.isZero()) return '';
      const gain = new BigNumber(gainPercent).dividedBy(100);
      const multiplier =
        formData.side === 'long'
          ? new BigNumber(1).plus(gain)
          : new BigNumber(1).minus(gain);
      const price = referencePrice.multipliedBy(multiplier);
      return formatPriceToSignificantDigits(price.toNumber());
    },
    [referencePrice, formData.side],
  );

  const calculateSlPrice = useCallback(
    (lossPercent: string) => {
      if (!lossPercent || referencePrice.isZero()) return '';
      const loss = new BigNumber(lossPercent).dividedBy(100);
      const multiplier =
        formData.side === 'long'
          ? new BigNumber(1).minus(loss)
          : new BigNumber(1).plus(loss);
      const price = referencePrice.multipliedBy(multiplier);
      return formatPriceToSignificantDigits(price.toNumber());
    },
    [referencePrice, formData.side],
  );

  const calculateTpPercent = useCallback(
    (tpPrice: string) => {
      if (!tpPrice || referencePrice.isZero()) return '';
      const tp = new BigNumber(tpPrice);
      const diff =
        formData.side === 'long'
          ? tp.minus(referencePrice)
          : referencePrice.minus(tp);
      const percent = diff.dividedBy(referencePrice).multipliedBy(100);
      return formatPercentage(percent.toNumber());
    },
    [referencePrice, formData.side],
  );

  const calculateSlPercent = useCallback(
    (slPrice: string) => {
      if (!slPrice || referencePrice.isZero()) return '';
      const sl = new BigNumber(slPrice);
      const diff =
        formData.side === 'long'
          ? referencePrice.minus(sl)
          : sl.minus(referencePrice);
      const percent = diff.dividedBy(referencePrice).multipliedBy(100);
      return formatPercentage(percent.toNumber());
    },
    [referencePrice, formData.side],
  );

  const handleTpPriceChange = useCallback(
    (value: string) => {
      if (!validatePriceInput(value)) return;
      const percent = calculateTpPercent(value);
      updateForm({
        tpTriggerPx: value,
        tpGainPercent: percent,
      });
    },
    [calculateTpPercent, updateForm],
  );

  const handleTpPercentChange = useCallback(
    (value: string) => {
      // Allow negative values and decimal for percentage
      if (!/^-?[0-9]*\.?[0-9]*$/.test(value) && value !== '') return;
      const price = calculateTpPrice(value);
      updateForm({
        tpTriggerPx: price,
        tpGainPercent: value,
      });
    },
    [calculateTpPrice, updateForm],
  );

  const handleSlPriceChange = useCallback(
    (value: string) => {
      if (!validatePriceInput(value)) return;
      const percent = calculateSlPercent(value);
      updateForm({
        slTriggerPx: value,
        slLossPercent: percent,
      });
    },
    [calculateSlPercent, updateForm],
  );

  const handleSlPercentChange = useCallback(
    (value: string) => {
      // Allow negative values and decimal for percentage
      if (!/^-?[0-9]*\.?[0-9]*$/.test(value) && value !== '') return;
      const price = calculateSlPrice(value);
      updateForm({
        slTriggerPx: price,
        slLossPercent: value,
      });
    },
    [calculateSlPrice, updateForm],
  );

  return (
    <>
      <YStack gap="$4">
        <TradeSideToggle
          value={formData.side}
          onChange={(side: ISide) => updateForm({ side })}
          disabled={isSubmitting}
        />

        <XStack alignItems="center" justifyContent="space-between">
          <XStack gap="$2">
            <OrderTypeSelector
              value={formData.type}
              onChange={(type: 'market' | 'limit') => updateForm({ type })}
              disabled={isSubmitting}
            />
            <MarginModeSelector disabled={isSubmitting} />
          </XStack>
          <LeverageAdjustModal />
        </XStack>

        {formData.type === 'limit' ? (
          <YStack bg="$bgSubdued" borderRadius="$3" borderWidth="$0" p="$3">
            <SizableText size="$bodyMd" color="$textSubdued" mb="$2">
              Limit Price
            </SizableText>
            <PriceInput
              onUseMarketPrice={() => {
                if (tokenInfo?.markPx) {
                  updateForm({ price: tokenInfo.markPx });
                }
              }}
              value={formData.price}
              onChange={(value) => updateForm({ price: value })}
              szDecimals={tokenInfo?.szDecimals || 2}
            />
          </YStack>
        ) : null}

        <SizeInput
          side={formData.side}
          tokenInfo={tokenInfo}
          value={formData.size}
          onChange={(value) => updateForm({ size: value })}
        />

        <YStack gap="$3">
          <Checkbox
            label="TP / SL"
            value={formData.hasTpsl}
            onChange={(checked: ICheckedState) =>
              updateForm({ hasTpsl: !!checked })
            }
            disabled={isSubmitting}
            labelProps={{ size: '$bodySm' }}
            containerProps={{ alignItems: 'center', ml: '$1' }}
            width="$4"
            height="$4"
          />

          {formData.hasTpsl ? (
            <YStack gap="$2">
              <XStack gap="$2">
                <YStack flex={1}>
                  <Input
                    placeholder="TP Price"
                    value={formData.tpTriggerPx}
                    onChangeText={handleTpPriceChange}
                    disabled={isSubmitting}
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
                    placeholder="Gain"
                    value={formData.tpGainPercent}
                    onChangeText={handleTpPercentChange}
                    disabled={isSubmitting}
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
                          <XStack
                            alignItems="center"
                            justifyContent="center"
                            pr="$2"
                          >
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
                    placeholder="SL Price"
                    value={formData.slTriggerPx}
                    onChangeText={handleSlPriceChange}
                    disabled={isSubmitting}
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
                    placeholder="Loss"
                    value={formData.slLossPercent}
                    onChangeText={handleSlPercentChange}
                    disabled={isSubmitting}
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
                          <XStack
                            alignItems="center"
                            justifyContent="center"
                            pr="$2"
                          >
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
          ) : null}
        </YStack>
      </YStack>

      <YStack bg="$bgSubdued" borderRadius="$3" borderWidth="$0" p="$3">
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMd" color="$textSubdued">
            Order Value
          </SizableText>
          <NumberSizeableText
            size="$bodyMd"
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {totalValue.toNumber()}
          </NumberSizeableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMd" color="$textSubdued">
            Margin Required
          </SizableText>
          {leverage ? (
            <NumberSizeableText
              size="$bodyMd"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {marginRequired.toNumber()}
            </NumberSizeableText>
          ) : (
            <Skeleton width={80} height={18} />
          )}
        </XStack>
      </YStack>
    </>
  );
}

const PerpTradingFormMemo = memo(PerpTradingForm);
export { PerpTradingFormMemo as PerpTradingForm };
