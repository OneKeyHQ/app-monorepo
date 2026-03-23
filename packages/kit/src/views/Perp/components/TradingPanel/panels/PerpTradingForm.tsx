import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Checkbox,
  DashText,
  Icon,
  IconButton,
  Popover,
  Select,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  usePerpsActivePositionAtom,
  useTradingFormAtom,
  useTradingFormComputedAtom,
  useTradingFormEnvAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type {
  IBBOPriceMode,
  ITradingFormData,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCustomSettingsAtom,
  usePerpsShouldShowEnableTradingButtonAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatPriceToSignificantDigits,
  getTriggerEffectivePrice,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useShowDepositWithdrawModal } from '../../../hooks/useShowDepositWithdrawModal';
import { useTradingPrice } from '../../../hooks/useTradingPrice';
import {
  type ITradeSide,
  getTradingSideTextColor,
} from '../../../utils/styleUtils';
import { PerpsSlider } from '../../PerpsSlider';
import { PerpsAccountNumberValue } from '../components/PerpsAccountNumberValue';
import { PriceInput } from '../inputs/PriceInput';
import { SizeInput } from '../inputs/SizeInput';
import { TpSlFormInput } from '../inputs/TpSlFormInput';
import { LeverageAdjustModal } from '../modals/LeverageAdjustModal';
import { BBOSelector } from '../selectors/BBOSelector';
import { MarginModeSelector } from '../selectors/MarginModeSelector';

interface IPerpTradingFormProps {
  isSubmitting?: boolean;
  isMobile?: boolean;
}
type IPrimaryOrderType = 'market' | 'limit' | 'trigger';
type ITriggerDropdownValue = ETriggerOrderType | 'scale' | 'twap';

// Migrate old persisted trigger order types to new values
function migrateTriggerOrderType(raw: string): ETriggerOrderType {
  if (raw === 'stopMarket' || raw === 'takeMarket') {
    return ETriggerOrderType.TRIGGER_MARKET;
  }
  if (raw === 'stopLimit' || raw === 'takeLimit') {
    return ETriggerOrderType.TRIGGER_LIMIT;
  }
  return raw as ETriggerOrderType;
}

const TRIGGER_MODE_TPSL_RESET: Partial<ITradingFormData> = {
  hasTpsl: false,
  tpTriggerPx: '',
  tpGainPercent: '',
  slTriggerPx: '',
  slLossPercent: '',
  tpType: 'price',
  tpValue: '',
  slType: 'price',
  slValue: '',
};

