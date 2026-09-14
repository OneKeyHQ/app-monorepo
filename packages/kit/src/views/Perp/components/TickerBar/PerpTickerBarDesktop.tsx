import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { isString } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  DebugRenderTracker,
  Divider,
  IconButton,
  ScrollView,
  SizableText,
  SkeletonContainer,
  Tooltip,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { ITooltipRef } from '@onekeyhq/components/src/actions/Tooltip';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsAllAssetCtxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { openHyperLiquidTokenExplorerUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { PerpTestIDs } from '@onekeyhq/kit/src/views/Perp/testIDs';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useSpotActiveAssetAtom,
  useSpotActiveAssetCtxAtom,
  useSpotExternalMarketCapsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { markPerpsColdStartPerfOnce } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getDexIndexByAssetId,
  getDexIndexByCoin,
  isPerpsUniverseCacheComplete,
  toAssetId,
  toCtxIndex,
} from '@onekeyhq/shared/src/utils/perpsDexUtils';
import {
  formatAssetCtx,
  getSpotMarketCapValue,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useFundingCountdown, usePerpSession } from '../../hooks';
import { useShowPortfolio } from '../../hooks/useShowPortfolio';
import { useSpotMetaMaps } from '../../hooks/useSpotMetaMaps';
import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';
import { FavoriteButton } from '../TokenSelector/PerpTokenSelectorRow';

// Medium-weight (500) data values — the heading tokens' 600 reads too heavy
// for a dense stat strip of tabular digits, while plain 400 gets lost against
// the subdued labels at this size.
const TICKER_BAR_STAT_VALUE_TEXT_PROPS = {
  size: '$bodySmMedium',
} as const;

const TICKER_BAR_STAT_LABEL_VALUE_GAP = 5;
const TICKER_BAR_STAT_DASH_LABEL_VALUE_GAP = 4;
const TICKER_BAR_PRICE_SECTION_WIDTH = 90;
const TICKER_BAR_WIDE_PRICE_SECTION_WIDTH = 120;
const TICKER_BAR_WIDE_MARK_PRICE_LENGTH = 8;
const TICKER_BAR_WIDE_CHANGE_DISPLAY_LENGTH = 15;

// The background points the subscription at the new coin before trading
// metadata resolves, so activeAsset carries the new coin with assetId still
// undefined for ~150ms. Indexing is positional either way (assetId is
// offset + index), so resolving the same index from the coin costs nothing in
// accuracy and keeps the cached ctx reachable across that gap. (OK-60692)
let universesByDexCache: IPerpsUniverse[][] | undefined;
let universesByDexInFlight: Promise<IPerpsUniverse[][] | undefined> | undefined;

async function readCompletePerpsUniversesByDex() {
  let { universesByDex } =
    await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
  if (!isPerpsUniverseCacheComplete(universesByDex)) {
    // Cold start can read SimpleDB before the metadata refresh lands. The
    // refresh is single-flight and cold start already starts one, so this
    // joins it rather than adding a request. Mirrors usePerpsFavorites.
    await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
    ({ universesByDex } =
      await backgroundApiProxy.serviceHyperliquid.getTradingUniverse());
  }
  // An empty array is truthy, so caching an unfinished read would pin every
  // later lookup to it and keep the strip flashing skeletons for the rest of
  // the session. Leave it uncached and let the next call retry.
  if (isPerpsUniverseCacheComplete(universesByDex)) {
    universesByDexCache = universesByDex;
  }
  return universesByDex;
}

function loadPerpsUniversesByDex() {
  if (universesByDexCache) {
    return Promise.resolve(universesByDexCache);
  }
  if (!universesByDexInFlight) {
    universesByDexInFlight = readCompletePerpsUniversesByDex()
      // Every ticker-bar cell awaits this promise, so one rejection would
      // surface seven times over. The coin lookup degrades to the assetId
      // path on undefined, which is the pre-fix behavior.
      .catch(() => undefined)
      .finally(() => {
        universesByDexInFlight = undefined;
      });
  }
  return universesByDexInFlight;
}

