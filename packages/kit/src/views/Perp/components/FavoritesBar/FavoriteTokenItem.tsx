import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCtxByCoin } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  type IPerpFavoritesDisplayMode,
  type IPerpsActiveAssetCtxAtom,
  type ISpotActiveAssetCtxAtom,
  perpsActiveAssetCtxAtom,
  spotActiveAssetCtxAtom,
  usePerpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import perpsUtils, {
  formatPriceToSignificantDigits,
  formatSpotPriceEntry,
  getHyperliquidTokenImageUris,
  getHyperliquidTokenImageUrl,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  MAX_DECIMALS_PERP,
  MAX_SIGNIFICANT_FIGURES,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useSpotAssetCtxByPair } from '../../hooks/useSpotAssetCtxByPair';

export const TABULAR_NUMS_STYLE = {
  fontVariantNumeric: 'tabular-nums',
} as const;

/**
 * Calculate stable minWidth (in ch units) for formatted price strings to
 * prevent layout jitter caused by trailing-zero stripping in
 * formatPriceToSignificantDigits. With tabular-nums, 1ch equals one digit width.
 */
export function getStablePriceMinWidth(priceStr: string): string | undefined {
  // ch units are CSS-only, not supported on React Native
  if (platformEnv.isNative) return undefined;
  if (!priceStr || priceStr === '-' || priceStr === '0') return undefined;

  const dotIndex = priceStr.indexOf('.');
  if (dotIndex === -1) return undefined;

  const intPart = priceStr.substring(0, dotIndex);
  const intDigits = intPart === '0' ? 0 : intPart.length;

  if (intDigits >= MAX_SIGNIFICANT_FIGURES) return undefined;

  let maxDecimals: number;
  if (intDigits === 0) {
    // Leading zeros don't count as significant figures
    const decimalPart = priceStr.substring(dotIndex + 1);
    const leadingZeroMatch = decimalPart.match(/^(0*)/);
    const leadingZeros = leadingZeroMatch ? leadingZeroMatch[1].length : 0;
    maxDecimals = Math.min(
      leadingZeros + MAX_SIGNIFICANT_FIGURES,
      MAX_DECIMALS_PERP,
    );
  } else {
    maxDecimals = MAX_SIGNIFICANT_FIGURES - intDigits;
  }

  const totalChars = intPart.length + 1 + maxDecimals;
  return `${totalChars}ch`;
}

interface IFavoriteTokenItemProps {
  displayName: string;
  coinName: string;
  dexIndex: number;
  assetId: number;
  imageTokenName: string;
  mode: 'perp' | 'spot';
  onPress: () => void;
  displayMode?: IPerpFavoritesDisplayMode;
}

interface ICtxQuote {
  markPrice: string;
  change24hPercent: number;
}

// The trade instrument's own quote is ahead of the shared contexts, so its
// token shows that one. Moving between the two can step the price back.
function useSettledCtxQuote(
  activeQuote: ICtxQuote | undefined,
  marketQuote: ICtxQuote,
): ICtxQuote {
  const useActive = !!activeQuote?.markPrice;
  const candidate = useActive && activeQuote ? activeQuote : marketQuote;
  const [settledActive, setSettledActive] = useState(useActive);
  const lastDisplayed = useRef(candidate);
  const quote = settledActive === useActive ? candidate : lastDisplayed.current;

  useLayoutEffect(() => {
    lastDisplayed.current = quote;
  }, [quote]);

  useEffect(() => {
    if (settledActive === useActive) return;
    // Hold the previous quote only while changing sources. Live ticks do not
    // restart this window and resume immediately once the source settles.
    const timer = setTimeout(() => setSettledActive(useActive), 250);
    return () => clearTimeout(timer);
  }, [settledActive, useActive]);

  return quote;
}

interface ICtxQuoteSourceProps {
  coinName: string;
  dexIndex: number;
  assetId: number;
}

// Each mode subscribes to its own quote only: the spot map changes with every
// quote of any pair, which a perp token has no use for.
function usePerpCtxQuote({
  coinName,
  dexIndex,
  assetId,
}: ICtxQuoteSourceProps) {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const ctx = usePerpsCtxByCoin(dexIndex, assetId);
  const marketQuote = useMemo(() => perpsUtils.formatAssetCtx(ctx), [ctx]);
  const isActive = activeAsset?.coin === coinName;
  const activeCtxAtom = useMemo(
    () =>
      selectAtom(
        perpsActiveAssetCtxAtom.atom(),
        (value: IPerpsActiveAssetCtxAtom) =>
          isActive && value?.coin === coinName ? value.ctx : undefined,
      ),
    [coinName, isActive],
  );
  return useSettledCtxQuote(useAtomValue(activeCtxAtom), marketQuote);
}

function useSpotCtxQuote({ coinName }: ICtxQuoteSourceProps) {
  const [activeInstrument] = useActiveTradeInstrumentAtom();
  const ctx = useSpotAssetCtxByPair(coinName);
  const marketQuote = useMemo(
    () => formatSpotPriceEntry(ctx ?? undefined),
    [ctx],
  );
  const isActive =
    activeInstrument.mode === 'spot' && activeInstrument.coin === coinName;
  const activeCtxAtom = useMemo(
    () =>
      selectAtom(
        spotActiveAssetCtxAtom.atom(),
        (value: ISpotActiveAssetCtxAtom) =>
          isActive && value?.coin === coinName ? value.ctx : undefined,
      ),
    [coinName, isActive],
  );
  return useSettledCtxQuote(useAtomValue(activeCtxAtom), marketQuote);
}

