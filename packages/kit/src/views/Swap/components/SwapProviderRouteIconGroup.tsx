import { memo, useMemo } from 'react';

import {
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IQuoteRouteDataInfo } from '@onekeyhq/shared/types/swap/types';

type ISwapProviderRouteIconGroupProps = {
  routeInfos: IQuoteRouteDataInfo[];
} & Omit<React.ComponentProps<typeof YStack>, 'children'>;
const SwapProviderRouteIconGroup = ({
  routeInfos,
  ...props
}: ISwapProviderRouteIconGroupProps) => {
  const displayRoute = useMemo(() => {
    const firstIconLeftPosition = 1;
    return routeInfos
      .map((routeInfo, index) => {
        if (index > 2) return undefined;
        return {
          ...routeInfo,
          leftPosition:
            index === 0
              ? firstIconLeftPosition
              : firstIconLeftPosition + index * 4,
        };
      })
      .filter(Boolean);
  }, [routeInfos]);

  const containerWidth = useMemo(() => {
    if (routeInfos.length === 2) return '$12';
    if (routeInfos.length >= 3) return '$16';
    return '$8';
  }, [routeInfos.length]);

  return (
    <YStack
      alignItems="center"
      overflow="visible"
      {...props}
      w={containerWidth}
      h="$14"
    >
      <XStack w={containerWidth} h="$8">
        {displayRoute.map((routeInfo, index) => (
          <XStack
            key={index}
            position="absolute"
            left={`$${routeInfo.leftPosition}`}
            borderRadius="$full"
          >
            <Image width="$6" height="$6" borderRadius="$full">
              <Image.Source source={{ uri: routeInfo.logo }} />
              <Image.Fallback bg="$bgStrong" delayMs={1000}>
                <Icon size="$6" name="CoinOutline" color="$iconDisabled" />
              </Image.Fallback>
            </Image>
          </XStack>
        ))}
      </XStack>
      <Stack
        position="absolute"
        top="$8"
        left="$0"
        right="$0"
        alignItems="center"
      >
        <SizableText
          maxWidth="none"
          width="auto"
          whiteSpace="nowrap"
          textAlign="center"
          size="$bodySmMedium"
          color="$textSubdued"
        >
          {routeInfos.length === 1 ? routeInfos[0].name : 'Protocols'}
        </SizableText>
      </Stack>
    </YStack>
  );
};

export default memo(SwapProviderRouteIconGroup);