function useTickerBarCoinCtxLocation() {
  const { result: universesByDex } = usePromiseResult(
    loadPerpsUniversesByDex,
    [],
    { checkIsFocused: false },
  );
  return useCallback(
    (coin: string) => {
      if (!coin) return undefined;
      const dexIndex = getDexIndexByCoin(coin);
      const ctxIndex =
        universesByDex?.[dexIndex]?.findIndex((item) => item.name === coin) ??
        -1;
      return ctxIndex < 0 ? undefined : { dexIndex, ctxIndex };
    },
    [universesByDex],
  );
}

function isValidPerpFormattedCtx(
  ctx: ReturnType<typeof formatAssetCtx> | undefined,
) {
  const markPriceNumber = Number.parseFloat(ctx?.markPrice ?? '0');
  return Number.isFinite(markPriceNumber) && markPriceNumber > 0;
}

// Mirrors the mobile header: a ctx left over from the previous pair must not
// render under the new one. The perp branch already matches on coin, and the
// instrument is written optimistically at switch start, so the spot branch
// needs the same guard to stay blank until its own ctx arrives.
function useTickerBarSpotAssetCtx() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const matched = spotAssetCtx?.coin === activeTradeInstrument.coin;
  return matched ? spotAssetCtx : undefined;
}

function useTickerBarPerpAssetCtx() {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [allAssetCtxs] = usePerpsAllAssetCtxsAtom();
  const resolveCoinCtxLocation = useTickerBarCoinCtxLocation();
  // perpsActiveAssetAtom writes a fresh object on every set, so depending on
  // it wholesale would re-run this memo (and its BigNumber formatting) across
  // all ticker-bar cells whenever universe/margin changed.
  const { assetId: activeAssetId, coin: activeCoin } = activeAsset;

  const resolved = useMemo(() => {
    if (
      assetCtx?.coin === activeCoin &&
      isValidPerpFormattedCtx(assetCtx.ctx)
    ) {
      return {
        assetCtx,
        source: 'active' as const,
      };
    }

    const location =
      activeAssetId === undefined
        ? resolveCoinCtxLocation(activeCoin)
        : (() => {
            const dexIndex = getDexIndexByAssetId(activeAssetId);
            return {
              dexIndex,
              ctxIndex: toCtxIndex(activeAssetId, dexIndex),
            };
          })();

    if (!location) {
      return {
        assetCtx,
        source: 'empty' as const,
      };
    }

    const cachedCtx =
      allAssetCtxs.assetCtxsByDex?.[location.dexIndex]?.[location.ctxIndex];
    const formattedCachedCtx = cachedCtx
      ? formatAssetCtx(cachedCtx)
      : undefined;
    if (!isValidPerpFormattedCtx(formattedCachedCtx)) {
      return {
        assetCtx,
        source: 'empty' as const,
      };
    }

    return {
      assetCtx: {
        coin: activeCoin,
        assetId: toAssetId({
          dexIndex: location.dexIndex,
          index: location.ctxIndex,
        }),
        ctx: formattedCachedCtx,
      },
      source: 'allDexsAssetCtxs' as const,
    };
  }, [
    activeAssetId,
    activeCoin,
    allAssetCtxs,
    assetCtx,
    resolveCoinCtxLocation,
  ]);

  useEffect(() => {
    if (resolved.source === 'allDexsAssetCtxs') {
      markPerpsColdStartPerfOnce('ui_ticker_bar_all_dexs_ctx_ready', {
        coin: resolved.assetCtx.coin,
        markPrice: resolved.assetCtx.ctx?.markPrice,
      });
    }
  }, [resolved]);

  return resolved.assetCtx;
}

function formatTickerBarChange24hDisplay({
  change24h,
  change24hPercent,
}: {
  change24h?: string;
  change24hPercent?: string | number;
}) {
  const changeValue = change24h || '0';
  const signedChangeValue =
    changeValue.startsWith('-') || changeValue === '0'
      ? changeValue
      : `+${changeValue}`;
  const percentText = numberFormat(String(change24hPercent || 0), {
    formatter: 'priceChange',
    formatterOptions: {
      showPlusMinusSigns: true,
    },
  });
  return `${signedChangeValue} (${percentText})`;
}

