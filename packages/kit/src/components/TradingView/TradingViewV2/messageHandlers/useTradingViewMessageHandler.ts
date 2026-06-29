import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { calculateDisplayPriceScale } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { handleAnalyticsEvent } from './analyticsHandler';
import {
  fetchAccountTransactionMarks,
  handleKLineDataRequest,
  sendClearAccountMarks,
  shouldMockEmptyKLineData,
} from './klineDataHandler';
import { handleLayoutUpdate } from './layoutUpdateHandler';

import type { IMarksTimeRange, IMessageHandlerContext } from './types';
import type { IWebViewRef } from '../../../WebView/types';
import type { ITradingViewV2KLineDataFallback } from '../hooks/useTradingViewV2';
import type {
  ICustomReceiveHandlerData,
  ITradingViewIndicatorsDialogData,
  ITradingViewInteractionOverlayData,
  ITradingViewIntervalConfigData,
  ITradingViewIntervalOption,
  ITradingViewKLineDataReadyData,
  ITradingViewKLineLoadErrorData,
  ITradingViewKLinePeriodChangeData,
  ITradingViewNativeChartControlsConfigData,
  ITradingViewPriceUpdateData,
  ITradingViewTouchScrollData,
} from '../types';

const DEFAULT_HYPERLIQUID_PRICE_SCALE = 100;
const TRADINGVIEW_PRICE_UPDATE = 'tradingview_priceUpdate';
const TRADINGVIEW_INTERVAL_CONFIG = 'tradingview_intervalConfig';
const TRADINGVIEW_NATIVE_CHART_CONTROLS_CONFIG =
  'tradingview_nativeChartControlsConfig';

interface IUseTradingViewMessageHandlerParams {
  tokenAddress?: string;
  networkId?: string;
  webRef: React.RefObject<IWebViewRef | null>;
  onPanesCountChange?: (count: number) => void;
  accountAddress?: string;
  tokenSymbol?: string;
  marksTimeRange?: React.MutableRefObject<IMarksTimeRange | null>;
  currentKLineResolution?: React.MutableRefObject<string>;
  onCurrentKLineResolutionChange?: (resolution: string) => void;
  onTouchScroll?: (deltaY: number) => void;
  onIndicatorsDialogOpenChange?: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
  forceEmptyKLineData?: boolean;
  emptyKLineDataOnError?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  onPrimaryKLineDataUnavailable?: () => void;
  onPriceUpdate?: (data: ITradingViewPriceUpdateData) => void;
  onIntervalConfigChange?: (data: ITradingViewIntervalConfigData) => void;
  onNativeChartControlsConfigChange?: (
    data: ITradingViewNativeChartControlsConfigData,
  ) => void;
  onKLineDataReady?: (data: ITradingViewKLineDataReadyData) => void;
  onKLineLoadError?: (data: ITradingViewKLineLoadErrorData) => void;
  onKLinePeriodChange?: (data: ITradingViewKLinePeriodChangeData) => void;
}

async function handleGetHyperliquidPriceScale({
  request,
  webRef,
}: {
  request: { symbol?: string; requestId?: string };
  webRef: React.RefObject<IWebViewRef | null>;
}) {
  if (!request.requestId) {
    return;
  }

  const requestSymbol = request.symbol;
  let priceScale = DEFAULT_HYPERLIQUID_PRICE_SCALE;
  let persistedPriceScale: number | undefined;
  let midValue: string | undefined;

  if (!requestSymbol) {
    webRef.current?.sendMessageViaInjectedScript({
      type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
      payload: {
        priceScale,
        minmov: 1,
        requestId: request.requestId,
      },
    });
    return;
  }

  const loadMidPrice = async () => {
    return backgroundApiProxy.serviceHyperliquid.getTradingviewMidPrice(
      requestSymbol,
    );
  };

  midValue = await loadMidPrice();

  if (!midValue && requestSymbol) {
    try {
      persistedPriceScale =
        await backgroundApiProxy.serviceHyperliquid.getTradingviewDisplayPriceScale(
          requestSymbol,
        );
    } catch (error) {
      console.error(
        '[TradingViewV2] Failed to load HyperLiquid price scale:',
        error,
      );
    }
  }

  if (!midValue && persistedPriceScale === undefined) {
    const deadline = Date.now() + timerUtils.getTimeDurationMs({ seconds: 3 });
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      midValue = await loadMidPrice();
      if (midValue) {
        break;
      }
    }
  }

  if (midValue && requestSymbol) {
    priceScale = calculateDisplayPriceScale(midValue);
    try {
      await backgroundApiProxy.serviceHyperliquid.setTradingviewDisplayPriceScale(
        {
          symbol: requestSymbol,
          priceScale,
        },
      );
    } catch (error) {
      console.error(
        '[TradingViewV2] Failed to persist HyperLiquid price scale:',
        error,
      );
    }
  } else if (persistedPriceScale !== undefined) {
    priceScale = persistedPriceScale;
  }

  webRef.current?.sendMessageViaInjectedScript({
    type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
    payload: {
      priceScale,
      minmov: 1,
      requestId: request.requestId,
    },
  });
}

