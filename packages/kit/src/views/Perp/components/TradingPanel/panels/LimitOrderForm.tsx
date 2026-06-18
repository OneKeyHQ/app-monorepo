import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  DashText,
  Dialog,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  type IBBOPriceMode,
  type ITradingFormData,
  useBboForOrderPrice,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetCtxReadyAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  calculateLiquidationPrice,
  formatPriceToSignificantDigits,
  parseDexCoin,
  resolveTradingSizeBN,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITIF } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { calculateOrderPrice } from '../../../hooks/useOrderPrice';
import { usePerpsAccountScopedActivePositions } from '../../../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsMarketDataFreshness } from '../../../hooks/usePerpsMarketDataFreshness';
import { useTradingPrice } from '../../../hooks/useTradingPrice';
import { PerpsAccountSelectorProviderMirror } from '../../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { shouldApplyMinimumOrderGuard } from '../../../utils/minimumOrderGuard';
import { shouldBlockPerpsTradingForMarketData } from '../../../utils/perpsMarketDataFreshness';
import { resolveTpSlTriggerPx } from '../../../utils/resolveTpSlTriggerPx';
import { PERP_TRADE_BUTTON_COLORS } from '../../../utils/styleUtils';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';
import { PerpsSlider } from '../../PerpsSlider';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';
import { PriceInput } from '../inputs/PriceInput';
import { SizeInput } from '../inputs/SizeInput';
import { TpSlFormInput } from '../inputs/TpSlFormInput';
import { showOrderConfirmDialog } from '../modals/OrderConfirmModal';
import { BBOSelector } from '../selectors/BBOSelector';
import { TimeInForceSelector } from '../selectors/TimeInForceSelector';

interface ILimitOrderFormProps {
  symbol: string;
  seededPrice: string;
  onClose: () => void;
}

type ITradeSide = 'long' | 'short';

function getPositiveFiniteNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function LimitOrderForm({
  symbol,
  seededPrice,
  onClose,
}: ILimitOrderFormProps) {
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [isAssetCtxReady] = usePerpsActiveAssetCtxReadyAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const perpsPositions = usePerpsAccountScopedActivePositions();
  const { midPrice, midPriceBN } = useTradingPrice();
  const marketDataFreshness = usePerpsMarketDataFreshness();

  // The form reads the live active asset, but `symbol` is the coin snapshotted
  // when the ticket opened. A programmatic active-asset switch (chart
  // SYMBOL_CHANGE, navigation, background refresh) the modal can't block would
  // otherwise let us submit against the wrong coin, so close on any drift.
  useEffect(() => {
    if (activeAsset?.coin && activeAsset.coin !== symbol) {
      onClose();
    }
  }, [activeAsset?.coin, symbol, onClose]);

  // All form state is local; this never writes tradingFormAtom (the main panel's).
  const [side, setSide] = useState<ITradeSide>('long');
  const [price, setPrice] = useState(seededPrice);
  const [size, setSize] = useState('');
  const [sizeInputMode, setSizeInputMode] = useState<EPerpsSizeInputMode>(
    EPerpsSizeInputMode.MANUAL,
  );
  const [sizePercent, setSizePercent] = useState(0);
  const [limitTif, setLimitTif] = useState<ITIF>('Gtc');
  const [bboPriceMode, setBboPriceMode] = useState<IBBOPriceMode>(null);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [hasTpsl, setHasTpsl] = useState(false);
  const [tpType, setTpType] = useState<'price' | 'percentage'>('price');
  const [tpValue, setTpValue] = useState('');
  const [slType, setSlType] = useState<'price' | 'percentage'>('price');
  const [slValue, setSlValue] = useState('');
  // Bumped whenever TP/SL inputs are programmatically re-seeded (TpSlFormInput
  // does not re-sync its internalValue on prop change).
  const [tpslSeedKey, setTpslSeedKey] = useState(0);
  const [inlineError, setInlineError] = useState<string | undefined>(undefined);

  const isBBOActive = Boolean(bboPriceMode);

  const szDecimals = activeAsset?.universe?.szDecimals ?? 2;
  const leverage = useMemo(
    () =>
      getPositiveFiniteNumber(activeAssetData?.leverage?.value) ??
      getPositiveFiniteNumber(activeAsset?.universe?.maxLeverage) ??
      1,
    [activeAssetData?.leverage?.value, activeAsset?.universe?.maxLeverage],
  );

  const displayName = useMemo(() => parseDexCoin(symbol).displayName, [symbol]);

  // Track BBO + mid in refs so the side-button press handlers can resolve the
  // concrete price without depending on the latest render closure.
  const bbo = useBboForOrderPrice(isBBOActive);
  const bboRef = useRef(bbo);
  bboRef.current = bbo;
  const midPriceBNRef = useRef(midPriceBN);
  midPriceBNRef.current = midPriceBN;

  // With a BBO mode the price comes from the live orderbook; otherwise the typed input.
  const resolvePriceForSide = useCallback(
    (forSide: ITradeSide) =>
      calculateOrderPrice(
        'limit',
        price,
        bboPriceMode ?? undefined,
        bboRef.current,
        midPriceBNRef.current,
        forSide,
        'standard',
      ),
    [bboPriceMode, price],
  );

  const referencePriceBN = useMemo(
    () => resolvePriceForSide(side).price,
    [resolvePriceForSide, side],
  );
  const referencePriceString = referencePriceBN.gt(0)
    ? referencePriceBN.toFixed()
    : '';

  const computeSizeBN = useCallback(
    (forSide: ITradeSide, refPrice: BigNumber) =>
      resolveTradingSizeBN({
        sizeInputMode,
        manualSize: size,
        sizePercent,
        side: forSide,
        price: refPrice.gt(0) ? refPrice.toFixed() : '',
        markPrice: activeAssetCtx?.ctx?.markPrice,
        maxTradeSzs: activeAssetData?.maxTradeSzs,
        leverageValue: activeAssetData?.leverage?.value,
        fallbackLeverage: activeAsset?.universe?.maxLeverage,
        szDecimals,
      }),
    [
      activeAsset?.universe?.maxLeverage,
      activeAssetCtx?.ctx?.markPrice,
      activeAssetData?.leverage?.value,
      activeAssetData?.maxTradeSzs,
      size,
      sizeInputMode,
      sizePercent,
      szDecimals,
    ],
  );

  const previewSizeBN = useMemo(
    () => computeSizeBN(side, referencePriceBN),
    [computeSizeBN, referencePriceBN, side],
  );

  const currentCoinPosition = useMemo(
    () =>
      perpsPositions.filter(
        (pos) => pos.position.coin === activeAsset?.coin,
      )?.[0]?.position,
    [perpsPositions, activeAsset?.coin],
  );

  const liquidationPriceBN = useMemo(() => {
    if (!activeAssetData?.leverage?.type) {
      return null;
    }
    if (
      !previewSizeBN.isFinite() ||
      previewSizeBN.lte(0) ||
      !referencePriceBN.isFinite() ||
      referencePriceBN.lte(0)
    ) {
      return null;
    }
    const totalValue = previewSizeBN.multipliedBy(referencePriceBN);
    const result = calculateLiquidationPrice({
      totalValue,
      referencePrice: referencePriceBN,
      clampToCurrentMark: true,
      markPrice: activeAssetCtx?.ctx?.markPrice
        ? new BigNumber(activeAssetCtx.ctx.markPrice)
        : undefined,
      positionSize: previewSizeBN,
      side,
      leverage,
      mode: activeAssetData.leverage.type,
      marginTiers: activeAsset?.margin?.marginTiers,
      maxLeverage: activeAsset?.universe?.maxLeverage || 1,
      crossMarginUsed: new BigNumber(accountSummary?.crossAccountValue || '0'),
      crossMaintenanceMarginUsed: new BigNumber(
        accountSummary?.crossMaintenanceMarginUsed || '0',
      ),
      existingPositionSize: currentCoinPosition
        ? new BigNumber(currentCoinPosition.szi)
        : undefined,
      existingEntryPrice: currentCoinPosition
        ? new BigNumber(currentCoinPosition.entryPx)
        : undefined,
      newOrderSide: side,
    });
    return result?.gt(0) ? result : null;
  }, [
    accountSummary?.crossAccountValue,
    accountSummary?.crossMaintenanceMarginUsed,
    activeAsset?.margin?.marginTiers,
    activeAsset?.universe?.maxLeverage,
    activeAssetCtx?.ctx?.markPrice,
    activeAssetData?.leverage?.type,
    currentCoinPosition,
    leverage,
    previewSizeBN,
    referencePriceBN,
    side,
  ]);

  const marginRequiredBN = useMemo(() => {
    if (
      !previewSizeBN.isFinite() ||
      previewSizeBN.lte(0) ||
      !referencePriceBN.isFinite() ||
      referencePriceBN.lte(0)
    ) {
      return new BigNumber(0);
    }
    return previewSizeBN
      .multipliedBy(referencePriceBN)
      .dividedBy(leverage > 0 ? leverage : 1);
  }, [leverage, previewSizeBN, referencePriceBN]);

  const availableToTrade = useMemo(() => {
    const available = activeAssetData?.availableToTrade;
    if (!available) {
      return '0';
    }
    const longValue = Number(available[0] ?? 0);
    const shortValue = Number(available[1] ?? 0);
    return new BigNumber(Math.min(longValue, shortValue)).toFixed(
      2,
      BigNumber.ROUND_DOWN,
    );
  }, [activeAssetData?.availableToTrade]);

  // Size/slider/mode coordination replicates PerpTradingForm, in local state.
  const handleManualSizeChange = useCallback((value: string) => {
    setSize(value);
    setSizeInputMode(EPerpsSizeInputMode.MANUAL);
    setSizePercent(0);
    setInlineError(undefined);
  }, []);

  const switchToManual = useCallback(() => {
    setSizeInputMode((mode) => {
      if (mode === EPerpsSizeInputMode.SLIDER) {
        setSizePercent(0);
        setSize('');
        return EPerpsSizeInputMode.MANUAL;
      }
      return mode;
    });
  }, []);

  const handleSliderPercentChange = useCallback(
    (nextValue: number | number[]) => {
      const raw = Array.isArray(nextValue) ? nextValue[0] : nextValue;
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const clamped = Math.max(0, Math.min(100, value));
      setSizeInputMode(EPerpsSizeInputMode.SLIDER);
      setSizePercent(clamped);
      setSize('');
      setInlineError(undefined);
    },
    [],
  );

  const sliderValue =
    sizeInputMode === EPerpsSizeInputMode.SLIDER ? sizePercent : 0;
  const sliderEnabled = useMemo(() => {
    const maxBN = computeSizeBN(side, referencePriceBN);
    return referencePriceBN.gt(0) && maxBN.isFinite();
  }, [computeSizeBN, referencePriceBN, side]);

  const handleUseMidPrice = useCallback(() => {
    if (!midPrice) {
      return;
    }
    setPrice(formatPriceToSignificantDigits(midPrice, szDecimals));
    setInlineError(undefined);
  }, [midPrice, szDecimals]);

  const handleBBOToggle = useCallback(() => {
    setBboPriceMode((prev) =>
      prev ? null : { type: 'counterparty', level: 1 },
    );
  }, []);

  const handleTpslCheckboxChange = useCallback((checked: boolean) => {
    setHasTpsl(checked);
    if (!checked) {
      setTpValue('');
      setSlValue('');
      setTpslSeedKey((key) => key + 1);
    }
  }, []);

  const handlePlace = useCallback(
    (pressedSide: ITradeSide) => {
      // Abort if the active coin drifted from the snapshot — the form computes
      // off the live asset, so a stale ticket must not submit against it.
      if (!activeAsset?.coin || activeAsset.coin !== symbol) {
        onClose();
        return;
      }

      setSide(pressedSide);

      // Same blocks as the main panel (validateOrderPanelState): the order
      // ticket holds independent state, so it must enforce them itself instead
      // of bypassing straight to submitOrder.
      if (shouldBlockPerpsTradingForMarketData(marketDataFreshness)) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.perp_offline }),
          message: intl.formatMessage({
            id: ETranslations.perps_offline_moblie,
          }),
        });
        return;
      }

      const orderPrice = resolvePriceForSide(pressedSide);
      if (orderPrice.error || !orderPrice.isValid || orderPrice.price.lte(0)) {
        setInlineError(
          intl.formatMessage({
            id: ETranslations.perp_trade_price_place_holder,
          }),
        );
        return;
      }
      const resolvedPriceBN = orderPrice.price;
      const resolvedPrice = formatPriceToSignificantDigits(
        resolvedPriceBN,
        szDecimals,
      );

      const computedSizeBN = computeSizeBN(pressedSide, resolvedPriceBN);
      if (!computedSizeBN.isFinite() || computedSizeBN.lte(0)) {
        setInlineError(
          intl.formatMessage({
            id: ETranslations.perp_trade_amount_place_holder,
          }),
        );
        return;
      }

      const orderValueBN = computedSizeBN.multipliedBy(resolvedPriceBN);
      if (
        shouldApplyMinimumOrderGuard({
          isSpot: false,
          orderMode: 'standard',
          orderType: 'limit',
          hasBboPriceMode: Boolean(bboPriceMode),
        }) &&
        orderValueBN.gt(0) &&
        orderValueBN.lt(10)
      ) {
        setInlineError(
          intl.formatMessage(
            { id: ETranslations.perp_size_least },
            { amount: '$10' },
          ),
        );
        return;
      }

      const available = activeAssetData?.availableToTrade;
      const sideAvailableBN = new BigNumber(
        (pressedSide === 'long' ? available?.[0] : available?.[1]) ?? 0,
      );
      const marginRequiredForOrderBN = orderValueBN.dividedBy(
        leverage > 0 ? leverage : 1,
      );
      if (marginRequiredForOrderBN.gt(sideAvailableBN)) {
        setInlineError(
          intl.formatMessage({
            id: ETranslations.perp_insufficient_margin__title,
          }),
        );
        return;
      }

      const { tpTriggerPx, slTriggerPx } = resolveTpSlTriggerPx({
        hasTpsl,
        tpType,
        tpValue,
        slType,
        slValue,
        referencePrice: resolvedPriceBN,
        side: pressedSide,
        leverage,
      });

      setInlineError(undefined);

      // Normalize to a concrete manual token size so the confirm dialog display
      // and the submitted order stay consistent (slider sizes resolve to 0 in
      // the confirm content otherwise).
      const builtFormData: ITradingFormData = {
        side: pressedSide,
        type: 'limit',
        price: resolvedPrice,
        size: computedSizeBN.toFixed(),
        sizeInputMode: EPerpsSizeInputMode.MANUAL,
        sizePercent: 0,
        leverage,
        bboPriceMode: bboPriceMode ?? null,
        limitTif,
        reduceOnly,
        hasTpsl,
        tpTriggerPx: tpTriggerPx ?? '',
        tpGainPercent: '',
        slTriggerPx: slTriggerPx ?? '',
        slLossPercent: '',
        tpType,
        tpValue,
        slType,
        slValue,
        orderMode: 'standard',
      };

      showOrderConfirmDialog({
        overrideSide: pressedSide,
        formData: builtFormData,
        price: resolvedPrice,
        expectedCoin: symbol,
        intl,
        onConfirmSuccess: onClose,
      });
    },
    [
      activeAsset?.coin,
      activeAssetData?.availableToTrade,
      bboPriceMode,
      computeSizeBN,
      hasTpsl,
      intl,
      leverage,
      limitTif,
      marketDataFreshness,
      onClose,
      reduceOnly,
      resolvePriceForSide,
      slType,
      slValue,
      symbol,
      szDecimals,
      tpType,
      tpValue,
    ],
  );

  const longColors =
    themeVariant === 'light'
      ? PERP_TRADE_BUTTON_COLORS.light
      : PERP_TRADE_BUTTON_COLORS.dark;

  return (
    <YStack gap="$2.5">
      {/* Price + BBO */}
      <XStack alignItems="center" gap="$2.5">
        {isBBOActive ? (
          <YStack flex={1}>
            <BBOSelector value={bboPriceMode} onChange={setBboPriceMode} />
          </YStack>
        ) : (
          <YStack flex={1}>
            <PriceInput
              value={price}
              onChange={(value) => {
                setPrice(value);
                setInlineError(undefined);
              }}
              onUseMidPrice={midPrice ? handleUseMidPrice : undefined}
              szDecimals={szDecimals}
            />
          </YStack>
        )}
        <DashText
          size="$bodyMdMedium"
          dashColor="$text"
          dashThickness={0.5}
          cursor="pointer"
          onPress={handleBBOToggle}
          alignSelf="center"
        >
          {intl.formatMessage({ id: ETranslations.Perps_BBO_button_title })}
        </DashText>
      </XStack>

      {/* Size + slider */}
      <SizeInput
        value={size}
        side={side}
        symbol={displayName}
        onChange={handleManualSizeChange}
        activeAsset={activeAsset}
        isAssetCtxReady={isAssetCtxReady}
        referencePrice={referencePriceString}
        sizeInputMode={sizeInputMode}
        sliderPercent={sizePercent}
        onRequestManualMode={switchToManual}
        leverage={leverage}
      />
      <PerpsSlider
        min={0}
        max={100}
        value={sliderValue}
        showBubble={false}
        onChange={handleSliderPercentChange}
        disabled={!sliderEnabled}
        segments={4}
        snapTapToSegment
        sliderHeight={4}
      />

      {/* Reduce only */}
      <XStack alignItems="center">
        <Checkbox
          testID="chart-limit-reduce-only-checkbox"
          value={reduceOnly}
          onChange={(checked) => setReduceOnly(!!checked)}
          label={intl.formatMessage({ id: ETranslations.perps_reduce_only })}
          containerProps={{ p: 0, alignItems: 'center', cursor: 'pointer' }}
          labelProps={{ fontSize: '$bodyMdMedium', color: '$text' }}
        />
      </XStack>

      {/* Time in force */}
      <XStack justifyContent="flex-end">
        <TimeInForceSelector value={limitTif} onChange={setLimitTif} />
      </XStack>

      {/* TP/SL */}
      <XStack alignItems="center" gap="$2">
        <Checkbox
          testID="chart-limit-tpsl-checkbox"
          value={hasTpsl}
          onChange={(checked) => handleTpslCheckboxChange(!!checked)}
          containerProps={{ p: 0, alignItems: 'center', cursor: 'pointer' }}
        />
        <SizableText size="$bodyMd" color="$text">
          {intl.formatMessage({ id: ETranslations.perp_position_tp_sl })}
        </SizableText>
      </XStack>
      {hasTpsl ? (
        <YStack gap="$2">
          <TpSlFormInput
            key={`tp-${tpslSeedKey}`}
            type="tp"
            label={intl.formatMessage({
              id: ETranslations.perp_trade_tp_price,
            })}
            value={tpValue}
            inputType={tpType}
            referencePrice={referencePriceString}
            szDecimals={szDecimals}
            onChange={setTpValue}
            onTypeChange={setTpType}
          />
          <TpSlFormInput
            key={`sl-${tpslSeedKey}`}
            type="sl"
            label={intl.formatMessage({
              id: ETranslations.perp_trade_sl_price,
            })}
            value={slValue}
            inputType={slType}
            referencePrice={referencePriceString}
            szDecimals={szDecimals}
            onChange={setSlValue}
            onTypeChange={setSlType}
          />
        </YStack>
      ) : null}

      {/* Footer: cost / liq price / available */}
      <YStack gap="$1.5">
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_cost })}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$text">
            {marginRequiredBN.gt(0)
              ? `$${marginRequiredBN.toFixed(2, BigNumber.ROUND_DOWN)}`
              : '--'}
          </SizableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_est_liq_price })}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$text">
            {liquidationPriceBN
              ? `$${formatPriceToSignificantDigits(
                  liquidationPriceBN,
                  szDecimals,
                )}`
              : '--'}
          </SizableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_account_overview_available,
            })}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$text">
            {`$${availableToTrade}`}
          </SizableText>
        </XStack>
      </YStack>

      {inlineError ? (
        <SizableText size="$bodySm" color="$textCritical">
          {inlineError}
        </SizableText>
      ) : null}

      {/* Buy / Sell */}
      <TradingGuardWrapper>
        <XStack gap="$2.5">
          <Button
            testID="chart-limit-long-button"
            flex={1}
            size="medium"
            childrenAsText={false}
            borderRadius="$4"
            bg={longColors.long}
            hoverStyle={{ bg: longColors.longHover }}
            pressStyle={{ bg: longColors.longPress }}
            onPress={() => handlePlace('long')}
          >
            <SizableText size="$bodyMdMedium" color="$textOnColor">
              {intl.formatMessage({ id: ETranslations.perp_trade_long })}
            </SizableText>
          </Button>
          <Button
            testID="chart-limit-short-button"
            flex={1}
            size="medium"
            childrenAsText={false}
            borderRadius="$4"
            bg={longColors.short}
            hoverStyle={{ bg: longColors.shortHover }}
            pressStyle={{ bg: longColors.shortPress }}
            onPress={() => handlePlace('short')}
          >
            <SizableText size="$bodyMdMedium" color="$textOnColor">
              {intl.formatMessage({ id: ETranslations.perp_trade_short })}
            </SizableText>
          </Button>
        </XStack>
      </TradingGuardWrapper>
    </YStack>
  );
}

// symbol/price are snapshotted at open; LimitOrderForm closes and the confirm
// step re-asserts the live coin still matches, so a later active-asset switch
// cannot submit a stale ticket against another coin.
export function showLimitOrderDialog({
  symbol,
  price,
  intl,
}: {
  symbol: string;
  price: string;
  intl: IntlShape;
}) {
  const displayName = parseDexCoin(symbol).displayName;
  const dialogInstance = Dialog.show({
    title: `${intl.formatMessage({
      id: ETranslations.perp_trade_limit,
    })} · ${displayName}`,
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <LimitOrderForm
            symbol={symbol}
            seededPrice={price}
            onClose={() => {
              void dialogInstance.close();
            }}
          />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