function useTickerBarIsLoading() {
  const { currentToken } = usePerpSession();
  const [activeTradeInstrumentForMode] = useActiveTradeInstrumentAtom();
  const tradingMode = activeTradeInstrumentForMode.mode;
  const assetCtx = useTickerBarPerpAssetCtx();
  const spotCtx = useTickerBarSpotAssetCtx();
  const isSpot = tradingMode === 'spot';
  if (isSpot) {
    // Spot: only loading if spot ctx hasn't arrived yet.
    // Don't gate on isReady (perps WS connection state) — spot data
    // flows through the same WS but isReady can be temporarily false
    // during mode transitions while the spot subscription is active.
    return !spotCtx?.ctx;
  }
  const { markPrice } = assetCtx?.ctx || {
    markPrice: '0',
  };
  const markPriceNumber = Number.parseFloat(markPrice);
  return (
    assetCtx?.coin !== currentToken ||
    !Number.isFinite(markPriceNumber) ||
    markPriceNumber === 0
  );
}

const TickerBarMarkPriceView = memo(
  ({
    formattedMarkPrice,
    isLoading,
    tooltipContentId,
  }: {
    formattedMarkPrice: string;
    isLoading: boolean;
    tooltipContentId: ETranslations;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker
        name="TickerBarMarkPrice"
        position="bottom-left"
        offsetY={10}
      >
        <SkeletonContainer isLoading={isLoading} width={80} height={28}>
          <Tooltip
            placement="top"
            renderTrigger={
              <SizableText
                size="$headingMd"
                fontWeight="500"
                cursor="help"
                lineHeight={20}
                numberOfLines={1}
              >
                {formattedMarkPrice}
              </SizableText>
            }
            renderContent={
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: tooltipContentId,
                })}
              </SizableText>
            }
          />
        </SkeletonContainer>
      </DebugRenderTracker>
    );
  },
);
TickerBarMarkPriceView.displayName = 'TickerBarMarkPriceView';

function TickerBarMarkPrice() {
  const [activeTradeInstrumentForMode] = useActiveTradeInstrumentAtom();
  const tradingMode = activeTradeInstrumentForMode.mode;
  const assetCtx = useTickerBarPerpAssetCtx();
  const spotCtx = useTickerBarSpotAssetCtx();
  const isSpot = tradingMode === 'spot';
  const formattedMarkPrice = formatLocalizedNumberString(
    (isSpot ? spotCtx?.ctx?.markPrice : assetCtx?.ctx?.markPrice) || '',
  );
  const isLoading = useTickerBarIsLoading();
  useEffect(() => {
    if (!isLoading && formattedMarkPrice) {
      markPerpsColdStartPerfOnce('ui_ticker_bar_mark_price_ready', {
        mode: tradingMode,
        price: formattedMarkPrice,
      });
    }
  }, [formattedMarkPrice, isLoading, tradingMode]);
  return (
    <TickerBarMarkPriceView
      formattedMarkPrice={formattedMarkPrice}
      isLoading={isLoading}
      tooltipContentId={
        isSpot
          ? ETranslations.perp_spot_reference_price__desc
          : ETranslations.perp_mark_price_tooltip
      }
    />
  );
}

const TickerBarChange24hView = memo(
  ({ changeDisplay }: { changeDisplay: string }) => (
    <DebugRenderTracker
      name="TickerBarChange24h"
      position="bottom-right"
      offsetY={10}
    >
      <SizableText
        size="$bodyXs"
        textTransform="none"
        fontWeight="600"
        letterSpacing={0.2}
        lineHeight={12}
        color={changeDisplay.trim().startsWith('-') ? '$red11' : '$green11'}
        numberOfLines={1}
      >
        {changeDisplay}
      </SizableText>
    </DebugRenderTracker>
  ),
);
TickerBarChange24hView.displayName = 'TickerBarChange24hView';

