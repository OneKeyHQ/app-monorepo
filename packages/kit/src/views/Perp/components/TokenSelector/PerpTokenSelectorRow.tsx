import {
  type PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
} from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  IconButton,
  NumberSizeableText,
  SizableText,
  SkeletonContainer,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  type ISpotAssetCtxEntry,
  spotAssetCtxsMapAtom,
  usePerpTokenFavoritesPersistAtom,
  usePerpsFavoritesOrderPersistAtom,
  useSpotExternalMarketCapsAtom,
  useSpotTokenFavoritesPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
  formatLocalizedNumberString,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatSpotPairDisplayName,
  formatSpotPriceToValid,
  formatWithPrecision,
  getHyperliquidTokenImageUrl,
  getSpotMarketCapValue,
  getSpotTokenDisplayName,
  getValidSpotPriceDecimals,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { usePerpsAssetCtx } from '../../hooks/usePerpsAssetCtx';

interface IPerpTokenSelectorRowProps {
  mockedToken: {
    index: number;
    dexIndex: number;
    assetId?: number;
    tokenName?: string;
    tokenMaxLeverage?: number;
    tokenSubtitle?: string;
    spotUniverse?: ISpotUniverse;
  };
  onPress: (name: string) => void;
  isOnModal?: boolean;
  skipMarkRequired?: boolean;
  desktopLayout?: 'perp' | 'spot' | 'mixed';
}

interface ITokenSelectorRowContextValue {
  isSpot?: boolean;
  desktopLayout?: 'perp' | 'spot' | 'mixed';
  // Spot favorite key — the HL pair id ("PURR/USDC", "@149"), distinct from
  // token.name (base name used for image/display lookups).
  pairCoin?: string;
  token: {
    name: string;
    displayName: string;
    dexLabel?: string;
    subtitle?: string;
    maxLeverage: number;
    assetId: number;
  };
  assetCtx: {
    markPrice: string;
    change24h: string;
    change24hPercent: number;
    fundingRate: string;
    marketCap?: string;
    volume24h: string;
    openInterest: string;
  };
  isLoading: boolean;
  onPress: () => void;
}

const TokenSelectorRowContext =
  createContext<ITokenSelectorRowContextValue | null>(null);

const DESKTOP_SUBTITLE_MAX_WIDTH = 52;
const MOBILE_SUBTITLE_MAX_WIDTH = 80;

function isSpotAssetCtxEntryEqual(
  a: ISpotAssetCtxEntry | null,
  b: ISpotAssetCtxEntry | null,
) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.markPx === b.markPx &&
    a.prevDayPx === b.prevDayPx &&
    a.dayNtlVlm === b.dayNtlVlm &&
    a.circulatingSupply === b.circulatingSupply &&
    a.totalSupply === b.totalSupply
  );
}

function createSpotAssetCtxByPairAtom(pairName: string) {
  return selectAtom(
    spotAssetCtxsMapAtom.atom(),
    (
      spotPriceMap,
      prevCtx?: ISpotAssetCtxEntry | null,
    ): ISpotAssetCtxEntry | null => {
      const nextCtx = spotPriceMap[pairName] ?? null;
      if (prevCtx !== undefined && isSpotAssetCtxEntryEqual(prevCtx, nextCtx)) {
        return prevCtx;
      }
      return nextCtx;
    },
  );
}

const spotAssetCtxByPairAtomCache = new Map<
  string,
  ReturnType<typeof createSpotAssetCtxByPairAtom>
>();

function getOrCreateSpotAssetCtxByPairAtom(pairName: string) {
  let entry = spotAssetCtxByPairAtomCache.get(pairName);
  if (!entry) {
    entry = createSpotAssetCtxByPairAtom(pairName);
    spotAssetCtxByPairAtomCache.set(pairName, entry);
  }
  return entry;
}

function useSpotAssetCtxByPair(pairName: string) {
  const selectedAtom = useMemo(
    () => getOrCreateSpotAssetCtxByPairAtom(pairName),
    [pairName],
  );
  return useAtomValue(selectedAtom);
}

export const SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT = {
  asset: { flex: 2.2, minWidth: 220 },
  price: { flex: 1.1, minWidth: 110 },
  change24h: { flex: 1.5, minWidth: 150 },
  volume: { flex: 1.1, minWidth: 110 },
  marketCap: { flex: 1.2, minWidth: 120 },
} as const;

