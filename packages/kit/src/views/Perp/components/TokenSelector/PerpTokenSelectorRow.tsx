import {
  type PropsWithChildren,
  createContext,
  memo,
  useContext,
  useMemo,
} from 'react';

import {
  Badge,
  DebugRenderTracker,
  NumberSizeableText,
  SizableText,
  SkeletonContainer,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { usePerpsAllAssetsFilteredAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsAssetCtx } from '../../hooks/usePerpsAssetCtx';

interface IPerpTokenSelectorRowProps {
  mockedToken: {
    index: number;
  };
  onPress: (name: string) => void;
  isOnModal?: boolean;
}

interface ITokenSelectorRowContextValue {
  token: {
    name: string;
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

// Desktop cell components
const TokenInfoCellDesktop = memo(() => {
  const themeVariant = useThemeVariant();
  const { token } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenInfoCellDesktop"
        offsetY={10}
      >
        <XStack
          width={150}
          justifyContent="flex-start"
          gap="$2"
          alignItems="center"
        >
          <Token
            size="xs"
            borderRadius="$full"
            bg={themeVariant === 'light' ? undefined : '$bgInverse'}
            tokenImageUri={getHyperliquidTokenImageUrl(token.name)}
            fallbackIcon="CryptoCoinOutline"
          />
          <SizableText size="$bodySmMedium">{token.name}</SizableText>
          <Badge radius="$2" bg="$bgInfo" gap="$1">
            <SizableText color="$textInfo" size="$bodySm">
              {token.maxLeverage}x
            </SizableText>
          </Badge>
        </XStack>
      </DebugRenderTracker>
    ),
    [token.name, token.maxLeverage, themeVariant],
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
        <XStack width={100} justifyContent="flex-start">
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
        <XStack width={120} justifyContent="flex-start">
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
        <XStack width={100} justifyContent="flex-start">
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
        <XStack width={100} justifyContent="flex-start">
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
        <XStack flex={1} justifyContent="flex-start">
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
          px="$5"
          py="$3"
          flex={1}
          cursor="pointer"
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
  const themeVariant = useThemeVariant();
  const { token } = useTokenSelectorRowContext();

  const content = useMemo(
    () => (
      <DebugRenderTracker
        position="bottom-right"
        name="TokenImageMobile"
        offsetY={10}
      >
        <Token
          size="lg"
          borderRadius="$full"
          bg={themeVariant === 'light' ? undefined : '$bgInverse'}
          tokenImageUri={getHyperliquidTokenImageUrl(token.name)}
          fallbackIcon="CryptoCoinOutline"
        />
      </DebugRenderTracker>
    ),
    [token.name, themeVariant],
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
        <XStack gap="$1.5" alignItems="center" justifyContent="center">
          <SizableText size="$bodyMdMedium">{token.name}</SizableText>

          <XStack
            borderRadius="$1"
            bg="$bgInfo"
            justifyContent="center"
            alignItems="center"
            px="$1.5"
          >
            <SizableText
              fontSize={10}
              alignSelf="center"
              color="$textInfo"
              lineHeight={16}
            >
              {token.maxLeverage}x
            </SizableText>
          </XStack>
        </XStack>
      </DebugRenderTracker>
    ),
    [token.name, token.maxLeverage],
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
          cursor="pointer"
          pressStyle={{
            bg: '$bgHover',
          }}
          gap="$4"
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
  ({ mockedToken, onPress, isOnModal }: IPerpTokenSelectorRowProps) => {
    const [filteredAssets] = usePerpsAllAssetsFilteredAtom();
    const token = filteredAssets.assets[mockedToken.index];

    const { assetCtx, isLoading } = usePerpsAssetCtx({
      assetId: token?.assetId,
    });

    const handlePress = useMemo(
      () => () => {
        onPress(token.name);
      },
      [onPress, token.name],
    );

    const contextValue: ITokenSelectorRowContextValue = useMemo(
      () => ({
        token: {
          name: token.name,
          maxLeverage: token.maxLeverage,
          assetId: token.assetId,
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
        token.name,
        token.maxLeverage,
        token.assetId,
        assetCtx,
        isLoading,
        handlePress,
      ],
    );

    if (token.isDelisted || !assetCtx) {
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