export function TickerBarChange24h() {
  const [activeTradeInstrumentForMode] = useActiveTradeInstrumentAtom();
  const tradingMode = activeTradeInstrumentForMode.mode;
  const assetCtx = useTickerBarPerpAssetCtx();
  const spotCtx = useTickerBarSpotAssetCtx();
  const displayCtx = tradingMode === 'spot' ? spotCtx?.ctx : assetCtx?.ctx;
  const changeDisplay = useMemo(() => {
    return formatTickerBarChange24hDisplay({
      change24h: displayCtx?.change24h,
      change24hPercent: displayCtx?.change24hPercent,
    });
  }, [displayCtx?.change24h, displayCtx?.change24hPercent]);
  const isLoading = useTickerBarIsLoading();

  return isLoading ? null : (
    <TickerBarChange24hView changeDisplay={changeDisplay} />
  );
}

const TickerBarOraclePriceView = memo(
  ({
    formattedOraclePrice,
    isLoading,
  }: {
    formattedOraclePrice: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker name="TickerBarOraclePrice">
        <YStack gap={TICKER_BAR_STAT_DASH_LABEL_VALUE_GAP}>
          <Tooltip
            renderTrigger={
              <DashText
                size="$bodySm"
                dashThickness={0.5}
                dashSpacing={0}
                color="$textSubdued"
                cursor="help"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_oracle_price,
                })}
              </DashText>
            }
            renderContent={
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_oracle_price_tooltip,
                })}
              </SizableText>
            }
            placement="top"
          />
          <SkeletonContainer isLoading={isLoading} width={80} height={16}>
            <SizableText {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}>
              {formattedOraclePrice}
            </SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarOraclePriceView.displayName = 'TickerBarOraclePriceView';

function TickerBarOraclePrice() {
  const assetCtx = useTickerBarPerpAssetCtx();
  const formattedOraclePrice = formatLocalizedNumberString(
    assetCtx?.ctx?.oraclePrice || '',
  );
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarOraclePriceView
      formattedOraclePrice={formattedOraclePrice}
      isLoading={isLoading}
    />
  );
}

const TickerBar24hVolumeView = memo(
  ({
    formattedVolume24h,
    isLoading,
  }: {
    formattedVolume24h: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker name="TickerBar24hVolume">
        <YStack gap={TICKER_BAR_STAT_LABEL_VALUE_GAP}>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_24h_Volume,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={80} height={16}>
            <SizableText {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}>
              ${formattedVolume24h}
            </SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBar24hVolumeView.displayName = 'TickerBar24hVolumeView';

function TickerBar24hVolume() {
  const [activeTradeInstrumentForMode] = useActiveTradeInstrumentAtom();
  const tradingMode = activeTradeInstrumentForMode.mode;
  const assetCtx = useTickerBarPerpAssetCtx();
  const spotCtx = useTickerBarSpotAssetCtx();
  const isSpot = tradingMode === 'spot';
  const volume24h = isSpot
    ? spotCtx?.ctx?.volume24h || '0'
    : assetCtx?.ctx?.volume24h || '0';
  const formattedVolume24h = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(volume24h.toString()),
  );
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBar24hVolumeView
      formattedVolume24h={
        isString(formattedVolume24h) ? formattedVolume24h : '--'
      }
      isLoading={isLoading}
    />
  );
}

const TickerBarOpenInterestView = memo(
  ({
    formattedOpenInterest,
    isLoading,
  }: {
    formattedOpenInterest: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker name="TickerBarOpenInterest">
        <YStack gap={TICKER_BAR_STAT_DASH_LABEL_VALUE_GAP}>
          <Tooltip
            renderTrigger={
              <DashText
                size="$bodySm"
                color="$textSubdued"
                dashThickness={0.5}
                dashSpacing={0}
                cursor="help"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_open_Interest,
                })}
              </DashText>
            }
            renderContent={
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_open_interest_tooltip,
                })}
              </SizableText>
            }
            placement="top"
          />
          <SkeletonContainer isLoading={isLoading} width={80} height={16}>
            <SizableText {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}>
              ${formattedOpenInterest}
            </SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarOpenInterestView.displayName = 'TickerBarOpenInterestView';

