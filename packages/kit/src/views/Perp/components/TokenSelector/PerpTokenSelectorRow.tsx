import { memo } from 'react';

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

const TokenInfoDesktop = memo(
  ({ name, maxLeverage }: { name: string; maxLeverage: number }) => {
    const themeVariant = useThemeVariant();

    return (
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
          tokenImageUri={getHyperliquidTokenImageUrl(name)}
          fallbackIcon="CryptoCoinOutline"
        />
        <SizableText size="$bodySmMedium">{name}</SizableText>
        <Badge radius="$2" bg="$bgInfo" gap="$1">
          <SizableText color="$textInfo" size="$bodySm">
            {maxLeverage}x
          </SizableText>
        </Badge>
      </XStack>
    );
  },
);
TokenInfoDesktop.displayName = 'TokenInfoDesktop';

const TokenImageMobile = memo(({ name }: { name: string }) => {
  const themeVariant = useThemeVariant();

  return (
    <Token
      size="lg"
      borderRadius="$full"
      bg={themeVariant === 'light' ? undefined : '$bgInverse'}
      tokenImageUri={getHyperliquidTokenImageUrl(name)}
      fallbackIcon="CryptoCoinOutline"
    />
  );
});
TokenImageMobile.displayName = 'TokenImageMobile';

const TokenNameMobile = memo(
  ({ name, maxLeverage }: { name: string; maxLeverage: number }) => {
    return (
      <XStack gap="$1.5" alignItems="center" justifyContent="center">
        <SizableText size="$bodyMdMedium">{name}</SizableText>

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
            {maxLeverage}x
          </SizableText>
        </XStack>
      </XStack>
    );
  },
);
TokenNameMobile.displayName = 'TokenNameMobile';

const PerpTokenSelectorRow = memo(
  ({ mockedToken, onPress, isOnModal }: IPerpTokenSelectorRowProps) => {
    const [filteredAssets] = usePerpsAllAssetsFilteredAtom();
    const token = filteredAssets.assets[mockedToken.index];
    // const isLoading = true;
    const {
      assetCtx,
      isLoading,
      //
    } = usePerpsAssetCtx({
      assetId: token.assetId,
    });

    if (token.isDelisted || !assetCtx) {
      return null;
    }

    if (isOnModal) {
      return (
        <DebugRenderTracker
          position="bottom-center"
          name="PerpTokenSelectorRow-Modal"
        >
          <XStack
            px="$5"
            py="$2.5"
            flex={1}
            justifyContent="space-between"
            alignItems="center"
            onPress={() => onPress(token.name)}
            cursor="pointer"
            pressStyle={{
              bg: '$bgHover',
            }}
            gap="$4"
          >
            <TokenImageMobile name={token.name} />
            <XStack gap="$2" alignItems="center" justifyContent="center">
              <YStack gap="$1">
                <TokenNameMobile
                  name={token.name}
                  maxLeverage={token.maxLeverage}
                />
                <SkeletonContainer isLoading={isLoading} width={80} height={16}>
                  <SizableText size="$bodySm" color="$text">
                    $
                    {formatDisplayNumber(
                      NUMBER_FORMATTER.marketCap(assetCtx.volume24h),
                    )}
                  </SizableText>
                </SkeletonContainer>
              </YStack>
            </XStack>
            <Stack flex={1} />
            <YStack gap="$1" justifyContent="flex-end">
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
            </YStack>
          </XStack>
        </DebugRenderTracker>
      );
    }

    return (
      <DebugRenderTracker
        position="bottom-center"
        name="PerpTokenSelectorRow-Popover"
      >
        <XStack
          onPress={() => onPress(token.name)}
          borderRadius="$0"
          justifyContent="flex-start"
          hoverStyle={{ bg: '$bgHover' }}
          px="$5"
          py="$3"
          flex={1}
          cursor="pointer"
        >
          {/* Token Info */}
          <TokenInfoDesktop name={token.name} maxLeverage={token.maxLeverage} />
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
          <XStack width={100} justifyContent="flex-start">
            <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
              <SizableText size="$bodySm" color="$text">
                {(Number(assetCtx.fundingRate) * 100).toFixed(4)}%
              </SizableText>
            </SkeletonContainer>
          </XStack>
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
          <XStack flex={1} justifyContent="flex-end">
            <SkeletonContainer isLoading={isLoading} width="80%" height={16}>
              <SizableText size="$bodySm" color="$text">
                $
                {formatDisplayNumber(
                  NUMBER_FORMATTER.marketCap(
                    (
                      Number(assetCtx.openInterest) * Number(assetCtx.markPrice)
                    ).toString(),
                  ),
                )}
              </SizableText>
            </SkeletonContainer>
          </XStack>
        </XStack>
      </DebugRenderTracker>
    );
  },
);

PerpTokenSelectorRow.displayName = 'PerpTokenSelectorRow';

export { PerpTokenSelectorRow };