export const MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT = {
  asset: { flex: 2, minWidth: 180 },
  price: { flex: 1, minWidth: 100 },
  change24h: { flex: 1.25, minWidth: 130 },
  fundingRate: { flex: 1, minWidth: 100 },
  volume: { flex: 1, minWidth: 100 },
  openInterest: { flex: 1.1, minWidth: 110 },
  marketCap: { flex: 1.1, minWidth: 110 },
} as const;

function getFlexibleDesktopColumnLayout(
  desktopLayout?: 'perp' | 'spot' | 'mixed',
) {
  return desktopLayout === 'mixed'
    ? MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT
    : SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT;
}

function useTokenSelectorRowContext() {
  const context = useContext(TokenSelectorRowContext);
  if (!context) {
    throw new OneKeyLocalError(
      'useTokenSelectorRowContext must be used within TokenSelectorRowProvider',
    );
  }
  return context;
}

function TokenSelectorRowProvider({
  children,
  value,
}: PropsWithChildren<{ value: ITokenSelectorRowContextValue }>) {
  return (
    <TokenSelectorRowContext.Provider value={value}>
      {children}
    </TokenSelectorRowContext.Provider>
  );
}

export const FavoriteButton = memo(
  ({
    coin,
    isMobile,
    iconSize,
    isSpot,
  }: {
    coin: string;
    isMobile?: boolean;
    iconSize?: string;
    isSpot?: boolean;
  }) => {
    const [perpFavs, setPerpFavs] = usePerpTokenFavoritesPersistAtom();
    const [spotFavs, setSpotFavs] = useSpotTokenFavoritesPersistAtom();
    const [, setFavoritesOrder] = usePerpsFavoritesOrderPersistAtom();
    const isFavorite = isSpot
      ? spotFavs.favorites.includes(coin)
      : perpFavs.favorites.includes(coin);

    const handleToggle = useCallback(() => {
      const mode: 'perp' | 'spot' = isSpot ? 'spot' : 'perp';
      const toggleFavorites = (prev: string[]) => {
        const removing = prev.includes(coin);
        return removing ? prev.filter((f) => f !== coin) : [...prev, coin];
      };
      const wasFavorited = isSpot
        ? spotFavs.favorites.includes(coin)
        : perpFavs.favorites.includes(coin);
      if (isSpot) {
        setSpotFavs((prev) => ({
          ...prev,
          favorites: toggleFavorites(prev.favorites),
        }));
      } else {
        setPerpFavs((prev) => {
          const removing = prev.favorites.includes(coin);
          void backgroundApiProxy.serviceMarketV2.syncToMarketWatchList({
            coin,
            action: removing ? 'remove' : 'add',
          });
          return {
            ...prev,
            favorites: toggleFavorites(prev.favorites),
          };
        });
      }
      // FavoritesBar's passive sync would eventually backfill, but writing
      // directly here avoids a one-frame flicker on add/remove.
      setFavoritesOrder((prev) => {
        if (wasFavorited) {
          return {
            sequence: prev.sequence.filter(
              (e) => !(e.mode === mode && e.coinName === coin),
            ),
          };
        }
        if (prev.sequence.some((e) => e.mode === mode && e.coinName === coin)) {
          return prev;
        }
        return {
          sequence: [...prev.sequence, { mode, coinName: coin }],
        };
      });
    }, [
      coin,
      isSpot,
      setPerpFavs,
      setSpotFavs,
      setFavoritesOrder,
      perpFavs.favorites,
      spotFavs.favorites,
    ]);

    return (
      <IconButton
        testID="perp-already-favorite-icon-btn"
        icon={isFavorite ? 'StarSolid' : 'StarOutline'}
        variant="tertiary"
        size="small"
        iconProps={{
          color: isFavorite ? '$icon' : '$iconSubdued',
          size: iconSize ?? (isMobile ? '$5' : '$3'),
        }}
        onPress={handleToggle}
        stopPropagation
      />
    );
  },
);

FavoriteButton.displayName = 'FavoriteButton';

const SubtitleBadge = memo(
  ({
    subtitle,
    maxWidth,
    withTooltip,
  }: {
    subtitle: string;
    maxWidth: number;
    withTooltip?: boolean;
  }) => {
    const badge = (
      <XStack
        borderRadius="$1"
        bg="$bgInfo"
        justifyContent="center"
        alignItems="center"
        px="$1"
        maxWidth={maxWidth}
        minWidth={0}
        overflow="hidden"
        flexShrink={0}
        accessibilityLabel={subtitle}
      >
        <SizableText
          fontSize={10}
          alignSelf="center"
          color="$textInfo"
          lineHeight={16}
          numberOfLines={1}
          ellipsizeMode="tail"
          flexShrink={1}
        >
          {subtitle}
        </SizableText>
      </XStack>
    );

    if (!withTooltip) {
      return badge;
    }

    return (
      <Tooltip
        placement="top"
        hovering
        renderTrigger={badge}
        renderContent={subtitle}
      />
    );
  },
);
SubtitleBadge.displayName = 'SubtitleBadge';