function TickerBarOpenInterest() {
  const assetCtx = useTickerBarPerpAssetCtx();
  const { openInterest = '0', markPrice = '0' } = assetCtx?.ctx || {};
  const formattedOpenInterest = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(
      (Number(openInterest) * Number(markPrice)).toString(),
    ),
  );
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarOpenInterestView
      formattedOpenInterest={
        isString(formattedOpenInterest) ? formattedOpenInterest : '--'
      }
      isLoading={isLoading}
    />
  );
}

const TickerBarMarketCapView = memo(
  ({
    formattedMarketCap,
    isLoading,
  }: {
    formattedMarketCap: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    return (
      <DebugRenderTracker name="TickerBarMarketCap">
        <YStack gap={TICKER_BAR_STAT_LABEL_VALUE_GAP}>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_market_cap,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={80} height={16}>
            <SizableText {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}>
              {formattedMarketCap === '--'
                ? formattedMarketCap
                : `$${formattedMarketCap}`}
            </SizableText>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarMarketCapView.displayName = 'TickerBarMarketCapView';

function TickerBarMarketCap() {
  const spotCtx = useTickerBarSpotAssetCtx();
  const [spotMarketCaps] = useSpotExternalMarketCapsAtom();
  const marketCap = getSpotMarketCapValue(
    spotCtx?.ctx,
    spotCtx?.baseName ?? spotCtx?.coin,
    spotMarketCaps,
  );
  const formattedMarketCap = marketCap
    ? formatDisplayNumber(NUMBER_FORMATTER.marketCap(marketCap))
    : undefined;
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarMarketCapView
      formattedMarketCap={
        isString(formattedMarketCap) ? formattedMarketCap : '--'
      }
      isLoading={isLoading}
    />
  );
}

const TickerBarSpotContractView = memo(
  ({ contract, isLoading }: { contract?: string; isLoading: boolean }) => {
    const intl = useIntl();
    const { copyText } = useClipboard();
    const shortenedContract = contract
      ? `${contract.slice(0, 6)}...${contract.slice(-4)}`
      : '--';

    return (
      <DebugRenderTracker name="TickerBarSpotContract">
        <YStack gap={TICKER_BAR_STAT_LABEL_VALUE_GAP}>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_contract,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={120} height={16}>
            <XStack gap="$1" alignItems="center">
              <SizableText
                {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
                fontFamily="$monoRegular"
                color="$text"
                numberOfLines={1}
              >
                {shortenedContract}
              </SizableText>
              {contract ? (
                <>
                  <IconButton
                    testID={PerpTestIDs.TickerBarCopyContractButton}
                    size="small"
                    variant="tertiary"
                    icon="Copy3Outline"
                    iconProps={{ size: '$3', color: '$iconSubdued' }}
                    onPress={() => {
                      copyText(contract);
                    }}
                  />
                  <IconButton
                    testID={PerpTestIDs.TickerBarOpenContractButton}
                    size="small"
                    variant="tertiary"
                    icon="OpenOutline"
                    iconProps={{ size: '$3', color: '$iconSubdued' }}
                    onPress={() => {
                      void openHyperLiquidTokenExplorerUrl({
                        tokenId: contract,
                      });
                    }}
                  />
                </>
              ) : null}
            </XStack>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarSpotContractView.displayName = 'TickerBarSpotContractView';

function TickerBarSpotContract() {
  const [spotAsset] = useSpotActiveAssetAtom();
  const { tokenContractMap } = useSpotMetaMaps();
  const isLoading = useTickerBarIsLoading();
  const contract =
    tokenContractMap[spotAsset?.universe?.baseName ?? ''] ||
    tokenContractMap[spotAsset?.coin ?? ''];

  return (
    <TickerBarSpotContractView contract={contract} isLoading={isLoading} />
  );
}

function TickerBarFundingRateCountdown() {
  const countdown = useFundingCountdown();
  return (
    <DebugRenderTracker
      name="TickerBarFundingRateCountdown"
      position="bottom-right"
      offsetX={10}
    >
      <SizableText {...TICKER_BAR_STAT_VALUE_TEXT_PROPS} color="$text">
        {countdown}
      </SizableText>
    </DebugRenderTracker>
  );
}

const TickerBarFundingRateView = memo(
  ({
    fundingRate,
    fundingRatePercent,
    hourlyFundingRate,
    dailyFundingRate,
    weeklyFundingRate,
    monthlyFundingRate,
    annualizedFundingRate,
    countdown,
    isLoading,
  }: {
    fundingRate: number;
    fundingRatePercent: string;
    hourlyFundingRate: string;
    dailyFundingRate: string;
    weeklyFundingRate: string;
    monthlyFundingRate: string;
    annualizedFundingRate: string;
    countdown: string;
    isLoading: boolean;
  }) => {
    const intl = useIntl();
    const { showPortfolio: showFundingAnalysis } = useShowPortfolio({
      initialChartType: 'funding',
    });
    const tooltipRef = useRef<ITooltipRef>({
      closeTooltip: () => Promise.resolve(),
      openTooltip: () => Promise.resolve(),
    });
    const handleViewFundingHistory = useCallback(() => {
      void tooltipRef.current.closeTooltip();
      appEventBus.emit(EAppEventBusNames.PerpShowFundingHistory, undefined);
    }, []);
    const handleViewFundingAnalysis = useCallback(() => {
      void tooltipRef.current.closeTooltip();
      void showFundingAnalysis();
    }, [showFundingAnalysis]);
    return (
      <DebugRenderTracker name="TickerBarFundingRate">
        <YStack gap={TICKER_BAR_STAT_LABEL_VALUE_GAP}>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_Funding,
            })}
          </SizableText>
          <SkeletonContainer isLoading={isLoading} width={120} height={16}>
            <XStack alignItems="baseline" gap="$2">
              <Tooltip
                ref={tooltipRef}
                hovering
                renderTrigger={
                  <XStack alignItems="baseline" gap="$2">
                    <DashText
                      {...TICKER_BAR_STAT_VALUE_TEXT_PROPS}
                      color={fundingRate >= 0 ? '$green11' : '$red11'}
                      dashThickness={0.5}
                      dashSpacing={0}
                      cursor="help"
                    >
                      {`${fundingRatePercent}%`}
                    </DashText>
                    <TickerBarFundingRateCountdown />
                  </XStack>
                }
                renderContent={
                  <YStack gap="$3" py="$2" minWidth={200}>
                    <YStack gap="$2">
                      <XStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <SizableText size="$bodySm" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.perps_fee_rate_projection,
                          })}
                        </SizableText>
                        <SizableText size="$bodySm" color="$textSubdued">
                          {intl.formatMessage({
                            id: ETranslations.perp_position_funding,
                          })}
                        </SizableText>
                      </XStack>
                      <YStack gap="$3">
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <XStack gap="$1" alignItems="center">
                            <SizableText size="$bodySm">
                              {intl.formatMessage({
                                id: ETranslations.perps_hourly,
                              })}
                            </SizableText>
                            <SizableText size="$bodySm" color="$textSubdued">
                              ({countdown})
                            </SizableText>
                          </XStack>
                          <SizableText
                            size="$bodySm"
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {hourlyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <SizableText size="$bodySm">
                            {intl.formatMessage({
                              id: ETranslations.earn_daily,
                            })}
                          </SizableText>
                          <SizableText
                            size="$bodySm"
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {dailyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <SizableText size="$bodySm">
                            {intl.formatMessage({
                              id: ETranslations.earn_weekly,
                            })}
                          </SizableText>
                          <SizableText
                            size="$bodySm"
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {weeklyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <SizableText size="$bodySm">
                            {intl.formatMessage({
                              id: ETranslations.earn_monthly,
                            })}
                          </SizableText>
                          <SizableText
                            size="$bodySm"
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {monthlyFundingRate}%
                          </SizableText>
                        </XStack>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <SizableText size="$bodySm">
                            {intl.formatMessage({
                              id: ETranslations.earn_annually,
                            })}
                          </SizableText>
                          <SizableText
                            size="$bodySm"
                            color={fundingRate >= 0 ? '$green11' : '$red11'}
                          >
                            {annualizedFundingRate}%
                          </SizableText>
                        </XStack>
                      </YStack>
                    </YStack>
                    <Divider />
                    <YStack gap="$2" justifyContent="space-between">
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.perp_trades_history_direction,
                        })}
                      </SizableText>
                      {fundingRate >= 0 ? (
                        <SizableText size="$bodySmMedium" color="$text">
                          <SizableText size="$bodySmMedium" color="$green11">
                            {intl.formatMessage({
                              id: ETranslations.perp_ticker_direction_funding_tooltip_long,
                            })}
                          </SizableText>{' '}
                          {intl.formatMessage({
                            id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
                          })}{' '}
                          <SizableText size="$bodySmMedium" color="$red11">
                            {intl.formatMessage({
                              id: ETranslations.perp_ticker_direction_funding_tooltip_short,
                            })}
                          </SizableText>
                        </SizableText>
                      ) : (
                        <SizableText size="$bodySmMedium" color="$text">
                          <SizableText size="$bodySmMedium" color="$red11">
                            {intl.formatMessage({
                              id: ETranslations.perp_ticker_direction_funding_tooltip_short,
                            })}
                          </SizableText>{' '}
                          {intl.formatMessage({
                            id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
                          })}{' '}
                          <SizableText size="$bodySmMedium" color="$green11">
                            {intl.formatMessage({
                              id: ETranslations.perp_ticker_direction_funding_tooltip_long,
                            })}
                          </SizableText>
                        </SizableText>
                      )}
                    </YStack>
                    <Divider />
                    <YStack gap="$2">
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.perp_funding_rate_tip0,
                        })}
                      </SizableText>
                      <SizableText size="$bodySmMedium">
                        {intl.formatMessage({
                          id: ETranslations.perp_funding_rate_tip1,
                        })}
                      </SizableText>
                      <SizableText size="$bodySmMedium">
                        {intl.formatMessage({
                          id: ETranslations.perp_funding_rate_tip2,
                        })}
                      </SizableText>
                    </YStack>
                    <YStack gap="$3" width="100%">
                      <Button
                        width="100%"
                        size="small"
                        variant="secondary"
                        testID="perp-desktop-view-funding-history-button"
                        onPress={handleViewFundingHistory}
                      >
                        {intl.formatMessage({
                          id: ETranslations.perp_funding_rate_history__action,
                        })}
                      </Button>
                      <Button
                        width="100%"
                        size="small"
                        variant="secondary"
                        testID="perp-desktop-view-funding-analysis-button"
                        onPress={handleViewFundingAnalysis}
                      >
                        {intl.formatMessage({
                          id: ETranslations.perp_view_funding_analysis__action,
                        })}
                      </Button>
                    </YStack>
                  </YStack>
                }
              />
            </XStack>
          </SkeletonContainer>
        </YStack>
      </DebugRenderTracker>
    );
  },
);
TickerBarFundingRateView.displayName = 'TickerBarFundingRateView';

