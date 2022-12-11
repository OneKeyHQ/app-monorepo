import React, { ComponentProps, FC } from 'react';

import { Box, Image, Text } from '@onekeyhq/components';

import { Provider } from '../../typings';

type SwappingViaProps = {
  providers?: Provider[];
  typography?: ComponentProps<typeof Text>['typography'];
  color?: ComponentProps<typeof Text>['color'];
  fontWeight?: ComponentProps<typeof Text>['fontWeight'];
};

type SwappingViaLogosProps = { sources?: string[]; size?: number };
export const SwappingViaLogos: FC<SwappingViaLogosProps> = ({
  sources,
  size,
}) => {
  const imageSize = size || 4;
  if (!sources || sources.length === 0) {
    return null;
  }
  if (sources.length === 1) {
    return (
      <Box
        borderRadius="full"
        w={imageSize}
        h={imageSize}
        overflow="hidden"
        key={sources[0]}
      >
        <Image size={imageSize} src={sources[0]} testID={sources[0]} />
      </Box>
    );
  }
  const calcMargin = (index: number, base: number): number => {
    if (index <= 0) {
      return 0;
    }
    return -(index * base) / 2;
  };
  return (
    <Box flexDirection="row" alignItems="center">
      {sources.map((source, index) => (
        <Box
          ml={calcMargin(index, imageSize / 4)}
          borderRadius="full"
          h={imageSize}
          w={imageSize}
          overflow="hidden"
          key={source}
        >
          <Image size={imageSize} src={source} />
        </Box>
      ))}
    </Box>
  );
};

const SwappingVia: FC<SwappingViaProps> = ({
  providers,
  typography = 'Caption',
  color = 'text-subdued',
  fontWeight = 400,
}) => {
  if (!providers) {
    return (
      <Text typography={typography} color={color}>
        OneKey Swap
      </Text>
    );
  }
  if (providers.length === 1) {
    return (
      <Box flexDirection="row" alignItems="center">
        {providers[0].logoUrl ? (
          <SwappingViaLogos sources={[providers[0].logoUrl]} />
        ) : null}
        <Text
          ml={2}
          typography={typography}
          color={color}
          fontWeight={fontWeight}
        >
          {providers[0].name}
        </Text>
      </Box>
    );
  }
  if (providers.length > 1) {
    const sources = providers.map((i) => i.logoUrl).filter(Boolean);
    return (
      <Box alignItems="center" flexDirection="row" alignContent="center">
        {sources.length > 0 ? <SwappingViaLogos sources={sources} /> : null}
        <Text
          ml={2}
          typography={typography}
          color={color}
          fontWeight={fontWeight}
        >
          {providers.length} Exchanges
        </Text>
      </Box>
    );
  }
  return (
    <Text typography={typography} color={color}>
      OneKey Swap
    </Text>
  );
};

export default SwappingVia;
