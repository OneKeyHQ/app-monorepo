import { memo } from 'react';

import {
  Badge,
  NumberSizeableText,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

interface IPerpTokenSelectorRowProps {
  token: {
    name: string;
    markPrice: string;
    change24h: string;
    change24hPercent: number;
    fundingRate: string;
    volume24h: string;
    openInterest: string;
    maxLeverage: number;
    isDelisted?: boolean;
  };
  onPress: () => void;
}

const PerpTokenSelectorRow = memo(
  ({ token, onPress }: IPerpTokenSelectorRowProps) => {
    const themeVariant = useThemeVariant();
    if (token.isDelisted) {
      return null;
    }

    return (
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
          <NumberSizeableText
            formatter="price"
            size="$bodySmMedium"
            color="$text"
          >
            {token.markPrice}
          </NumberSizeableText>
        </XStack>
        <XStack width={120} justifyContent="flex-start">
          <SizableText
            size="$bodySm"
            color={token.change24hPercent > 0 ? '$green11' : '$red11'}
          >
            <SizableText
              size="$bodySm"
              color={token.change24hPercent > 0 ? '$green11' : '$red11'}
            >
              {token.change24h}
            </SizableText>{' '}
            /{' '}
            <NumberSizeableText
              size="$bodySm"
              color={token.change24hPercent > 0 ? '$green11' : '$red11'}
              formatter="priceChange"
              formatterOptions={{ showPlusMinusSigns: true }}
            >
              {token.change24hPercent.toString()}
            </NumberSizeableText>
          </SizableText>
        </XStack>

        <XStack width={100} justifyContent="flex-start">
          <SizableText size="$bodySm" color="$text">
            {(Number(token.fundingRate) * 100).toFixed(4)}%
          </SizableText>
        </XStack>

        <XStack width={100} justifyContent="flex-start">
          <SizableText size="$bodySm" color="$text">
            ${formatDisplayNumber(NUMBER_FORMATTER.marketCap(token.volume24h))}
          </SizableText>
        </XStack>

        <XStack flex={1} justifyContent="flex-end">
          <SizableText size="$bodySm" color="$text">
            $
            {formatDisplayNumber(
              NUMBER_FORMATTER.marketCap(
                (
                  Number(token.openInterest) * Number(token.markPrice)
                ).toString(),
              ),
            )}
          </SizableText>
        </XStack>
      </XStack>
    );
  },
);

PerpTokenSelectorRow.displayName = 'PerpTokenSelectorRow';

export { PerpTokenSelectorRow };