function CtxQuoteText({
  displayMode,
  quote,
}: {
  displayMode: IPerpFavoritesDisplayMode;
  quote: ICtxQuote;
}) {
  const { change24hPercent, markPrice } = quote;
  const color = change24hPercent >= 0 ? '$textSuccess' : '$textCritical';

  if (markPrice === '0') {
    return <Skeleton width={displayMode === 'price' ? 46 : 60} height={16} />;
  }

  if (displayMode === 'percent') {
    return (
      <NumberSizeableText
        size="$bodySmMedium"
        color={color}
        style={TABULAR_NUMS_STYLE}
        formatter="priceChange"
        formatterOptions={{ showPlusMinusSigns: true }}
      >
        {change24hPercent.toString()}
      </NumberSizeableText>
    );
  }

  const priceDisplay = markPrice
    ? formatPriceToSignificantDigits(markPrice)
    : '-';
  return (
    <SizableText
      size="$bodySmMedium"
      color={color}
      style={TABULAR_NUMS_STYLE}
      minWidth={getStablePriceMinWidth(priceDisplay)}
      textAlign="right"
    >
      {priceDisplay}
    </SizableText>
  );
}

/** `priceAndPercent` shows both from one quote subscription. */
export type ICtxPriceDisplayMode =
  | IPerpFavoritesDisplayMode
  | 'priceAndPercent';

function CtxQuote({
  displayMode,
  quote,
}: {
  displayMode: ICtxPriceDisplayMode;
  quote: ICtxQuote;
}) {
  if (displayMode !== 'priceAndPercent') {
    return <CtxQuoteText quote={quote} displayMode={displayMode} />;
  }
  return (
    <>
      <CtxQuoteText quote={quote} displayMode="price" />
      <CtxQuoteText quote={quote} displayMode="percent" />
    </>
  );
}

type ICtxModeQuoteProps = ICtxQuoteSourceProps & {
  displayMode: ICtxPriceDisplayMode;
};

function PerpCtxPriceDisplay({ displayMode, ...source }: ICtxModeQuoteProps) {
  return <CtxQuote quote={usePerpCtxQuote(source)} displayMode={displayMode} />;
}

function SpotCtxPriceDisplay({ displayMode, ...source }: ICtxModeQuoteProps) {
  return <CtxQuote quote={useSpotCtxQuote(source)} displayMode={displayMode} />;
}

export const CtxPriceDisplay = memo(
  ({
    displayMode = 'price',
    mode,
    ...source
  }: ICtxQuoteSourceProps & {
    displayMode?: ICtxPriceDisplayMode;
    mode: 'perp' | 'spot';
  }) =>
    mode === 'spot' ? (
      <SpotCtxPriceDisplay {...source} displayMode={displayMode} />
    ) : (
      <PerpCtxPriceDisplay {...source} displayMode={displayMode} />
    ),
);
CtxPriceDisplay.displayName = 'CtxPriceDisplay';

// Shared price display: change% (colored) + price (subdued)
export const PriceChangeDisplay = memo(
  ({ change, markPrice }: { change: number; markPrice?: string }) => {
    const color = change >= 0 ? '$textSuccess' : '$textCritical';
    const sign = change >= 0 ? '+' : '';
    const price = markPrice ? formatPriceToSignificantDigits(markPrice) : '-';
    const priceMinWidth = getStablePriceMinWidth(price);
    return (
      <>
        <SizableText
          size="$bodySmMedium"
          color={color}
          style={TABULAR_NUMS_STYLE}
        >
          {`${sign}${change.toFixed(2)}%`}
        </SizableText>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          style={TABULAR_NUMS_STYLE}
          minWidth={priceMinWidth}
          textAlign="right"
        >
          {price}
        </SizableText>
      </>
    );
  },
);
PriceChangeDisplay.displayName = 'PriceChangeDisplay';

function FavoriteTokenItem({
  displayName,
  coinName,
  dexIndex,
  assetId,
  imageTokenName,
  mode,
  onPress,
  displayMode = 'price',
}: IFavoriteTokenItemProps) {
  return (
    <XStack
      onPress={onPress}
      px="$1"
      py="$1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      userSelect="none"
      alignItems="center"
      gap="$1.5"
      cursor="default"
    >
      <Token
        size="xs"
        borderRadius="$full"
        {...(mode === 'spot'
          ? { tokenImageUri: getHyperliquidTokenImageUrl(imageTokenName) }
          : { tokenImageUris: getHyperliquidTokenImageUris(coinName) })}
        fallbackIcon="CryptoCoinOutline"
      />
      <SizableText size="$bodySmMedium" color="$text">
        {displayName}
      </SizableText>
      <CtxPriceDisplay
        key={`${mode}:${coinName}:${dexIndex}:${assetId}`}
        coinName={coinName}
        dexIndex={dexIndex}
        assetId={assetId}
        displayMode={displayMode}
        mode={mode}
      />
    </XStack>
  );
}

const FavoriteTokenItemMemo = memo(FavoriteTokenItem);
export { FavoriteTokenItemMemo as FavoriteTokenItem };
