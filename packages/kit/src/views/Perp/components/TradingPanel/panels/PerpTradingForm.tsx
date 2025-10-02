import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  DashText,
  Divider,
  IconButton,
  Popover,
  SizableText,
  Skeleton,
  Slider,
  Tooltip,
  XStack,
  YStack,
  useInTabDialog,
} from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  usePerpsActivePositionAtom,
  useTradingFormAtom,
  useTradingFormComputedAtom,
  useTradingFormEnvAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsShouldShowEnableTradingButtonAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';

import {
  type ITradeSide,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { PriceInput } from '../inputs/PriceInput';
import { SizeInput } from '../inputs/SizeInput';
import { TpSlFormInput } from '../inputs/TpSlFormInput';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';
import { LeverageAdjustModal } from '../modals/LeverageAdjustModal';
import { MarginModeSelector } from '../selectors/MarginModeSelector';
import { OrderTypeSelector } from '../selectors/OrderTypeSelector';

interface IPerpTradingFormProps {
  isSubmitting?: boolean;
  isMobile?: boolean;
}

function MobileDepositButton() {
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const dialogInTab = useInTabDialog();
  return (
    <IconButton
      testID="perp-trading-form-mobile-deposit-button"
      size="small"
      variant="tertiary"
      iconSize="$3.5"
      icon="PlusCircleSolid"
      onPress={() =>
        showDepositWithdrawModal(
          {
            actionType: 'deposit',
            withdrawable: accountSummary?.withdrawable || '0',
          },
          dialogInTab,
        )
      }
      color="$iconSubdued"
      cursor="pointer"
    />
  );
}

function PerpTradingForm({
  isSubmitting = false,
  isMobile = false,
}: IPerpTradingFormProps) {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [formData] = useTradingFormAtom();
  const [, setTradingFormEnv] = useTradingFormEnvAtom();
  const [tradingComputed] = useTradingFormComputedAtom();
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const currentTokenName = activeAsset?.coin;
  const [{ activePositions: perpsPositions }] = usePerpsActivePositionAtom();
  const [perpsSelectedSymbol] = usePerpsActiveAssetAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const { universe } = perpsSelectedSymbol;
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();
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

    if (
      prevType !== 'limit' &&
      currentType === 'limit' &&
      activeAssetCtx?.ctx?.markPrice
    ) {
      updateForm({
        price: formatPriceToSignificantDigits(activeAssetCtx?.ctx?.markPrice),
      });
    }

    prevTypeRef.current = currentType;
  }, [
    formData.type,
    formData.price,
    activeAssetCtx?.ctx?.markPrice,
    updateForm,
  ]);

  useEffect(() => {
    const nextEnv = {
      markPrice: activeAssetCtx?.ctx?.markPrice,
      availableToTrade: activeAssetData?.availableToTrade,
      leverageValue: activeAssetData?.leverage?.value,
      fallbackLeverage: activeAsset?.universe?.maxLeverage,
      szDecimals: activeAsset?.universe?.szDecimals,
    };
    setTradingFormEnv((prev) => {
      const prevAvailable = prev.availableToTrade ?? [];
      const nextAvailable = nextEnv.availableToTrade ?? [];
      if (
        prev.markPrice === nextEnv.markPrice &&
        prev.leverageValue === nextEnv.leverageValue &&
        prev.fallbackLeverage === nextEnv.fallbackLeverage &&
        prev.szDecimals === nextEnv.szDecimals &&
        prevAvailable[0] === nextAvailable[0] &&
        prevAvailable[1] === nextAvailable[1]
      ) {
        return prev;
      }
      return nextEnv;
    });
  }, [
    activeAssetCtx?.ctx?.markPrice,
    activeAssetData?.availableToTrade,
    activeAssetData?.leverage?.value,
    activeAsset?.universe?.maxLeverage,
    activeAsset?.universe?.szDecimals,
    setTradingFormEnv,
  ]);

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
      activeAssetCtx?.ctx?.markPrice &&
      isDataSynced;

    // Step 1: Detect token switch and mark switching state
    if (hasTokenChanged) {
      tokenSwitchingRef.current = currentTokenName;
      prevTokenRef.current = currentTokenName;
      return; // Early return to avoid price update with stale data
    }

    // Step 2: Update price after token data is synchronized (prevents stale price)
    if (shouldUpdatePrice && activeAssetCtx?.ctx?.markPrice) {
      updateForm({
        price: formatPriceToSignificantDigits(activeAssetCtx?.ctx?.markPrice),
      });
      tokenSwitchingRef.current = false;
    }

    // Step 3: Initialize token reference on first load
    if (!prevToken && currentTokenName) {
      prevTokenRef.current = currentTokenName;
    }
  }, [
    currentTokenName,
    activeAssetCtx?.ctx?.markPrice,
    formData.type,
    updateForm,
  ]);

  const leverage = useMemo(() => {
    return (
      activeAssetData?.leverage?.value || activeAsset?.universe?.maxLeverage
    );
  }, [activeAssetData?.leverage?.value, activeAsset?.universe?.maxLeverage]);

  // Reference Price: Get the effective trading price (limit price or market price)
  const [referencePrice, referencePriceString] = useMemo(() => {
    let price = new BigNumber(0);
    if (formData.type === 'limit' && formData.price) {
      price = new BigNumber(formData.price);
    }
    if (formData.type === 'market' && activeAssetCtx?.ctx?.markPrice) {
      price = new BigNumber(activeAssetCtx?.ctx?.markPrice);
    }
    return [
      price,
      formatPriceToSignificantDigits(
        price,
        activeAsset?.universe?.szDecimals ?? 2,
      ),
    ];
  }, [
    formData.type,
    formData.price,
    activeAssetCtx?.ctx?.markPrice,
    activeAsset?.universe?.szDecimals,
  ]);

  const { availableToTradeDisplay } = useMemo(() => {
    const _availableToTrade = activeAssetData?.availableToTrade || [0, 0];
    const value = _availableToTrade[formData.side === 'long' ? 0 : 1] || 0;
    const valueBN = new BigNumber(value);
    return {
      availableToTradeDisplay: valueBN.toFixed(2, BigNumber.ROUND_DOWN),
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
    return tradingComputed.computedSizeBN.multipliedBy(referencePrice); // Size × Price = Total Value
  }, [tradingComputed.computedSizeBN, referencePrice]);

  const marginRequired = useMemo(() => {
    return tradingComputed.computedSizeBN
      .multipliedBy(referencePrice)
      .dividedBy(leverage || 1); // (Size × Price) ÷ Leverage = Required Margin
  }, [tradingComputed.computedSizeBN, referencePrice, leverage]);

  const switchToManual = useCallback(() => {
    if (tradingComputed.sizeInputMode === EPerpsSizeInputMode.SLIDER) {
      updateForm({
        sizeInputMode: EPerpsSizeInputMode.MANUAL,
        sizePercent: 0,
        size: '',
      });
    }
  }, [tradingComputed.sizeInputMode, updateForm]);

  const handleManualSizeChange = useCallback(
    (value: string) => {
      updateForm({
        size: value,
        sizeInputMode: EPerpsSizeInputMode.MANUAL,
        sizePercent: 0,
      });
    },
    [updateForm],
  );

  const handleSliderPercentChange = useCallback(
    (nextValue: number | number[]) => {
      const raw = Array.isArray(nextValue) ? nextValue[0] : nextValue;
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const clamped = Math.max(0, Math.min(100, value));
      updateForm({
        sizeInputMode: EPerpsSizeInputMode.SLIDER,
        sizePercent: clamped,
        size: '',
      });
    },
    [updateForm],
  );

  const sliderValue =
    tradingComputed.sizeInputMode === 'slider'
      ? tradingComputed.sizePercent
      : 0;
  const sliderDisabled = isSubmitting || !tradingComputed.sliderEnabled;

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

  const handleTpValueChange = useCallback(
    (value: string) => {
      updateForm({ tpValue: value });
    },
    [updateForm],
  );

  const handleTpTypeChange = useCallback(
    (type: 'price' | 'percentage') => {
      updateForm({ tpType: type });
    },
    [updateForm],
  );

  const handleSlValueChange = useCallback(
    (value: string) => {
      updateForm({ slValue: value });
    },
    [updateForm],
  );

  const handleSlTypeChange = useCallback(
    (type: 'price' | 'percentage') => {
      updateForm({ slType: type });
    },
    [updateForm],
  );

  const orderTypeOptions = useMemo(
    () => [
      {
        name: intl.formatMessage({ id: ETranslations.perp_trade_market }),
        value: 'market' as const,
      },
      {
        name: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
        value: 'limit' as const,
      },
    ],
    [intl],
  );

  const handleOrderTypeChange = useCallback(
    (name: string) => {
      const option = orderTypeOptions.find((o) => o.name === name);
      if (option) {
        updateForm({ type: option.value });
      }
    },
    [orderTypeOptions, updateForm],
  );

  if (isMobile) {
    return (
      <YStack gap="$3">
        <XStack alignItems="center" flex={1} gap="$2.5">
          <YStack flex={1}>
            <MarginModeSelector disabled={isSubmitting} isMobile={isMobile} />
          </YStack>
          <LeverageAdjustModal isMobile={isMobile} />
        </XStack>
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
            <MobileDepositButton />
          </XStack>
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
        {formData.type === 'limit' ? (
          <PriceInput
            onUseMarketPrice={() => {
              if (activeAssetCtx?.ctx?.markPrice) {
                updateForm({
                  price: formatPriceToSignificantDigits(
                    activeAssetCtx?.ctx?.markPrice,
                  ),
                });
              }
            }}
            value={formData.price}
            onChange={(value) => updateForm({ price: value })}
            szDecimals={universe?.szDecimals ?? 2}
            isMobile={isMobile}
          />
        ) : (
          <PriceInput
            onUseMarketPrice={() => {
              if (activeAssetCtx?.ctx?.markPrice) {
                updateForm({
                  price: formatPriceToSignificantDigits(
                    activeAssetCtx?.ctx?.markPrice,
                  ),
                });
              }
            }}
            value={intl.formatMessage({
              id: ETranslations.perp_market_price,
            })}
            onChange={(value) => updateForm({ price: value })}
            szDecimals={universe?.szDecimals ?? 2}
            isMobile={isMobile}
            disabled
          />
        )}
        <SizeInput
          referencePrice={referencePriceString}
          side={formData.side}
          activeAsset={activeAsset}
          activeAssetCtx={activeAssetCtx}
          symbol={perpsSelectedSymbol.coin}
          value={formData.size}
          onChange={handleManualSizeChange}
          sizeInputMode={tradingComputed.sizeInputMode}
          sliderPercent={tradingComputed.sizePercent}
          onRequestManualMode={switchToManual}
          isMobile={isMobile}
        />
        <Slider
          min={0}
          max={100}
          value={sliderValue}
          onChange={handleSliderPercentChange}
          disabled={sliderDisabled}
          segments={4}
          step={1}
          h="$1.5"
        />
        {shouldShowEnableTradingButton && isMobile ? null : (
          <YStack gap="$1" mt="$1">
            <XStack alignItems="center" gap="$2">
              <Checkbox
                value={formData.hasTpsl}
                onChange={handleTpslCheckboxChange}
                disabled={isSubmitting}
                containerProps={{ p: 0, alignItems: 'center' }}
                width="$3.5"
                height="$3.5"
                p="$0"
              />
              <Popover
                renderContent={() => (
                  <YStack px="$5" pt="$2" pb="$4">
                    <SizableText size="$bodyMd">
                      {intl.formatMessage({
                        id: ETranslations.perp_tp_sl_tooltip,
                      })}
                    </SizableText>
                  </YStack>
                )}
                renderTrigger={
                  <DashText
                    size="$bodySm"
                    dashColor="$textSubdued"
                    dashThickness={0.5}
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_position_tp_sl,
                    })}
                  </DashText>
                }
                title={intl.formatMessage({
                  id: ETranslations.perp_position_tp_sl,
                })}
              />
            </XStack>
            {formData.hasTpsl ? (
              <YStack gap="$2">
                <TpSlFormInput
                  type="tp"
                  label={intl.formatMessage({
                    id: ETranslations.perp_tp,
                  })}
                  value={formData.tpValue || ''}
                  inputType={formData.tpType || 'price'}
                  referencePrice={referencePriceString}
                  szDecimals={activeAsset?.universe?.szDecimals ?? 2}
                  onChange={handleTpValueChange}
                  onTypeChange={handleTpTypeChange}
                  disabled={isSubmitting}
                  isMobile={isMobile}
                />
                <TpSlFormInput
                  type="sl"
                  label={intl.formatMessage({
                    id: ETranslations.perp_sl,
                  })}
                  value={formData.slValue || ''}
                  inputType={formData.slType || 'price'}
                  referencePrice={referencePriceString}
                  szDecimals={activeAsset?.universe?.szDecimals ?? 2}
                  onChange={handleSlValueChange}
                  onTypeChange={handleSlTypeChange}
                  disabled={isSubmitting}
                  isMobile={isMobile}
                />
              </YStack>
            ) : null}
          </YStack>
        )}
      </YStack>
    );
  }

  return (
    <>
      <YStack gap="$4">
        <YStack>
          <XStack>
            {orderTypeOptions.map((option) => (
              <XStack
                pb="$2.5"
                key={option.value}
                ml="$2.5"
                mr="$2"
                borderBottomWidth={
                  formData.type === option.value ? '$0.5' : '$0'
                }
                borderBottomColor="$borderActive"
                onPress={() => handleOrderTypeChange(option.name)}
                cursor="pointer"
              >
                <SizableText
                  size="$headingXs"
                  fontSize={14}
                  color={
                    formData.type === option.value ? '$text' : '$textSubdued'
                  }
                >
                  {option.name}
                </SizableText>
              </XStack>
            ))}
          </XStack>
          <Divider />
        </YStack>

        <XStack alignItems="center" flex={1} gap="$3">
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
                color={getTradingSideTextColor(
                  selectedSymbolPositionSide as ITradeSide,
                )}
              >
                {selectedSymbolPositionValue} {perpsSelectedSymbol.coin}
              </SizableText>
            )}
          </XStack>
        </YStack>
        {formData.type === 'limit' ? (
          <PriceInput
            onUseMarketPrice={() => {
              if (activeAssetCtx?.ctx?.markPrice) {
                updateForm({
                  price: formatPriceToSignificantDigits(
                    activeAssetCtx?.ctx?.markPrice,
                  ),
                });
              }
            }}
            value={formData.price}
            onChange={(value) => updateForm({ price: value })}
            szDecimals={universe?.szDecimals ?? 2}
          />
        ) : null}

        <SizeInput
          referencePrice={referencePriceString}
          side={formData.side}
          activeAsset={activeAsset}
          activeAssetCtx={activeAssetCtx}
          symbol={perpsSelectedSymbol.coin}
          value={formData.size}
          onChange={handleManualSizeChange}
          sizeInputMode={tradingComputed.sizeInputMode}
          sliderPercent={tradingComputed.sizePercent}
          onRequestManualMode={switchToManual}
        />
        <YStack mt="$3">
          <Slider
            width="100%"
            min={0}
            max={100}
            value={sliderValue}
            onChange={handleSliderPercentChange}
            disabled={sliderDisabled}
            segments={4}
            step={1}
          />
        </YStack>

        <YStack p="$0">
          <XStack alignItems="center" gap="$2">
            <Checkbox
              value={formData.hasTpsl}
              onChange={handleTpslCheckboxChange}
              disabled={isSubmitting}
              containerProps={{ alignItems: 'center', cursor: 'pointer' }}
              width="$4"
              height="$4"
            />
            <Tooltip
              renderContent={intl.formatMessage({
                id: ETranslations.perp_tp_sl_tooltip,
              })}
              renderTrigger={
                <DashText
                  size="$bodyMd"
                  dashColor="$textDisabled"
                  dashThickness={0.5}
                  cursor="help"
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_position_tp_sl,
                  })}
                </DashText>
              }
            />
          </XStack>

          {formData.hasTpsl ? (
            <YStack gap="$2">
              <TpSlFormInput
                type="tp"
                label={intl.formatMessage({
                  id: ETranslations.perp_trade_tp_price,
                })}
                value={formData.tpValue || ''}
                inputType={formData.tpType || 'price'}
                referencePrice={referencePriceString}
                szDecimals={activeAsset?.universe?.szDecimals ?? 2}
                onChange={handleTpValueChange}
                onTypeChange={handleTpTypeChange}
                disabled={isSubmitting}
              />
              <TpSlFormInput
                type="sl"
                label={intl.formatMessage({
                  id: ETranslations.perp_trade_sl_price,
                })}
                value={formData.slValue || ''}
                inputType={formData.slType || 'price'}
                referencePrice={referencePriceString}
                szDecimals={activeAsset?.universe?.szDecimals ?? 2}
                onChange={handleSlValueChange}
                onTypeChange={handleSlTypeChange}
                disabled={isSubmitting}
              />
            </YStack>
          ) : null}
        </YStack>
      </YStack>
    </>
  );
}

const PerpTradingFormMemo = memo(PerpTradingForm);
export { PerpTradingFormMemo as PerpTradingForm };