export const TradingModeBadge = memo(
  ({
    isSpot,
    px = '$1',
    bg = '$bgSubdued',
    color = '$textSubdued',
  }: {
    isSpot: boolean;
    px?: string | number;
    bg?: string;
    color?: string;
  }) => {
    const intl = useIntl();

    return (
      <XStack
        borderRadius="$1"
        bg={bg}
        justifyContent="center"
        alignItems="center"
        px={px}
      >
        <SizableText color={color} fontSize={10} lineHeight={16}>
          {isSpot
            ? intl.formatMessage({
                id: ETranslations.dexmarket_spot,
              })
            : intl.formatMessage({
                id: ETranslations.perp_label_perp,
              })}
        </SizableText>
      </XStack>
    );
  },
);
TradingModeBadge.displayName = 'TradingModeBadge';

// Desktop cell components
const TokenInfoCellDesktop = memo(() => {
  const { token, isSpot, pairCoin, desktopLayout } =
    useTokenSelectorRowContext();
  const { gtLg } = useMedia();
  const useFlexibleLayout = isSpot || desktopLayout === 'mixed';
  const columnLayout = getFlexibleDesktopColumnLayout(desktopLayout);

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenInfoCellDesktop"
        offsetY={10}
      >
        <XStack
          width={useFlexibleLayout ? undefined : 180}
          flex={useFlexibleLayout ? columnLayout.asset.flex : undefined}
          flexBasis={useFlexibleLayout ? 0 : undefined}
          minWidth={useFlexibleLayout ? columnLayout.asset.minWidth : 180}
          justifyContent="flex-start"
          gap="$1.5"
          alignItems="center"
        >
          <FavoriteButton coin={pairCoin ?? token.name} isSpot={isSpot} />
          <XStack
            gap="$1.5"
            alignItems="center"
            overflow="hidden"
            pr="$1"
            flex={1}
            minWidth={0}
          >
            <Token
              size="xs"
              borderRadius="$full"
              tokenImageUri={getHyperliquidTokenImageUrl(
                isSpot ? token.name : token.displayName,
              )}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText size="$bodySmMedium" numberOfLines={1} flexShrink={1}>
              {token.displayName}
            </SizableText>
            <XStack gap="$1" minWidth={0}>
              {isSpot ? (
                <TradingModeBadge
                  isSpot
                  px="$1.5"
                  bg="$bgStrong"
                  color="$textSubdued"
                />
              ) : null}
              {!isSpot && token.maxLeverage > 0 ? (
                <XStack
                  borderRadius="$1"
                  bg="$bgStrong"
                  justifyContent="center"
                  alignItems="center"
                  px="$1.5"
                >
                  <SizableText
                    fontSize={10}
                    alignSelf="center"
                    color="$textSubdued"
                    lineHeight={16}
                  >
                    {token.maxLeverage}x
                  </SizableText>
                </XStack>
              ) : null}
              {token.subtitle && gtLg ? (
                <SubtitleBadge
                  subtitle={token.subtitle}
                  maxWidth={DESKTOP_SUBTITLE_MAX_WIDTH}
                  withTooltip
                />
              ) : null}
            </XStack>
          </XStack>
        </XStack>
      </DebugRenderTracker>
    ),
    [
      token.displayName,
      token.subtitle,
      token.maxLeverage,
      token.name,
      gtLg,
      isSpot,
      pairCoin,
      useFlexibleLayout,
      columnLayout.asset.flex,
      columnLayout.asset.minWidth,
    ],
  );
  return content;
});

TokenInfoCellDesktop.displayName = 'TokenInfoCellDesktop';