function TickerBarFundingRate() {
  const assetCtx = useTickerBarPerpAssetCtx();
  const fundingRateStr = assetCtx?.ctx?.fundingRate || '0';
  const fundingRate = parseFloat(fundingRateStr);
  const fundingRatePercent = (fundingRate * 100).toFixed(4);
  const hourlyFundingRate = (fundingRate * 100).toFixed(4);
  const dailyFundingRate = (fundingRate * 100 * 24).toFixed(4);
  const weeklyFundingRate = (fundingRate * 100 * 24 * 7).toFixed(4);
  const monthlyFundingRate = (fundingRate * 100 * 24 * 30).toFixed(4);
  const annualizedFundingRate = (fundingRate * 100 * 24 * 365).toFixed(4);
  const countdown = useFundingCountdown();
  const isLoading = useTickerBarIsLoading();

  return (
    <TickerBarFundingRateView
      fundingRate={fundingRate}
      fundingRatePercent={fundingRatePercent}
      hourlyFundingRate={hourlyFundingRate}
      dailyFundingRate={dailyFundingRate}
      weeklyFundingRate={weeklyFundingRate}
      monthlyFundingRate={monthlyFundingRate}
      annualizedFundingRate={annualizedFundingRate}
      countdown={countdown}
      isLoading={isLoading}
    />
  );
}