async function handleGetMarks({
  request,
  accountAddress,
  tokenAddress,
  networkId,
  resolution,
  webRef,
  forceEmptyKLineData,
}: {
  request: {
    requestId?: string;
    from?: number;
    to?: number;
    symbol?: string;
    resolution?: string;
  };
  accountAddress?: string;
  tokenAddress: string;
  networkId: string;
  resolution?: string;
  webRef: React.RefObject<IWebViewRef | null>;
  forceEmptyKLineData?: boolean;
}) {
  const requestId = request.requestId;

  if (!requestId) {
    return;
  }

  if (forceEmptyKLineData || (await shouldMockEmptyKLineData(resolution))) {
    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks: [],
        requestId,
      },
    });
    sendClearAccountMarks({
      tokenAddress,
      symbol: request.symbol,
      webRef,
    });
    return;
  }

  if (!tokenAddress || !networkId) {
    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks: [],
        requestId,
      },
    });
    return;
  }

  try {
    const marks = await fetchAccountTransactionMarks({
      accountAddress,
      tokenAddress,
      networkId,
      from: request.from ?? 0,
      to: request.to ?? Math.floor(Date.now() / 1000),
    });

    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks,
        requestId,
      },
    });
  } catch (error) {
    console.error('[TradingViewV2] Failed to fetch marks:', error);
    webRef.current?.sendMessageViaInjectedScript({
      type: 'MARKS_RESPONSE',
      payload: {
        marks: [],
        requestId,
      },
    });
  }
}

function getIndicatorsDialogOpenState(
  dialogData: ITradingViewIndicatorsDialogData | undefined,
): boolean | undefined {
  if (typeof dialogData?.isOpen === 'boolean') {
    return dialogData.isOpen;
  }
  if (dialogData?.action === 'open') {
    return true;
  }
  if (dialogData?.action === 'close') {
    return false;
  }
  return undefined;
}