const TokenPriceCellDesktop = memo(() => {
  const { assetCtx, isLoading, isSpot, desktopLayout } =
    useTokenSelectorRowContext();
  const useFlexibleLayout = isSpot || desktopLayout === 'mixed';
  const columnLayout = getFlexibleDesktopColumnLayout(desktopLayout);

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenPriceCellDesktop"
        offsetY={10}
      >
        <XStack
          width={useFlexibleLayout ? undefined : 110}
          flex={useFlexibleLayout ? columnLayout.price.flex : undefined}
          flexBasis={useFlexibleLayout ? 0 : undefined}
          minWidth={useFlexibleLayout ? columnLayout.price.minWidth : 110}
          justifyContent="flex-start"
        >
          <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
            {isSpot ? (
              <SizableText size="$bodySmMedium" color="$text">
                {assetCtx.markPrice}
              </SizableText>
            ) : (
              <NumberSizeableText
                formatter="price"
                size="$bodySmMedium"
                color="$text"
              >
                {assetCtx.markPrice}
              </NumberSizeableText>
            )}
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [
      assetCtx.markPrice,
      isLoading,
      isSpot,
      useFlexibleLayout,
      columnLayout.price.flex,
      columnLayout.price.minWidth,
    ],
  );
  return content;
});

TokenPriceCellDesktop.displayName = 'TokenPriceCellDesktop';

const Token24hChangeCellDesktop = memo(() => {
  const { assetCtx, isLoading, isSpot, desktopLayout } =
    useTokenSelectorRowContext();
  const useFlexibleLayout = isSpot || desktopLayout === 'mixed';
  const columnLayout = getFlexibleDesktopColumnLayout(desktopLayout);

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="Token24hChangeCellDesktop"
        offsetY={10}
      >
        <XStack
          width={useFlexibleLayout ? undefined : 150}
          flex={useFlexibleLayout ? columnLayout.change24h.flex : undefined}
          flexBasis={useFlexibleLayout ? 0 : undefined}
          minWidth={useFlexibleLayout ? columnLayout.change24h.minWidth : 150}
          justifyContent="flex-start"
        >
          <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
            <SizableText
              size="$bodySm"
              color={assetCtx.change24hPercent > 0 ? '$green11' : '$red11'}
            >
              <SizableText
                size="$bodySm"
                color={assetCtx.change24hPercent > 0 ? '$green11' : '$red11'}
              >
                {assetCtx.change24h}
              </SizableText>{' '}
              /{' '}
              <NumberSizeableText
                size="$bodySm"
                color={assetCtx.change24hPercent > 0 ? '$green11' : '$red11'}
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns: true }}
              >
                {assetCtx.change24hPercent.toString()}
              </NumberSizeableText>
            </SizableText>
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [
      assetCtx.change24h,
      assetCtx.change24hPercent,
      isLoading,
      useFlexibleLayout,
      columnLayout.change24h.flex,
      columnLayout.change24h.minWidth,
    ],
  );
  return content;
});

Token24hChangeCellDesktop.displayName = 'Token24hChangeCellDesktop';

const TokenFundingCellDesktop = memo(() => {
  const { assetCtx, isLoading, isSpot, desktopLayout } =
    useTokenSelectorRowContext();
  const useFlexibleLayout = desktopLayout === 'mixed';
  const mixedColumnLayout = MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT;

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenFundingCellDesktop"
        offsetY={10}
      >
        <XStack
          width={useFlexibleLayout ? undefined : 110}
          flex={
            useFlexibleLayout ? mixedColumnLayout.fundingRate.flex : undefined
          }
          flexBasis={useFlexibleLayout ? 0 : undefined}
          minWidth={
            useFlexibleLayout
              ? mixedColumnLayout.fundingRate.minWidth
              : undefined
          }
          justifyContent="flex-start"
        >
          <SkeletonContainer
            isLoading={!isSpot ? isLoading : false}
            width="80%"
            height={16}
          >
            <SizableText size="$bodySm" color="$text">
              {isSpot
                ? '-'
                : `${(Number(assetCtx.fundingRate) * 100).toFixed(4)}%`}
            </SizableText>
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [
      assetCtx.fundingRate,
      isLoading,
      isSpot,
      useFlexibleLayout,
      mixedColumnLayout.fundingRate.flex,
      mixedColumnLayout.fundingRate.minWidth,
    ],
  );
  return content;
});

TokenFundingCellDesktop.displayName = 'TokenFundingCellDesktop';

