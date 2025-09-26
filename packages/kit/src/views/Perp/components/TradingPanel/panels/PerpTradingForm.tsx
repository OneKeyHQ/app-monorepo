import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Slider,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import {
  useActiveAssetDataAtom,
  useHyperliquidActions,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsSelectedSymbolAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';

import { useCurrentTokenData, usePerpPositions } from '../../../hooks';
import { LiquidationPriceDisplay } from '../components/LiquidationPriceDisplay';
import { PriceInput } from '../inputs/PriceInput';
import { SizeInput } from '../inputs/SizeInput';
import { TpslInput } from '../inputs/TpslInput';
import { LeverageAdjustModal } from '../modals/LeverageAdjustModal';
import { MarginModeSelector } from '../selectors/MarginModeSelector';
import { OrderTypeSelector } from '../selectors/OrderTypeSelector';
import { TradeSideToggle } from '../selectors/TradeSideToggle';

import { PerpAccountPanel } from './PerpAccountPanel';

import type { ISide } from '../selectors/TradeSideToggle';

interface IPerpTradingFormProps {
  isSubmitting?: boolean;
  isMobile?: boolean;
}

function PerpTradingForm({
  isSubmitting = false,
  isMobile = false,
}: IPerpTradingFormProps) {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [formData] = useTradingFormAtom();
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const tokenInfo = useCurrentTokenData();
  const currentTokenName = tokenInfo?.name;
  const perpsPositions = usePerpPositions();
  const [perpsSelectedSymbol] = usePerpsSelectedSymbolAtom();
  const [activeAssetData] = useActiveAssetDataAtom();
  const { universe } = perpsSelectedSymbol;
  const updateForm = useCallback(
    (updates: Partial<ITradingFormData>) => {
      actions.current.updateTradingForm(updates);
    },
    [actions],
  );

  const prevTypeRef = useRef<'market' | 'limit'>(formData.type);
  const prevTokenRef = useRef<string>(currentTokenName || '');
  const tokenSwitchingRef = useRef<string | false>(false);

  useEffect(() => {
    const prevType = prevTypeRef.current;
    const currentType = formData.type;

    if (prevType !== 'limit' && currentType === 'limit' && tokenInfo?.markPx) {
      updateForm({ price: formatPriceToSignificantDigits(tokenInfo.markPx) });
    }

    prevTypeRef.current = currentType;
  }, [formData.type, formData.price, tokenInfo?.markPx, updateForm]);

  // Token Switch Effect: Handle price updates when user switches tokens
  // This prevents stale price data from being used during token transitions
  useEffect(() => {
    const prevToken = prevTokenRef.current;
    const hasTokenChanged =
      currentTokenName && prevToken && prevToken !== currentTokenName;
    const isDataSynced = prevToken === currentTokenName;
    const shouldUpdatePrice =
      tokenSwitchingRef.current === currentTokenName &&
      formData.type === 'limit' &&
      currentTokenName &&
      tokenInfo?.markPx &&
      isDataSynced;

    // Step 1: Detect token switch and mark switching state
    if (hasTokenChanged) {
      tokenSwitchingRef.current = currentTokenName;
      prevTokenRef.current = currentTokenName;
      return; // Early return to avoid price update with stale data
    }

    // Step 2: Update price after token data is synchronized (prevents stale price)
    if (shouldUpdatePrice && tokenInfo.markPx) {
      updateForm({ price: formatPriceToSignificantDigits(tokenInfo.markPx) });
      tokenSwitchingRef.current = false; // Reset switching state
    }

    // Step 3: Initialize token reference on first load
    if (!prevToken && currentTokenName) {
      prevTokenRef.current = currentTokenName;
    }
  }, [currentTokenName, tokenInfo?.markPx, formData.type, updateForm]);

  const leverage = useMemo(() => {
    return activeAssetData?.leverage?.value || tokenInfo?.maxLeverage;
  }, [activeAssetData?.leverage?.value, tokenInfo?.maxLeverage]);

  // Reference Price: Get the effective trading price (limit price or market price)
  const [referencePrice, referencePriceString] = useMemo(() => {
    let price = new BigNumber(0);
    if (formData.type === 'limit' && formData.price) {
      price = new BigNumber(formData.price);
    }
    if (formData.type === 'market' && tokenInfo?.markPx) {
      price = new BigNumber(tokenInfo.markPx);
    }
    return [
      price,
      formatPriceToSignificantDigits(price, tokenInfo?.szDecimals ?? 2),
    ];
  }, [formData.type, formData.price, tokenInfo?.markPx, tokenInfo?.szDecimals]);

  const { availableToTradeDisplay, availableToTradeValue } = useMemo(() => {
    const _availableToTrade = activeAssetData?.availableToTrade || [0, 0];
    const value = _availableToTrade[formData.side === 'long' ? 0 : 1] || 0;
    const valueBN = new BigNumber(value);
    return {
      availableToTradeDisplay: valueBN.toFixed(2, BigNumber.ROUND_DOWN),
      availableToTradeValue: valueBN.toNumber(),
    };
  }, [formData.side, activeAssetData?.availableToTrade]);

  const [selectedSymbolPositionValue, selectedSymbolPositionSide] =
    useMemo(() => {
      const value = Number(
        perpsPositions.filter(
          (pos) => pos.position.coin === perpsSelectedSymbol.coin,
        )?.[0]?.position.szi || '0',
      );
      const side = value >= 0 ? 'long' : 'short';

      return [Math.abs(value), side];
    }, [perpsPositions, perpsSelectedSymbol.coin]);

  // Order calculations: Total value and required margin
  const totalValue = useMemo(() => {
    const size = new BigNumber(formData.size || 0);
    return size.multipliedBy(referencePrice); // Size × Price = Total Value
  }, [formData.size, referencePrice]);

  const marginRequired = useMemo(() => {
    return new BigNumber(formData.size || 0)
      .multipliedBy(referencePrice)
      .dividedBy(leverage || 1); // (Size × Price) ÷ Leverage = Required Margin
  }, [formData.size, referencePrice, leverage]);

  // Slider Configuration: Calculate price, leverage, max value and current value for size slider
  const sliderConfig = useMemo(() => {
    // Get effective price for slider calculation (limit price or market price)
    const getEffectivePrice = (): BigNumber | null => {
      if (referencePrice.gt(0)) return referencePrice;
      if (tokenInfo?.markPx) {
        const markPx = new BigNumber(tokenInfo.markPx);
        return markPx.isFinite() && markPx.gt(0) ? markPx : null;
      }
      return null;
    };

    // Get safe leverage value (fallback to 1x if invalid)
    const getSafeLeverage = (): BigNumber => {
      if (!leverage) return new BigNumber(1);
      const leverageBN = new BigNumber(leverage);
      return leverageBN.isFinite() && leverageBN.gt(0)
        ? leverageBN
        : new BigNumber(1);
    };

    const effectivePrice = getEffectivePrice();
    const safeLeverage = getSafeLeverage();
    const currentValue = new BigNumber(formData.size || 0);

    // Calculate maximum trade size: Available Balance × Leverage ÷ Price
    const calculateMaxSize = (): number => {
      if (!effectivePrice || effectivePrice.lte(0)) return 0;
      if (!Number.isFinite(availableToTradeValue) || availableToTradeValue <= 0)
        return 0;

      const maxTokens = new BigNumber(availableToTradeValue)
        .multipliedBy(safeLeverage)
        .dividedBy(effectivePrice)
        .decimalPlaces(tokenInfo?.szDecimals ?? 2, BigNumber.ROUND_FLOOR);

      return maxTokens.isFinite() && maxTokens.gt(0) ? maxTokens.toNumber() : 0;
    };

    const maxSize = calculateMaxSize();
    const currentValueNum = currentValue.isFinite()
      ? currentValue.toNumber()
      : 0;

    return {
      price: effectivePrice,
      leverage: safeLeverage,
      maxSize,
      currentValue: currentValueNum,
      controlledValue: maxSize > 0 ? Math.min(currentValueNum, maxSize) : 0,
      isValid: !!effectivePrice && effectivePrice.gt(0) && maxSize > 0,
    };
  }, [
    referencePrice,
    tokenInfo?.markPx,
    tokenInfo?.szDecimals,
    leverage,
    availableToTradeValue,
    formData.size,
  ]);

  const sliderStep = useMemo(() => {
    const decimals = Math.min(tokenInfo?.szDecimals ?? 2, 6);
    return Number((10 ** -decimals).toFixed(decimals));
  }, [tokenInfo?.szDecimals]);

  const handleSizeSliderChange = useCallback(
    (value?: number) => {
      if (value === undefined) return;
      if (!sliderConfig.isValid) return;
      const decimals = tokenInfo?.szDecimals ?? 2;
      const formatted = new BigNumber(value)
        .decimalPlaces(decimals, BigNumber.ROUND_FLOOR)
        .toFixed();
      updateForm({ size: formatted });
    },
    [sliderConfig.isValid, tokenInfo?.szDecimals, updateForm],
  );

  const handleTpslCheckboxChange = useCallback(
    (checked: ICheckedState) => {
      updateForm({ hasTpsl: !!checked });

      if (!checked) {
        updateForm({
          tpTriggerPx: '',
          slTriggerPx: '',
        });
      }
    },
    [updateForm],
  );
  const handleTpslChange = useCallback(
    (data: { tpPrice: string; slPrice: string }) => {
      updateForm({
        tpTriggerPx: data.tpPrice,
        slTriggerPx: data.slPrice,
      });
    },
    [updateForm],
  );
  if (isMobile) {
    return (
      <YStack gap="$3">
        <TradeSideToggle
          value={formData.side}
          onChange={(side: ISide) => updateForm({ side })}
          disabled={isSubmitting}
          isMobile={isMobile}
        />
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_account_overview_available,
            })}
          </SizableText>
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodySmMedium" color="$text">
              ${availableToTradeDisplay}
            </SizableText>
            <PerpAccountPanel isTradingPanel />
          </XStack>
        </XStack>
        <XStack alignItems="center" flex={1} gap="$2.5">
          <YStack flex={1}>
            <MarginModeSelector disabled={isSubmitting} isMobile={isMobile} />
          </YStack>
          <LeverageAdjustModal isMobile={isMobile} />
        </XStack>
        <XStack alignItems="center" flex={1} gap="$2.5">
          <YStack flex={1}>
            <OrderTypeSelector
              value={formData.type}
              onChange={(type: 'market' | 'limit') => updateForm({ type })}
              disabled={isSubmitting}
              isMobile={isMobile}
            />
          </YStack>
        </XStack>
        <PriceInput
          onUseMarketPrice={() => {
            if (tokenInfo?.markPx) {
              updateForm({
                price: formatPriceToSignificantDigits(tokenInfo.markPx),
              });
            }
          }}
          value={
            formData.type === 'limit'
              ? formData.price
              : intl.formatMessage({
                  id: ETranslations.perp_market_price,
                })
          }
          onChange={(value) => updateForm({ price: value })}
          szDecimals={universe?.szDecimals ?? 2}
          isMobile={isMobile}
          disabled={formData.type === 'market'}
        />
        <SizeInput
          side={formData.side}
          tokenInfo={tokenInfo}
          symbol={perpsSelectedSymbol.coin}
          value={formData.size}
          onChange={(value) => updateForm({ size: value })}
          isMobile={isMobile}
        />
        <Slider
          mt="$2"
          min={0}
          max={sliderConfig.maxSize}
          value={sliderConfig.controlledValue}
          onChange={handleSizeSliderChange}
          disabled={
            isSubmitting || !sliderConfig.isValid || Number.isNaN(sliderStep)
          }
          step={sliderStep}
        />
        <YStack gap="$1">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.perp_position_tp_sl,
            })}
            value={formData.hasTpsl}
            onChange={handleTpslCheckboxChange}
            disabled={isSubmitting}
            labelProps={{
              fontSize: getFontSize('$bodySm'),
              color: '$textSubdued',
            }}
            containerProps={{ p: 0, alignItems: 'center' }}
            width="$3.5"
            height="$3.5"
            p="$0"
          />

          {formData.hasTpsl ? (
            <TpslInput
              price={referencePrice.toFixed()}
              side={formData.side}
              szDecimals={tokenInfo?.szDecimals ?? 2}
              leverage={leverage}
              tpsl={{
                tpPrice: formData.tpTriggerPx,
                slPrice: formData.slTriggerPx,
              }}
              onChange={handleTpslChange}
              disabled={isSubmitting}
              isMobile={isMobile}
              amount={formData.size}
            />
          ) : null}
        </YStack>
        <YStack
          flex={1}
          gap="$1"
          px="$2"
          py="$1"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$2"
        >
          <XStack justifyContent="space-between">
            <SizableText fontSize={10} color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trade_order_value,
              })}
            </SizableText>
            <NumberSizeableText
              fontSize={10}
              formatter="value"
              formatterOptions={{ currency: '$' }}
              color="$text"
              fontWeight={500}
            >
              {totalValue.toNumber()}
            </NumberSizeableText>
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText fontSize={10} color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_position_liq_price,
              })}
            </SizableText>
            <SizableText fontSize={10} color="$text">
              <LiquidationPriceDisplay isMobile={isMobile} />
            </SizableText>
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText fontSize={10} color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trade_margin_required,
              })}
            </SizableText>
            <SizableText fontSize={10}>
              ${marginRequired.toFixed(2)}
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
    );
  }
  return (
    <>
      <YStack gap="$4">
        <TradeSideToggle
          value={formData.side}
          onChange={(side: ISide) => updateForm({ side })}
          disabled={isSubmitting}
        />

        <XStack alignItems="center" flex={1} gap="$3">
          <YStack flex={1}>
            <OrderTypeSelector
              value={formData.type}
              onChange={(type: 'market' | 'limit') => updateForm({ type })}
              disabled={isSubmitting}
            />
          </YStack>

          <YStack flex={1}>
            <MarginModeSelector disabled={isSubmitting} />
          </YStack>

          <LeverageAdjustModal />
        </XStack>
        <YStack
          flex={1}
          gap="$2.5"
          p="$2.5"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$3"
        >
          {/* Available Balance */}
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trade_account_overview_available,
              })}
            </SizableText>
            {activeAssetData ? (
              <SizableText size="$bodySmMedium" color="$text">
                ${availableToTradeDisplay}
              </SizableText>
            ) : (
              <Skeleton width={70} height={16} />
            )}
          </XStack>
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trade_current_position,
              })}
            </SizableText>
            {perpsAccountLoading?.selectAccountLoading ? (
              <Skeleton width={60} height={16} />
            ) : (
              <SizableText
                size="$bodySmMedium"
                color={
                  selectedSymbolPositionSide === 'long'
                    ? '$textSuccess'
                    : '$textCritical'
                }
              >
                {selectedSymbolPositionValue} {perpsSelectedSymbol.coin}
              </SizableText>
            )}
          </XStack>
        </YStack>
        {formData.type === 'limit' ? (
          <PriceInput
            onUseMarketPrice={() => {
              if (tokenInfo?.markPx) {
                updateForm({
                  price: formatPriceToSignificantDigits(tokenInfo.markPx),
                });
              }
            }}
            value={formData.price}
            onChange={(value) => updateForm({ price: value })}
            szDecimals={universe?.szDecimals ?? 2}
          />
        ) : null}

        <SizeInput
          side={formData.side}
          tokenInfo={tokenInfo}
          symbol={perpsSelectedSymbol.coin}
          value={formData.size}
          onChange={(value) => updateForm({ size: value })}
        />
        <Slider
          width="100%"
          mt="$3"
          min={0}
          max={sliderConfig.maxSize}
          value={sliderConfig.controlledValue}
          onChange={handleSizeSliderChange}
          disabled={
            isSubmitting || !sliderConfig.isValid || Number.isNaN(sliderStep)
          }
          step={sliderStep}
        />

        <YStack p="$0">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.perp_position_tp_sl,
            })}
            value={formData.hasTpsl}
            onChange={handleTpslCheckboxChange}
            disabled={isSubmitting}
            labelProps={{
              fontSize: getFontSize('$bodyMd'),
              color: '$textSubdued',
            }}
            containerProps={{ alignItems: 'center' }}
            width="$4"
            height="$4"
          />

          {formData.hasTpsl ? (
            <TpslInput
              price={referencePriceString}
              side={formData.side}
              szDecimals={tokenInfo?.szDecimals ?? 2}
              leverage={leverage}
              tpsl={{
                tpPrice: formData.tpTriggerPx,
                slPrice: formData.slTriggerPx,
              }}
              onChange={handleTpslChange}
              disabled={isSubmitting}
              amount={formData.size}
            />
          ) : null}
        </YStack>
      </YStack>

      <YStack gap="$2" mt="$5">
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_order_value,
            })}
          </SizableText>
          <NumberSizeableText
            size="$bodySmMedium"
            formatter="value"
            formatterOptions={{ currency: '$' }}
          >
            {totalValue.toNumber()}
          </NumberSizeableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_position_liq_price,
            })}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            <LiquidationPriceDisplay />
          </SizableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_margin_required,
            })}
          </SizableText>
          <NumberSizeableText
            size="$bodySm"
            formatter="value"
            formatterOptions={{ currency: '$' }}
          >
            {marginRequired.toNumber()}
          </NumberSizeableText>
        </XStack>
      </YStack>
    </>
  );
}

const PerpTradingFormMemo = memo(PerpTradingForm);
export { PerpTradingFormMemo as PerpTradingForm };
