import {
  type PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
} from 'react';

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
  usePerpsAllAssetsFilteredAtom,
  usePerpsTokenSearchAliasesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpTokenFavoritesPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getHyperliquidTokenImageUrl,
  getTokenSubtitle,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { usePerpsAssetCtx } from '../../hooks/usePerpsAssetCtx';

interface IPerpTokenSelectorRowProps {
  mockedToken: {
    index: number;
    dexIndex: number;
  };
  onPress: (name: string) => void;
  isOnModal?: boolean;
  skipMarkRequired?: boolean;
}

interface ITokenSelectorRowContextValue {
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
  }: {
    coin: string;
    isMobile?: boolean;
    iconSize?: string;
  }) => {
    const [favorites, setFavorites] = usePerpTokenFavoritesPersistAtom();
    const isFavorite = favorites.favorites.includes(coin);

    const handleToggle = useCallback(() => {
      setFavorites((prev) => {
        const alreadyFavorite = prev.favorites.includes(coin);
        void backgroundApiProxy.serviceMarketV2.syncToMarketWatchList({
          coin,
          action: alreadyFavorite ? 'remove' : 'add',
        });
        return {
          ...prev,
          favorites: alreadyFavorite
            ? prev.favorites.filter((f) => f !== coin)
            : [...prev.favorites, coin],
        };
      });
    }, [coin, setFavorites]);

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

// Desktop cell components
const TokenInfoCellDesktop = memo(() => {
  const { token } = useTokenSelectorRowContext();
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
          <FavoriteButton coin={token.name} />
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
              tokenImageUri={getHyperliquidTokenImageUrl(token.displayName)}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText size="$bodySmMedium" numberOfLines={1} flexShrink={1}>
              {token.displayName}
            </SizableText>
            <XStack gap="$1" minWidth={0}>
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
    [token.displayName, token.subtitle, token.maxLeverage, token.name, gtLg],
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
  const { onPress } = useTokenSelectorRowContext();

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
          <TokenFundingCellDesktop />
          <TokenVolumeCellDesktop />
          <TokenOpenInterestCellDesktop />
        </XStack>
      </DebugRenderTracker>
    ),
    [onPress],
  );
  return content;
});

TokenSelectorRowDesktop.displayName = 'TokenSelectorRowDesktop';

// Mobile cell components
const TokenImageMobile = memo(() => {
  const { token } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenImageMobile"
        offsetY={10}
      >
        <XStack gap="$2" alignItems="center">
          <FavoriteButton coin={token.name} isMobile />
          <Token
            size="lg"
            borderRadius="$full"
            tokenImageUri={getHyperliquidTokenImageUrl(token.displayName)}
            fallbackIcon="CryptoCoinOutline"
          />
        </XStack>
      </DebugRenderTracker>
    ),
    [token.displayName, token.name],
  );
  return content;
});

TokenImageMobile.displayName = 'TokenImageMobile';

const TokenNameMobile = memo(() => {
  const { token } = useTokenSelectorRowContext();

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
    [token.displayName, token.subtitle, token.maxLeverage],
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

const PerpTokenSelectorRow = memo(
  ({
    mockedToken,
    onPress,
    isOnModal,
    skipMarkRequired,
  }: IPerpTokenSelectorRowProps) => {
    const [filteredAssets] = usePerpsAllAssetsFilteredAtom();
    const [tokenSearchAliases] = usePerpsTokenSearchAliasesAtom();
    const tokensByDex = filteredAssets.assetsByDex || [];
    const assets: IPerpsUniverse[] = tokensByDex[mockedToken.dexIndex] || [];
    const token: IPerpsUniverse | undefined = assets[mockedToken.index];
    const tokenName = token?.name ?? '';
    const tokenAssetId = token?.assetId ?? -1;
    const tokenMaxLeverage = token?.maxLeverage ?? 0;

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
    const subtitle = useMemo(
      () => getTokenSubtitle(tokenName, tokenSearchAliases),
      [tokenName, tokenSearchAliases],
    );

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

    if (!token || token.isDelisted || !assetCtx) {
      return null;
    }

    return (
      <TokenSelectorRowProvider value={contextValue}>
        {isOnModal ? <TokenSelectorRowMobile /> : <TokenSelectorRowDesktop />}
      </TokenSelectorRowProvider>
    );
  },
);

PerpTokenSelectorRow.displayName = 'PerpTokenSelectorRow';

export { PerpTokenSelectorRow };