const TokenVolumeCellDesktop = memo(() => {
  const { assetCtx, isLoading, isSpot, desktopLayout } =
    useTokenSelectorRowContext();
  const useFlexibleLayout = isSpot || desktopLayout === 'mixed';
  const columnLayout = getFlexibleDesktopColumnLayout(desktopLayout);

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenVolumeCellDesktop"
        offsetY={10}
      >
        <XStack
          width={useFlexibleLayout ? undefined : 110}
          flex={useFlexibleLayout ? columnLayout.volume.flex : undefined}
          flexBasis={useFlexibleLayout ? 0 : undefined}
          minWidth={useFlexibleLayout ? columnLayout.volume.minWidth : 110}
          justifyContent="flex-start"
        >
          <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
            <SizableText size="$bodySm" color="$text">
              $
              {formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(assetCtx.volume24h),
              )}
            </SizableText>
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [
      assetCtx.volume24h,
      isLoading,
      useFlexibleLayout,
      columnLayout.volume.flex,
      columnLayout.volume.minWidth,
    ],
  );
  return content;
});

TokenVolumeCellDesktop.displayName = 'TokenVolumeCellDesktop';

const TokenMarketCapCellDesktop = memo(() => {
  const { assetCtx, isLoading, isSpot, desktopLayout } =
    useTokenSelectorRowContext();
  const useFlexibleLayout = isSpot || desktopLayout === 'mixed';
  const columnLayout = getFlexibleDesktopColumnLayout(desktopLayout);

  const content = useMemo(
    () => (
      <XStack
        width={useFlexibleLayout ? undefined : 120}
        flex={useFlexibleLayout ? columnLayout.marketCap.flex : undefined}
        flexBasis={useFlexibleLayout ? 0 : undefined}
        minWidth={useFlexibleLayout ? columnLayout.marketCap.minWidth : 120}
        justifyContent="flex-start"
      >
        <SkeletonContainer
          isLoading={isSpot ? isLoading : false}
          width="80%"
          height={16}
        >
          <SizableText size="$bodySm" color="$text">
            {assetCtx.marketCap ?? '-'}
          </SizableText>
        </SkeletonContainer>
      </XStack>
    ),
    [
      assetCtx.marketCap,
      isLoading,
      isSpot,
      useFlexibleLayout,
      columnLayout.marketCap.flex,
      columnLayout.marketCap.minWidth,
    ],
  );
  return content;
});

TokenMarketCapCellDesktop.displayName = 'TokenMarketCapCellDesktop';

const TokenOpenInterestCellDesktop = memo(() => {
  const { assetCtx, isLoading, isSpot, desktopLayout } =
    useTokenSelectorRowContext();
  const useFlexibleLayout = desktopLayout === 'mixed';
  const mixedColumnLayout = MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT;

  const openInterestDisplay = useMemo(() => {
    const formatted = formatDisplayNumber(
      NUMBER_FORMATTER.marketCap(
        (Number(assetCtx.openInterest) * Number(assetCtx.markPrice)).toString(),
      ),
    );
    return typeof formatted === 'string' ? `$${formatted}` : '-';
  }, [assetCtx.openInterest, assetCtx.markPrice]);

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenOpenInterestCellDesktop"
        offsetY={10}
      >
        <XStack
          width={useFlexibleLayout ? undefined : 120}
          flex={
            useFlexibleLayout ? mixedColumnLayout.openInterest.flex : undefined
          }
          flexBasis={useFlexibleLayout ? 0 : undefined}
          minWidth={
            useFlexibleLayout
              ? mixedColumnLayout.openInterest.minWidth
              : undefined
          }
          justifyContent="flex-start"
        >
          <SkeletonContainer
            isLoading={!isSpot ? isLoading : false}
            width="80%"
            height={16}
          >
            <SizableText size="$bodySm" color="$text">
              {isSpot ? '-' : openInterestDisplay}
            </SizableText>
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [
      openInterestDisplay,
      isLoading,
      isSpot,
      useFlexibleLayout,
      mixedColumnLayout.openInterest.flex,
      mixedColumnLayout.openInterest.minWidth,
    ],
  );
  return content;
});

TokenOpenInterestCellDesktop.displayName = 'TokenOpenInterestCellDesktop';