function PerpTickerBarDesktop() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [activeTradeInstrumentForMode] = useActiveTradeInstrumentAtom();
  const tradingMode = activeTradeInstrumentForMode.mode;
  const assetCtx = useTickerBarPerpAssetCtx();
  const isSpot = tradingMode === 'spot';
  const marketDataGap = useMemo(() => (isSpot ? '$6' : '$6'), [isSpot]);
  const priceSectionWidth = useMemo(() => {
    if (isSpot) {
      return TICKER_BAR_WIDE_PRICE_SECTION_WIDTH;
    }

    const formattedMarkPrice = formatLocalizedNumberString(
      assetCtx?.ctx?.markPrice || '',
    );
    const changeDisplay = formatTickerBarChange24hDisplay({
      change24h: assetCtx?.ctx?.change24h,
      change24hPercent: assetCtx?.ctx?.change24hPercent,
    });
    const needsWidePriceSection =
      formattedMarkPrice.length > TICKER_BAR_WIDE_MARK_PRICE_LENGTH ||
      changeDisplay.length > TICKER_BAR_WIDE_CHANGE_DISPLAY_LENGTH;

    return needsWidePriceSection
      ? TICKER_BAR_WIDE_PRICE_SECTION_WIDTH
      : TICKER_BAR_PRICE_SECTION_WIDTH;
  }, [
    assetCtx?.ctx?.change24h,
    assetCtx?.ctx?.change24hPercent,
    assetCtx?.ctx?.markPrice,
    isSpot,
  ]);
  const content = (
    <XStack
      bg="$bgApp"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      py="$4"
      pl="$5"
      pr="$3"
      alignItems="center"
      justifyContent="flex-start"
      gap="$5"
      h={PERP_LAYOUT_CONFIG.desktop.tickerBarHeight}
    >
      <XStack gap="$3" alignItems="center" minWidth={0} flexShrink={1}>
        <XStack gap="$2" alignItems="center" minWidth={0} flexShrink={1}>
          <FavoriteButton
            coin={activeTradeInstrument.coin}
            iconSize="$4"
            isSpot={isSpot}
          />
          <PerpTokenSelector />
        </XStack>

        <YStack
          alignItems="flex-start"
          width={priceSectionWidth}
          flexShrink={0}
          cursor="default"
        >
          <TickerBarMarkPrice />
          <TickerBarChange24h />
        </YStack>
      </XStack>

      {/* Right: Market Data */}
      <ScrollView
        cursor="default"
        horizontal
        flex={1}
        minWidth={0}
        contentContainerStyle={{
          gap: marketDataGap,
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {isSpot ? null : <TickerBarOraclePrice />}
        {isSpot ? null : <TickerBarFundingRate />}
        <TickerBar24hVolume />
        {isSpot ? <TickerBarMarketCap /> : <TickerBarOpenInterest />}
        {isSpot ? <TickerBarSpotContract /> : null}
      </ScrollView>
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpTickerBarDesktop" position="top-right">
      {content}
    </DebugRenderTracker>
  );
}

const PerpTickerBarDesktopMemo = memo(PerpTickerBarDesktop);
export { PerpTickerBarDesktopMemo as PerpTickerBarDesktop };