function getInteractionOverlayOpenState(
  overlayData: ITradingViewInteractionOverlayData | undefined,
): boolean | undefined {
  if (typeof overlayData?.isOpen === 'boolean') {
    return overlayData.isOpen;
  }
  if (overlayData?.action === 'open') {
    return true;
  }
  if (overlayData?.action === 'close') {
    return false;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeStringOptionDisabled(option: Record<string, unknown>) {
  if (typeof option.disabled === 'boolean') {
    return option.disabled;
  }
  if (typeof option.enabled === 'boolean') {
    return !option.enabled;
  }
  if (typeof option.available === 'boolean') {
    return !option.available;
  }
  if (typeof option.selectable === 'boolean') {
    return !option.selectable;
  }
  return undefined;
}

function normalizeStringOptions(
  options: unknown,
): { label: string; value: string }[] | null {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalizedOptions: { label: string; value: string }[] = [];
  for (const option of options) {
    if (!isRecord(option)) {
      return null;
    }

    const label = typeof option.label === 'string' ? option.label.trim() : '';
    const value = typeof option.value === 'string' ? option.value.trim() : '';
    if (!label || !value) {
      return null;
    }

    normalizedOptions.push({ label, value });
  }

  return normalizedOptions;
}

function normalizeIntervalOptions(
  options: unknown,
): ITradingViewIntervalOption[] | null {
  const normalizedOptions = normalizeStringOptions(options);
  if (!normalizedOptions) {
    return null;
  }

  return normalizedOptions.map((option, index) => {
    const rawOption = Array.isArray(options) ? options[index] : null;
    const disabled = isRecord(rawOption)
      ? normalizeStringOptionDisabled(rawOption)
      : undefined;
    return {
      ...option,
      ...(disabled === undefined ? {} : { disabled }),
    };
  });
}

function normalizeIntervalConfig(
  data: unknown,
): ITradingViewIntervalConfigData | null {
  if (!isRecord(data)) {
    return null;
  }

  const intervals = normalizeIntervalOptions(data.intervals);
  const activeInterval =
    typeof data.activeInterval === 'string' ? data.activeInterval.trim() : '';
  if (!intervals?.length || !activeInterval) {
    return null;
  }

  return {
    intervals,
    activeInterval,
    ...(typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
      ? { timestamp: data.timestamp }
      : {}),
  };
}

function normalizeIndicators(
  indicators: unknown,
): ITradingViewNativeChartControlsConfigData['indicators'] | null {
  const options = normalizeStringOptions(indicators);
  if (!options) {
    return null;
  }

  return options.map((option, index) => {
    const rawIndicator = Array.isArray(indicators) ? indicators[index] : null;
    return {
      ...option,
      ...(isRecord(rawIndicator) && typeof rawIndicator.active === 'boolean'
        ? { active: rawIndicator.active }
        : {}),
    };
  });
}

function normalizeChartTypes(
  chartTypes: unknown,
): ITradingViewNativeChartControlsConfigData['chartTypes'] | null {
  if (!Array.isArray(chartTypes)) {
    return null;
  }

  const normalizedChartTypes: ITradingViewNativeChartControlsConfigData['chartTypes'] =
    [];
  for (const chartType of chartTypes) {
    if (!isRecord(chartType)) {
      return null;
    }

    const label =
      typeof chartType.label === 'string' ? chartType.label.trim() : '';
    const value = Number(chartType.value);
    if (!label || !Number.isFinite(value)) {
      return null;
    }

    normalizedChartTypes.push({ label, value });
  }

  return normalizedChartTypes;
}

function normalizeResetLayout(
  resetLayout: unknown,
): ITradingViewNativeChartControlsConfigData['resetLayout'] | undefined {
  if (!isRecord(resetLayout)) {
    return undefined;
  }

  const label =
    typeof resetLayout.label === 'string' ? resetLayout.label.trim() : '';
  if (typeof resetLayout.enabled !== 'boolean' || !label) {
    return undefined;
  }

  return {
    enabled: resetLayout.enabled,
    label,
  };
}

type IPriceMarketCapConfig = NonNullable<
  ITradingViewNativeChartControlsConfigData['priceMarketCap']
>;

function normalizePriceMarketCapOptions(
  options: unknown,
): IPriceMarketCapConfig['options'] | null {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalizedOptions: IPriceMarketCapConfig['options'] = [];
  for (const option of options) {
    if (!isRecord(option)) {
      return null;
    }

    const label = typeof option.label === 'string' ? option.label.trim() : '';
    const value = option.value;
    if (!label || (value !== 'price' && value !== 'marketcap')) {
      return null;
    }

    normalizedOptions.push({ label, value });
  }

  return normalizedOptions;
}

function normalizePriceMarketCap(
  priceMarketCap: unknown,
): ITradingViewNativeChartControlsConfigData['priceMarketCap'] | undefined {
  if (!isRecord(priceMarketCap)) {
    return undefined;
  }

  const label =
    typeof priceMarketCap.label === 'string' ? priceMarketCap.label.trim() : '';
  const options = normalizePriceMarketCapOptions(priceMarketCap.options);
  const activeMode = priceMarketCap.activeMode;
  if (
    typeof priceMarketCap.enabled !== 'boolean' ||
    !label ||
    !options ||
    (activeMode !== 'price' && activeMode !== 'marketcap')
  ) {
    return undefined;
  }

  return {
    enabled: priceMarketCap.enabled,
    label,
    options,
    activeMode,
  };
}

type IPriceScaleConfig = NonNullable<
  ITradingViewNativeChartControlsConfigData['priceScale']
>;

function normalizePriceScaleOptions(
  options: unknown,
): IPriceScaleConfig['options'] | null {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalizedOptions: IPriceScaleConfig['options'] = [];
  for (const option of options) {
    if (!isRecord(option)) {
      return null;
    }

    const label = typeof option.label === 'string' ? option.label.trim() : '';
    const value = option.value;
    if (
      !label ||
      (value !== 'auto' && value !== 'log' && value !== 'percentage')
    ) {
      return null;
    }

    normalizedOptions.push({ label, value });
  }

  return normalizedOptions;
}

function normalizePriceScale(
  priceScale: unknown,
): ITradingViewNativeChartControlsConfigData['priceScale'] | undefined {
  if (!isRecord(priceScale)) {
    return undefined;
  }

  const label =
    typeof priceScale.label === 'string' ? priceScale.label.trim() : '';
  const options = normalizePriceScaleOptions(priceScale.options);
  const activeMode = priceScale.activeMode;
  if (
    typeof priceScale.enabled !== 'boolean' ||
    !label ||
    !options ||
    (activeMode !== 'auto' &&
      activeMode !== 'log' &&
      activeMode !== 'percentage')
  ) {
    return undefined;
  }

  return {
    enabled: priceScale.enabled,
    label,
    options,
    activeMode,
  };
}

function normalizeNativeChartControlsConfig(
  data: unknown,
): ITradingViewNativeChartControlsConfigData | null {
  if (!isRecord(data)) {
    return null;
  }

  const indicators = normalizeIndicators(data.indicators);
  const chartTypes = normalizeChartTypes(data.chartTypes);
  const activeChartType = Number(data.activeChartType);
  if (!indicators || !chartTypes || !Number.isFinite(activeChartType)) {
    return null;
  }

  const intervals =
    data.intervals === undefined
      ? undefined
      : normalizeIntervalOptions(data.intervals);
  if (data.intervals !== undefined && !intervals) {
    return null;
  }

  const activeInterval =
    typeof data.activeInterval === 'string' ? data.activeInterval.trim() : '';
  const resetLayout = normalizeResetLayout(data.resetLayout);
  const priceMarketCap = normalizePriceMarketCap(data.priceMarketCap);
  const priceScale = normalizePriceScale(data.priceScale);

  return {
    ...(intervals?.length ? { intervals } : {}),
    ...(activeInterval ? { activeInterval } : {}),
    ...(typeof data.indicatorsEnabled === 'boolean'
      ? { indicatorsEnabled: data.indicatorsEnabled }
      : {}),
    indicators,
    ...(typeof data.chartTypesEnabled === 'boolean'
      ? { chartTypesEnabled: data.chartTypesEnabled }
      : {}),
    chartTypes,
    activeChartType,
    ...(resetLayout ? { resetLayout } : {}),
    ...(priceMarketCap ? { priceMarketCap } : {}),
    ...(priceScale ? { priceScale } : {}),
    ...(typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
      ? { timestamp: data.timestamp }
      : {}),
  };
}

function normalizeTradingViewMessagePayload({
  data,
  scope,
}: ICustomReceiveHandlerData): ICustomReceiveHandlerData['data'] {
  if (data.scope || !scope) {
    return data;
  }

  return {
    ...data,
    scope,
  };
}

export function useTradingViewMessageHandler({
  tokenAddress = '',
  networkId = '',
  webRef,
  onPanesCountChange,
  accountAddress,
  tokenSymbol,
  marksTimeRange,
  currentKLineResolution,
  onCurrentKLineResolutionChange,
  onTouchScroll,
  onIndicatorsDialogOpenChange,
  onInteractionOverlayOpenChange,
  forceEmptyKLineData,
  emptyKLineDataOnError,
  kLineDataFallback,
  primaryKLineDataUnavailable,
  onPrimaryKLineDataUnavailable,
  onPriceUpdate,
  onIntervalConfigChange,
  onNativeChartControlsConfigChange,
  onKLineDataReady,
  onKLineLoadError,
  onKLinePeriodChange,
}: IUseTradingViewMessageHandlerParams) {
  const customReceiveHandler = useCallback(
    async (payload: ICustomReceiveHandlerData) => {
      const data = normalizeTradingViewMessagePayload(payload);
      // Create context for message handlers
      const context: IMessageHandlerContext = {
        tokenAddress,
        networkId,
        webRef,
        onPanesCountChange,
        accountAddress,
        tokenSymbol,
        marksTimeRange,
        currentKLineResolution,
        onCurrentKLineResolutionChange,
        forceEmptyKLineData,
        emptyKLineDataOnError,
        kLineDataFallback,
        primaryKLineDataUnavailable,
        onPrimaryKLineDataUnavailable,
        onKLineDataReady,
        onKLineLoadError,
        onKLinePeriodChange,
      };

      // Handle TradingView private API requests
      if (
        data.scope === '$private' &&
        data.method === 'tradingview_getKLineData'
      ) {
        await handleKLineDataRequest({ data, context });
      }

      // Handle TradingView layout update messages
      if (
        data.scope === '$private' &&
        data.method === 'tradingview_layoutUpdate'
      ) {
        await handleLayoutUpdate({ data, context });
      }

      // Handle TradingView analytics messages (interval, time frame, etc.)
      if (
        data.scope === '$private' &&
        data.method?.startsWith('tradingview_analytics_')
      ) {
        await handleAnalyticsEvent(data.method, { data, context });
      }

      if (
        data.scope === '$private' &&
        data.method === 'tradingview_getHyperliquidPriceScale'
      ) {
        await handleGetHyperliquidPriceScale({
          request: data.data as { symbol?: string; requestId?: string },
          webRef,
        });
      }

      if (
        data.scope === '$private' &&
        data.method === TRADINGVIEW_PRICE_UPDATE
      ) {
        const priceUpdateData = data.data as
          | ITradingViewPriceUpdateData
          | undefined;
        if (priceUpdateData) {
          onPriceUpdate?.(priceUpdateData);
        }
      }

      if (
        data.scope === '$private' &&
        data.method === TRADINGVIEW_INTERVAL_CONFIG
      ) {
        const intervalConfigData = normalizeIntervalConfig(data.data);
        if (intervalConfigData) {
          onIntervalConfigChange?.(intervalConfigData);
        }
      }

      if (
        data.scope === '$private' &&
        data.method === TRADINGVIEW_NATIVE_CHART_CONTROLS_CONFIG
      ) {
        const nativeChartControlsConfigData =
          normalizeNativeChartControlsConfig(data.data);
        if (nativeChartControlsConfigData) {
          onNativeChartControlsConfigChange?.(nativeChartControlsConfigData);
        }
      }

      if (data.scope === '$private' && data.method === 'tradingview_getMarks') {
        const marksRequest = data.data as {
          requestId?: string;
          from?: number;
          to?: number;
          symbol?: string;
          resolution?: string;
        };
        const resolution =
          marksRequest.resolution || currentKLineResolution?.current;

        await handleGetMarks({
          request: marksRequest,
          accountAddress,
          tokenAddress,
          networkId,
          resolution,
          webRef,
          forceEmptyKLineData,
        });
      }

      if (
        data.scope === '$private' &&
        data.method === 'tradingview_touchScroll'
      ) {
        const touchData = data.data as ITradingViewTouchScrollData | undefined;
        const deltaY = Number(touchData?.deltaY ?? 0);
        if (Number.isFinite(deltaY) && deltaY !== 0) {
          onTouchScroll?.(deltaY);
        }
      }

      if (
        data.scope === '$private' &&
        data.method === 'tradingview_indicatorsDialog'
      ) {
        const dialogData = data.data as
          | ITradingViewIndicatorsDialogData
          | undefined;
        const isOpen = getIndicatorsDialogOpenState(dialogData);

        if (typeof isOpen === 'boolean') {
          onIndicatorsDialogOpenChange?.(isOpen);
        }
      }

      if (
        data.scope === '$private' &&
        data.method === 'tradingview_interactionOverlay'
      ) {
        const overlayData = data.data as
          | ITradingViewInteractionOverlayData
          | undefined;
        const isOpen = getInteractionOverlayOpenState(overlayData);

        if (typeof isOpen === 'boolean') {
          onInteractionOverlayOpenChange?.(isOpen);
        }
      }
    },
    [
      tokenAddress,
      networkId,
      webRef,
      onPanesCountChange,
      accountAddress,
      tokenSymbol,
      marksTimeRange,
      currentKLineResolution,
      onCurrentKLineResolutionChange,
      onTouchScroll,
      onIndicatorsDialogOpenChange,
      onInteractionOverlayOpenChange,
      forceEmptyKLineData,
      emptyKLineDataOnError,
      kLineDataFallback,
      primaryKLineDataUnavailable,
      onPrimaryKLineDataUnavailable,
      onPriceUpdate,
      onIntervalConfigChange,
      onNativeChartControlsConfigChange,
      onKLineDataReady,
      onKLineLoadError,
      onKLinePeriodChange,
    ],
  );

  return {
    customReceiveHandler,
  };
}