const TokenSelectorRowDesktop = memo(() => {
  const { onPress, isSpot, desktopLayout } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="left-center"
        offsetX={10}
        name="TokenSelectorRowDesktop"
      >
        <XStack
          onPress={onPress}
          borderRadius="$0"
          justifyContent="flex-start"
          width="100%"
          hoverStyle={{ bg: '$bgHover' }}
          px="$4"
          py="$3"
          minHeight={48}
          flex={1}
          cursor="default"
        >
          <TokenInfoCellDesktop />
          <TokenPriceCellDesktop />
          <Token24hChangeCellDesktop />
          {desktopLayout === 'mixed' ? (
            <>
              <TokenFundingCellDesktop />
              <TokenVolumeCellDesktop />
              <TokenOpenInterestCellDesktop />
              <TokenMarketCapCellDesktop />
            </>
          ) : null}
          {!isSpot && desktopLayout !== 'mixed' ? (
            <>
              <TokenFundingCellDesktop />
              <TokenVolumeCellDesktop />
              <TokenOpenInterestCellDesktop />
            </>
          ) : null}
          {isSpot && desktopLayout !== 'mixed' ? (
            <>
              <TokenVolumeCellDesktop />
              <TokenMarketCapCellDesktop />
            </>
          ) : null}
        </XStack>
      </DebugRenderTracker>
    ),
    [onPress, isSpot, desktopLayout],
  );
  return content;
});

TokenSelectorRowDesktop.displayName = 'TokenSelectorRowDesktop';

// Mobile cell components
const TokenImageMobile = memo(() => {
  const { token, isSpot, pairCoin } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenImageMobile"
        offsetY={10}
      >
        <XStack gap="$2" alignItems="center">
          <FavoriteButton
            coin={pairCoin ?? token.name}
            isMobile
            isSpot={isSpot}
          />
          <Token
            size="lg"
            borderRadius="$full"
            tokenImageUri={getHyperliquidTokenImageUrl(
              isSpot ? token.name : token.displayName,
            )}
            fallbackIcon="CryptoCoinOutline"
          />
        </XStack>
      </DebugRenderTracker>
    ),
    [token.displayName, token.name, isSpot, pairCoin],
  );
  return content;
});

TokenImageMobile.displayName = 'TokenImageMobile';

const TokenNameMobile = memo(() => {
  const { token, isSpot } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenNameMobile"
        offsetY={10}
      >
        <YStack gap="$0">
          <XStack gap="$1.5" alignItems="center" justifyContent="center">
            <SizableText size="$bodyMdMedium">{token.displayName}</SizableText>

            <XStack gap="$1">
              {isSpot ? (
                <TradingModeBadge isSpot px="$1.5" bg="$bgStrong" />
              ) : null}
              {!isSpot && token.maxLeverage > 0 ? (
                <XStack
                  borderRadius="$1"
                  bg="$bgStrong"
                  justifyContent="center"
                  alignItems="center"
                  px="$1.5"
                >
                  <SizableText
                    fontSize={10}
                    alignSelf="center"
                    color="$textSubdued"
                    lineHeight={16}
                  >
                    {token.maxLeverage}x
                  </SizableText>
                </XStack>
              ) : null}
              {token.subtitle ? (
                <SubtitleBadge
                  subtitle={token.subtitle}
                  maxWidth={MOBILE_SUBTITLE_MAX_WIDTH}
                />
              ) : null}
            </XStack>
          </XStack>
        </YStack>
      </DebugRenderTracker>
    ),
    [token.displayName, token.subtitle, token.maxLeverage, isSpot],
  );
  return content;
});

TokenNameMobile.displayName = 'TokenNameMobile';

const TokenVolumeMobile = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenVolumeMobile"
        offsetY={10}
      >
        <SkeletonContainer isLoading={isLoading} width={80} height={16}>
          <SizableText size="$bodySm" color="$text">
            $
            {formatDisplayNumber(
              NUMBER_FORMATTER.marketCap(assetCtx.volume24h),
            )}
          </SizableText>
        </SkeletonContainer>
      </DebugRenderTracker>
    ),
    [assetCtx.volume24h, isLoading],
  );
  return content;
});

TokenVolumeMobile.displayName = 'TokenVolumeMobile';

const TokenPriceMobile = memo(() => {
  const { assetCtx, isLoading, isSpot } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenPriceMobile"
        offsetY={10}
      >
        <SkeletonContainer
          alignSelf="flex-end"
          isLoading={isLoading}
          width={100}
          height={16}
        >
          {isSpot ? (
            <SizableText
              size="$bodyMdMedium"
              color="$text"
              alignSelf="flex-end"
            >
              {assetCtx.markPrice}
            </SizableText>
          ) : (
            <NumberSizeableText
              formatter="price"
              size="$bodyMdMedium"
              color="$text"
              alignSelf="flex-end"
            >
              {assetCtx.markPrice}
            </NumberSizeableText>
          )}
        </SkeletonContainer>
      </DebugRenderTracker>
    ),
    [assetCtx.markPrice, isLoading, isSpot],
  );
  return content;
});

