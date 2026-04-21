import {
  type PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
} from 'react';

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
  usePerpTokenFavoritesPersistAtom,
  useSpotAssetCtxsMapAtom,
  useSpotTokenFavoritesPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatSpotPairDisplayName,
  getHyperliquidTokenImageUrl,
  getSpotTokenDisplayName,
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
}

interface ITokenSelectorRowContextValue {
  isSpot?: boolean;
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
    const isFavorite = isSpot
      ? spotFavs.favorites.includes(coin)
      : perpFavs.favorites.includes(coin);

    const handleToggle = useCallback(() => {
      const toggleFavorites = (prev: string[]) => {
        const removing = prev.includes(coin);
        return removing ? prev.filter((f) => f !== coin) : [...prev, coin];
      };
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
    }, [coin, isSpot, setPerpFavs, setSpotFavs]);

    return (
      <IconButton
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
  const { token, isSpot } = useTokenSelectorRowContext();
  const { gtLg } = useMedia();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenInfoCellDesktop"
        offsetY={10}
      >
        <XStack
          width={180}
          justifyContent="flex-start"
          gap="$1.5"
          alignItems="center"
          minWidth={0}
        >
          <FavoriteButton coin={token.name} isSpot={isSpot} />
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
    ],
  );
  return content;
});

TokenInfoCellDesktop.displayName = 'TokenInfoCellDesktop';

const TokenPriceCellDesktop = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenPriceCellDesktop"
        offsetY={10}
      >
        <XStack width={110} justifyContent="flex-start">
          <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
            <NumberSizeableText
              formatter="price"
              size="$bodySmMedium"
              color="$text"
            >
              {assetCtx.markPrice}
            </NumberSizeableText>
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [assetCtx.markPrice, isLoading],
  );
  return content;
});

TokenPriceCellDesktop.displayName = 'TokenPriceCellDesktop';

const Token24hChangeCellDesktop = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="Token24hChangeCellDesktop"
        offsetY={10}
      >
        <XStack width={150} justifyContent="flex-start">
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
    [assetCtx.change24h, assetCtx.change24hPercent, isLoading],
  );
  return content;
});

Token24hChangeCellDesktop.displayName = 'Token24hChangeCellDesktop';

const TokenFundingCellDesktop = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenFundingCellDesktop"
        offsetY={10}
      >
        <XStack width={110} justifyContent="flex-start">
          <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
            <SizableText size="$bodySm" color="$text">
              {(Number(assetCtx.fundingRate) * 100).toFixed(4)}%
            </SizableText>
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [assetCtx.fundingRate, isLoading],
  );
  return content;
});

TokenFundingCellDesktop.displayName = 'TokenFundingCellDesktop';

const TokenVolumeCellDesktop = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenVolumeCellDesktop"
        offsetY={10}
      >
        <XStack width={110} justifyContent="flex-start">
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
    [assetCtx.volume24h, isLoading],
  );
  return content;
});

TokenVolumeCellDesktop.displayName = 'TokenVolumeCellDesktop';

const TokenMarketCapCellDesktop = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <XStack width={200} justifyContent="flex-start">
        <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
          <SizableText size="$bodySm" color="$text">
            {assetCtx.marketCap ?? '--'}
          </SizableText>
        </SkeletonContainer>
      </XStack>
    ),
    [assetCtx.marketCap, isLoading],
  );
  return content;
});

TokenMarketCapCellDesktop.displayName = 'TokenMarketCapCellDesktop';

const TokenOpenInterestCellDesktop = memo(() => {
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

  const openInterestValue = useMemo(
    () =>
      formatDisplayNumber(
        NUMBER_FORMATTER.marketCap(
          (
            Number(assetCtx.openInterest) * Number(assetCtx.markPrice)
          ).toString(),
        ),
      ),
    [assetCtx.openInterest, assetCtx.markPrice],
  );

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenOpenInterestCellDesktop"
        offsetY={10}
      >
        <XStack width={120} justifyContent="flex-start">
          <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
            <SizableText size="$bodySm" color="$text">
              ${openInterestValue}
            </SizableText>
          </SkeletonContainer>
        </XStack>
      </DebugRenderTracker>
    ),
    [openInterestValue, isLoading],
  );
  return content;
});

