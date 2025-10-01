import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { InputAccessoryView, Keyboard } from 'react-native';

import {
  Button,
  Input,
  SizableText,
  XStack,
  YStack,
  getFontSize,
  useIsKeyboardShown,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  calculateProfitLoss,
  formatPercentage,
  formatPriceToSignificantDigits,
  validatePriceInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';

// Done button component
const TpslDoneButton = ({ onDone }: { onDone: () => void }) => {
  const intl = useIntl();
  const isKeyboardShown = useIsKeyboardShown();
  const viewShow = platformEnv.isNativeIOS || isKeyboardShown;

  if (!viewShow) return null;

  return (
    <XStack
      p="$2.5"
      px="$3.5"
      justifyContent="flex-end"
      bg="$bgSubdued"
      borderTopWidth="$px"
      borderTopColor="$borderSubduedLight"
    >
      <Button
        variant="tertiary"
        onPress={() => {
          Keyboard.dismiss();
          onDone();
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_done })}
      </Button>
    </XStack>
  );
};

// Wrapper component similar to InputWithAccessoryDoneView but with unique ID support
type ITpslInputWithDoneProps = ComponentProps<typeof Input> & {
  accessoryViewId: string;
  onDone?: () => void;
};

const TpslInputWithDone = ({
  accessoryViewId,
  onDone = () => {},
  ...inputProps
}: ITpslInputWithDoneProps) => {
  return (
    <>
      <Input {...inputProps} inputAccessoryViewID={accessoryViewId} />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={accessoryViewId}>
          <TpslDoneButton onDone={onDone} />
        </InputAccessoryView>
      ) : null}
    </>
  );
};

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
  hiddenTp?: boolean;
  hiddenSl?: boolean;
  isMobile?: boolean;
  // Optional props for profit/loss calculation
  amount?: string | number;
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
    hiddenTp = false,
    hiddenSl = false,
    isMobile = false,
    amount,
  }: ITpslInputProps) => {
    const referencePrice = useMemo(() => {
      return new BigNumber(price || 0);
    }, [price]);

    // Calculate expected profit for TP
    const expectedProfit = useMemo(() => {
      if (!tpsl.tpPrice || !amount || !price) return null;

      return calculateProfitLoss({
        entryPrice: price,
        exitPrice: tpsl.tpPrice,
        amount,
        side,
        formatOptions: {
          currency: '$',
          decimals: 2,
          showSign: false,
        },
      });
    }, [tpsl.tpPrice, amount, price, side]);

    // Calculate expected loss for SL
    const expectedLoss = useMemo(() => {
      if (!tpsl.slPrice || !amount || !price) return null;

      return calculateProfitLoss({
        entryPrice: price,
        exitPrice: tpsl.slPrice,
        amount,
        side,
        formatOptions: {
          currency: '$',
          decimals: 2,
          showSign: false,
        },
      });
    }, [tpsl.slPrice, amount, price, side]);

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
    const [internalState, setInternalState] = useState({
      tpTriggerPx: tpsl.tpPrice,
      tpGainPercent: calculatePercent(tpsl.tpPrice, true),
      slTriggerPx: tpsl.slPrice,
      slLossPercent: calculatePercent(tpsl.slPrice, false),
    });

    const calculatePrice = useCallback(
      (percent: string, isTP: boolean) => {
        if (!percent || referencePrice.isZero()) return '';
        const percentNum = new BigNumber(percent);
        // Adjust percentage by leverage: actual price change is percentage / leverage
        const adjustedPercent = percentNum.dividedBy(leverage);
        const multiplier =
          (side === 'long') === isTP
            ? new BigNumber(100).plus(adjustedPercent)
            : new BigNumber(100).minus(adjustedPercent);
        return formatPriceToSignificantDigits(
          referencePrice.multipliedBy(multiplier).dividedBy(100),
          szDecimals,
        );
      },
      [referencePrice, side, szDecimals, leverage],
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
        if (value === '-') return;
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
      (value: string) => value === '' || /^-?(\d+\.?\d*|\d*\.\d+)$/.test(value),
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
        if (value === '-') return;
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
    if (isMobile) {
      return (
        <YStack gap="$3">
          {hiddenTp ? null : (
            <YStack gap="$2">
              <TpslInputWithDone
                accessoryViewId="tpsl-tp-price-mobile"
                onDone={() => {}}
                h={32}
                placeholder={intl.formatMessage({
                  id: ETranslations.perp_trade_tp_price,
                })}
                value={internalState.tpTriggerPx}
                onChangeText={handleTpPriceChange}
                disabled={disabled}
                keyboardType="decimal-pad"
                fontSize={getFontSize('$bodyMd')}
                size="small"
                containerProps={{
                  borderWidth: ifOnDialog ? '$px' : 0,
                  borderColor: ifOnDialog ? '$borderSubdued' : undefined,
                  bg: ifOnDialog ? '$bgApp' : '$bgSubdued',
                  borderRadius: '$2',
                }}
                InputComponentStyle={{
                  px: '$3',
                }}
                addOns={[
                  {
                    renderContent: (
                      <XStack
                        alignItems="center"
                        justifyContent="center"
                        pr="$3"
                      >
                        <SizableText size="$bodyMd" color="$textSubdued">
                          USD
                        </SizableText>
                      </XStack>
                    ),
                  },
                ]}
              />
              {expectedProfit ? (
                <XStack justifyContent="flex-start" pr="$0.5">
                  <SizableText
                    size="$bodySm"
                    color={
                      !expectedProfit.startsWith('-')
                        ? '$green11'
                        : '$textSubdued'
                    }
                  >
                    <SizableText size="$bodySm" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.perp_tp_sl_profit,
                      })}
                      {': '}
                    </SizableText>
                    {expectedProfit}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>
          )}
          {hiddenSl ? null : (
            <YStack gap="$2">
              <TpslInputWithDone
                accessoryViewId="tpsl-sl-price-mobile"
                onDone={() => {}}
                h={32}
                placeholder={intl.formatMessage({
                  id: ETranslations.perp_trade_sl_price,
                })}
                value={internalState.slTriggerPx}
                onChangeText={handleSlPriceChange}
                disabled={disabled}
                keyboardType="decimal-pad"
                fontSize={getFontSize('$bodyMd')}
                size="small"
                containerProps={{
                  borderWidth: ifOnDialog ? '$px' : 0,
                  borderColor: ifOnDialog ? '$borderSubdued' : undefined,
                  bg: ifOnDialog ? '$bgApp' : '$bgSubdued',
                  borderRadius: '$2',
                }}
                InputComponentStyle={{
                  px: '$3',
                }}
                addOns={[
                  {
                    renderContent: (
                      <XStack
                        alignItems="center"
                        justifyContent="center"
                        pr="$3"
                      >
                        <SizableText size="$bodyMd" color="$textSubdued">
                          USD
                        </SizableText>
                      </XStack>
                    ),
                  },
                ]}
              />
              <XStack justifyContent="flex-start" pr="$0.5">
                <SizableText
                  size="$bodySm"
                  color={
                    expectedLoss && expectedLoss.startsWith('-')
                      ? '$red11'
                      : '$textSubdued'
                  }
                >
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.perp_tp_sl_loss,
                    })}
                    {': '}
                  </SizableText>
                  {expectedLoss || '$0.00'}
                </SizableText>
              </XStack>
            </YStack>
          )}
        </YStack>
      );
    }
    return (
      <YStack gap="$3">
        {hiddenTp ? null : (
          <XStack gap="$3">
            <YStack
              flex={1}
              hoverStyle={
                ifOnDialog
                  ? undefined
                  : {
                      outlineWidth: '$px',
                      outlineColor: '$border',
                      outlineStyle: 'solid',
                    }
              }
              borderWidth={ifOnDialog ? '$px' : 0}
              borderColor={ifOnDialog ? '$border' : undefined}
              bg={ifOnDialog ? '$bgApp' : '$bgSubdued'}
              borderRadius="$2"
            >
              <TpslInputWithDone
                accessoryViewId="tpsl-tp-price-desktop"
                onDone={() => {}}
                h={40}
                value={internalState.tpTriggerPx}
                onChangeText={handleTpPriceChange}
                disabled={disabled}
                keyboardType="decimal-pad"
                size="small"
                containerProps={{
                  borderWidth: 0,
                }}
              />
            </YStack>

            <YStack
              width={120}
              hoverStyle={
                ifOnDialog
                  ? undefined
                  : {
                      outlineWidth: '$px',
                      outlineColor: '$border',
                      outlineStyle: 'solid',
                    }
              }
              borderWidth={ifOnDialog ? '$px' : 0}
              borderColor={ifOnDialog ? '$border' : undefined}
              bg={ifOnDialog ? '$bgApp' : '$bgSubdued'}
              borderRadius="$2"
            >
              <TpslInputWithDone
                accessoryViewId="tpsl-tp-gain-percent"
                onDone={() => {}}
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
        )}
        {expectedProfit ? (
          <XStack justifyContent="flex-start" pr="$0.5">
            <SizableText
              size="$bodySm"
              color={
                !expectedProfit.startsWith('-') ? '$green11' : '$textSubdued'
              }
            >
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_tp_sl_profit,
                })}
                {': '}
              </SizableText>
              {expectedProfit}
            </SizableText>
          </XStack>
        ) : null}
        {hiddenSl ? null : (
          <XStack gap="$2">
            <YStack
              flex={1}
              hoverStyle={
                ifOnDialog
                  ? undefined
                  : {
                      outlineWidth: '$px',
                      outlineColor: '$border',
                      outlineStyle: 'solid',
                    }
              }
              borderWidth={ifOnDialog ? '$px' : 0}
              borderColor={ifOnDialog ? '$border' : undefined}
              bg={ifOnDialog ? '$bgApp' : '$bgSubdued'}
              borderRadius="$2"
            >
              <TpslInputWithDone
                accessoryViewId="tpsl-sl-price-desktop"
                onDone={() => {}}
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
                  borderWidth: 0,
                }}
              />
            </YStack>
            <YStack
              width={120}
              hoverStyle={
                ifOnDialog
                  ? undefined
                  : {
                      outlineWidth: '$px',
                      outlineColor: '$border',
                      outlineStyle: 'solid',
                    }
              }
              borderRadius="$2"
              borderWidth={ifOnDialog ? '$px' : 0}
              borderColor={ifOnDialog ? '$border' : undefined}
              bg={ifOnDialog ? '$bgApp' : '$bgSubdued'}
            >
              <TpslInputWithDone
                accessoryViewId="tpsl-sl-loss-percent"
                onDone={() => {}}
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
        )}
        {expectedLoss ? (
          <XStack justifyContent="flex-start" pr="$0.5">
            <SizableText
              size="$bodySm"
              color={expectedLoss.startsWith('-') ? '$red11' : '$textSubdued'}
            >
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_tp_sl_loss,
                })}
                {': '}
              </SizableText>

              {expectedLoss}
            </SizableText>
          </XStack>
        ) : null}
      </YStack>
    );
  },
);

TpslInput.displayName = 'TpslInput';