TokenPriceMobile.displayName = 'TokenPriceMobile';

const Token24hChangeMobile = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="Token24hChangeMobile"
        offsetY={10}
      >
        <SkeletonContainer
          alignSelf="flex-end"
          isLoading={isLoading}
          width={80}
          height={16}
        >
          <NumberSizeableText
            size="$bodySm"
            alignSelf="flex-end"
            color={assetCtx.change24hPercent > 0 ? '$green11' : '$red11'}
            formatter="priceChange"
            formatterOptions={{ showPlusMinusSigns: true }}
          >
            {assetCtx.change24hPercent.toString()}
          </NumberSizeableText>
        </SkeletonContainer>
      </DebugRenderTracker>
    ),
    [assetCtx.change24hPercent, isLoading],
  );
  return content;
});

Token24hChangeMobile.displayName = 'Token24hChangeMobile';

const TokenSelectorRowMobile = memo(() => {
  const { onPress } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="left-center"
        offsetX={10}
        name="TokenSelectorRowMobile"
      >
        <XStack
          px="$5"
          py="$2.5"
          flex={1}
          justifyContent="space-between"
          alignItems="center"
          onPress={onPress}
          pressStyle={{
            bg: '$bgHover',
          }}
          gap="$2.5"
          cursor="default"
        >
          <TokenImageMobile />
          <XStack gap="$2" alignItems="center" justifyContent="center">
            <YStack gap="$1">
              <TokenNameMobile />
              <TokenVolumeMobile />
            </YStack>
          </XStack>
          <Stack flex={1} />
          <YStack gap="$1" justifyContent="flex-end">
            <TokenPriceMobile />
            <Token24hChangeMobile />
          </YStack>
        </XStack>
      </DebugRenderTracker>
    ),
    [onPress],
  );
  return content;
});

TokenSelectorRowMobile.displayName = 'TokenSelectorRowMobile';

const SpotTokenSelectorRowInner = memo(
  ({
    spotUniverse,
    onPress,
    isOnModal,
    desktopLayout,
  }: {
    spotUniverse: ISpotUniverse;
    onPress: (name: string) => void;
    isOnModal?: boolean;
    desktopLayout?: 'perp' | 'spot' | 'mixed';
  }) => {
    // Use pair name (@107 or PURR/USDC) as key — matches universe.name
    const ctx = useSpotAssetCtxByPair(spotUniverse.name);
    const [spotMarketCaps] = useSpotExternalMarketCapsAtom();
    const markPx = ctx?.markPx || '0';
    const prevDayPx = Number(ctx?.prevDayPx || 0);
    const markPxNum = Number(markPx);
    const priceDecimals = getValidSpotPriceDecimals(
      markPx,
      spotUniverse.baseSzDecimals ?? 2,
    );
    const change24hPercent =
      prevDayPx > 0 ? ((markPxNum - prevDayPx) / prevDayPx) * 100 : 0;
    const change24h =
      prevDayPx > 0
        ? formatWithPrecision(markPxNum - prevDayPx, priceDecimals)
        : '0';
    const displayMarkPrice = formatSpotPriceToValid(
      markPx,
      spotUniverse.baseSzDecimals ?? 2,
    );
    const localizedDisplayMarkPrice =
      formatLocalizedNumberString(displayMarkPrice);

    const handlePress = useMemo(
      () => () => onPress(spotUniverse.name),
      [onPress, spotUniverse.name],
    );
    const marketCapDisplay = useMemo(() => {
      if (markPxNum <= 0) {
        return undefined;
      }
      const marketCap = getSpotMarketCapValue(
        {
          markPx,
          circulatingSupply: ctx?.circulatingSupply,
        },
        spotUniverse.baseName,
        spotMarketCaps,
      );
      if (!marketCap) {
        return undefined;
      }
      const formatted = formatDisplayNumber(
        NUMBER_FORMATTER.marketCap(marketCap),
      );
      if (typeof formatted !== 'string' || formatted.length === 0) {
        return undefined;
      }
      return `$${formatted}`;
    }, [
      ctx?.circulatingSupply,
      markPx,
      markPxNum,
      spotMarketCaps,
      spotUniverse.baseName,
    ]);

    const contextValue: ITokenSelectorRowContextValue = useMemo(
      () => ({
        isSpot: true,
        desktopLayout,
        pairCoin: spotUniverse.name,
        token: {
          name: getSpotTokenDisplayName(spotUniverse.baseName),
          displayName: formatSpotPairDisplayName(
            spotUniverse.baseName,
            spotUniverse.quoteName,
          ),
          maxLeverage: 0,
          assetId: spotUniverse.assetId,
        },
        assetCtx: {
          markPrice: localizedDisplayMarkPrice,
          change24h,
          change24hPercent,
          fundingRate: '0',
          volume24h: ctx?.dayNtlVlm || '0',
          openInterest: '0',
          marketCap: marketCapDisplay,
        },
        isLoading: !ctx,
        onPress: handlePress,
      }),
      [
        spotUniverse,
        localizedDisplayMarkPrice,
        change24h,
        change24hPercent,
        ctx,
        marketCapDisplay,
        handlePress,
        desktopLayout,
      ],
    );

    return (
      <TokenSelectorRowProvider value={contextValue}>
        {isOnModal ? <TokenSelectorRowMobile /> : <TokenSelectorRowDesktop />}
      </TokenSelectorRowProvider>
    );
  },
);
SpotTokenSelectorRowInner.displayName = 'SpotTokenSelectorRowInner';