function MobileDepositButton() {
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  return (
    <IconButton
      testID="perp-trading-form-mobile-deposit-button"
      size="small"
      variant="tertiary"
      iconSize="$3.5"
      icon="PlusCircleSolid"
      onPress={() => void showDepositWithdrawModal('deposit')}
      color="$iconSubdued"
      cursor="default"
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
  const { midPrice, midPriceBN } = useTradingPrice();
  const [{ activePositions: perpsPositions }] = usePerpsActivePositionAtom();
  const [perpsSelectedSymbol] = usePerpsActiveAssetAtom();
  const isBBOActive = !!formData.bboPriceMode;
  const perpsSelectedDisplayName = useMemo(
    () => parseDexCoin(perpsSelectedSymbol.coin).displayName,
    [perpsSelectedSymbol.coin],
  );
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const { universe } = perpsSelectedSymbol;
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();

  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();

  // Derive primaryOrderType from formData.orderMode
  const primaryOrderType: IPrimaryOrderType =
    formData.orderMode === 'trigger' ? 'trigger' : formData.type;
  // Trigger order type: prefer formData, fall back to persisted setting (with migration)
  const triggerOrderType = migrateTriggerOrderType(
    formData.triggerOrderType ??
      perpsCustomSettings.lastTriggerOrderType ??
      ETriggerOrderType.TRIGGER_MARKET,
  );
  // Only triggerMenuOpen stays as local state (pure UI)
  const [triggerMenuOpen, setTriggerMenuOpen] = useState(false);
  // Trigger price and reduceOnly from atom
  const triggerPrice = formData.triggerPrice ?? '';
  const triggerReduceOnly = formData.triggerReduceOnly ?? true;
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

    if (prevType !== 'limit' && currentType === 'limit' && midPrice) {
      updateForm({
        price: formatPriceToSignificantDigits(midPrice),
      });
    }

    prevTypeRef.current = currentType;
  }, [formData.type, formData.price, midPrice, updateForm]);

  useEffect(() => {
    const rawAvailable = activeAssetData?.availableToTrade;
    const maxAvailable = rawAvailable
      ? Math.max(Number(rawAvailable[0] ?? 0), Number(rawAvailable[1] ?? 0))
      : 0;
    const nextEnv = {
      markPrice: midPrice,
      availableToTrade: [maxAvailable, maxAvailable],
      maxTradeSzs: activeAssetData?.maxTradeSzs,
      leverageValue: activeAssetData?.leverage?.value,
      fallbackLeverage: activeAsset?.universe?.maxLeverage,
      szDecimals: activeAsset?.universe?.szDecimals,
    };
    setTradingFormEnv((prev) => {
      const prevAvailable = prev.availableToTrade ?? [];
      const nextAvailable = nextEnv.availableToTrade ?? [];
      const prevMaxTradeSzs = prev.maxTradeSzs ?? [];
      const nextMaxTradeSzs = nextEnv.maxTradeSzs ?? [];
      if (
        prev.markPrice === nextEnv.markPrice &&
        prev.leverageValue === nextEnv.leverageValue &&
        prev.fallbackLeverage === nextEnv.fallbackLeverage &&
        prev.szDecimals === nextEnv.szDecimals &&
        prevAvailable[0] === nextAvailable[0] &&
        prevAvailable[1] === nextAvailable[1] &&
        prevMaxTradeSzs[0] === nextMaxTradeSzs[0] &&
        prevMaxTradeSzs[1] === nextMaxTradeSzs[1]
      ) {
        return prev;
      }
      return nextEnv;
    });
    if (formData.leverage !== nextEnv.leverageValue) {
      updateForm({
        leverage: nextEnv.leverageValue,
      });
    }
  }, [
    midPrice,
    activeAssetData?.availableToTrade,
    activeAssetData?.maxTradeSzs,
    activeAssetData?.leverage?.value,
    activeAsset?.universe?.maxLeverage,
    activeAsset?.universe?.szDecimals,
    setTradingFormEnv,
    formData.leverage,
    updateForm,
  ]);

  // Reference Price: Get the effective trading price (limit price, market price, or trigger effective price)
  const [, referencePriceString] = useMemo(() => {
    let price = new BigNumber(0);
    if (formData.orderMode === 'trigger' && formData.triggerOrderType) {
      price = getTriggerEffectivePrice({
        triggerOrderType: formData.triggerOrderType,
        triggerPrice: formData.triggerPrice,
        executionPrice: formData.executionPrice,
        midPrice:
          midPriceBN.isFinite() && midPriceBN.gt(0)
            ? midPriceBN.toFixed()
            : undefined,
      });
    } else if (formData.type === 'limit' && formData.price) {
      price = new BigNumber(formData.price);
    } else if (formData.type === 'market') {
      price = midPriceBN;
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
    formData.orderMode,
    formData.triggerOrderType,
    formData.triggerPrice,
    formData.executionPrice,
    midPriceBN,
    activeAsset?.universe?.szDecimals,
  ]);

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

  const availableToTrade = useMemo(() => {
    const available = activeAssetData?.availableToTrade;
    if (!available) return '0';
    const longValue = Number(available[0] ?? 0);
    const shortValue = Number(available[1] ?? 0);
    return new BigNumber(Math.max(longValue, shortValue)).toFixed(
      2,
      BigNumber.ROUND_DOWN,
    );
  }, [activeAssetData?.availableToTrade]);

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

  const handleBBOToggle = useCallback(() => {
    if (formData.bboPriceMode) {
      updateForm({ bboPriceMode: null });
    } else {
      updateForm({
        bboPriceMode: { type: 'counterparty', level: 1 },
      });
    }
  }, [formData.bboPriceMode, updateForm]);

  const handleBBOChange = useCallback(
    (mode: IBBOPriceMode) => {
      updateForm({ bboPriceMode: mode });
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

  const triggerTypeOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_market,
        }),
        value: ETriggerOrderType.TRIGGER_MARKET as ITriggerDropdownValue,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_limit,
        }),
        value: ETriggerOrderType.TRIGGER_LIMIT as ITriggerDropdownValue,
      },
    ],
    [intl],
  );
  const mobileOrderTypeOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.perp_trade_market }),
        value: 'market' as string,
      },
      {
        label: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
        value: 'limit' as string,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_market,
        }),
        value: ETriggerOrderType.TRIGGER_MARKET as string,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_order_trigger_limit,
        }),
        value: ETriggerOrderType.TRIGGER_LIMIT as string,
      },
    ],
    [intl],
  );

  const applyPrimaryOrderType = useCallback(
    (nextType: IPrimaryOrderType) => {
      if (nextType === 'trigger') {
        const persistedType = migrateTriggerOrderType(
          perpsCustomSettings.lastTriggerOrderType ??
            ETriggerOrderType.TRIGGER_MARKET,
        );
        const isLimitTrigger =
          persistedType === ETriggerOrderType.TRIGGER_LIMIT;
        updateForm({
          ...TRIGGER_MODE_TPSL_RESET,
          orderMode: 'trigger',
          triggerOrderType: persistedType,
          type: isLimitTrigger ? 'limit' : 'market',
          bboPriceMode: null,
        });
        return;
      }
      updateForm({
        orderMode: 'standard',
        type: nextType,
      });
    },
    [perpsCustomSettings.lastTriggerOrderType, updateForm],
  );

  const handleTriggerOrderTypeChange = useCallback(
    (nextValue: string | number | boolean | undefined) => {
      if (typeof nextValue !== 'string') {
        return;
      }
      const nextType = nextValue as ITriggerDropdownValue;
      if (nextType === 'scale' || nextType === 'twap') {
        return;
      }
      const migrated = migrateTriggerOrderType(nextType);
      const isLimitTrigger = migrated === ETriggerOrderType.TRIGGER_LIMIT;
      updateForm({
        ...TRIGGER_MODE_TPSL_RESET,
        orderMode: 'trigger',
        triggerOrderType: migrated,
        type: isLimitTrigger ? 'limit' : 'market',
        bboPriceMode: null,
      });
      setPerpsCustomSettings({
        ...perpsCustomSettings,
        lastTriggerOrderType: migrated,
      });
    },
    [updateForm, perpsCustomSettings, setPerpsCustomSettings],
  );

  const isTriggerMode = formData.orderMode === 'trigger';
  const isTriggerLimitOrder =
    triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;

  const renderPriceInputSection = () => {
    if (isTriggerMode) {
      return (
        <YStack gap={isMobile ? '$2.5' : '$3'}>
          <PriceInput
            label={intl.formatMessage({
              id: ETranslations.dexmarket_pro_trigger_price,
            })}
            placeholder={intl.formatMessage({
              id: ETranslations.perps_input_tirgger_price_place_holder,
            })}
            value={triggerPrice}
            onChange={(value) => updateForm({ triggerPrice: value })}
            szDecimals={universe?.szDecimals ?? 2}
            isMobile={isMobile}
            disabled={isSubmitting}
          />
          {isTriggerLimitOrder ? (
            <PriceInput
              onUseMidPrice={() => {
                if (midPrice) {
                  updateForm({
                    executionPrice: formatPriceToSignificantDigits(midPrice),
                  });
                }
              }}
              placeholder={intl.formatMessage({
                id: ETranslations.perps_input_price_place_holder,
              })}
              value={formData.executionPrice ?? ''}
              onChange={(value) => updateForm({ executionPrice: value })}
              szDecimals={universe?.szDecimals ?? 2}
              isMobile={isMobile}
              disabled={isSubmitting}
            />
          ) : null}
        </YStack>
      );
    }
    if (formData.type === 'limit' || isMobile) {
      return (
        <XStack alignItems="center" flex={1} gap={isMobile ? '$2.5' : '$3'}>
          {isBBOActive && formData.type === 'limit' ? (
            <YStack flex={1}>
              <BBOSelector
                value={formData.bboPriceMode ?? null}
                onChange={handleBBOChange}
                disabled={isSubmitting}
                isMobile={isMobile}
              />
            </YStack>
          ) : (
            <YStack flex={1}>
              <PriceInput
                onUseMidPrice={() => {
                  if (midPrice) {
                    updateForm({
                      price: formatPriceToSignificantDigits(midPrice),
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
            </YStack>
          )}
          {formData.type === 'limit' ? (
            <Badge
              testID="perp-bbo-toggle-button"
              borderRadius="$2"
              bg="$bgSubdued"
              borderWidth="$px"
              borderColor={isBBOActive ? '$borderPrimary' : '$bgSubdued'}
              onPress={handleBBOToggle}
              px="$3"
              h={isMobile ? 38 : 40}
              alignItems="center"
              cursor="default"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgHover',
              }}
              disabled={isSubmitting}
            >
              {isMobile ? (
                <DashText
                  size="$bodyMdMedium"
                  dashColor="$text"
                  dashThickness={0}
                >
                  {intl.formatMessage({
                    id: ETranslations.Perps_BBO_button_title,
                  })}
                </DashText>
              ) : (
                <Tooltip
                  renderTrigger={
                    <DashText
                      size="$bodyMdMedium"
                      dashColor="$text"
                      dashThickness={0.5}
                    >
                      {intl.formatMessage({
                        id: ETranslations.Perps_BBO_button_title,
                      })}
                    </DashText>
                  }
                  renderContent={intl.formatMessage({
                    id: ETranslations.Perps_BBO_button_desc,
                  })}
                  placement="top-end"
                />
              )}
            </Badge>
          ) : null}
        </XStack>
      );
    }
    return null;
  };

  const checkboxSizeVal = isMobile ? '$3.5' : '$4';
  const tpLabelKey = isMobile
    ? ETranslations.perp_tp
    : ETranslations.perp_trade_tp_price;
  const slLabelKey = isMobile
    ? ETranslations.perp_sl
    : ETranslations.perp_trade_sl_price;

  const renderBottomSection = () => {
    if (shouldShowEnableTradingButton && isMobile) {
      return null;
    }
    if (isTriggerMode) {
      return (
        <YStack gap="$1" {...(isMobile && { mt: '$1' })} p="$0">
          <XStack alignItems="center" gap="$2">
            <Checkbox
              value={triggerReduceOnly}
              onChange={(checked) =>
                updateForm({ triggerReduceOnly: !!checked })
              }
              disabled={isSubmitting}
              containerProps={{
                p: 0,
                alignItems: 'center',
                ...(!isMobile && { cursor: 'pointer' }),
              }}
              width={checkboxSizeVal}
              height={checkboxSizeVal}
              {...(isMobile && { p: '$0' })}
            />
            <SizableText
              size={isMobile ? '$bodyMd' : '$bodyMdMedium'}
              color="$text"
            >
              {intl.formatMessage({ id: ETranslations.perps_reduce_only })}
            </SizableText>
          </XStack>
        </YStack>
      );
    }
    return (
      <YStack gap="$1" {...(isMobile && { mt: '$1' })} p="$0">
        <XStack alignItems="center" gap="$2">
          <Checkbox
            value={formData.hasTpsl}
            onChange={handleTpslCheckboxChange}
            disabled={isSubmitting}
            containerProps={{
              p: 0,
              alignItems: 'center',
              ...(!isMobile && { cursor: 'pointer' }),
            }}
            width={checkboxSizeVal}
            height={checkboxSizeVal}
            {...(isMobile && { p: '$0' })}
          />

          {isMobile ? (
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
          ) : (
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
          )}
        </XStack>

        {formData.hasTpsl ? (
          <YStack gap="$2">
            <TpSlFormInput
              type="tp"
              label={intl.formatMessage({
                id: tpLabelKey,
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
                id: slLabelKey,
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
    );
  };

  // Always show the last selected (or current) trigger type name on the tab
  const triggerTabLabel =
    triggerTypeOptions.find((item) => item.value === triggerOrderType)?.label ||
    triggerTypeOptions.find(
      (item) => item.value === perpsCustomSettings.lastTriggerOrderType,
    )?.label ||
    'Trigger';
  const mobileSelectedOrderType: string = isTriggerMode
    ? triggerOrderType
    : primaryOrderType;

  return (
    <YStack gap={isMobile ? '$2.5' : '$4'} pt={isMobile ? '$0' : '$2.5'}>
      {isMobile ? (
        <>
          <XStack alignItems="center" flex={1} gap="$2.5">
            <YStack flex={1}>
              <MarginModeSelector disabled={isSubmitting} isMobile={isMobile} />
            </YStack>
            <LeverageAdjustModal isMobile={isMobile} />
          </XStack>

          <XStack alignItems="center" flex={1} gap="$2.5">
            <YStack flex={1}>
              <Select
                items={mobileOrderTypeOptions}
                title={intl.formatMessage({
                  id: ETranslations.perp_trade_order_type,
                })}
                value={mobileSelectedOrderType}
                disabled={isSubmitting}
                onChange={(nextValue) => {
                  if (typeof nextValue !== 'string') {
                    return;
                  }
                  if (nextValue === 'market' || nextValue === 'limit') {
                    applyPrimaryOrderType(nextValue);
                    return;
                  }
                  handleTriggerOrderTypeChange(nextValue);
                }}
                placement="bottom-start"
                renderTrigger={({
                  onPress,
                  label,
                  disabled: disabledTrigger,
                }) => (
                  <XStack
                    onPress={onPress}
                    disabled={disabledTrigger}
                    height={32}
                    bg="$bgSubdued"
                    borderRadius="$2"
                    alignItems="center"
                    justifyContent="space-between"
                    px="$3"
                    flex={1}
                  >
                    <SizableText size="$bodyMdMedium">{label}</SizableText>
                    <Icon
                      name="ChevronDownSmallOutline"
                      color="$iconSubdued"
                      size="$4"
                    />
                  </XStack>
                )}
                floatingPanelProps={{
                  width: 180,
                }}
              />
            </YStack>
          </XStack>
        </>
      ) : (
        <>
          <YStack gap="$2">
            <XStack alignItems="center" flex={1} gap="$3">
              <YStack flex={1}>
                <MarginModeSelector
                  disabled={isSubmitting}
                  isMobile={isMobile}
                />
              </YStack>
              <LeverageAdjustModal isMobile={isMobile} />
            </XStack>

            <XStack
              h={38}
              alignItems="center"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              {orderTypeOptions.map((option) => {
                const isFocused = primaryOrderType === option.value;
                return (
                  <XStack
                    h={38}
                    key={option.value}
                    mr="$4"
                    alignItems="center"
                    position="relative"
                    onPress={() => {
                      if (!isSubmitting) {
                        applyPrimaryOrderType(option.value);
                      }
                    }}
                    cursor="pointer"
                  >
                    <SizableText
                      size="$bodyMdMedium"
                      color={isFocused ? '$text' : '$textSubdued'}
                    >
                      {option.name}
                    </SizableText>
                    {isFocused ? (
                      <YStack
                        position="absolute"
                        bottom={0}
                        left={0}
                        right={0}
                        h="$0.5"
                        bg="$text"
                        borderRadius={1}
                      />
                    ) : null}
                  </XStack>
                );
              })}
              <Select
                items={triggerTypeOptions}
                title="Trigger"
                value={triggerOrderType}
                onOpenChange={setTriggerMenuOpen}
                onChange={handleTriggerOrderTypeChange}
                disabled={isSubmitting}
                placement="bottom-start"
                floatingPanelProps={{ width: 180 }}
                renderTrigger={({ onPress, disabled: disabledTrigger }) => (
                  <XStack
                    h={38}
                    alignItems="center"
                    position="relative"
                    gap="$1"
                    cursor="pointer"
                    onPress={(e) => {
                      if (disabledTrigger) return;
                      if (!isTriggerMode) {
                        // First click: activate trigger mode with persisted type
                        applyPrimaryOrderType('trigger');
                      } else {
                        // Already in trigger mode: open dropdown to switch type
                        onPress?.(e);
                      }
                    }}
                  >
                    <SizableText
                      size="$bodyMdMedium"
                      color={isTriggerMode ? '$text' : '$textSubdued'}
                    >
                      {triggerTabLabel}
                    </SizableText>
                    <Icon
                      name={
                        triggerMenuOpen
                          ? 'ChevronTopSmallOutline'
                          : 'ChevronDownSmallOutline'
                      }
                      color={isTriggerMode ? '$icon' : '$iconSubdued'}
                      size="$4"
                    />
                    {isTriggerMode ? (
                      <YStack
                        position="absolute"
                        bottom={0}
                        left={0}
                        right={0}
                        h="$0.5"
                        bg="$text"
                        borderRadius={1}
                      />
                    ) : null}
                  </XStack>
                )}
              />
            </XStack>
          </YStack>
        </>
      )}

      <YStack
        gap="$2.5"
        {...(!isMobile && {
          flex: 1,
          p: '$2.5',
          borderWidth: '$px',
          borderColor: '$borderSubdued',
          borderRadius: '$2',
        })}
      >
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_account_overview_available,
            })}
          </SizableText>
          <XStack alignItems="center" gap="$1">
            <PerpsAccountNumberValue
              value={availableToTrade}
              skeletonWidth={60}
            />
            <MobileDepositButton />
          </XStack>
        </XStack>

        {isMobile ? null : (
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
                {selectedSymbolPositionValue} {perpsSelectedDisplayName}
              </SizableText>
            )}
          </XStack>
        )}
      </YStack>

      {renderPriceInputSection()}

      <SizeInput
        referencePrice={referencePriceString}
        side={formData.side}
        activeAsset={activeAsset}
        activeAssetCtx={activeAssetCtx}
        symbol={perpsSelectedDisplayName}
        value={formData.size}
        onChange={handleManualSizeChange}
        sizeInputMode={tradingComputed.sizeInputMode}
        sliderPercent={tradingComputed.sizePercent}
        onRequestManualMode={switchToManual}
        isMobile={isMobile}
        leverage={formData.leverage ?? 1}
      />

      <YStack px="$1" {...(isMobile && { pt: '$2', pb: '$2', mt: '$0' })}>
        <PerpsSlider
          min={0}
          max={100}
          value={sliderValue}
          showBubble={false}
          onChange={handleSliderPercentChange}
          disabled={sliderDisabled}
          segments={4}
          sliderHeight={isMobile ? 2 : 4}
        />
      </YStack>

      {renderBottomSection()}
    </YStack>
  );
}

const PerpTradingFormMemo = memo(PerpTradingForm);
export { PerpTradingFormMemo as PerpTradingForm };
