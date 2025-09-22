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
  const perpsPositions = usePerpPositions();
  const [perpsSelectedSymbol] = usePerpsSelectedSymbolAtom();
  const { universe } = perpsSelectedSymbol;
  const updateForm = useCallback(
    (updates: Partial<ITradingFormData>) => {
      actions.current.updateTradingForm(updates);
    },
    [actions],
  );

  const prevTypeRef = useRef<'market' | 'limit'>(formData.type);
  const prevTokenRef = useRef<string>(tokenInfo?.name || '');

  useEffect(() => {
    const prevType = prevTypeRef.current;
    const currentType = formData.type;

    if (prevType !== 'limit' && currentType === 'limit' && tokenInfo?.markPx) {
      updateForm({ price: formatPriceToSignificantDigits(tokenInfo.markPx) });
    }

    prevTypeRef.current = currentType;
  }, [formData.type, formData.price, tokenInfo?.markPx, updateForm]);

  useEffect(() => {
    const currentTokenName = tokenInfo?.name;
    const prevToken = prevTokenRef.current;

    if (
      prevToken &&
      currentTokenName &&
      prevToken !== currentTokenName &&
      formData.type === 'limit' &&
      tokenInfo?.markPx
    ) {
      updateForm({ price: formatPriceToSignificantDigits(tokenInfo.markPx) });
    }

    if (currentTokenName) {
      prevTokenRef.current = currentTokenName;
    }
  }, [tokenInfo?.name, tokenInfo?.markPx, formData.type, updateForm]);

  const leverage = useMemo(() => {
    return tokenInfo?.leverage?.value || tokenInfo?.maxLeverage;
  }, [tokenInfo?.leverage?.value, tokenInfo?.maxLeverage]);

  const referencePrice = useMemo(() => {
    if (formData.type === 'limit' && formData.price) {
      return new BigNumber(formData.price);
    }
    if (formData.type === 'market' && tokenInfo?.markPx) {
      return new BigNumber(tokenInfo.markPx);
    }
    return new BigNumber(0);
  }, [formData.type, formData.price, tokenInfo?.markPx]);

  const availableToTrade = useMemo(() => {
    const maxTradeSzs = tokenInfo?.maxTradeSzs || [0, 0];
    return maxTradeSzs[formData.side === 'long' ? 0 : 1] || 0;
  }, [tokenInfo?.maxTradeSzs, formData.side]);

  const selectedSymbolPositionValue = useMemo(() => {
    return (
      perpsPositions.filter(
        (pos) => pos.position.coin === perpsSelectedSymbol.coin,
      )?.[0]?.position.positionValue || '0'
    );
  }, [perpsPositions, perpsSelectedSymbol.coin]);

  const totalValue = useMemo(() => {
    const size = new BigNumber(formData.size || 0);
    return size.multipliedBy(referencePrice);
  }, [formData.size, referencePrice]);

  const handleTpslCheckboxChange = useCallback(
    (checked: ICheckedState) => {
      updateForm({ hasTpsl: !!checked });
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
          {perpsAccountLoading?.selectAccountLoading ? (
            <Skeleton width={70} height={16} />
          ) : (
            <XStack alignItems="center" gap="$1">
              <SizableText size="$bodySmMedium" color="$text">
                {selectedSymbolPositionValue} {tokenInfo?.name}
              </SizableText>
              <PerpAccountPanel isTradingPanel />
            </XStack>
          )}
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
              if (tokenInfo?.markPx) {
                updateForm({
                  price: formatPriceToSignificantDigits(tokenInfo.markPx),
                });
              }
            }}
            value={formData.price}
            onChange={(value) => updateForm({ price: value })}
            szDecimals={universe?.szDecimals ?? 2}
            isMobile={isMobile}
          />
        ) : null}
        <SizeInput
          side={formData.side}
          tokenInfo={tokenInfo}
          value={formData.size}
          onChange={(value) => updateForm({ size: value })}
          isMobile={isMobile}
        />
        <YStack>
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
            containerProps={{ alignItems: 'center' }}
            width="$3.5"
            height="$3.5"
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
            {perpsAccountLoading?.selectAccountLoading ? (
              <Skeleton width={70} height={16} />
            ) : (
              <SizableText size="$bodySmMedium" color="$text">
                {availableToTrade} {tokenInfo?.name}
              </SizableText>
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
              <NumberSizeableText
                size="$bodySmMedium"
                formatter="value"
                formatterOptions={{ currency: '$' }}
              >
                {selectedSymbolPositionValue}
              </NumberSizeableText>
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
      </YStack>
    </>
  );
}

const PerpTradingFormMemo = memo(PerpTradingForm);
export { PerpTradingFormMemo as PerpTradingForm };