const PerpTokenSelectorRowPerps = memo(
  ({
    mockedToken,
    onPress,
    isOnModal,
    skipMarkRequired,
    desktopLayout,
  }: IPerpTokenSelectorRowProps) => {
    // Static token data is pre-computed in the parent list and passed via mockedToken.
    // This avoids subscribing to usePerpsAllAssetsFilteredAtom (150+ subscriptions).
    const tokenName = mockedToken.tokenName ?? '';
    const tokenAssetId = mockedToken.assetId ?? -1;
    const tokenMaxLeverage = mockedToken.tokenMaxLeverage ?? 0;

    const { assetCtx, isLoading } = usePerpsAssetCtx({
      assetId: tokenAssetId,
      skipMarkRequired,
    });

    const handlePress = useMemo(
      () => () => {
        onPress(tokenName);
      },
      [onPress, tokenName],
    );

    const parsed = useMemo(() => parseDexCoin(tokenName), [tokenName]);
    const subtitle = mockedToken.tokenSubtitle;

    const contextValue: ITokenSelectorRowContextValue = useMemo(
      () => ({
        desktopLayout,
        token: {
          name: tokenName,
          displayName: parsed.displayName,
          dexLabel: parsed.dexLabel,
          subtitle,
          maxLeverage: tokenMaxLeverage,
          assetId: tokenAssetId,
        },
        assetCtx: {
          markPrice: assetCtx?.markPrice ?? '0',
          change24h: assetCtx?.change24h ?? '0',
          change24hPercent: assetCtx?.change24hPercent ?? 0,
          fundingRate: assetCtx?.fundingRate ?? '0',
          volume24h: assetCtx?.volume24h ?? '0',
          openInterest: assetCtx?.openInterest ?? '0',
        },
        isLoading,
        onPress: handlePress,
      }),
      [
        tokenName,
        tokenMaxLeverage,
        tokenAssetId,
        parsed.displayName,
        parsed.dexLabel,
        subtitle,
        assetCtx,
        isLoading,
        handlePress,
        desktopLayout,
      ],
    );

    if (!tokenName || !assetCtx) {
      return null;
    }

    return (
      <TokenSelectorRowProvider value={contextValue}>
        {isOnModal ? <TokenSelectorRowMobile /> : <TokenSelectorRowDesktop />}
      </TokenSelectorRowProvider>
    );
  },
);
PerpTokenSelectorRowPerps.displayName = 'PerpTokenSelectorRowPerps';

const PerpTokenSelectorRow = memo(
  ({
    mockedToken,
    onPress,
    isOnModal,
    skipMarkRequired,
    desktopLayout,
  }: IPerpTokenSelectorRowProps) => {
    // Spot path: render from spotUniverse data
    if (mockedToken.spotUniverse) {
      return (
        <SpotTokenSelectorRowInner
          spotUniverse={mockedToken.spotUniverse}
          onPress={onPress}
          isOnModal={isOnModal}
          desktopLayout={desktopLayout}
        />
      );
    }

    // Perps path: existing logic
    return (
      <PerpTokenSelectorRowPerps
        mockedToken={mockedToken}
        onPress={onPress}
        isOnModal={isOnModal}
        skipMarkRequired={skipMarkRequired}
        desktopLayout={desktopLayout}
      />
    );
  },
);
PerpTokenSelectorRow.displayName = 'PerpTokenSelectorRow';

export { PerpTokenSelectorRow };
