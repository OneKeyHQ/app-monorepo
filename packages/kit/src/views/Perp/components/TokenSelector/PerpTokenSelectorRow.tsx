import { memo } from 'react';

import {
  Badge,
  DebugRenderTracker,
  NumberSizeableText,
  SizableText,
  SkeletonContainer,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { usePerpsAssetCtx } from '../../hooks/usePerpsAssetCtx';

interface IPerpTokenSelectorRowProps {
  token: IPerpsUniverse;
  onPress: () => void;
  isOnModal?: boolean;
}

const PerpTokenSelectorRow = memo(
  ({ token, onPress, isOnModal }: IPerpTokenSelectorRowProps) => {
    const themeVariant = useThemeVariant();
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
          timesBadgePosition="bottom-center"
          name="PerpTokenSelectorRow-Modal"
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
          >
            <XStack gap="$2" alignItems="center" justifyContent="center">
              <Token
                size="lg"
                borderRadius="$full"
                bg={themeVariant === 'light' ? undefined : '$bgInverse'}
                tokenImageUri={`https://app.hyperliquid.xyz/coins/${token.name}.svg`}
                fallbackIcon="CryptoCoinOutline"
              />
              <YStack gap="$1">
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
                <SkeletonContainer
                  isLoading={isLoading}
                  width="80%"
                  height={16}
                >
                  <SizableText size="$bodySm" color="$text">
                    $
                    {formatDisplayNumber(
                      NUMBER_FORMATTER.marketCap(assetCtx.volume24h),
                    )}
                  </SizableText>
                </SkeletonContainer>
              </YStack>
            </XStack>
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
        timesBadgePosition="bottom-center"
        name="PerpTokenSelectorRow-Popover"
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
          {/* Token Info */}
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
              tokenImageUri={`https://app.hyperliquid.xyz/coins/${token.name}.svg`}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText size="$bodySmMedium">{token.name}</SizableText>
            <Badge radius="$2" bg="$bgInfo" gap="$1">
              <SizableText color="$textInfo" size="$bodySm">
                {token.maxLeverage}x
              </SizableText>
            </Badge>
          </XStack>
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
