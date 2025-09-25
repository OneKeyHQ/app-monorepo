import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  usePerpsActivePositionAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';

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
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const currentTokenName = activeAsset?.coin;
  const [{ activePositions: perpsPositions }] = usePerpsActivePositionAtom();
  const [perpsSelectedSymbol] = usePerpsActiveAssetAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
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

    // Handle token switch
    if (hasTokenChanged) {
      tokenSwitchingRef.current = currentTokenName;
      prevTokenRef.current = currentTokenName;
      return; // Early return to avoid price update with stale data
    }

    // Update price after token switch when data is synchronized
    if (shouldUpdatePrice && activeAssetCtx?.ctx?.markPrice) {
      updateForm({
        price: formatPriceToSignificantDigits(activeAssetCtx?.ctx?.markPrice),
      });
      tokenSwitchingRef.current = false;
    }

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

  const availableToTrade = useMemo(() => {
    const _availableToTrade = activeAssetData?.availableToTrade || [0, 0];
    const value = _availableToTrade[formData.side === 'long' ? 0 : 1] || 0;
    return new BigNumber(value).toFixed(2, BigNumber.ROUND_DOWN);
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

  const totalValue = useMemo(() => {
    const size = new BigNumber(formData.size || 0);
    return size.multipliedBy(referencePrice);
  }, [formData.size, referencePrice]);

  const marginRequired = useMemo(() => {
    return new BigNumber(formData.size || 0)
      .multipliedBy(referencePrice)
      .dividedBy(leverage || 1);
  }, [formData.size, referencePrice, leverage]);

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
              ${availableToTrade}
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
          side={formData.side}
          activeAsset={activeAsset}
          activeAssetCtx={activeAssetCtx}
          symbol={perpsSelectedSymbol.coin}
          value={formData.size}
          onChange={(value) => updateForm({ size: value })}
          isMobile={isMobile}
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
              szDecimals={activeAsset?.universe?.szDecimals ?? 2}
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
                ${availableToTrade}
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
          side={formData.side}
          activeAsset={activeAsset}
          activeAssetCtx={activeAssetCtx}
          symbol={perpsSelectedSymbol.coin}
          value={formData.size}
          onChange={(value) => updateForm({ size: value })}
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
              szDecimals={activeAsset?.universe?.szDecimals ?? 2}
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