TokenOpenInterestCellDesktop.displayName = 'TokenOpenInterestCellDesktop';

const TokenSelectorRowDesktop = memo(() => {
  const { onPress, isSpot } = useTokenSelectorRowContext();

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
          hoverStyle={{ bg: '$bgHover' }}
          px="$4"
          py="$3"
          flex={1}
          cursor="default"
        >
          <TokenInfoCellDesktop />
          <TokenPriceCellDesktop />
          <Token24hChangeCellDesktop />
          {isSpot ? null : (
            <>
              <TokenFundingCellDesktop />
              <TokenVolumeCellDesktop />
              <TokenOpenInterestCellDesktop />
            </>
          )}
          {isSpot ? (
            <>
              <TokenVolumeCellDesktop />
              <TokenMarketCapCellDesktop />
            </>
          ) : null}
        </XStack>
      </DebugRenderTracker>
    ),
    [onPress, isSpot],
  );
  return content;
});

TokenSelectorRowDesktop.displayName = 'TokenSelectorRowDesktop';

// Mobile cell components
const TokenImageMobile = memo(() => {
  const { token, isSpot } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenImageMobile"
        offsetY={10}
      >
        <XStack gap="$2" alignItems="center">
          <FavoriteButton coin={token.name} isMobile isSpot={isSpot} />
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
    [token.displayName, token.name, isSpot],
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
  const { assetCtx, isLoading } = useTokenSelectorRowContext();

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
          <NumberSizeableText
            formatter="price"
            size="$bodyMdMedium"
            color="$text"
            alignSelf="flex-end"
          >
            {assetCtx.markPrice}
          </NumberSizeableText>
        </SkeletonContainer>
      </DebugRenderTracker>
    ),
    [assetCtx.markPrice, isLoading],
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
  }: {
    spotUniverse: ISpotUniverse;
    onPress: (name: string) => void;
    isOnModal?: boolean;
  }) => {
    const [spotPriceMap] = useSpotAssetCtxsMapAtom();
    // Use pair name (@107 or PURR/USDC) as key — matches universe.name
    const ctx = spotPriceMap[spotUniverse.name];
    const markPx = ctx?.markPx || '0';
    const prevDayPx = Number(ctx?.prevDayPx || 0);
    const markPxNum = Number(markPx);
    const change24hPercent =
      prevDayPx > 0 ? ((markPxNum - prevDayPx) / prevDayPx) * 100 : 0;
    const change24h = prevDayPx > 0 ? (markPxNum - prevDayPx).toFixed(6) : '0';

    const handlePress = useMemo(
      () => () => onPress(spotUniverse.name),
      [onPress, spotUniverse.name],
    );

    const contextValue: ITokenSelectorRowContextValue = useMemo(
      () => ({
        isSpot: true,
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
          markPrice: markPx,
          change24h,
          change24hPercent,
          fundingRate: '0',
          volume24h: ctx?.dayNtlVlm || '0',
          openInterest: '0',
          marketCap:
            ctx?.circulatingSupply && markPxNum > 0
              ? `${Math.round(Number(ctx.circulatingSupply) * markPxNum).toLocaleString('en-US')} ${spotUniverse.quoteName}`
              : undefined,
        },
        isLoading: !ctx,
        onPress: handlePress,
      }),
      [
        spotUniverse,
        markPx,
        markPxNum,
        change24h,
        change24hPercent,
        ctx,
        handlePress,
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
  }: IPerpTokenSelectorRowProps) => {
    // Spot path: render from spotUniverse data
    if (mockedToken.spotUniverse) {
      return (
        <SpotTokenSelectorRowInner
          spotUniverse={mockedToken.spotUniverse}
          onPress={onPress}
          isOnModal={isOnModal}
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
      />
    );
  },
);
PerpTokenSelectorRow.displayName = 'PerpTokenSelectorRow';

export { PerpTokenSelectorRow };
